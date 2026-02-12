# Session

Session-ID: S-2026-02-09-0040-mobile-boot-greeting
Title: Add mobile voice greeting and fix model load race condition
Date: 2026-02-09
Author: Claude

## Goal

Add a voice welcome greeting on mobile during model loading, and fix a race condition in model load/unload that caused models to fail loading after pressing X.

## Context

On mobile (iPhone/Android), the app auto-loads an LLM model on startup which takes several seconds. During this time the user stares at a loading bar with no feedback. Also, a race condition in LLMEngine meant pressing X (unload) while a model was loading could corrupt state, preventing subsequent loads.

## Plan

1. Add native SpeechSynthesis greeting on mobile boot ("Well, hello there!")
2. Play ding sounds every 2s while model loads
3. Play happy jingle + say "Ok ready" when model finishes loading
4. Fix iOS audio by adding tap-to-start splash (iOS requires user gesture for audio)
5. Fix load/unload race condition with operation queue + cancellation token
6. Add comprehensive test cases for race conditions

## Changes Made

### `src/lib/ding-tone.ts` (new file export)
- Added `generateHappyJingleBlob()` — ascending C major arpeggio (C5-E5-G5-C6) with shimmer harmonics

### `src/App.tsx`
- Added `mobileTapped` state for tap-to-start splash screen (unlocks iOS audio)
- Added boot greeting flow: SpeechSynthesis greetings → ding interval → happy jingle on load
- Splash screen with Bug Loop branding and "Tap anywhere to start" prompt

### `src/lib/llm-engine.ts`
- Added `opQueue` promise chain to serialize all load/unload operations
- Added `loadToken` cancellation mechanism — created synchronously in `loadModel()`, cancelled synchronously in `unloadModel()`
- `doLoad()` checks token at each await point, tears down partially-created engines on cancellation
- Throws "Model load cancelled" on cancellation (not treated as an error in UI)

### `src/lib/__tests__/llm-engine.test.ts` (10 new tests)
- Unload resets isLoading, notifies completion
- Reload same/different model after unload
- Unload during load cancels the load
- Load after unload-during-load succeeds cleanly
- Rapid double-unload safety
- Rapid load-load serialization (last model wins)
- Unload clears loading flag mid-load

### `src/lib/__tests__/loop-controller.test.ts` (5 new tests)
- Unload resets loadProgress, notifies listeners
- Reload same model after unload
- Unload during load cancels cleanly
- Rapid double-unload safety

## Decisions Made

- **Native SpeechSynthesis over VITS**: Works without user gesture on most browsers (except iOS), available immediately without model download
- **Tap-to-start splash for iOS**: iOS requires user gesture for all audio APIs. Splash screen serves as UX welcome + audio unlock
- **Cancellation token over generation counter**: Generation counter fails when load/unload are queued synchronously before microtasks run (counter is already bumped by the time doLoad captures it). Token is created in loadModel and cancelled in unloadModel, both synchronously.
- **Operation queue serialization**: Simple promise chaining ensures load/unload never overlap, preventing state corruption

## Open Questions

- Ding sounds via Audio element may be silenced by iOS auto-play policy even after tap (SpeechSynthesis is primary UX, dings are secondary)
- Should we add a cancellation UI indicator ("Loading cancelled")?

## Links

Commits:
- (pending)
