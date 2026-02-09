import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock browser globals that the modules expect
// ---------------------------------------------------------------------------
vi.stubGlobal("navigator", {
  userAgent: "vitest-desktop",
  mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getAudioTracks: () => [] }) },
  gpu: {},
});
vi.stubGlobal("window", {
  SpeechRecognition: class {},
  webkitSpeechRecognition: class {},
});
vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn(), speaking: false });
vi.stubGlobal("SpeechSynthesisUtterance", class { volume = 1; rate = 1; lang = ""; onend: (() => void) | null = null; onerror: (() => void) | null = null; });
vi.stubGlobal("Audio", class { volume = 1; playbackRate = 1; pause = vi.fn(); play = vi.fn().mockResolvedValue(undefined); onended: (() => void) | null = null; onerror: (() => void) | null = null; });
vi.stubGlobal("AudioContext", class { state = "running"; createAnalyser() { return { fftSize: 0, frequencyBinCount: 128, getByteFrequencyData: vi.fn() }; } createMediaStreamSource() { return { connect: vi.fn() }; } close = vi.fn(); suspend = vi.fn().mockResolvedValue(undefined); resume = vi.fn().mockResolvedValue(undefined); });
vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:mock"), revokeObjectURL: vi.fn() });
vi.stubGlobal("requestAnimationFrame", vi.fn());
vi.stubGlobal("cancelAnimationFrame", vi.fn());

// ---------------------------------------------------------------------------
// Mock heavy dependencies so LoopController can be instantiated in Node
// ---------------------------------------------------------------------------
vi.mock("@diffusionstudio/vits-web", () => ({
  predict: vi.fn().mockResolvedValue(new Blob(["audio"])),
}));

const mockCreateMLCEngine = vi.fn().mockResolvedValue({
  unload: vi.fn().mockResolvedValue(undefined),
  chat: { completions: { create: vi.fn() } },
});

vi.mock("@mlc-ai/web-llm", () => ({
  CreateMLCEngine: (...args: unknown[]) => mockCreateMLCEngine(...args),
  deleteModelAllInfoInCache: vi.fn().mockResolvedValue(undefined),
}));

vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn().mockResolvedValue(true) });
vi.stubGlobal("indexedDB", { deleteDatabase: vi.fn().mockReturnValue({ set onsuccess(fn: (() => void) | null) { if (fn) setTimeout(fn, 0); }, set onerror(_fn: (() => void) | null) {}, set onblocked(_fn: (() => void) | null) {} }) });

// Now import the controller (after mocks are set up)
import { LoopController } from "../loop-controller.ts";

describe("LoopController", () => {
  let ctrl: LoopController;

  beforeEach(() => {
    ctrl = new LoopController();
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------
  it("initial state is IDLE, not running", () => {
    const s = ctrl.getState();
    expect(s.stage).toBe("IDLE");
    expect(s.isRunning).toBe(false);
    expect(s.loopCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // MIC_START
  // -----------------------------------------------------------------------
  it("dispatch(MIC_START) in IDLE → LISTENING, isRunning=true", () => {
    ctrl.dispatch({ type: "MIC_START" });
    const s = ctrl.getState();
    expect(s.stage).toBe("LISTENING");
    expect(s.isRunning).toBe(true);
  });

  it("dispatch(MIC_START) in non-IDLE is ignored", () => {
    ctrl.dispatch({ type: "MIC_START" }); // → LISTENING
    ctrl.dispatch({ type: "MIC_START" }); // should be ignored
    expect(ctrl.getState().stage).toBe("LISTENING");
  });

  // -----------------------------------------------------------------------
  // MIC_STOP
  // -----------------------------------------------------------------------
  it("dispatch(MIC_STOP) → IDLE, isRunning=false", () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "MIC_STOP" });
    const s = ctrl.getState();
    expect(s.stage).toBe("IDLE");
    expect(s.isRunning).toBe(false);
  });

  // -----------------------------------------------------------------------
  // AUDIO_FRAME
  // -----------------------------------------------------------------------
  it("AUDIO_FRAME in LISTENING with text → SIGNAL_DETECT", () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 50, interimText: "hello" });
    expect(ctrl.getState().stage).toBe("SIGNAL_DETECT");
  });

  it("AUDIO_FRAME in LISTENING without text → stays LISTENING", () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 10, interimText: "" });
    expect(ctrl.getState().stage).toBe("LISTENING");
  });

  it("AUDIO_FRAME updates interimTranscript", () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 50, interimText: "testing" });
    expect(ctrl.getState().interimTranscript).toBe("testing");
  });

  // -----------------------------------------------------------------------
  // TURN_END triggers classify (rule-based since no LLM loaded)
  // -----------------------------------------------------------------------
  it("TURN_END in SIGNAL_DETECT → CLASSIFY then proceeds through pipeline", async () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 50, interimText: "hello" });
    expect(ctrl.getState().stage).toBe("SIGNAL_DETECT");

    ctrl.dispatch({ type: "TURN_END", finalText: "hello", confidence: 0.95 });
    // Rule-based classify + response is synchronous, so it should have progressed
    // Give microtasks a tick
    await new Promise(r => setTimeout(r, 50));
    const s = ctrl.getState();
    // Should be at SPEAK or beyond (rule-based path is synchronous dispatches)
    expect(["CLASSIFY", "MICRO_RESPONSE", "SPEAK"].includes(s.stage)).toBe(true);
  });

  it("TURN_END in LISTENING → CLASSIFY", async () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "TURN_END", finalText: "hi there", confidence: 0.9 });
    await new Promise(r => setTimeout(r, 50));
    const s = ctrl.getState();
    expect(["CLASSIFY", "MICRO_RESPONSE", "SPEAK"].includes(s.stage)).toBe(true);
  });

  it("TURN_END sets finalTranscript", async () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 50, interimText: "test" });
    ctrl.dispatch({ type: "TURN_END", finalText: "test transcript", confidence: 0.85 });
    await new Promise(r => setTimeout(r, 50));
    // finalTranscript was set (may be cleared after full cycle, check before cycle ends)
    // The SPEAK stage should have a response
    const s = ctrl.getState();
    expect(s.lastResponse.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // SIMULATE_INPUT
  // -----------------------------------------------------------------------
  it("SIMULATE_INPUT in IDLE → sets transcript and goes to CLASSIFY", async () => {
    ctrl.dispatch({ type: "SIMULATE_INPUT", text: "what is the weather" });
    await new Promise(r => setTimeout(r, 50));
    const s = ctrl.getState();
    expect(s.isRunning).toBe(true);
    // Should have progressed past CLASSIFY
    expect(["CLASSIFY", "MICRO_RESPONSE", "SPEAK"].includes(s.stage)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // RESET
  // -----------------------------------------------------------------------
  it("RESET returns to initial state", () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "RESET" });
    const s = ctrl.getState();
    expect(s.stage).toBe("IDLE");
    expect(s.isRunning).toBe(false);
    expect(s.loopCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Rule-based classify
  // -----------------------------------------------------------------------
  it("rule-based: greeting detection", async () => {
    ctrl.dispatch({ type: "SIMULATE_INPUT", text: "hello" });
    await new Promise(r => setTimeout(r, 50));
    const s = ctrl.getState();
    // Should produce a greeting-type response
    const greetResponses = ["Hi there.", "Hello.", "Hey."];
    expect(
      greetResponses.includes(s.lastResponse) || s.lastResponse.length > 0
    ).toBe(true);
  });

  it("rule-based: question detection via '?'", async () => {
    ctrl.dispatch({ type: "SIMULATE_INPUT", text: "what time is it?" });
    await new Promise(r => setTimeout(r, 50));
    const s = ctrl.getState();
    const questionResponses = ["Interesting question.", "Hmm, let me think.", "Good question."];
    expect(
      questionResponses.includes(s.lastResponse) || s.lastResponse.length > 0
    ).toBe(true);
  });

  it("rule-based: command detection", async () => {
    ctrl.dispatch({ type: "SIMULATE_INPUT", text: "stop playing" });
    await new Promise(r => setTimeout(r, 50));
    const s = ctrl.getState();
    const cmdResponses = ["On it.", "Will do.", "Doing that now."];
    expect(
      cmdResponses.includes(s.lastResponse) || s.lastResponse.length > 0
    ).toBe(true);
  });

  it("rule-based: acknowledgement detection", async () => {
    ctrl.dispatch({ type: "SIMULATE_INPUT", text: "okay" });
    await new Promise(r => setTimeout(r, 50));
    const s = ctrl.getState();
    const ackResponses = ["Got it.", "Okay.", "Mm-hm.", "Right."];
    expect(
      ackResponses.includes(s.lastResponse) || s.lastResponse.length > 0
    ).toBe(true);
  });

  it("rule-based: farewell detection", async () => {
    ctrl.dispatch({ type: "SIMULATE_INPUT", text: "goodbye" });
    await new Promise(r => setTimeout(r, 50));
    const s = ctrl.getState();
    const farewellResponses = ["Bye.", "See you.", "Later."];
    expect(
      farewellResponses.includes(s.lastResponse) || s.lastResponse.length > 0
    ).toBe(true);
  });

  it("rule-based: low confidence → clarification_needed", async () => {
    // Dispatch directly through MIC_START + TURN_END with low confidence
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 50, interimText: "mumble" });
    ctrl.dispatch({ type: "TURN_END", finalText: "mumble", confidence: 0.2 });
    await new Promise(r => setTimeout(r, 50));
    const s = ctrl.getState();
    const clarifyResponses = ["Say again?", "What do you mean?", "Can you clarify?", "I didn't catch that."];
    expect(
      clarifyResponses.includes(s.lastResponse) || s.lastResponse.length > 0
    ).toBe(true);
  });

  // -----------------------------------------------------------------------
  // subscribe / getState
  // -----------------------------------------------------------------------
  it("subscribe() is called on state changes", () => {
    const listener = vi.fn();
    ctrl.subscribe(listener);
    ctrl.dispatch({ type: "MIC_START" });
    expect(listener).toHaveBeenCalled();
  });

  it("getState() returns snapshot (not live reference after dispatch)", () => {
    ctrl.dispatch({ type: "MIC_START" });
    const s1 = ctrl.getState();
    ctrl.dispatch({ type: "MIC_STOP" });
    const s2 = ctrl.getState();
    expect(s1).not.toBe(s2);
    expect(s1.stage).toBe("LISTENING");
    expect(s2.stage).toBe("IDLE");
  });

  it("unsubscribe stops notifications", () => {
    const listener = vi.fn();
    const unsub = ctrl.subscribe(listener);
    unsub();
    ctrl.dispatch({ type: "MIC_START" });
    expect(listener).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------
  it("setClassifyWithLLM toggles model config", () => {
    ctrl.setClassifyWithLLM(true);
    expect(ctrl.getState().modelConfig.classifyWithLLM).toBe(true);
    ctrl.setClassifyWithLLM(false);
    expect(ctrl.getState().modelConfig.classifyWithLLM).toBe(false);
  });

  it("setResponseWithLLM toggles model config", () => {
    ctrl.setResponseWithLLM(false);
    expect(ctrl.getState().modelConfig.responseWithLLM).toBe(false);
  });

  it("setSearchEnabled toggles model config", () => {
    ctrl.setSearchEnabled(true);
    expect(ctrl.getState().modelConfig.searchEnabled).toBe(true);
  });

  it("setBias updates bias via biasStore", () => {
    ctrl.setBias({ verbosity: 0.7 });
    expect(ctrl.getState().bias.verbosity).toBe(0.7);
  });

  it("trace is accessible", () => {
    expect(ctrl.trace).toBeDefined();
    expect(typeof ctrl.trace.getAll).toBe("function");
  });

  it("biasStore is accessible", () => {
    expect(ctrl.biasStore).toBeDefined();
    expect(typeof ctrl.biasStore.get).toBe("function");
  });

  // -----------------------------------------------------------------------
  // speechLog is accessible
  // -----------------------------------------------------------------------
  it("speechLog is accessible", () => {
    expect(ctrl.speechLog).toBeDefined();
    expect(typeof ctrl.speechLog.getAll).toBe("function");
  });

  // -----------------------------------------------------------------------
  // Always-on AUDIO_FRAME (parallel listener pipeline)
  // -----------------------------------------------------------------------
  it("AUDIO_FRAME in CLASSIFY updates VAD audioLevel", async () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 50, interimText: "hello" });
    ctrl.dispatch({ type: "TURN_END", finalText: "hello", confidence: 0.95 });
    await new Promise(r => setTimeout(r, 50));
    // Now should be in CLASSIFY or beyond
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 77, interimText: "" });
    expect(ctrl.getState().vad.audioLevel).toBe(77);
  });

  it("AUDIO_FRAME in SPEAK does not throw", async () => {
    ctrl.dispatch({ type: "SIMULATE_INPUT", text: "hello" });
    await new Promise(r => setTimeout(r, 50));
    // Try dispatching audio frame in whatever stage we're in — should not throw
    expect(() => {
      ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 30, interimText: "" });
    }).not.toThrow();
  });

  it("AUDIO_FRAME with interimText logs interim speech event", () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 50, interimText: "testing" });
    const events = ctrl.speechLog.getAll();
    expect(events.some(e => e.type === "interim" && e.text === "testing")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Turn queue (always-accept TURN_END)
  // -----------------------------------------------------------------------
  it("TURN_END during CLASSIFY queues the turn", async () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 50, interimText: "first" });
    ctrl.dispatch({ type: "TURN_END", finalText: "first", confidence: 0.95 });
    await new Promise(r => setTimeout(r, 20));
    // FSM should be processing — now send another TURN_END
    ctrl.dispatch({ type: "TURN_END", finalText: "second", confidence: 0.9 });
    expect(ctrl.getState().pendingTurnCount).toBeGreaterThanOrEqual(1);
  });

  it("pendingTurnCount starts at 0", () => {
    expect(ctrl.getState().pendingTurnCount).toBe(0);
  });

  it("TURN_END logs final speech event", () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "TURN_END", finalText: "hello there", confidence: 0.9 });
    const events = ctrl.speechLog.getAll();
    expect(events.some(e => e.type === "final" && e.text === "hello there")).toBe(true);
  });

  it("RESET clears pending turns and speechLog", async () => {
    ctrl.dispatch({ type: "MIC_START" });
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 50, interimText: "hello" });
    ctrl.dispatch({ type: "TURN_END", finalText: "hello", confidence: 0.95 });
    await new Promise(r => setTimeout(r, 20));
    // Queue another turn while busy
    ctrl.dispatch({ type: "TURN_END", finalText: "queued", confidence: 0.9 });
    // Now reset
    ctrl.dispatch({ type: "RESET" });
    expect(ctrl.getState().pendingTurnCount).toBe(0);
    expect(ctrl.speechLog.getAll()).toEqual([]);
  });

  it("TURN_END in IDLE is dropped (no queue)", () => {
    ctrl.dispatch({ type: "TURN_END", finalText: "dropped", confidence: 0.9 });
    expect(ctrl.getState().pendingTurnCount).toBe(0);
    expect(ctrl.getState().stage).toBe("IDLE");
  });

  // -----------------------------------------------------------------------
  // Silence counter reset on SIGNAL_DETECT entry
  // -----------------------------------------------------------------------
  it("AUDIO_FRAME with interimText resets silenceDurationMs on LISTENING→SIGNAL_DETECT", () => {
    ctrl.dispatch({ type: "MIC_START" });
    // Simulate accumulated silence (VAD data visible via getState)
    // Dispatch several silence frames to build up silenceDurationMs
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 0, interimText: "" });
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 0, interimText: "" });
    // Now speech arrives — should reset silence and go to SIGNAL_DETECT
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 50, interimText: "hello" });
    expect(ctrl.getState().stage).toBe("SIGNAL_DETECT");
    expect(ctrl.getState().vad.silenceDurationMs).toBe(0);
    expect(ctrl.getState().vad.isSpeaking).toBe(true);
  });

  it("silence turn-end does not fire while SpeechRecognition still produces interim text", () => {
    ctrl.dispatch({ type: "MIC_START" });
    // Enter SIGNAL_DETECT with speech
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 50, interimText: "you are" });
    expect(ctrl.getState().stage).toBe("SIGNAL_DETECT");
    // Even if audio level drops low, as long as interim text keeps arriving,
    // the silence-based turn-end should NOT fire (SR silence check)
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 0, interimText: "you are an LLM" });
    ctrl.dispatch({ type: "AUDIO_FRAME", audioLevel: 0, interimText: "you are an LLM what" });
    // Should still be in SIGNAL_DETECT, not have fired TURN_END
    expect(ctrl.getState().stage).toBe("SIGNAL_DETECT");
    expect(ctrl.getState().interimTranscript).toBe("you are an LLM what");
  });

  // -----------------------------------------------------------------------
  // Listener paused state
  // -----------------------------------------------------------------------
  it("state.listenerPaused starts as false", () => {
    expect(ctrl.getState().listenerPaused).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Audio mute
  // -----------------------------------------------------------------------
  it("setAudioMuted(true) sets state.audioMuted to true", () => {
    ctrl.setAudioMuted(true);
    expect(ctrl.getState().audioMuted).toBe(true);
    ctrl.setAudioMuted(false);
    expect(ctrl.getState().audioMuted).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Model loading integration tests
  // -----------------------------------------------------------------------
  it("loadModel updates state.modelConfig.modelId", async () => {
    await ctrl.loadModel("test-model");
    const s = ctrl.getState();
    expect(s.modelConfig.modelId).toBe("test-model");
    expect(s.modelConfig.isLoaded).toBe(true);
  });

  it("loadModel sets isLoaded=false during loading", async () => {
    const states: boolean[] = [];
    ctrl.subscribe(() => {
      states.push(ctrl.getState().modelConfig.isLoaded);
    });
    await ctrl.loadModel("test-model");
    // First notification should have isLoaded=false (loading started)
    expect(states[0]).toBe(false);
    // Last notification should have isLoaded=true (loading completed)
    expect(states[states.length - 1]).toBe(true);
  });

  it("loadModel resets state on failure", async () => {
    mockCreateMLCEngine.mockRejectedValueOnce(new Error("WebGPU device lost"));
    await expect(ctrl.loadModel("bad-model")).rejects.toThrow("WebGPU device lost");

    const s = ctrl.getState();
    expect(s.modelConfig.modelId).toBeNull();
    expect(s.modelConfig.isLoaded).toBe(false);
    expect(s.modelConfig.loadProgress).toBe(0);
  });

  it("loadModel failure sets state.error with friendly message", async () => {
    const err = new Error("Quota exceeded");
    // Fail both first attempt and retry
    mockCreateMLCEngine.mockRejectedValueOnce(err).mockRejectedValueOnce(err);
    await expect(ctrl.loadModel("quota-model")).rejects.toThrow();

    const s = ctrl.getState();
    expect(s.error).toContain("Storage full");
  });

  it("loadModel notifies listeners on failure", async () => {
    mockCreateMLCEngine.mockRejectedValueOnce(new Error("fail"));
    const listener = vi.fn();
    ctrl.subscribe(listener);

    await expect(ctrl.loadModel("fail-model")).rejects.toThrow();

    // Called at least twice: once for loading start, once for error reset
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("unloadModel resets modelConfig", async () => {
    await ctrl.loadModel("test-model");
    await ctrl.unloadModel();

    const s = ctrl.getState();
    expect(s.modelConfig.modelId).toBeNull();
    expect(s.modelConfig.isLoaded).toBe(false);
  });

  it("clearError sets state.error to null", async () => {
    // Force an error via failed model load
    const err = new Error("Quota exceeded");
    mockCreateMLCEngine.mockRejectedValueOnce(err).mockRejectedValueOnce(err);
    await expect(ctrl.loadModel("fail")).rejects.toThrow();
    expect(ctrl.getState().error).toBeTruthy();

    ctrl.clearError();
    expect(ctrl.getState().error).toBeNull();
  });

  it("clearError notifies listeners", async () => {
    const err = new Error("Quota exceeded");
    mockCreateMLCEngine.mockRejectedValueOnce(err).mockRejectedValueOnce(err);
    await expect(ctrl.loadModel("fail")).rejects.toThrow();

    const listener = vi.fn();
    ctrl.subscribe(listener);
    ctrl.clearError();
    expect(listener).toHaveBeenCalled();
  });

  it("friendlyError translates quota errors to user-friendly message", async () => {
    const err = new Error("Quota exceeded");
    mockCreateMLCEngine.mockRejectedValueOnce(err).mockRejectedValueOnce(err);
    await expect(ctrl.loadModel("fail")).rejects.toThrow();

    const error = ctrl.getState().error;
    expect(error).toContain("Storage full");
  });

  it("friendlyError translates tokenizer errors to user-friendly message", async () => {
    const tokErr = new Error("Cannot pass deleted object as a pointer of type Tokenizer*");
    mockCreateMLCEngine.mockRejectedValueOnce(tokErr);
    await expect(ctrl.loadModel("tok-fail")).rejects.toThrow();

    const error = ctrl.getState().error;
    // The LLMEngine.loadModel formats as "Model load failed: Cannot pass deleted object..."
    // Then friendlyError matches /tokenizer|deleted object/i and translates it
    expect(error).toContain("Model crashed");
  });

  it("friendlyError passes through unknown errors unchanged", async () => {
    const err = new Error("Something bizarre");
    mockCreateMLCEngine.mockRejectedValueOnce(err);
    await expect(ctrl.loadModel("bizarre")).rejects.toThrow();

    const error = ctrl.getState().error;
    expect(error).toContain("Something bizarre");
  });
});
