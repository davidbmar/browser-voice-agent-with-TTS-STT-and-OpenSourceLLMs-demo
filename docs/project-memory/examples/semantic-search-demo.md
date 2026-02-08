# Semantic Search Demo

## Real Example from Browser Question Loop

### Question: "Show me anything about audio problems or bugs"

### How Claude Searches

**Step 1: Read all session files**
```bash
grep -r "" docs/project-memory/sessions/S-*.md
```

**Step 2: Analyze semantically** (not just keyword matching)

**Step 3: Return results with explanations**

---

## Results

### ✅ S-2026-02-08-1400-listener-ui-mute
**Relevance:** 🔥 High - Audio functionality

**Why it matches:**
- Added **audio mute toggle** feature
- Fixed **audio output** visibility issues
- Modified **TTSSpeaker** audio playback paths
- Deals with **echo cancellation** during audio playback
- Keywords found: "audio", "mute", "speaker", "echo", "volume"

**Key decisions:**
- Used volume=0 for VITS silence instead of skipping
- Made listener pause during SPEAK visible (echo cancellation issue)

**Excerpt:**
```
## Goal
Add audio mute toggle...

## Changes Made
### Audio Mute
- TTSSpeaker: added muted field, setMuted(), isMuted()
- Applied in 4 playback paths
```

---

### ✅ S-2026-02-08-1500-fix-silence-counter
**Relevance:** 🔥 Critical - Audio Bug Fix

**Why it matches:**
- Fixed **speech clipping bug** (audio capture problem)
- Problem: "what time is it?" only captured "what"
- Root cause: silence detection during **speech recognition**
- Related to **audio level detection** and **VAD** (Voice Activity Detection)
- Keywords found: "silence", "speech", "turn detection", "clipping"

**Key fix:**
- Reset silence counter when speech detected
- Prevents premature turn-end during multi-word utterances

**Excerpt:**
```
## Goal
Fix premature turn-end detection that causes speech to be
clipped to just the first word

## Context
The silence-based turn detection fires TURN_END too early
```

---

### ❌ S-2026-02-08-1430-migrate-project-memory
**Relevance:** Low - Not audio-related

**Why it doesn't match:**
- About documentation system migration
- No audio functionality mentioned

---

## Concept Mapping

Claude understood these relationships:

| User Query | Matched Concepts |
|------------|------------------|
| "audio problems" | → speech clipping, echo cancellation |
| "audio bugs" | → premature turn-end, silence detection |
| "audio features" | → mute toggle, volume control |
| "voice issues" | → speech recognition, VAD, interim results |

---

## More Examples

### Query: "What work was done on testing?"

**Found:** S-2026-02-08-1400-listener-ui-mute

**Why:** Session mentions:
- "Added vitest.config.ts"
- "12 test files with 208 tests"
- "comprehensive test suite"

**Concepts matched:**
- testing → vitest, test suite, test infrastructure

---

### Query: "Show me UI improvements"

**Found:** S-2026-02-08-1400-listener-ui-mute

**Why:** Session mentions:
- "make all panels collapsible"
- "Two-row stage diagram"
- "Add visibility into listener pause/resume"

**Concepts matched:**
- UI → panels, diagram, visibility, collapsible

---

### Query: "What bugs were fixed?"

**Found:** S-2026-02-08-1500-fix-silence-counter

**Why:** Session explicitly about bug fix:
- Goal: "Fix premature turn-end detection"
- Problem: speech clipped to first word
- Root cause identified and fixed

**Concepts matched:**
- bugs → premature, clipped, fix, issue

---

## How to Use

Just ask Claude natural questions:
- "Show me anything about mobile support"
- "What decisions were made about authentication?"
- "When did we add the search feature?"
- "What performance work was done?"

Claude will:
1. Read all relevant files
2. Find conceptually related content
3. Explain why results match
4. Provide relevance scores
5. Show key excerpts

No need to guess exact keywords!
