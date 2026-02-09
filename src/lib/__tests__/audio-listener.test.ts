import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock browser globals
// ---------------------------------------------------------------------------
let recognitionInstance: Record<string, unknown> = {};
const MockSpeechRecognition = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
  this.continuous = false;
  this.interimResults = false;
  this.lang = "";
  this.onresult = null;
  this.onerror = null;
  this.onend = null;
  this.start = vi.fn();
  this.stop = vi.fn();
  recognitionInstance = this;
  return this;
});

vi.stubGlobal("window", {
  SpeechRecognition: MockSpeechRecognition,
  webkitSpeechRecognition: MockSpeechRecognition,
});

const mockGetUserMedia = vi.fn().mockResolvedValue({
  getAudioTracks: () => [{ label: "mic", readyState: "live", muted: false, enabled: true, stop: vi.fn() }],
  getTracks: () => [{ stop: vi.fn() }],
});

vi.stubGlobal("navigator", {
  userAgent: "vitest-desktop",
  mediaDevices: { getUserMedia: mockGetUserMedia },
});

vi.stubGlobal("AudioContext", class {
  state = "running";
  createAnalyser() {
    return { fftSize: 0, frequencyBinCount: 128, getByteFrequencyData: vi.fn() };
  }
  createMediaStreamSource() { return { connect: vi.fn() }; }
  close = vi.fn();
  suspend = vi.fn().mockResolvedValue(undefined);
  resume = vi.fn().mockResolvedValue(undefined);
});

vi.stubGlobal("requestAnimationFrame", vi.fn());
vi.stubGlobal("cancelAnimationFrame", vi.fn());

import { AudioListener } from "../audio-listener.ts";

describe("AudioListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recognitionInstance = {};
  });

  // -----------------------------------------------------------------------
  // Static
  // -----------------------------------------------------------------------
  it("isSupported() returns true when SpeechRecognition exists", () => {
    expect(AudioListener.isSupported()).toBe(true);
  });

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  it("isActive() is false initially", () => {
    const listener = new AudioListener();
    expect(listener.isActive()).toBe(false);
  });

  it("isPaused() is false initially", () => {
    const listener = new AudioListener();
    expect(listener.isPaused()).toBe(false);
  });

  it("start() sets active", async () => {
    const listener = new AudioListener();
    await listener.start();
    expect(listener.isActive()).toBe(true);
  });

  it("stop() clears active", async () => {
    const listener = new AudioListener();
    await listener.start();
    listener.stop();
    expect(listener.isActive()).toBe(false);
  });

  it("pause() sets paused and stops recognition", async () => {
    const listener = new AudioListener();
    await listener.start();
    listener.pause();
    expect(listener.isPaused()).toBe(true);
    expect(recognitionInstance.stop).toHaveBeenCalled();
  });

  it("resume() clears paused", async () => {
    const listener = new AudioListener();
    await listener.start();
    listener.pause();
    listener.resume();
    expect(listener.isPaused()).toBe(false);
  });

  it("start() is idempotent when already active", async () => {
    const listener = new AudioListener();
    await listener.start();
    await listener.start(); // should not throw
    expect(listener.isActive()).toBe(true);
    // MockSpeechRecognition constructor called only once
    expect(MockSpeechRecognition).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Callbacks
  // -----------------------------------------------------------------------
  it("onFinalTranscript fires on final recognition result", async () => {
    const onFinal = vi.fn();
    const listener = new AudioListener({ onFinalTranscript: onFinal });
    await listener.start();

    // Simulate a final recognition result
    const onresult = recognitionInstance.onresult as (e: unknown) => void;
    if (onresult) {
      onresult({
        resultIndex: 0,
        results: [{
          0: { transcript: "hello world", confidence: 0.95 },
          isFinal: true,
          length: 1,
        }],
      });
    }
    expect(onFinal).toHaveBeenCalledWith("hello world", 0.95);
  });

  it("onInterimTranscript fires on interim result", async () => {
    const onInterim = vi.fn();
    const listener = new AudioListener({ onInterimTranscript: onInterim });
    await listener.start();

    const onresult = recognitionInstance.onresult as (e: unknown) => void;
    if (onresult) {
      onresult({
        resultIndex: 0,
        results: [{
          0: { transcript: "hel", confidence: 0.5 },
          isFinal: false,
          length: 1,
        }],
      });
    }
    expect(onInterim).toHaveBeenCalledWith("hel");
  });

  it("onError fires on recognition error (non-aborted)", async () => {
    const onErr = vi.fn();
    const listener = new AudioListener({ onError: onErr });
    await listener.start();

    const onerror = recognitionInstance.onerror as (e: unknown) => void;
    if (onerror) {
      onerror({ error: "network", message: "Network error" });
    }
    expect(onErr).toHaveBeenCalledWith("Speech recognition error: network");
  });

  it("suppresses 'aborted' errors", async () => {
    const onErr = vi.fn();
    const listener = new AudioListener({ onError: onErr });
    await listener.start();

    const onerror = recognitionInstance.onerror as (e: unknown) => void;
    if (onerror) {
      onerror({ error: "aborted", message: "" });
    }
    expect(onErr).not.toHaveBeenCalled();
  });

  it("suppresses 'no-speech' errors", async () => {
    const onErr = vi.fn();
    const listener = new AudioListener({ onError: onErr });
    await listener.start();

    const onerror = recognitionInstance.onerror as (e: unknown) => void;
    if (onerror) {
      onerror({ error: "no-speech", message: "" });
    }
    expect(onErr).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // getUserMedia skipped on Android/iOS (mic contention fix)
  // -----------------------------------------------------------------------
  it("does NOT call getUserMedia on Android (prevents mic steal from SpeechRecognition)", async () => {
    // Simulate Android Z Fold 7 user agent
    (navigator as unknown as Record<string, unknown>).userAgent =
      "Mozilla/5.0 (Linux; Android 14; SM-F946B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

    const listener = new AudioListener();
    await listener.start();

    expect(mockGetUserMedia).not.toHaveBeenCalled();
    expect(listener.isActive()).toBe(true);

    listener.stop();
    // Restore
    (navigator as unknown as Record<string, unknown>).userAgent = "vitest-desktop";
  });

  it("does NOT call getUserMedia on iOS (gesture context expiry fix)", async () => {
    (navigator as unknown as Record<string, unknown>).userAgent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

    const listener = new AudioListener();
    await listener.start();

    expect(mockGetUserMedia).not.toHaveBeenCalled();
    expect(listener.isActive()).toBe(true);

    listener.stop();
    (navigator as unknown as Record<string, unknown>).userAgent = "vitest-desktop";
  });

  it("DOES call getUserMedia on desktop for audio level monitoring", async () => {
    (navigator as unknown as Record<string, unknown>).userAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    const listener = new AudioListener();
    await listener.start();

    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(listener.isActive()).toBe(true);

    listener.stop();
    (navigator as unknown as Record<string, unknown>).userAgent = "vitest-desktop";
  });

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------
  it("getDiagnostics() returns event log", async () => {
    const listener = new AudioListener();
    await listener.start();
    const diag = listener.getDiagnostics();
    expect(diag).toHaveProperty("eventLog");
    expect(diag).toHaveProperty("audioContext");
    expect(diag).toHaveProperty("streamTracks");
  });
});
