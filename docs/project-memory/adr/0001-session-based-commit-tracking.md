# ADR-0001: Session-Based Commit Tracking

Status: Accepted
Date: 2026-02-08

## Context

When vibe-coding, context gets lost. Looking at git log weeks later, it's unclear:
- Why a change was made
- What problem it solved
- What alternatives were considered
- What session it belonged to

Need a lightweight way to link commits to their reasoning without heavyweight tools.

## Decision

Every coding session gets a Session ID: `S-YYYY-MM-DD-HHMM-<slug>`

Every commit message must include the Session ID: `[SessionID] description`

Every session creates a markdown file in `docs/project-memory/sessions/` that documents:
- Goal
- Context
- Changes made
- Decisions made
- Links to commits, PRs, ADRs

## Consequences

### Positive
- Git log becomes searchable by session
- Can trace any commit back to its context
- Searchable with standard grep/git tools
- No external dependencies
- Works offline
- PRs automatically have context via Session ID

### Negative
- Requires discipline to create session docs
- Commit messages slightly longer
- One more file to update during sessions

### Neutral
- Session docs live in the repo
- Uses standard markdown

## Evidence

Git log examples:
```
[S-2026-02-08-1400-bootstrap-memory] Create project memory system
[S-2026-02-08-1400-bootstrap-memory] Add session and ADR templates
```

Searching:
```bash
git log --all --grep="S-2026-02-08-1400-bootstrap-memory"
grep -r "S-2026-02-08-1400-bootstrap-memory" docs/project-memory/
```

## Links

Sessions:
- S-2026-02-08-1400-bootstrap-memory

PRs:
- (Will be linked when PR created)

Commits:
- (Will be linked after commits made)
