# Session

Session-ID: S-2026-02-08-1400-bootstrap-memory
Date: 2026-02-08
Author: dmar

## Goal

Bootstrap the Project Memory system so every coding session and decision is searchable with citations.

## Context

Starting a new repo. Need a way to track:
- Why code changed
- What was decided and when
- How to find context for any commit

## Plan

1. Create directory structure for sessions, ADRs, runbooks, architecture
2. Create templates for sessions and ADRs
3. Document Session ID format and commit message standard
4. Create example files showing how it works
5. Update CLAUDE.md so AI knows how to use the system
6. Update README.md to point to CLAUDE.md

## Changes Made

- Created `docs/project-memory/` structure
- Created session and ADR templates
- Created example session (this file)
- Created example ADR for decision tracking
- Created PR template requiring Session IDs
- Documented Session ID format: `S-YYYY-MM-DD-HHMM-<slug>`
- Established commit message format: `[SessionID] description`

## Decisions Made

**Session ID Format**: Chose `S-YYYY-MM-DD-HHMM-<slug>` because:
- Sortable by time
- Human readable
- Unique enough for concurrent sessions
- Easy to grep in commits

**Commit Prefix Requirement**: Every commit must include `[SessionID]` because:
- Makes git log searchable
- Links commits to session context
- Enables tracing from code to reasoning

## Open Questions

None. System is ready to use.

## Links

Commits:
- (This is the bootstrap session)

PRs:
- (Will be linked when PR created)

ADRs:
- ADR-0001 - Session-based commit tracking
