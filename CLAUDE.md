# Claude Instructions

## Project Memory System

This repo uses a **Traceable Project Memory** system. Every coding session, commit, and decision must be documented and searchable.

### You MUST Follow These Rules

#### 1. Session ID Format

Every coding session gets a unique Session ID:
```
S-YYYY-MM-DD-HHMM-<slug>
```

Example: `S-2026-02-08-1430-mobile-audio`

#### 2. Commit Message Format

Every commit message MUST include the Session ID:
```
[S-YYYY-MM-DD-HHMM-slug] description of change
```

Example:
```
[S-2026-02-08-1430-mobile-audio] Add microphone permission check
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
   - Fill in Goal, Context, Plan

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

### Your Workflow

1. **Start of work:** Create or identify Session ID
2. **Create session doc:** Use template, fill in Goal/Context/Plan
3. **Make changes:** Write code
4. **Commit with Session ID:** `[SessionID] description`
5. **Update session doc:** Add Changes Made, Decisions, Links
6. **Create ADR if needed:** For significant decisions
7. **Create PR:** Reference Session ID, link to session doc

### Example Workflow

```bash
# Starting work
# Session ID: S-2026-02-08-1645-auth-refactor

# Create session doc
cp docs/project-memory/sessions/_template.md \
   docs/project-memory/sessions/S-2026-02-08-1645-auth-refactor.md

# Make changes...
# Commit with Session ID
git commit -m "[S-2026-02-08-1645-auth-refactor] Extract auth logic to service"

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

- ✅ Every commit has `[SessionID]` prefix
- ✅ Every session has a markdown doc
- ✅ Significant decisions get ADRs
- ✅ PRs reference Session IDs
- ✅ Session docs link to commits, PRs, ADRs
