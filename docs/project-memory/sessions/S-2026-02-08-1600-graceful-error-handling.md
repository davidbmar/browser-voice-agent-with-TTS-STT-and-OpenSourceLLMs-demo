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

(to be filled)

## Decisions Made

(to be filled)

## Open Questions

- None

## Links

Commits:
- (to be added)
