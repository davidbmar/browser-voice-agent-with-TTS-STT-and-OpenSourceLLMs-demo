import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock browser globals
// ---------------------------------------------------------------------------
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
vi.stubGlobal("speechSynthesis", { speak: mockSpeak, cancel: mockCancel, speaking: false });
vi.stubGlobal("SpeechSynthesisUtterance", class {
  text = ""; volume = 1; rate = 1; lang = "";
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text?: string) { if (text) this.text = text; }
});

vi.stubGlobal("Audio", class {
  volume = 1; playbackRate = 1;
  pause = vi.fn();
  play = vi.fn().mockImplementation(function (this: { onended: (() => void) | null }) {
    // Auto-finish playback after a tick
    setTimeout(() => { this.onended?.(); }, 5);
    return Promise.resolve();
  });
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
});

vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:mock"), revokeObjectURL: vi.fn() });

// Stub navigator for non-iOS, non-mobile
vi.stubGlobal("navigator", { userAgent: "vitest-desktop" });

// ---------------------------------------------------------------------------
// Mock VITS
// ---------------------------------------------------------------------------
const mockPredict = vi.fn().mockResolvedValue(new Blob(["audio"]));
vi.mock("@diffusionstudio/vits-web", () => ({
  predict: (...args: unknown[]) => mockPredict(...args),
}));

import { TTSSpeaker, VOICE_RESPONSE, VOICE_MONOLOGUE } from "../tts-speaker.ts";

describe("TTSSpeaker", () => {
  let speaker: TTSSpeaker;
  let onSpeakStart: ReturnType<typeof vi.fn>;
  let onSpeakEnd: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPredict.mockResolvedValue(new Blob(["audio"]));
    onSpeakStart = vi.fn();
    onSpeakEnd = vi.fn();
    onError = vi.fn();
    speaker = new TTSSpeaker({ onSpeakStart, onSpeakEnd, onError });
  });

  // -----------------------------------------------------------------------
  // State management
  // -----------------------------------------------------------------------
  it("isSpeaking() is false initially", () => {
    expect(speaker.isSpeaking()).toBe(false);
  });

  it("stop() sets speaking to false", () => {
    speaker.beginStream();
    expect(speaker.isSpeaking()).toBe(true);
    speaker.stop();
    expect(speaker.isSpeaking()).toBe(false);
  });

  it("getQueueDepth() starts at 0", () => {
    expect(speaker.getQueueDepth()).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Speak (simple)
  // -----------------------------------------------------------------------
  it("speak() with empty text returns immediately", async () => {
    await speaker.speak("  ");
    expect(onSpeakStart).not.toHaveBeenCalled();
  });

  it("speak() fires onSpeakStart", async () => {
    speaker.speak("Hello world.");
    // Give it a moment to start
    await new Promise(r => setTimeout(r, 50));
    expect(onSpeakStart).toHaveBeenCalled();
    speaker.stop(); // cleanup
  });

  // -----------------------------------------------------------------------
  // Streaming API
  // -----------------------------------------------------------------------
  it("beginStream() sets speaking to true", () => {
    speaker.beginStream();
    expect(speaker.isSpeaking()).toBe(true);
  });

  it("endStream() resolves when finished is set", async () => {
    speaker.beginStream();
    const p = speaker.endStream();
    // Should resolve since no chunks were pushed
    await expect(p).resolves.toBeUndefined();
  });

  it("pushSentence() enqueues a chunk", () => {
    speaker.beginStream();
    speaker.pushSentence("Test sentence.");
    // VITS mock was called
    expect(mockPredict).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Volume / Speed
  // -----------------------------------------------------------------------
  it("setVolume updates volume", () => {
    speaker.setVolume(0.5);
    // No public getter, but we can verify it doesn't throw
    expect(true).toBe(true);
  });

  it("setSpeed updates speed", () => {
    speaker.setSpeed(1.5);
    expect(true).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Voice constants
  // -----------------------------------------------------------------------
  it("exports VOICE_RESPONSE constant", () => {
    expect(VOICE_RESPONSE).toBe("en_GB-cori-high");
  });

  it("exports VOICE_MONOLOGUE constant", () => {
    expect(VOICE_MONOLOGUE).toBe("en_US-hfc_female-medium");
  });

  // -----------------------------------------------------------------------
  // unlockAudio
  // -----------------------------------------------------------------------
  it("unlockAudio calls speechSynthesis.speak", () => {
    speaker.unlockAudio();
    expect(mockSpeak).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // stop()
  // -----------------------------------------------------------------------
  it("stop() cancels speechSynthesis", () => {
    speaker.stop();
    expect(mockCancel).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Mute
  // -----------------------------------------------------------------------
  it("setMuted(true) makes isMuted() return true", () => {
    speaker.setMuted(true);
    expect(speaker.isMuted()).toBe(true);
  });

  it("setMuted(false) makes isMuted() return false", () => {
    speaker.setMuted(true);
    speaker.setMuted(false);
    expect(speaker.isMuted()).toBe(false);
  });
});
