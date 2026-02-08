# Session

Session-ID: S-2026-02-08-1400-listener-ui-mute
Date: 2026-02-08
Author: Claude + dmar

## Goal

Add visibility into listener pause/resume, make all panels collapsible, add audio mute toggle, add build number, and add comprehensive test suite.

## Context

After implementing the always-on listener pipeline, the UI didn't show when the listener was paused for echo cancellation. The stage diagram showed LISTENING in the sequential pipeline (but it's actually parallel). Some panels couldn't be collapsed. There was no way to mute audio output. No test infrastructure existed.

## Plan

1. Expose listenerPaused/audioMuted in LoopState
2. Two-row stage diagram (listener status + processing pipeline)
3. Make InternalStatePanel and BiasSliders collapsible
4. Audio mute toggle in ModelToggle
5. Add vitest infrastructure and comprehensive test suite
6. Build number (datetime stamp) in header
7. Speech event logging panel

## Changes Made

### Test Infrastructure
- Added vitest.config.ts, 12 test files with 208 tests covering all core modules
- Added speech-event-log.ts (event logging), format-time.ts (timezone-aware formatting)

### Listener Visibility
- Added listenerPaused and audioMuted to LoopState
- Wired onStateChange callback from AudioListener into LoopController
- Two-row stage diagram: Row 1 = listener status, Row 2 = processing pipeline

### Collapsible Panels
- InternalStatePanel: wrapped in Card + Collapsible
- BiasSliders: wrapped in Card + Collapsible

### Audio Mute
- TTSSpeaker: added muted field, setMuted(), isMuted(), applied in 4 playback paths
- ModelToggle: added Audio Output switch
- LoopController: added setAudioMuted() method
- useLoop hook: exposed setAudioMuted callback

### Build Number
- vite.config.ts: BUILD_NUMBER define (YYYYMMDDHHMMSS)
- vite-env.d.ts: TypeScript declaration
- App.tsx: displayed in header

### Speech Event Panel
- SpeechEventPanel component for real-time speech event monitoring
- SpeechEventLog class for structured event storage
- Wired into App.tsx

## Decisions Made

- Listener pause during SPEAK is unavoidable (echo cancellation) — made visible rather than eliminated
- Used VITS silence as volume=0 rather than skip to preserve pipeline timing
- Two-row stage diagram separates parallel concerns (listener vs processing)

## Open Questions

- None

## Links

Commits:
- (see git log)

PRs:
- N/A

ADRs:
- N/A
