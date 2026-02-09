/**
 * mobile-chat-order.test.ts — Tests that the mobile chat UI shows messages
 * in chronological order with no duplicates after turns complete.
 *
 * The core bug: after a turn commits to history, `lastResponse` and
 * `lastThinking` remain set (for desktop panel display). The mobile chat
 * must NOT render these stale fields as a "current turn" below the history,
 * or the user sees the same response twice with the view stuck at the bottom.
 */

import { describe, it, expect } from "vitest";
import type { LoopState, LoopHistoryEntry } from "../loop-types.ts";
import { DEFAULT_LOOP_STATE, DEFAULT_BIAS } from "../loop-types.ts";

// ---------------------------------------------------------------------------
// Replicate the mobile layout's rendering logic (from mobile-layout.tsx)
// ---------------------------------------------------------------------------

/** Which stages count as "actively processing a turn" */
const PROCESSING_STAGES = ["CLASSIFY", "MICRO_RESPONSE", "SPEAK", "SIGNAL_DETECT"];

interface MobileChatView {
  /** History bubbles rendered (chronological) */
  historyBubbles: LoopHistoryEntry[];
  /** Whether the "current turn" section is visible */
  isActiveTurn: boolean;
  /** Whether the stale response would render as a duplicate */
  showsCurrentResponse: boolean;
  /** Whether the stale thinking would render as a duplicate */
  showsCurrentThinking: boolean;
  /** Whether the empty state (instructions) is shown */
  showEmptyState: boolean;
}

/** Compute what the mobile layout would render given a LoopState. */
function computeMobileChatView(state: LoopState): MobileChatView {
  const transcript = state.finalTranscript || state.interimTranscript;
  const isProcessing = PROCESSING_STAGES.includes(state.stage);
  const isActiveTurn = isProcessing || !!transcript;
  const showEmptyState = !isActiveTurn && state.history.length === 0 && !state.error;

  return {
    historyBubbles: state.history,
    isActiveTurn,
    showsCurrentResponse: isActiveTurn && isProcessing && !!state.lastResponse,
    showsCurrentThinking: isActiveTurn && isProcessing && !!state.lastThinking,
    showEmptyState,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHistoryEntry(id: number, transcript: string, response: string): LoopHistoryEntry {
  return {
    id,
    transcript,
    response,
    classification: null,
    responseTokenCount: 10,
    totalDurationMs: 500,
    stageTimings: {},
    biasSnapshot: { ...DEFAULT_BIAS },
    modelUsed: "test-model",
    timestamp: Date.now(),
    searchQuery: null,
    searchResultCount: 0,
  };
}

function makeState(overrides: Partial<LoopState> = {}): LoopState {
  return { ...DEFAULT_LOOP_STATE, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Mobile chat ordering", () => {
  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------
  it("shows empty state when no history and IDLE", () => {
    const view = computeMobileChatView(makeState({ stage: "IDLE" }));
    expect(view.showEmptyState).toBe(true);
    expect(view.isActiveTurn).toBe(false);
    expect(view.historyBubbles).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // During active turn
  // -----------------------------------------------------------------------
  it("shows current turn during CLASSIFY", () => {
    const view = computeMobileChatView(makeState({
      stage: "CLASSIFY",
      finalTranscript: "hello",
    }));
    expect(view.isActiveTurn).toBe(true);
    expect(view.showEmptyState).toBe(false);
  });

  it("shows current response during SPEAK stage", () => {
    const view = computeMobileChatView(makeState({
      stage: "SPEAK",
      finalTranscript: "hello",
      lastResponse: "Hi there!",
    }));
    expect(view.isActiveTurn).toBe(true);
    expect(view.showsCurrentResponse).toBe(true);
  });

  it("shows thinking during MICRO_RESPONSE", () => {
    const view = computeMobileChatView(makeState({
      stage: "MICRO_RESPONSE",
      finalTranscript: "hello",
      lastThinking: "Processing...",
    }));
    expect(view.isActiveTurn).toBe(true);
    expect(view.showsCurrentThinking).toBe(true);
  });

  it("shows current turn when transcript exists even in LISTENING", () => {
    const view = computeMobileChatView(makeState({
      stage: "LISTENING",
      interimTranscript: "hel...",
    }));
    expect(view.isActiveTurn).toBe(true);
  });

  // -----------------------------------------------------------------------
  // After turn commits to history (THE BUG FIX)
  // -----------------------------------------------------------------------
  it("does NOT show stale response as current turn after commit to IDLE", () => {
    // This simulates the state after runUpdateBias():
    // - Turn committed to history
    // - lastResponse still set (intentionally, for desktop panels)
    // - Stage is IDLE
    // - finalTranscript cleared
    const view = computeMobileChatView(makeState({
      stage: "IDLE",
      finalTranscript: "",
      interimTranscript: "",
      lastResponse: "Hi there!",
      lastThinking: "I should greet them",
      history: [makeHistoryEntry(1, "hello", "Hi there!")],
    }));

    expect(view.isActiveTurn).toBe(false);
    expect(view.showsCurrentResponse).toBe(false);
    expect(view.showsCurrentThinking).toBe(false);
    // History should have exactly 1 entry (no duplicate)
    expect(view.historyBubbles).toHaveLength(1);
    expect(view.historyBubbles[0].response).toBe("Hi there!");
  });

  it("does NOT show stale response as current turn after commit to LISTENING", () => {
    // Same scenario but FSM looped back to LISTENING
    const view = computeMobileChatView(makeState({
      stage: "LISTENING",
      finalTranscript: "",
      interimTranscript: "",
      lastResponse: "Hi there!",
      lastThinking: "thinking...",
      history: [makeHistoryEntry(1, "hello", "Hi there!")],
    }));

    expect(view.isActiveTurn).toBe(false);
    expect(view.showsCurrentResponse).toBe(false);
    expect(view.showsCurrentThinking).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Chronological order
  // -----------------------------------------------------------------------
  it("history entries are in chronological order (oldest first)", () => {
    const history = [
      makeHistoryEntry(1, "first question", "first answer"),
      makeHistoryEntry(2, "second question", "second answer"),
      makeHistoryEntry(3, "third question", "third answer"),
    ];

    const view = computeMobileChatView(makeState({
      stage: "IDLE",
      history,
      lastResponse: "third answer",
    }));

    expect(view.historyBubbles).toHaveLength(3);
    expect(view.historyBubbles[0].id).toBe(1);
    expect(view.historyBubbles[1].id).toBe(2);
    expect(view.historyBubbles[2].id).toBe(3);
    // No duplicate current turn
    expect(view.isActiveTurn).toBe(false);
  });

  it("new turn appears below existing history", () => {
    const history = [
      makeHistoryEntry(1, "first question", "first answer"),
    ];

    const view = computeMobileChatView(makeState({
      stage: "MICRO_RESPONSE",
      history,
      finalTranscript: "second question",
      lastResponse: "",
    }));

    // History has 1 entry
    expect(view.historyBubbles).toHaveLength(1);
    // Active turn is visible (rendering below history)
    expect(view.isActiveTurn).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Empty state reappears correctly
  // -----------------------------------------------------------------------
  it("empty state does NOT show when history exists but no active turn", () => {
    const view = computeMobileChatView(makeState({
      stage: "IDLE",
      history: [makeHistoryEntry(1, "hello", "hi")],
      lastResponse: "hi",
    }));

    expect(view.showEmptyState).toBe(false);
  });

  it("empty state does NOT show when error exists", () => {
    const view = computeMobileChatView(makeState({
      stage: "IDLE",
      error: "Something went wrong",
    }));

    expect(view.showEmptyState).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Multiple turns scenario
  // -----------------------------------------------------------------------
  it("after 3 turns, no duplicate responses in chat", () => {
    const history = [
      makeHistoryEntry(1, "q1", "a1"),
      makeHistoryEntry(2, "q2", "a2"),
      makeHistoryEntry(3, "q3", "a3"),
    ];

    // State after third turn committed, back to IDLE
    const view = computeMobileChatView(makeState({
      stage: "IDLE",
      history,
      lastResponse: "a3",
      lastThinking: "thought3",
      finalTranscript: "",
    }));

    // All 3 responses in history only
    expect(view.historyBubbles).toHaveLength(3);
    expect(view.isActiveTurn).toBe(false);
    expect(view.showsCurrentResponse).toBe(false);

    // Verify each response appears exactly once in history
    const responses = view.historyBubbles.map(h => h.response);
    expect(responses).toEqual(["a1", "a2", "a3"]);
  });
});
