# Session

Session-ID: S-2026-02-08-1600-graceful-error-handling
Date: 2026-02-08
Author: Claude

## Goal

Add graceful error handling for model load failures (quota exceeded) and generation failures (Tokenizer* WASM crash). Pre-flight storage check, auto-unload on fatal errors, user-friendly messages, error dismissal.

## Context

Users see raw error strings like "Model load failed: Quota exceeded" and "Generation error: Cannot pass deleted object as a pointer of type Tokenizer*". The Tokenizer error leaves the engine in a broken state where `isLoaded()` returns true but every generation fails. No pre-flight storage check exists.

## Plan

1. Add `estimateStorage()` static method to LLMEngine
2. Auto-unload engine on fatal WASM/Tokenizer errors during generate
3. User-friendly error messages via `friendlyError()` in controller
4. Clear `state.error` when entering LISTENING stage
5. Show "low storage" warning in model selector
6. Add error dismiss button in App.tsx
7. Tests for all changes

## Changes Made

1. **`src/lib/llm-engine.ts`**: Added `estimateStorage()` static method; auto-unload on fatal WASM errors (Tokenizer/deleted object/disposed) in `generate()`
2. **`src/lib/loop-controller.ts`**: Added `clearError()` public method; added `friendlyError()` private helper translating quota/cache/tokenizer/network errors to user-friendly messages; all 3 `onError` callbacks now use `friendlyError()`; LISTENING stage entry clears `state.error`
3. **`src/components/model/model-selector.tsx`**: Added storage estimation hook; shows "low storage" badge on models exceeding available storage
4. **`src/App.tsx`**: Error display now has dismiss button (×) calling `controller.clearError()`
5. **`src/lib/__tests__/llm-engine.test.ts`**: 5 new tests (auto-unload Tokenizer, auto-unload disposed, no auto-unload on non-fatal, estimateStorage available, estimateStorage unavailable)
6. **`src/lib/__tests__/loop-controller.test.ts`**: 5 new tests (clearError, clearError notifies, friendlyError quota, friendlyError tokenizer, friendlyError passthrough)

## Decisions Made

- **Auto-unload on fatal errors**: Chose to null out engine+modelId directly (no async unload call) since the WASM is already corrupted. This makes `isLoaded()` return false immediately so FSM falls back to rule-based.
- **friendlyError in controller, not engine**: Error translation lives in the controller because it has context about user actions. The engine reports raw errors.
- **Clear error on LISTENING only**: Not on every stage transition, to avoid clearing errors too aggressively during error recovery.

## Open Questions

- None

## Links

Commits:
- (to be added)
