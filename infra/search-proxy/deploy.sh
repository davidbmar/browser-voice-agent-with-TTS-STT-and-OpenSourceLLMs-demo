#!/usr/bin/env bash
#
# deploy.sh — Deploy the search proxy Lambda + API Gateway + DynamoDB.
#
# Prerequisites:
#   - AWS CLI v2 configured with credentials that have Lambda, API Gateway, DynamoDB, IAM permissions
#   - Node.js 18+ and npm
#   - Search API keys (sign up at):
#       Google Custom Search: https://developers.google.com/custom-search/v1/overview
#       Brave Search:         https://brave.com/search/api/
#       Tavily:               https://tavily.com/
#
# Usage:
#   ./deploy.sh --setup          # Create all AWS resources from scratch
#   ./deploy.sh                  # Update Lambda code only
#   ./deploy.sh --keys           # Update environment variables only
#
# Environment variables (required for --setup and --keys):
#   GOOGLE_CSE_API_KEY  — Google Custom Search API key
#   GOOGLE_CSE_CX       — Google Custom Search engine ID
#   BRAVE_API_KEY        — Brave Search API key
#   TAVILY_API_KEY       — Tavily API key
#

set -euo pipefail

# --- Configuration ---
REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="bug-loop-search-proxy"
ROLE_NAME="bug-loop-search-proxy-role"
TABLE_NAME="search-proxy-quota"
API_NAME="bug-loop-search-api"
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-https://dmpt2ecfvyptf.cloudfront.net}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[search-proxy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[error]${NC} $*" >&2; }

# --- Parse args ---
MODE="update"
for arg in "$@"; do
  case "$arg" in
    --setup) MODE="setup" ;;
    --keys)  MODE="keys" ;;
  esac
done

# --- Build ---
build_lambda() {
  log "Installing dependencies..."
  cd "$SCRIPT_DIR"
  npm install --production

  log "Compiling TypeScript..."
  npx tsc

  log "Packaging Lambda..."
  cd dist
  cp -r ../node_modules .
  zip -rq ../search-proxy.zip .
  cd "$SCRIPT_DIR"

  local size
  size=$(du -sh search-proxy.zip | cut -f1)
  log "Package ready: search-proxy.zip ($size)"
}

# --- Environment variables JSON ---
get_env_vars() {
  cat <<EOF
{
  "Variables": {
    "GOOGLE_CSE_API_KEY": "${GOOGLE_CSE_API_KEY:-}",
    "GOOGLE_CSE_CX": "${GOOGLE_CSE_CX:-}",
    "BRAVE_API_KEY": "${BRAVE_API_KEY:-}",
    "TAVILY_API_KEY": "${TAVILY_API_KEY:-}",
    "ALLOWED_ORIGIN": "$ALLOWED_ORIGIN",
    "QUOTA_TABLE": "$TABLE_NAME"
  }
}
EOF
}

# --- Setup: create all resources ---
setup() {
  local account_id
  account_id=$(aws sts get-caller-identity --query Account --output text)
  log "Account: $account_id, Region: $REGION"

  # 1. DynamoDB table
  log "Creating DynamoDB table: $TABLE_NAME"
  if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" &>/dev/null; then
    log "Table already exists"
  else
    aws dynamodb create-table \
      --table-name "$TABLE_NAME" \
      --attribute-definitions AttributeName=pk,AttributeType=S \
      --key-schema AttributeName=pk,KeyType=HASH \
      --billing-mode PAY_PER_REQUEST \
      --region "$REGION" \
      --output text --query 'TableDescription.TableArn'
    log "Table created"
    aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$REGION"
  fi

  # 2. IAM role
  log "Creating IAM role: $ROLE_NAME"
  if aws iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
    log "Role already exists"
  else
    aws iam create-role \
      --role-name "$ROLE_NAME" \
      --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Principal": { "Service": "lambda.amazonaws.com" },
          "Action": "sts:AssumeRole"
        }]
      }' \
      --output text --query 'Role.Arn'

    aws iam attach-role-policy --role-name "$ROLE_NAME" \
      --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

    # DynamoDB access
    aws iam put-role-policy --role-name "$ROLE_NAME" \
      --policy-name "DynamoDBQuotaAccess" \
      --policy-document "{
        \"Version\": \"2012-10-17\",
        \"Statement\": [{
          \"Effect\": \"Allow\",
          \"Action\": [
            \"dynamodb:GetItem\",
            \"dynamodb:UpdateItem\"
          ],
          \"Resource\": \"arn:aws:dynamodb:$REGION:$account_id:table/$TABLE_NAME\"
        }]
      }"

    log "Role created with Lambda + DynamoDB permissions"
    # Wait for role propagation
    sleep 10
  fi

  local role_arn
  role_arn=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)

  # 3. Lambda function
  log "Creating Lambda function: $FUNCTION_NAME"
  if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
    log "Function already exists, updating code..."
    aws lambda update-function-code \
      --function-name "$FUNCTION_NAME" \
      --zip-file "fileb://$SCRIPT_DIR/search-proxy.zip" \
      --region "$REGION" \
      --output text --query 'FunctionArn'
  else
    aws lambda create-function \
      --function-name "$FUNCTION_NAME" \
      --runtime "nodejs20.x" \
      --handler "handler.handler" \
      --role "$role_arn" \
      --zip-file "fileb://$SCRIPT_DIR/search-proxy.zip" \
      --timeout 15 \
      --memory-size 256 \
      --environment "$(get_env_vars)" \
      --region "$REGION" \
      --output text --query 'FunctionArn'
    log "Lambda created"
  fi

  # Update env vars
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "$(get_env_vars)" \
    --region "$REGION" \
    --output text --query 'FunctionArn' >/dev/null
  log "Environment variables updated"

  # 4. API Gateway
  log "Creating API Gateway: $API_NAME"
  local api_id
  api_id=$(aws apigateway get-rest-apis --region "$REGION" --query \
    "items[?name=='$API_NAME'].id" --output text 2>/dev/null || true)

  if [ -n "$api_id" ] && [ "$api_id" != "None" ]; then
    log "API already exists: $api_id"
  else
    api_id=$(aws apigateway create-rest-api \
      --name "$API_NAME" \
      --description "Bug Loop search proxy" \
      --endpoint-configuration '{"types":["REGIONAL"]}' \
      --region "$REGION" \
      --query 'id' --output text)
    log "API created: $api_id"
  fi

  local root_id
  root_id=$(aws apigateway get-resources --rest-api-id "$api_id" --region "$REGION" \
    --query 'items[?path==`/`].id' --output text)

  # /search resource
  local search_id
  search_id=$(aws apigateway get-resources --rest-api-id "$api_id" --region "$REGION" \
    --query "items[?path=='/search'].id" --output text 2>/dev/null || true)

  if [ -z "$search_id" ] || [ "$search_id" = "None" ]; then
    search_id=$(aws apigateway create-resource \
      --rest-api-id "$api_id" \
      --parent-id "$root_id" \
      --path-part "search" \
      --region "$REGION" \
      --query 'id' --output text)
    log "Created /search resource"
  fi

  # /quota resource
  local quota_id
  quota_id=$(aws apigateway get-resources --rest-api-id "$api_id" --region "$REGION" \
    --query "items[?path=='/quota'].id" --output text 2>/dev/null || true)

  if [ -z "$quota_id" ] || [ "$quota_id" = "None" ]; then
    quota_id=$(aws apigateway create-resource \
      --rest-api-id "$api_id" \
      --parent-id "$root_id" \
      --path-part "quota" \
      --region "$REGION" \
      --query 'id' --output text)
    log "Created /quota resource"
  fi

  local lambda_arn
  lambda_arn=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" \
    --query 'Configuration.FunctionArn' --output text)
  local lambda_uri="arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$lambda_arn/invocations"

  # Helper: add method + integration
  add_method() {
    local resource_id="$1" method="$2"
    aws apigateway put-method \
      --rest-api-id "$api_id" \
      --resource-id "$resource_id" \
      --http-method "$method" \
      --authorization-type "NONE" \
      --region "$REGION" 2>/dev/null || true

    aws apigateway put-integration \
      --rest-api-id "$api_id" \
      --resource-id "$resource_id" \
      --http-method "$method" \
      --type "AWS_PROXY" \
      --integration-http-method "POST" \
      --uri "$lambda_uri" \
      --region "$REGION" 2>/dev/null || true
  }

  add_method "$search_id" "POST"
  add_method "$search_id" "OPTIONS"
  add_method "$quota_id" "GET"
  add_method "$quota_id" "OPTIONS"
  log "Methods configured"

  # Deploy API
  aws apigateway create-deployment \
    --rest-api-id "$api_id" \
    --stage-name "prod" \
    --region "$REGION" \
    --output text --query 'id' >/dev/null
  log "API deployed to prod stage"

  # Grant API Gateway permission to invoke Lambda
  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id "apigateway-invoke-$(date +%s)" \
    --action "lambda:InvokeFunction" \
    --principal "apigateway.amazonaws.com" \
    --source-arn "arn:aws:execute-api:$REGION:$account_id:$api_id/*" \
    --region "$REGION" 2>/dev/null || true

  local endpoint="https://$api_id.execute-api.$REGION.amazonaws.com/prod"
  echo ""
  log "Setup complete!"
  log "Endpoint: ${CYAN}$endpoint${NC}"
  echo ""
  log "Test with:"
  log "  curl -X POST $endpoint/search -H 'Content-Type: application/json' -d '{\"query\":\"weather in Austin\"}'"
  log "  curl $endpoint/quota"
  echo ""
  log "To use in the app, build with:"
  log "  SEARCH_PROXY_URL=$endpoint npm run build"
}

# --- Update: just redeploy code ---
update_code() {
  log "Updating Lambda code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$SCRIPT_DIR/search-proxy.zip" \
    --region "$REGION" \
    --output text --query 'FunctionArn'
  log "Lambda code updated"
}

# --- Keys: update env vars ---
update_keys() {
  log "Updating environment variables..."
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "$(get_env_vars)" \
    --region "$REGION" \
    --output text --query 'FunctionArn'
  log "Environment variables updated"
}

# --- Main ---
main() {
  echo ""
  echo -e "${CYAN}Bug Loop Search Proxy — Deploy${NC}"
  echo ""

  build_lambda

  case "$MODE" in
    setup)  setup ;;
    update) update_code ;;
    keys)   update_keys ;;
  esac

  echo ""
}

main "$@"
