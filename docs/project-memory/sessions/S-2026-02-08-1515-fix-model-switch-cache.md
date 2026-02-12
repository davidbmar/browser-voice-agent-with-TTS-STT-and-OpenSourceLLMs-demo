# Session

Session-ID: S-2026-02-08-1515-fix-model-switch-cache
Title: Fix model switching failure from full Cache Storage
Date: 2026-02-08
Author: Claude

## Goal

Fix model switching failure caused by browser Cache Storage being full from previous model weights.

## Context

When switching models after one is already loaded, the user sees "Model load failed: Failed to execute 'add' on 'Cache': Unexpected internal error." This is because `unloadModel()` frees GPU memory but doesn't clear the Cache Storage where WebLLM stores downloaded weights. The new model download then fails due to insufficient cache space.

## Plan

1. Delete old model from Cache Storage before loading new model (llm-engine.ts)
2. Reset controller state on load failure (loop-controller.ts)
3. Clear pendingModelId on error in App.tsx

## Changes Made

- `src/lib/llm-engine.ts`: Call `deleteModelAllInfoInCache(previousModelId)` before loading new model
- `src/lib/loop-controller.ts`: Wrap `llmEngine.loadModel()` in try/catch, reset modelConfig state on failure
- `src/App.tsx`: Clear `pendingModelId` when model load fails

## Decisions Made

- Cache cleanup is best-effort (try/catch with ignored error) — if it fails, the main load might still succeed
- Old model cache is only deleted when switching to a *different* model, not on reload of the same model

## Open Questions

None.

## Links

Commits:
- (pending)
