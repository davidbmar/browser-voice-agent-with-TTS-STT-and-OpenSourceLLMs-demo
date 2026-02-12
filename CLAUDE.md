# Claude Instructions

## Project Memory System

This repo uses a **Traceable Project Memory** system. Every coding session, commit, and decision must be documented and searchable.

### You MUST Follow These Rules

#### 1. Session ID Format

Every coding session gets a unique Session ID:
```
S-YYYY-MM-DD-HHMM-<slug>
```

**HHMM is UTC** — always use `date -u +%Y-%m-%d-%H%M` to generate the timestamp.

Example: `S-2026-02-08-1430-mobile-audio`

#### 2. Commit Message Format

Write a **human-readable subject line**. Put the Session ID in the commit body:
```
Subject line describing the change

Session: S-YYYY-MM-DD-HHMM-slug
```

Example:
```
Add microphone permission check

Session: S-2026-02-08-1430-mobile-audio
```

#### 3. Session Documentation

When starting work:

1. **Check if a session exists** for this work:
   ```bash
   ls docs/project-memory/sessions/
   ```

2. **If no session exists, create one:**
   - Copy `docs/project-memory/sessions/_template.md`
   - Name it with the Session ID: `S-YYYY-MM-DD-HHMM-slug.md`
   - Fill in Title, Goal, Context, Plan

3. **After making changes, update the session doc:**
   - Add what changed to "Changes Made"
   - Document decisions in "Decisions Made"
   - Link commits after you create them

#### 4. When to Create an ADR

Create an ADR in `docs/project-memory/adr/` when:
- Making significant architectural decisions
- Choosing between technical approaches
- Establishing patterns that will be followed
- Making decisions with long-term consequences

Use the ADR template: `docs/project-memory/adr/_template.md`

#### 5. Searching Project Memory

To find context for code:

**Search commits by Session ID:**
```bash
git log --all --grep="S-2026-02-08-1430-mobile-audio"
```

**Search session docs:**
```bash
grep -r "keyword" docs/project-memory/sessions/
```

**Search ADRs:**
```bash
grep -r "decision topic" docs/project-memory/adr/
```

**Find sessions by date:**
```bash
ls docs/project-memory/sessions/S-2026-02-08*
```

**Use the keyword index (FAST):**
```bash
# Search by keyword (instant lookup)
cat docs/project-memory/.index/keywords.json | jq '.audio'
# Returns: ["S-2026-02-08-1400-listener-ui-mute"]

# Get session metadata
cat docs/project-memory/.index/metadata.json | jq '.[] | select(.sessionId == "S-2026-02-08-1400-listener-ui-mute")'
```

**Rebuild index:**
```bash
npm run build-index
```

#### 6. Semantic Search (AI-Powered)

When users ask questions using **concepts** rather than exact keywords, you must do semantic search:

**User asks:** "Show me anything about mobile support"

**You should:**
1. Use Grep to read ALL session docs: `grep -r "" docs/project-memory/sessions/S-*.md`
2. Use Grep to read ALL ADRs: `grep -r "" docs/project-memory/adr/*.md`
3. Analyze content using your understanding to find matches
4. Match related concepts:
   - "mobile" → iPhone, responsive, viewport, touch, iOS
   - "authentication" → login, JWT, OAuth, auth, credentials
   - "performance" → optimization, speed, latency, memory
5. Return results with **explanation** of why they match

**Example:**

User: "What did we do about mobile?"

```bash
# 1. Read all sessions
grep -r "" docs/project-memory/sessions/S-*.md

# 2. Find S-2026-02-08-1430-migrate-project-memory
# 3. Notice it mentions "iPhone Chrome" and "responsive"
# 4. Return: "Found session S-2026-02-08-1430 because it discusses
#    iPhone Chrome optimizations and responsive design, which
#    relates to mobile support"
```

**Semantic search rules:**
- Always explain WHY results match (don't just keyword match)
- Find synonyms and related concepts
- Cross-reference between sessions, ADRs, and commits
- If no exact keyword matches, read files and understand semantically

### Your Workflow

1. **Start of work:** Create or identify Session ID (HHMM is UTC)
2. **Create session doc:** Use template, fill in Title/Goal/Context/Plan
3. **Make changes:** Write code
4. **Commit:** Human-readable subject, `Session: S-...` in body
5. **Update session doc:** Add Changes Made, Decisions, Links
6. **Create ADR if needed:** For significant decisions
7. **Create PR:** Reference Session ID, link to session doc

### Example Workflow

```bash
# Starting work (HHMM is UTC)
# Session ID: S-2026-02-08-1645-auth-refactor

# Create session doc
cp docs/project-memory/sessions/_template.md \
   docs/project-memory/sessions/S-2026-02-08-1645-auth-refactor.md

# Make changes...
# Commit with human-readable subject, Session ID in body
git commit -m "Extract auth logic to service

Session: S-2026-02-08-1645-auth-refactor"

# Update session doc with changes and link to commit
# Create ADR if you made a significant decision
# Create PR with Session ID
```

### Quick Reference

- **Session template:** `docs/project-memory/sessions/_template.md`
- **ADR template:** `docs/project-memory/adr/_template.md`
- **PR template:** `.github/PULL_REQUEST_TEMPLATE.md`
- **Overview:** `docs/project-memory/index.md`

## Always Enforce

- ✅ Session ID times are UTC (`date -u`)
- ✅ Every commit has `Session: S-...` in the body
- ✅ Every session has a markdown doc with a Title field
- ✅ Significant decisions get ADRs
- ✅ PRs reference Session IDs
- ✅ Session docs link to commits, PRs, ADRs
