# Session

Session-ID: S-2026-02-08-1500-fix-silence-counter
Date: 2026-02-08
Author: Claude + dmar

## Goal

Fix premature turn-end detection that causes speech to be clipped to just the first word (e.g., "what time is it?" only captures "what").

## Context

The silence-based turn detection in `updateVADFromLevel()` (loop-controller.ts:406-420) fires a synthetic `TURN_END` when `silenceDurationMs >= silenceThresholdMs` (1500ms default) during SIGNAL_DETECT with interim text. However, `silenceDurationMs` accumulates during long silences between utterances and is never reset when new speech arrives via SpeechRecognition interim results. This causes TURN_END to fire within ~200ms of the first word, using whatever partial text is available.

Evidence from Speech Events panel:
- `FINAL "what time" (0.70)` fires 213ms after first interim `"what"` — 0.70 is the hardcoded confidence from silence-based detection
- Full sentence `"what time is it" (0.97)` arrives later during MICRO_RESPONSE, gets queued, but discarded as stale (>10s old)

## Plan

1. Reset `silenceDurationMs` and `silenceStartTime` when transitioning LISTENING → SIGNAL_DETECT
2. Add tests verifying the reset behavior
3. Deploy and verify

## Changes Made

- `src/lib/loop-controller.ts` — Reset silence counter on LISTENING→SIGNAL_DETECT transition
- `src/lib/__tests__/loop-controller.test.ts` — Add test for silence reset on signal detect

## Decisions Made

- Reset silence counter at the LISTENING→SIGNAL_DETECT transition rather than modifying `updateVADFromLevel()`. This is the most targeted fix — the problem is that old silence data persists into a new speech detection window.

## Open Questions

- Should we also reset when `isSpeaking` flips to true in `updateVADFromLevel`? Currently line 392 does `silenceDurationMs = 0` but only when audio level crosses threshold. SpeechRecognition can start producing text before audio level detection catches up.

## Links

Commits:
- `b1c92c7` [S-2026-02-08-1400-listener-ui-mute] (fix included in this commit)

PRs:
- N/A

ADRs:
- N/A
