#!/usr/bin/env bash
#
# deploy.sh — Build and deploy the Bug Loop Voice Agent to AWS S3 + CloudFront.
#
# Prerequisites:
#   - AWS CLI v2 configured with appropriate credentials
#   - jq (for JSON parsing)
#
# Usage:
#   ./deploy.sh                  # Deploy to default bucket
#   ./deploy.sh my-bucket-name   # Deploy to specific bucket
#   ./deploy.sh --setup          # Create S3 bucket + CloudFront distribution
#
# The app requires these response headers for WebGPU (SharedArrayBuffer):
#   Cross-Origin-Embedder-Policy: require-corp
#   Cross-Origin-Opener-Policy: same-origin
#
# S3 static hosting alone can't set these headers, so we use CloudFront
# with a response headers policy.

set -euo pipefail

# --- Configuration ---
DEFAULT_BUCKET="bug-loop-voice-agent"
REGION="${AWS_REGION:-us-east-1}"

# Parse --setup flag vs bucket name
SETUP_MODE=false
BUCKET="$DEFAULT_BUCKET"
for arg in "$@"; do
  case "$arg" in
    --setup) SETUP_MODE=true ;;
    *) BUCKET="$arg" ;;
  esac
done
DIST_DIR="dist"
HEADERS_POLICY_NAME="bug-loop-coep-coop"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[error]${NC} $*" >&2; }

# --- Preflight checks ---
check_prerequisites() {
  local missing=0

  if ! command -v aws &>/dev/null; then
    err "AWS CLI not found. Install: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    missing=1
  fi

  if ! command -v jq &>/dev/null; then
    err "jq not found. Install: brew install jq (macOS) or apt install jq (Linux)"
    missing=1
  fi

  if ! command -v npm &>/dev/null; then
    err "npm not found. Install Node.js 18+."
    missing=1
  fi

  if ! aws sts get-caller-identity &>/dev/null; then
    err "AWS credentials not configured. Run: aws configure"
    missing=1
  fi

  if [ $missing -ne 0 ]; then
    exit 1
  fi

  log "Prerequisites OK (AWS CLI, jq, npm, credentials)"
}

# --- Build ---
build_app() {
  log "Building production bundle..."
  npm run build

  if [ ! -d "$DIST_DIR" ]; then
    err "Build failed — $DIST_DIR not found"
    exit 1
  fi

  local size
  size=$(du -sh "$DIST_DIR" | cut -f1)
  log "Build complete: $DIST_DIR ($size)"
}

# --- Setup: Create S3 bucket + CloudFront ---
setup_infrastructure() {
  log "Setting up S3 bucket: $BUCKET (region: $REGION)"

  # Create bucket
  if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
    log "Bucket $BUCKET already exists"
  else
    if [ "$REGION" = "us-east-1" ]; then
      aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
    else
      aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
        --create-bucket-configuration LocationConstraint="$REGION"
    fi
    log "Created bucket: $BUCKET"
  fi

  # Enable static website hosting (fallback — CloudFront is primary)
  aws s3 website "s3://$BUCKET" --index-document index.html --error-document index.html
  log "Enabled S3 static website hosting"

  # Block public access (CloudFront will use OAC)
  aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
    'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
  log "Public access blocked (CloudFront OAC will be used)"

  # Create CloudFront response headers policy for COOP/COEP
  log "Creating CloudFront response headers policy..."
  local policy_id
  policy_id=$(aws cloudfront list-response-headers-policies --query \
    "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name=='$HEADERS_POLICY_NAME'].ResponseHeadersPolicy.Id" \
    --output text 2>/dev/null || true)

  if [ -n "$policy_id" ] && [ "$policy_id" != "None" ]; then
    log "Response headers policy already exists: $policy_id"
  else
    local policy_config
    policy_config=$(cat <<'POLICY'
{
  "Name": "bug-loop-coep-coop",
  "Comment": "COOP/COEP headers for WebGPU SharedArrayBuffer support",
  "CustomHeadersConfig": {
    "Quantity": 2,
    "Items": [
      {
        "Header": "Cross-Origin-Embedder-Policy",
        "Value": "require-corp",
        "Override": true
      },
      {
        "Header": "Cross-Origin-Opener-Policy",
        "Value": "same-origin",
        "Override": true
      }
    ]
  }
}
POLICY
)
    policy_id=$(aws cloudfront create-response-headers-policy \
      --response-headers-policy-config "$policy_config" \
      --query 'ResponseHeadersPolicy.Id' --output text)
    log "Created response headers policy: $policy_id"
  fi

  # Create Origin Access Control
  local oac_id
  oac_id=$(aws cloudfront list-origin-access-controls --query \
    "OriginAccessControlList.Items[?Name=='$BUCKET-oac'].Id" --output text 2>/dev/null || true)

  if [ -z "$oac_id" ] || [ "$oac_id" = "None" ]; then
    oac_id=$(aws cloudfront create-origin-access-control --origin-access-control-config \
      "{\"Name\":\"$BUCKET-oac\",\"OriginAccessControlOriginType\":\"s3\",\"SigningBehavior\":\"always\",\"SigningProtocol\":\"sigv4\"}" \
      --query 'OriginAccessControl.Id' --output text)
    log "Created OAC: $oac_id"
  else
    log "OAC already exists: $oac_id"
  fi

  # Create CloudFront distribution
  local existing_dist
  existing_dist=$(aws cloudfront list-distributions --query \
    "DistributionList.Items[?Origins.Items[0].DomainName=='$BUCKET.s3.$REGION.amazonaws.com'].Id" \
    --output text 2>/dev/null || true)

  if [ -n "$existing_dist" ] && [ "$existing_dist" != "None" ]; then
    log "CloudFront distribution already exists: $existing_dist"
    local domain
    domain=$(aws cloudfront get-distribution --id "$existing_dist" --query 'Distribution.DomainName' --output text)
    echo ""
    log "Site URL: ${CYAN}https://$domain${NC}"
  else
    local dist_config
    dist_config=$(cat <<DISTCONF
{
  "CallerReference": "bug-loop-$(date +%s)",
  "Comment": "Bug Loop Voice Agent",
  "DefaultCacheBehavior": {
    "TargetOriginId": "$BUCKET-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "ResponseHeadersPolicyId": "$policy_id",
    "Compress": true,
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    }
  },
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "$BUCKET-origin",
      "DomainName": "$BUCKET.s3.$REGION.amazonaws.com",
      "S3OriginConfig": { "OriginAccessIdentity": "" },
      "OriginAccessControlId": "$oac_id"
    }]
  },
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [{
      "ErrorCode": 403,
      "ResponsePagePath": "/index.html",
      "ResponseCode": "200",
      "ErrorCachingMinTTL": 10
    }]
  }
}
DISTCONF
)
    local dist_id
    dist_id=$(aws cloudfront create-distribution \
      --distribution-config "$dist_config" \
      --query 'Distribution.Id' --output text)

    local domain
    domain=$(aws cloudfront get-distribution --id "$dist_id" --query 'Distribution.DomainName' --output text)

    # Add bucket policy for CloudFront OAC
    local account_id
    account_id=$(aws sts get-caller-identity --query Account --output text)

    aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [{
        \"Sid\": \"AllowCloudFrontServicePrincipal\",
        \"Effect\": \"Allow\",
        \"Principal\": { \"Service\": \"cloudfront.amazonaws.com\" },
        \"Action\": \"s3:GetObject\",
        \"Resource\": \"arn:aws:s3:::$BUCKET/*\",
        \"Condition\": {
          \"StringEquals\": {
            \"AWS:SourceArn\": \"arn:aws:cloudfront::$account_id:distribution/$dist_id\"
          }
        }
      }]
    }"

    log "Created CloudFront distribution: $dist_id"
    echo ""
    log "Site URL: ${CYAN}https://$domain${NC}"
    warn "CloudFront deployment takes 5-10 minutes to propagate globally."
  fi
}

# --- Deploy: sync to S3 + invalidate CloudFront ---
deploy_to_s3() {
  log "Syncing $DIST_DIR/ to s3://$BUCKET/ ..."

  # Sync with appropriate cache headers
  # HTML: no-cache (always revalidate)
  aws s3 sync "$DIST_DIR/" "s3://$BUCKET/" \
    --delete \
    --exclude "*.html" \
    --cache-control "public,max-age=31536000,immutable"

  # HTML files: short cache
  aws s3 sync "$DIST_DIR/" "s3://$BUCKET/" \
    --exclude "*" \
    --include "*.html" \
    --cache-control "public,max-age=60,must-revalidate"

  log "S3 sync complete"

  # Invalidate CloudFront cache
  local dist_id
  dist_id=$(aws cloudfront list-distributions --query \
    "DistributionList.Items[?Origins.Items[0].DomainName=='$BUCKET.s3.$REGION.amazonaws.com'].Id" \
    --output text 2>/dev/null || true)

  if [ -n "$dist_id" ] && [ "$dist_id" != "None" ]; then
    log "Invalidating CloudFront cache ($dist_id)..."
    aws cloudfront create-invalidation --distribution-id "$dist_id" \
      --paths "/*" --query 'Invalidation.Id' --output text
    log "CloudFront invalidation started"

    local domain
    domain=$(aws cloudfront get-distribution --id "$dist_id" --query 'Distribution.DomainName' --output text)
    echo ""
    log "Deployed to: ${CYAN}https://$domain${NC}"
  else
    warn "No CloudFront distribution found for bucket $BUCKET."
    warn "Run: ./deploy.sh --setup  to create one."
    echo ""
    log "S3 website URL: ${CYAN}http://$BUCKET.s3-website-$REGION.amazonaws.com${NC}"
    warn "Note: S3 website hosting does NOT set COOP/COEP headers. WebGPU/LLM will not work without CloudFront."
  fi
}

# --- Main ---
main() {
  echo ""
  echo -e "${CYAN}Bug Loop Voice Agent — Deploy${NC}"
  echo ""

  check_prerequisites

  if [ "$SETUP_MODE" = true ]; then
    build_app
    setup_infrastructure
    deploy_to_s3
    echo ""
    log "Setup complete!"
  else
    build_app
    deploy_to_s3
  fi

  echo ""
}

main "$@"
