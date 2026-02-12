# Session

Session-ID: S-2026-02-11-0010-auto-index-hooks
Title: Integrate bash auto-index system with git hooks
Date: 2026-02-11
Author: dmar

## Goal

Integrate the bash-based auto-index system from the traceable-searchable-adr-memory-index template repo so the project memory index rebuilds automatically on every commit.

## Context

The project had TypeScript-based index scripts (`build-index.ts`, `search-memory.ts`) but no git hooks installed. The index was stale and had to be rebuilt manually. The changelog UI was reading from `.index/metadata.json` and `.index/keywords.json` but these weren't being kept up to date.

## Plan

1. Copy bash scripts (build-index.sh, setup-hooks.sh, test.sh) from template repo
2. Install pre-commit hook via setup-hooks.sh
3. Build initial index
4. Fix format mismatch — bash builder must produce the same JSON format as the TS builder (changelog UI depends on it)

## Changes Made

- Added `scripts/build-index.sh` — rewrote to produce TS-compatible format:
  - `metadata.json`: array of `{sessionId, file, date, author, goal, keywords}` objects
  - `keywords.json`: `{keyword: [sessionId, ...]}` map for search
  - `sessions.txt`: plain text concatenation for grep
  - `last-updated.txt`: build timestamp
- Added `scripts/setup-hooks.sh` — installs pre-commit hook
- Added `scripts/test.sh` — test runner
- Added `tests/test-index-builder.sh` — test suite for index builder
- Installed `.git/hooks/pre-commit` — auto-rebuilds index and stages files before each commit

## Decisions Made

- **Bash build script instead of TS-only**: The bash version has no runtime dependencies beyond `jq`, works on any Unix system, and is simpler to run from a git hook. The TS version (`build-index.ts`) is kept as an alternative.
- **Match TS output format**: The changelog UI (`changelog-content.ts`) imports `metadata.json` and `keywords.json` at build time. The bash script must produce the same schema or the changelog breaks (which it did initially).
- **Stop word filtering in bash**: Ported the same stop word list from `build-index.ts` to keep keyword quality consistent.

## Open Questions

None.

## Links

Commits:
- (pending)

PRs:
- N/A

ADRs:
- N/A
