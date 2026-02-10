import { describe, it, expect } from "vitest";
import {
  DEFAULT_BIAS,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_LOOP_STATE,
  STAGES_IN_ORDER,
  MODEL_CATALOG,
} from "../loop-types.ts";

describe("DEFAULT_BIAS", () => {
  it("has all required fields", () => {
    expect(DEFAULT_BIAS).toHaveProperty("verbosity");
    expect(DEFAULT_BIAS).toHaveProperty("clarificationThreshold");
    expect(DEFAULT_BIAS).toHaveProperty("interruptionSensitivity");
    expect(DEFAULT_BIAS).toHaveProperty("responseSpeed");
    expect(DEFAULT_BIAS).toHaveProperty("silenceThresholdMs");
    expect(DEFAULT_BIAS).toHaveProperty("confidenceFloor");
  });

  it("has sensible default values", () => {
    expect(DEFAULT_BIAS.verbosity).toBe(0);
    expect(DEFAULT_BIAS.silenceThresholdMs).toBe(1500);
    expect(DEFAULT_BIAS.confidenceFloor).toBe(0.6);
  });
});

describe("DEFAULT_MODEL_CONFIG", () => {
  it("has all required fields with correct defaults", () => {
    expect(DEFAULT_MODEL_CONFIG.classifyWithLLM).toBe(false);
    expect(DEFAULT_MODEL_CONFIG.responseWithLLM).toBe(true);
    expect(DEFAULT_MODEL_CONFIG.searchEnabled).toBe(true);
    expect(DEFAULT_MODEL_CONFIG.speakMonologue).toBe(false);
    expect(DEFAULT_MODEL_CONFIG.modelId).toBeNull();
    expect(DEFAULT_MODEL_CONFIG.isLoaded).toBe(false);
    expect(DEFAULT_MODEL_CONFIG.loadProgress).toBe(0);
  });

  it("searchEnabled is true by default", () => {
    expect(DEFAULT_MODEL_CONFIG.searchEnabled).toBe(true);
  });

  it("speakMonologue is false by default", () => {
    expect(DEFAULT_MODEL_CONFIG.speakMonologue).toBe(false);
  });
});

describe("DEFAULT_LOOP_STATE", () => {
  it("has all required fields", () => {
    expect(DEFAULT_LOOP_STATE).toHaveProperty("stage", "IDLE");
    expect(DEFAULT_LOOP_STATE).toHaveProperty("loopCount", 0);
    expect(DEFAULT_LOOP_STATE).toHaveProperty("vad");
    expect(DEFAULT_LOOP_STATE).toHaveProperty("interimTranscript", "");
    expect(DEFAULT_LOOP_STATE).toHaveProperty("finalTranscript", "");
    expect(DEFAULT_LOOP_STATE).toHaveProperty("classification", null);
    expect(DEFAULT_LOOP_STATE).toHaveProperty("lastResponse", "");
    expect(DEFAULT_LOOP_STATE).toHaveProperty("lastThinking", "");
    expect(DEFAULT_LOOP_STATE).toHaveProperty("history");
    expect(DEFAULT_LOOP_STATE).toHaveProperty("isRunning", false);
    expect(DEFAULT_LOOP_STATE).toHaveProperty("error", null);
    expect(DEFAULT_LOOP_STATE).toHaveProperty("audioDiagnostics");
    expect(DEFAULT_LOOP_STATE).toHaveProperty("lastSearchQuery", "");
    expect(DEFAULT_LOOP_STATE).toHaveProperty("lastSearchResults");
    expect(DEFAULT_LOOP_STATE).toHaveProperty("lastSearchDurationMs", 0);
    expect(DEFAULT_LOOP_STATE).toHaveProperty("lastSearchProvider", "");
  });

  it("starts in IDLE stage with empty history", () => {
    expect(DEFAULT_LOOP_STATE.stage).toBe("IDLE");
    expect(DEFAULT_LOOP_STATE.history).toEqual([]);
    expect(DEFAULT_LOOP_STATE.isRunning).toBe(false);
  });

  it("has pendingTurnCount initialized to 0", () => {
    expect(DEFAULT_LOOP_STATE.pendingTurnCount).toBe(0);
  });

  it("has listenerPaused initialized to false", () => {
    expect(DEFAULT_LOOP_STATE.listenerPaused).toBe(false);
  });

  it("has audioMuted initialized to false", () => {
    expect(DEFAULT_LOOP_STATE.audioMuted).toBe(false);
  });
});

describe("STAGES_IN_ORDER", () => {
  it("contains all 9 stages", () => {
    expect(STAGES_IN_ORDER).toHaveLength(8);
  });

  it("starts with IDLE", () => {
    expect(STAGES_IN_ORDER[0]).toBe("IDLE");
  });

  it("contains all expected stages", () => {
    const expected = [
      "IDLE", "LISTENING", "SIGNAL_DETECT", "CLASSIFY",
      "MICRO_RESPONSE", "SPEAK", "FEEDBACK_OBSERVE", "UPDATE_BIAS",
    ];
    for (const stage of expected) {
      expect(STAGES_IN_ORDER).toContain(stage);
    }
  });
});

describe("MODEL_CATALOG", () => {
  it("has entries with required fields", () => {
    expect(MODEL_CATALOG.length).toBeGreaterThan(0);
    for (const model of MODEL_CATALOG) {
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("name");
      expect(model).toHaveProperty("vramGB");
      expect(model).toHaveProperty("tags");
      expect(typeof model.id).toBe("string");
      expect(typeof model.name).toBe("string");
      expect(typeof model.vramGB).toBe("number");
      expect(Array.isArray(model.tags)).toBe(true);
    }
  });

  it("has unique IDs", () => {
    const ids = MODEL_CATALOG.map(m => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("has positive vramGB values", () => {
    for (const model of MODEL_CATALOG) {
      expect(model.vramGB).toBeGreaterThan(0);
    }
  });
});
