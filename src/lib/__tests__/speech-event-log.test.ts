import { describe, it, expect, vi } from "vitest";
import { SpeechEventLog } from "../speech-event-log.ts";

describe("SpeechEventLog", () => {
  it("starts with no entries", () => {
    const log = new SpeechEventLog();
    expect(log.getAll()).toEqual([]);
  });

  it("add() creates an entry with auto-incrementing id", () => {
    const log = new SpeechEventLog();
    const e1 = log.add("interim", "hello", 0, "LISTENING");
    const e2 = log.add("final", "hello world", 0.95, "SIGNAL_DETECT");
    expect(e1.id).toBe(1);
    expect(e2.id).toBe(2);
  });

  it("add() populates all required fields", () => {
    const log = new SpeechEventLog();
    const e = log.add("final", "testing", 0.9, "CLASSIFY");
    expect(e.type).toBe("final");
    expect(e.text).toBe("testing");
    expect(e.confidence).toBe(0.9);
    expect(e.fsmStage).toBe("CLASSIFY");
    expect(typeof e.timestampMs).toBe("number");
    expect(e.timestampMs).toBeGreaterThan(0);
  });

  it("add() accepts optional extra fields", () => {
    const log = new SpeechEventLog();
    const e = log.add("dequeued", "queued text", 0.85, "LISTENING", {
      processedAt: 1700000000100,
      queueDurationMs: 340,
    });
    expect(e.processedAt).toBe(1700000000100);
    expect(e.queueDurationMs).toBe(340);
  });

  it("getAll() returns a copy", () => {
    const log = new SpeechEventLog();
    log.add("interim", "hi", 0, "LISTENING");
    const a = log.getAll();
    const b = log.getAll();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("getRecent() returns last N entries", () => {
    const log = new SpeechEventLog();
    for (let i = 0; i < 10; i++) {
      log.add("interim", `text${i}`, 0, "LISTENING");
    }
    const recent = log.getRecent(3);
    expect(recent).toHaveLength(3);
    expect(recent[0].text).toBe("text7");
    expect(recent[2].text).toBe("text9");
  });

  it("getRecent() returns referentially stable results when unchanged", () => {
    const log = new SpeechEventLog();
    log.add("final", "hello", 0.9, "SIGNAL_DETECT");
    const a = log.getRecent(100);
    const b = log.getRecent(100);
    expect(a).toBe(b); // same reference
  });

  it("getRecent() cache is invalidated after add()", () => {
    const log = new SpeechEventLog();
    log.add("final", "hello", 0.9, "SIGNAL_DETECT");
    const a = log.getRecent(100);
    log.add("final", "world", 0.8, "SIGNAL_DETECT");
    const b = log.getRecent(100);
    expect(a).not.toBe(b);
    expect(b).toHaveLength(2);
  });

  it("clear() removes all entries", () => {
    const log = new SpeechEventLog();
    log.add("interim", "hi", 0, "LISTENING");
    log.add("final", "hi there", 0.9, "SIGNAL_DETECT");
    log.clear();
    expect(log.getAll()).toEqual([]);
  });

  it("enforces max 200 entries", () => {
    const log = new SpeechEventLog();
    for (let i = 0; i < 250; i++) {
      log.add("interim", `text${i}`, 0, "LISTENING");
    }
    expect(log.getAll().length).toBeLessThanOrEqual(200);
  });

  it("subscribe() fires on add()", () => {
    const log = new SpeechEventLog();
    const listener = vi.fn();
    log.subscribe(listener);
    log.add("interim", "hello", 0, "LISTENING");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("subscribe() fires on clear()", () => {
    const log = new SpeechEventLog();
    const listener = vi.fn();
    log.subscribe(listener);
    log.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops notifications", () => {
    const log = new SpeechEventLog();
    const listener = vi.fn();
    const unsub = log.subscribe(listener);
    unsub();
    log.add("interim", "hello", 0, "LISTENING");
    expect(listener).not.toHaveBeenCalled();
  });
});
