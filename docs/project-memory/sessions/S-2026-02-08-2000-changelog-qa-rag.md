# Session S-2026-02-08-2000-changelog-qa-rag

Session-ID: S-2026-02-08-2000-changelog-qa-rag
Date: 2026-02-08
Author: dmar

## Goal

Add Q&A functionality to Changelog using BroadcastChannel + RAG pattern

## Context

The Changelog window displays all coding sessions but couldn't answer questions about them. Users wanted to ask questions like "Why did we add audio mute?" and get answers from the LLM using actual session content.

**Problem:**
- Changelog opens in separate window (can't access main app's LLM)
- Loading LLM twice would waste 2GB+ memory
- Need accurate answers with citations, not hallucinations

**Solution:**
- Use BroadcastChannel API for cross-window communication
- Implement RAG (Retrieval Augmented Generation) pattern:
  1. Search keyword index first (fast)
  2. Find top 5 relevant sessions
  3. Read full session content from disk
  4. LLM generates answer with session context

## Plan

1. Add BroadcastChannel listener to main app (App.tsx)
2. Add Q&A UI to Changelog window (changelog-content.ts)
3. Implement keyword search + LLM generation
4. Add markdown rendering for formatted output

## Changes Made

1. **`src/App.tsx`**: Added BroadcastChannel('llm-service') listener
   - Receives query + sessionIds from Changelog window
   - Reads session markdown files via fetch()
   - Uses `controller.getLLMEngine().generate()` with session context
   - Returns answer via BroadcastChannel
   - 30 second timeout handling

2. **`src/components/changelog/changelog-content.ts`**: Added Q&A UI
   - Input box, Ask button, status display, answer area
   - Searches keyword index to find relevant sessions (top 5)
   - Sends sessionIds via BroadcastChannel (efficient - not full content)
   - Renders markdown answers with marked.js
   - Enter key support, loading states, error handling

3. **System prompt updates**: Encourages markdown formatting
   - Headings, bullet points, code blocks
   - Bold Session ID citations
   - Structured, scannable output

4. **Bug fixes**:
   - Increased maxTokens from 256 to 512 (answers were truncated)
   - Strip `<think>` tags from LLM output (internal reasoning shouldn't show)

5. **Markdown rendering**:
   - Added marked.js v11 via CDN
   - Comprehensive CSS styling for headings, lists, code, quotes
   - Professional documentation-style output

## Decisions Made

- **BroadcastChannel over Shared Worker**: Simpler API, same origin only (acceptable)
- **RAG pattern**: Search first, then generate (accurate answers with citations vs blind LLM guessing)
- **Keyword index for search**: Fast, existing infrastructure, scales well
- **Top 5 sessions**: Balance between context and token limit
- **Markdown rendering**: Better UX than plain text, easy to scan
- **marked.js library**: Lightweight, popular, simple API

## Testing

Tested locally and on CloudFront:
1. Load model in main app
2. Open Changelog
3. Ask: "Why did we add audio mute?" → Cites S-2026-02-08-1400-listener-ui-mute
4. Ask: "Summarize the changes" → Lists recent sessions with details
5. Verify markdown rendering (headings, lists, code blocks)

## Open Questions

- None - feature complete and deployed

## Links

- PR/Commits:
  - `469a683` - Add BroadcastChannel Q&A to Changelog
  - `24555a4` - Fix Q&A truncation and thinking tags
  - `ec1fb52` - Add markdown rendering to Q&A answers
- Deployed: https://dmpt2ecfvyptf.cloudfront.net
- Related: S-2026-02-08-1430-migrate-project-memory (initial memory system migration)
