# Project Memory

## What is This?

Project Memory is a system for making every coding session, decision, and commit searchable and explainable with citations. No more "why did we do this?" or "what changed here?" Every vibe-coding session is traceable.

## Why Capture Sessions + Decisions?

- Find context for any line of code
- Understand decisions made months ago
- Onboard new developers faster
- Justify technical choices with evidence
- Link commits to their reasoning

## Session ID Format

Every coding session gets a unique ID:

```
S-YYYY-MM-DD-HHMM-<slug>
```

Example: `S-2026-02-08-1430-mobile-audio`

Rules:
- One Session ID per vibe-coding session
- Every commit message must include: `[SessionID] description`
- Session IDs link commits, PRs, and ADRs together

## How It Links Together

```
Session → Commits → PRs → ADRs
```

1. Start a session, create a session doc
2. Make commits with `[SessionID]` prefix
3. Create PR, reference Session ID
4. If you made a significant decision, write an ADR
5. Link them all together in the docs

## How to Create a New Session

1. Copy `sessions/_template.md`
2. Name it with Session ID: `S-2026-02-08-1430-my-feature.md`
3. Fill in Goal, Context, Plan
4. Work and make commits with `[S-2026-02-08-1430-my-feature]` prefix
5. Update session doc with Changes Made, Decisions, Links

## When to Create an ADR

Create an Architecture Decision Record when you:
- Choose between significant technical approaches
- Establish patterns that other code will follow
- Make decisions with long-term consequences
- Need to document "why we did it this way"

Not every session needs an ADR. ADRs are for decisions that matter across the codebase.

## Directory Structure

- `sessions/` - Individual coding session logs
- `adr/` - Architecture Decision Records
- `runbooks/` - Operational procedures
- `architecture/` - System design docs and diagrams
