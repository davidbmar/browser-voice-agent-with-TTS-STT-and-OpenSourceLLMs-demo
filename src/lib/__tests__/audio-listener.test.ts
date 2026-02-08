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
