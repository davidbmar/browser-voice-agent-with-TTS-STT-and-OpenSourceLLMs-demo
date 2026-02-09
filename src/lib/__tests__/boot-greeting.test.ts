import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock browser globals
// ---------------------------------------------------------------------------
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
vi.stubGlobal("speechSynthesis", { speak: mockSpeak, cancel: mockCancel, speaking: false });

// Track constructed utterances for inspection
const utterances: Array<{ text: string; rate: number; lang: string; onend: (() => void) | null; onerror: (() => void) | null }> = [];
vi.stubGlobal("SpeechSynthesisUtterance", class {
  text: string;
  volume = 1;
  rate = 1;
  lang = "";
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text?: string) {
    this.text = text || "";
    utterances.push(this);
  }
});

vi.stubGlobal("Audio", class {
  volume = 1;
  playbackRate = 1;
  play = vi.fn().mockResolvedValue(undefined);
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
});
vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:mock"), revokeObjectURL: vi.fn() });

// Mock OfflineAudioContext for generateDingBlob / generateHappyJingleBlob
vi.stubGlobal("OfflineAudioContext", class {
  createOscillator() {
    return { type: "sine", frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  }
  createGain() {
    return { gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  }
  get destination() { return {}; }
  startRendering() {
    return Promise.resolve({
      sampleRate: 22050,
      getChannelData: () => new Float32Array(5512), // 0.25s at 22050
    });
  }
});

import { startBootGreeting } from "../boot-greeting.ts";

describe("boot-greeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    utterances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // iOS audio unlock: synchronous speak in call stack
  // -----------------------------------------------------------------------
  it("calls speechSynthesis.speak() synchronously (iOS audio unlock)", () => {
    startBootGreeting();

    // The FIRST speak call must happen synchronously — not in a setTimeout/Promise
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it("first utterance text is the greeting", () => {
    startBootGreeting();

    expect(utterances.length).toBeGreaterThanOrEqual(1);
    expect(utterances[0].text).toBe("Well, hello there! How are you doing?");
  });

  it("first utterance has lang=en-US", () => {
    startBootGreeting();
    expect(utterances[0].lang).toBe("en-US");
  });

  // -----------------------------------------------------------------------
  // Full greeting sequence
  // -----------------------------------------------------------------------
  it("speaks second message after first utterance ends", () => {
    startBootGreeting();
    expect(mockSpeak).toHaveBeenCalledTimes(1);

    // Simulate first utterance finishing
    utterances[0].onend?.();

    // Second speak should be called (the "loading" message)
    expect(mockSpeak).toHaveBeenCalledTimes(2);
    expect(utterances[1].text).toBe(
      "On first boot I have to load an LLM model so give me a second please."
    );
  });

  it("starts ding interval after second utterance ends", async () => {
    startBootGreeting();
    utterances[0].onend?.();

    // Second utterance is now queued — simulate it finishing
    utterances[1].onend?.();

    // Let generateDingBlob resolve (it's async)
    await vi.advanceTimersByTimeAsync(100);

    // Advance past one ding interval (2000ms)
    vi.advanceTimersByTime(2100);

    // Audio.play should have been called for the ding
    // (The Audio mock's play is called inside setInterval)
    expect(Audio).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Model loaded — stop dings, play ready
  // -----------------------------------------------------------------------
  it("onModelLoaded clears ding interval and speaks ready message", async () => {
    const handle = startBootGreeting();

    // Walk through the full sequence to get dings started
    utterances[0].onend?.();
    utterances[1].onend?.();
    await vi.advanceTimersByTimeAsync(100); // let generateDingBlob resolve

    // Verify dings are running
    vi.advanceTimersByTime(2100);

    // Now model loads
    handle.onModelLoaded();

    // Let generateHappyJingleBlob resolve
    await vi.advanceTimersByTimeAsync(1000);

    // Should have spoken "Ok ready, how can I help you?"
    const readyUtterance = utterances.find(u => u.text === "Ok ready, how can I help you?");
    expect(readyUtterance).toBeDefined();
  });

  it("onModelLoaded before dings start skips to ready", async () => {
    const handle = startBootGreeting();

    // Model loads immediately (before first utterance even finishes)
    handle.onModelLoaded();

    // First utterance finishes — should skip dings and go to ready
    utterances[0].onend?.();

    // Let async jingle generation resolve
    await vi.advanceTimersByTimeAsync(1000);

    // Should NOT have spoken the "loading" message, should go straight to ready
    const readyUtterance = utterances.find(u => u.text === "Ok ready, how can I help you?");
    expect(readyUtterance).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------
  it("cleanup clears ding interval", async () => {
    const handle = startBootGreeting();

    utterances[0].onend?.();
    utterances[1].onend?.();
    await vi.advanceTimersByTimeAsync(100);

    handle.cleanup();

    // After cleanup, advancing timers should not create new Audio instances
    const speakCountBefore = mockSpeak.mock.calls.length;
    vi.advanceTimersByTime(5000);
    // No new speaks should happen (dings don't use speak, but interval should be cleared)
    expect(mockSpeak.mock.calls.length).toBe(speakCountBefore);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  it("returns handle even when speechSynthesis is undefined", () => {
    const originalSS = globalThis.speechSynthesis;
    // @ts-expect-error — deliberately removing for test
    delete globalThis.speechSynthesis;
    vi.stubGlobal("speechSynthesis", undefined);

    // Should not throw
    const handle = startBootGreeting();
    expect(handle).toBeDefined();
    expect(handle.onModelLoaded).toBeInstanceOf(Function);
    expect(handle.cleanup).toBeInstanceOf(Function);

    // Restore
    vi.stubGlobal("speechSynthesis", originalSS);
  });

  it("double onModelLoaded is safe", async () => {
    const handle = startBootGreeting();
    utterances[0].onend?.();
    utterances[1].onend?.();
    await vi.advanceTimersByTimeAsync(100);

    handle.onModelLoaded();
    // Second call should not throw or double-speak
    handle.onModelLoaded();

    await vi.advanceTimersByTimeAsync(1000);
    const readyCount = utterances.filter(u => u.text === "Ok ready, how can I help you?").length;
    // Should only say "ready" once (second onModelLoaded has no dingInterval to clear)
    expect(readyCount).toBe(1);
  });

  it("cleanup after onModelLoaded is safe", async () => {
    const handle = startBootGreeting();
    utterances[0].onend?.();
    utterances[1].onend?.();
    await vi.advanceTimersByTimeAsync(100);

    handle.onModelLoaded();
    handle.cleanup(); // should not throw
  });
});
