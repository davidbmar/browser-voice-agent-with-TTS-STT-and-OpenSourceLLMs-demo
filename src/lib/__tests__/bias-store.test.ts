import { describe, it, expect, vi } from "vitest";
import { BiasStore } from "../bias-store.ts";
import { DEFAULT_BIAS } from "../loop-types.ts";

describe("BiasStore", () => {
  it("initial state matches DEFAULT_BIAS", () => {
    const store = new BiasStore();
    expect(store.get()).toEqual(DEFAULT_BIAS);
  });

  it("get() returns a copy, not a reference", () => {
    const store = new BiasStore();
    const a = store.get();
    const b = store.get();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("set() merges partial values", () => {
    const store = new BiasStore();
    store.set({ verbosity: 0.5 });
    expect(store.get().verbosity).toBe(0.5);
  });

  it("set() does not affect unspecified fields", () => {
    const store = new BiasStore();
    const before = store.get();
    store.set({ verbosity: 0.5 });
    const after = store.get();
    expect(after.clarificationThreshold).toBe(before.clarificationThreshold);
    expect(after.silenceThresholdMs).toBe(before.silenceThresholdMs);
  });

  it("reset() returns to defaults", () => {
    const store = new BiasStore();
    store.set({ verbosity: 0.9, clarificationThreshold: 0.1 });
    store.reset();
    expect(store.get()).toEqual(DEFAULT_BIAS);
  });

  it("updateFromReaction('repeat_request') increases verbosity by 0.1", () => {
    const store = new BiasStore();
    const before = store.get().verbosity;
    store.updateFromReaction("repeat_request");
    expect(store.get().verbosity).toBeCloseTo(before + 0.1);
  });

  it("updateFromReaction('interruption') decreases verbosity and increases interruptionSensitivity", () => {
    const store = new BiasStore();
    const beforeV = store.get().verbosity;
    const beforeI = store.get().interruptionSensitivity;
    store.updateFromReaction("interruption");
    expect(store.get().verbosity).toBeCloseTo(beforeV - 0.15);
    expect(store.get().interruptionSensitivity).toBeCloseTo(beforeI + 0.1);
  });

  it("updateFromReaction('silence') decreases clarificationThreshold by 0.05", () => {
    const store = new BiasStore();
    const before = store.get().clarificationThreshold;
    store.updateFromReaction("silence");
    expect(store.get().clarificationThreshold).toBeCloseTo(before - 0.05);
  });

  it("updateFromReaction('correction') decreases confidenceFloor by 0.05", () => {
    const store = new BiasStore();
    const before = store.get().confidenceFloor;
    store.updateFromReaction("correction");
    expect(store.get().confidenceFloor).toBeCloseTo(before - 0.05);
  });

  it("updateFromReaction('acknowledgement') changes nothing", () => {
    const store = new BiasStore();
    const before = store.get();
    store.updateFromReaction("acknowledgement");
    expect(store.get()).toEqual(before);
  });

  it("verbosity is clamped at 1.0 upper bound", () => {
    const store = new BiasStore();
    store.set({ verbosity: 0.95 });
    store.updateFromReaction("repeat_request"); // +0.1 → should clamp to 1.0
    expect(store.get().verbosity).toBe(1);
  });

  it("verbosity is clamped at -1.0 lower bound", () => {
    const store = new BiasStore();
    store.set({ verbosity: -0.9 });
    store.updateFromReaction("interruption"); // -0.15 → should clamp to -1.0
    expect(store.get().verbosity).toBe(-1);
  });

  it("clarificationThreshold is floored at 0.3", () => {
    const store = new BiasStore();
    store.set({ clarificationThreshold: 0.32 });
    store.updateFromReaction("silence"); // -0.05 → should floor at 0.3
    expect(store.get().clarificationThreshold).toBeCloseTo(0.3);
  });

  it("confidenceFloor is floored at 0.3", () => {
    const store = new BiasStore();
    store.set({ confidenceFloor: 0.32 });
    store.updateFromReaction("correction"); // -0.05 → should floor at 0.3
    expect(store.get().confidenceFloor).toBeCloseTo(0.3);
  });

  it("subscribe() fires on changes", () => {
    const store = new BiasStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ verbosity: 0.5 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops notifications", () => {
    const store = new BiasStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.set({ verbosity: 0.5 });
    expect(listener).not.toHaveBeenCalled();
  });

  it("subscribe fires on updateFromReaction", () => {
    const store = new BiasStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.updateFromReaction("silence");
    expect(listener).toHaveBeenCalled();
  });

  it("subscribe fires on reset", () => {
    const store = new BiasStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.reset();
    expect(listener).toHaveBeenCalled();
  });

  it("updateFromReaction('follow_up') increases verbosity by 0.05", () => {
    const store = new BiasStore();
    const before = store.get().verbosity;
    store.updateFromReaction("follow_up");
    expect(store.get().verbosity).toBeCloseTo(before + 0.05);
  });

  it("updateFromReaction('follow_up') clamps verbosity at 1.0", () => {
    const store = new BiasStore();
    store.set({ verbosity: 0.98 });
    store.updateFromReaction("follow_up"); // +0.05 → should clamp to 1.0
    expect(store.get().verbosity).toBe(1);
  });
});
