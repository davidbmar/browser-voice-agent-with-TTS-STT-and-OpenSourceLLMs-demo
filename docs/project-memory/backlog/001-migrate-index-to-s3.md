# Backlog Item 001: Migrate Index to S3

**Status:** Future
**Priority:** Medium
**Estimated Effort:** 2-3 days
**Created:** 2026-02-08

## Problem

Currently the searchable index (`docs/project-memory/.index/`) is committed to git. This works for small repos but has limitations:

- **Bloats git history** - Index grows with repo size, increasing clone times
- **Merge conflicts** - Multiple people updating sessions causes index conflicts
- **Not suitable for orchestration** - Can't search across multiple repos efficiently
- **Rebuild overhead** - Must rebuild index and commit after every session

## Proposed Solution

Move the index to S3 for centralized storage and orchestration.

### Architecture

```
GitHub Actions (on push)
   ↓
Build index locally
   ↓
Upload to S3: s3://project-memory-indexes/{repo-name}/
   ↓
Claude/agents fetch from S3 (not git)
```

### S3 Structure

```
s3://project-memory-indexes/
  browser_question_loop/
    keywords.json
    metadata.json
    embeddings.json  (future: semantic search)
    last-updated.txt
  another-project/
    keywords.json
    metadata.json
    ...
```

### GitHub Actions Workflow

```yaml
name: Update Project Memory Index

on:
  push:
    paths:
      - 'docs/project-memory/sessions/**'
      - 'docs/project-memory/adr/**'

jobs:
  build-index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build-index
      - name: Upload to S3
        run: |
          aws s3 sync docs/project-memory/.index/ \
            s3://project-memory-indexes/${{ github.repository }}/
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### Claude Integration

Update CLAUDE.md to fetch from S3:

```markdown
#### 6. Using the Search Index (S3)

The search index is stored in S3, not git.

**Fetch index:**
```bash
aws s3 cp s3://project-memory-indexes/browser_question_loop/keywords.json .
cat keywords.json | jq '.audio'
```

**Or use API:**
```bash
curl https://api.projectmemory.dev/search?repo=browser_question_loop&q=audio
```
```

## Benefits

✅ **Git stays clean** - No index files bloating git history
✅ **No merge conflicts** - Index is external to git
✅ **Cross-repo search** - Can search multiple projects at once
✅ **Automatic updates** - GitHub Actions rebuilds on every push
✅ **Centralized** - Single source of truth for all project memory
✅ **Scalable** - Can add embeddings for semantic search later

## Requirements

### Infrastructure

- **S3 bucket**: `project-memory-indexes` (or similar)
- **IAM role**: GitHub Actions needs write access
- **CloudFront** (optional): CDN for faster index fetches
- **API Gateway** (optional): REST API for index queries

### Code Changes

- **CLAUDE.md**: Update to fetch from S3 instead of local files
- **GitHub Actions**: Add workflow for index updates
- **scripts/**: Add S3 upload logic to build-index.ts
- **docs/**: Update documentation with new search method

### Secrets

- `AWS_ACCESS_KEY_ID` - GitHub Actions secret
- `AWS_SECRET_ACCESS_KEY` - GitHub Actions secret
- `AWS_REGION` - us-east-1 (or your region)

## Implementation Plan

1. **Phase 1: S3 Setup**
   - Create S3 bucket
   - Configure IAM permissions
   - Test manual upload

2. **Phase 2: GitHub Actions**
   - Create workflow file
   - Test on push
   - Verify S3 upload works

3. **Phase 3: Claude Integration**
   - Update CLAUDE.md with S3 fetch instructions
   - Test search still works
   - Document new workflow

4. **Phase 4: Cleanup**
   - Remove index from git (.gitignore)
   - Update all documentation
   - Announce to team

## Alternative: API Approach

Instead of S3 direct access, create an API:

```
POST https://api.projectmemory.dev/search
{
  "repo": "browser_question_loop",
  "query": "audio problems",
  "semantic": true
}

Response:
{
  "results": [
    {
      "sessionId": "S-2026-02-08-1400-listener-ui-mute",
      "relevance": 0.92,
      "reason": "Mentions audio mute toggle and echo cancellation"
    }
  ]
}
```

Benefits:
- Can add semantic search without client changes
- Can aggregate across repos
- Can add authentication/rate limiting

## Related

- See `docs/project-memory/tools/semantic-search.md` for architecture options
- See `docs/project-memory/tools/build-index.md` for current implementation
- Consider adding vector embeddings when implementing (for semantic search)

## Notes

- Keep local index generation working (for offline use)
- S3 is primary, local is fallback
- Document both approaches in CLAUDE.md
