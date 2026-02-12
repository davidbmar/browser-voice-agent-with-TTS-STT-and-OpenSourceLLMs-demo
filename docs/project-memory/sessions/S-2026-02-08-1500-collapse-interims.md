# Session

Session-ID: S-2026-02-08-1500-collapse-interims
Title: Collapse consecutive interim speech events
Date: 2026-02-08
Author: Claude

## Goal

Collapse consecutive INTERIM speech events into a single row in the Speech Events panel to reduce noise.

## Context

The Speech Events panel shows every individual INTERIM event as a separate row, creating 15-20 lines for a single sentence. Users want a cleaner view with collapsed interims showing time range and count.

## Plan

1. Add `formatTimeRange()` to `format-time.ts`
2. Add `groupEvents()` helper and `DisplayItem` types to `speech-event-panel.tsx`
3. Update rendering to use grouped display items
4. Add tests for `formatTimeRange`

## Changes Made

- `src/lib/format-time.ts`: Added `formatTimeRange(startMs, endMs, tz)` function
- `src/components/trace/speech-event-panel.tsx`: Added grouping types/logic, updated render to collapse consecutive interims
- `src/lib/__tests__/format-time.test.ts`: Added tests for `formatTimeRange`

## Decisions Made

- Grouping is UI-only (rendering layer), SpeechEventLog unchanged
- Time range format: `HH:MM:SS.mmm-SS.mmm` for ranges > 100ms, single timestamp otherwise
- Show count of collapsed interims in parentheses at end of text

## Open Questions

None.

## Links

Commits:
- (pending)
