# Semantic Search for Project Memory

## Why Semantic Search?

Keyword search misses related concepts:
- Search "auth" → misses sessions that say "login" or "JWT"
- Search "performance" → misses "optimization" or "speed"
- Search "audio bugs" → misses "speech clipping" or "silence detection issues"

## How It Works

Claude reads all session/ADR files and uses AI understanding to find **concepts**, not just keywords.

### Example: "Show me audio problems"

**Traditional keyword search:**
```bash
grep -r "audio.*problem" docs/project-memory/
# Result: 0 matches
```

**Semantic search (Claude):**
```bash
# Claude reads ALL sessions
grep -r "" docs/project-memory/sessions/S-*.md

# Claude finds:
✅ S-2026-02-08-1400-listener-ui-mute
   - Mentions: "audio mute", "echo cancellation", "volume"
   - Relevance: Audio functionality work

✅ S-2026-02-08-1500-fix-silence-counter
   - Mentions: "speech clipping", "silence detection", "turn-end"
   - Relevance: Audio input bug fix (speech capture problem)
```

Claude understands:
- "speech clipping" = audio problem
- "echo cancellation" = audio processing
- "silence detection" = audio feature
- "mute toggle" = audio control

## Solutions for Semantic Search

### Quick Implementation (No External Tools)

Create a search script that uses Claude to understand queries:

```bash
#!/bin/bash
# search-memory.sh - Semantic search using Claude

QUERY="$1"

# Read all session docs and ADRs
SESSIONS=$(cat docs/project-memory/sessions/S-*.md)
ADRS=$(cat docs/project-memory/adr/*.md)

# Ask Claude to find relevant content
claude-code ask "
Given this query: '$QUERY'

Find all relevant sessions and ADRs from this content:

$SESSIONS
$ADRS

Return:
1. Matching sessions with Session IDs
2. Matching ADRs with numbers
3. Why they match (even if keywords differ)
4. Relevance score (1-10)
"
```

### Advanced Implementation (With Embeddings)

Build a local embedding index:

```typescript
// semantic-search.ts
import { embed } from '@anthropic-ai/sdk';

interface SearchResult {
  sessionId: string;
  content: string;
  relevance: number;
  reason: string;
}

async function semanticSearch(query: string): Promise<SearchResult[]> {
  // 1. Embed the query
  const queryEmbedding = await embed(query);

  // 2. Load cached embeddings of all sessions/ADRs
  const index = await loadEmbeddingIndex();

  // 3. Find nearest neighbors
  const results = index.search(queryEmbedding, k=10);

  // 4. Return with context
  return results.map(r => ({
    sessionId: r.metadata.sessionId,
    content: r.text,
    relevance: r.score,
    reason: explainMatch(query, r.text)
  }));
}
```

### Incremental Solution (Add to CLAUDE.md)

Let Claude do semantic search on demand:

When searching, Claude should:
1. Read all session/ADR files
2. Use its own understanding to find matches
3. Explain why results match (even without keywords)

Example:
```
User: "Show me anything about mobile support"

Claude searches:
- Reads all sessions
- Finds S-2026-02-08-1430-migrate-project-memory
- Matches because it mentions "iPhone" and "responsive"
- Returns with explanation: "Found because session discusses
  iPhone Chrome optimizations, which relates to mobile support"
```

## Recommendation

**Start Simple:** Add semantic search instructions to CLAUDE.md

**Later:** Build embedding index if the repo grows large

## Benefits

✅ Find concepts, not just keywords
✅ Understand "authentication" = "login" = "JWT" = "auth"
✅ Cross-reference related topics
✅ Better onboarding for new developers
✅ Discover connections you forgot about
