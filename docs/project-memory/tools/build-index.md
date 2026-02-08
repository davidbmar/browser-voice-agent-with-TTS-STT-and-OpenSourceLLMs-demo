# Building a Searchable Index

## Why Index?

Currently, semantic search reads ALL files on every query. This doesn't scale.

**Current (no index):**
- Read 100 files = 100KB per search
- 1000 sessions = 1MB per search ❌
- Slow, wasteful, doesn't scale

**With index:**
- Read pre-computed embeddings
- Fast vector similarity search
- Incremental updates
- Cross-repo search

---

## Option 1: Embedding Index (Recommended)

Use vector embeddings for true semantic search.

### Architecture

```
docs/project-memory/
  sessions/
    S-2026-02-08-1430-feature.md
  .index/
    embeddings.json        # Vector embeddings of all sessions
    metadata.json          # Session metadata (date, author, links)
    last-updated.txt       # Timestamp of last index build
```

### Implementation

```typescript
// build-index.ts
import { embed } from '@anthropic-ai/sdk';
import { glob } from 'glob';
import fs from 'fs';

interface IndexEntry {
  sessionId: string;
  file: string;
  embedding: number[];  // 1536-dim vector
  content: string;
  metadata: {
    date: string;
    author: string;
    goal: string;
  };
}

async function buildIndex() {
  const sessions = glob.sync('docs/project-memory/sessions/S-*.md');
  const index: IndexEntry[] = [];

  for (const file of sessions) {
    const content = fs.readFileSync(file, 'utf-8');

    // Extract metadata
    const sessionId = content.match(/Session-ID: (S-[\w-]+)/)?.[1];
    const date = content.match(/Date: ([\d-]+)/)?.[1];
    const author = content.match(/Author: (.+)/)?.[1];
    const goal = content.match(/## Goal\n\n(.+)/)?.[1];

    // Generate embedding (1536-dim vector)
    const embedding = await embed(content);

    index.push({
      sessionId,
      file,
      embedding,
      content: content.slice(0, 1000), // Store preview
      metadata: { date, author, goal }
    });
  }

  // Save index
  fs.writeFileSync(
    'docs/project-memory/.index/embeddings.json',
    JSON.stringify(index, null, 2)
  );
}
```

### Search with Index

```typescript
// search-index.ts
async function semanticSearch(query: string, k: number = 5) {
  // 1. Load index (once, cache in memory)
  const index = JSON.parse(
    fs.readFileSync('docs/project-memory/.index/embeddings.json', 'utf-8')
  );

  // 2. Embed query
  const queryEmbedding = await embed(query);

  // 3. Find nearest neighbors (cosine similarity)
  const results = index
    .map(entry => ({
      ...entry,
      score: cosineSimilarity(queryEmbedding, entry.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return results;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}
```

### Update Index Incrementally

```bash
#!/bin/bash
# update-index.sh

# Find sessions modified since last index update
LAST_UPDATE=$(cat docs/project-memory/.index/last-updated.txt)
NEW_SESSIONS=$(find docs/project-memory/sessions -name "S-*.md" -newer "$LAST_UPDATE")

if [ -n "$NEW_SESSIONS" ]; then
  echo "Updating index with new sessions..."
  node build-index.ts --incremental
  date > docs/project-memory/.index/last-updated.txt
else
  echo "Index is up to date"
fi
```

---

## Option 2: Simple Keyword Index (Fast & Lightweight)

Build a JSON index mapping keywords → sessions:

```typescript
// keyword-index.json
{
  "audio": ["S-2026-02-08-1400-listener-ui-mute", "S-2026-02-08-1500-fix-silence-counter"],
  "testing": ["S-2026-02-08-1400-listener-ui-mute"],
  "bug": ["S-2026-02-08-1500-fix-silence-counter"],
  "ui": ["S-2026-02-08-1400-listener-ui-mute"],
  "mute": ["S-2026-02-08-1400-listener-ui-mute"],
  "speech": ["S-2026-02-08-1500-fix-silence-counter"],
  "clipping": ["S-2026-02-08-1500-fix-silence-counter"]
}
```

**Pros:**
- ✅ Fast (no embedding API calls)
- ✅ Small file size
- ✅ Works offline
- ✅ Easy to understand

**Cons:**
- ❌ Not truly semantic (just keywords)
- ❌ Requires manual keyword extraction

---

## Option 3: SQLite Database

Store all sessions in a searchable database:

```sql
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  date TEXT,
  author TEXT,
  goal TEXT,
  context TEXT,
  changes_made TEXT,
  decisions_made TEXT,
  content TEXT,
  file_path TEXT
);

CREATE VIRTUAL TABLE sessions_fts USING fts5(
  session_id,
  content,
  content=sessions
);

-- Search
SELECT * FROM sessions_fts WHERE sessions_fts MATCH 'audio AND mute';
```

**Pros:**
- ✅ Fast full-text search
- ✅ Structured queries
- ✅ Works offline
- ✅ Standard SQL

**Cons:**
- ❌ Not semantic (keyword-based)
- ❌ Requires SQLite

---

## Recommendation

### Start: Simple Keyword Index
- Build JSON index with common keywords
- Fast, lightweight, no dependencies
- Good enough for < 500 sessions

### Scale: Embedding Index
- Add vector embeddings when > 500 sessions
- True semantic search
- Can use local models (sentence-transformers)

### Git Hook Integration

```bash
# .git/hooks/post-commit
#!/bin/bash
# Auto-update index after commit

if git diff-tree --name-only HEAD | grep -q "docs/project-memory/sessions"; then
  echo "Updating Project Memory index..."
  npm run build-index
fi
```

---

## Next Steps

1. Choose indexing approach
2. Create `build-index.ts` script
3. Add to npm scripts: `npm run build-index`
4. Add git hook to auto-update index
5. Update CLAUDE.md to use index instead of grep

Would you like me to implement one of these?
