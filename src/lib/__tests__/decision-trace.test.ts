import { describe, it, expect, vi } from "vitest";
import { DecisionTrace } from "../decision-trace.ts";

describe("DecisionTrace", () => {
  it("add() creates entry with correct fields", () => {
    const trace = new DecisionTrace();
    trace.add("IDLE", "test_event", "test detail", { key: "value" });
    const entries = trace.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].stage).toBe("IDLE");
    expect(entries[0].event).toBe("test_event");
    expect(entries[0].detail).toBe("test detail");
    expect(entries[0].data).toEqual({ key: "value" });
    expect(entries[0].timestamp).toBeGreaterThan(0);
  });

  it("getAll() returns all entries", () => {
    const trace = new DecisionTrace();
    trace.add("IDLE", "a", "first");
    trace.add("LISTENING", "b", "second");
    trace.add("CLASSIFY", "c", "third");
    expect(trace.getAll()).toHaveLength(3);
  });

  it("getAll() returns a copy", () => {
    const trace = new DecisionTrace();
    trace.add("IDLE", "a", "first");
    const all1 = trace.getAll();
    const all2 = trace.getAll();
    expect(all1).toEqual(all2);
    expect(all1).not.toBe(all2);
  });

  it("getRecent() returns last N entries", () => {
    const trace = new DecisionTrace();
    for (let i = 0; i < 5; i++) {
      trace.add("IDLE", `event_${i}`, `detail ${i}`);
    }
    const recent = trace.getRecent(100);
    expect(recent).toHaveLength(5);
  });

  it("getRecent() returns referentially stable snapshot when no changes", () => {
    const trace = new DecisionTrace();
    trace.add("IDLE", "a", "first");
    const snap1 = trace.getRecent();
    const snap2 = trace.getRecent();
    expect(snap1).toBe(snap2); // same reference
  });

  it("getRecent() returns new reference after add()", () => {
    const trace = new DecisionTrace();
    trace.add("IDLE", "a", "first");
    const snap1 = trace.getRecent();
    trace.add("IDLE", "b", "second");
    const snap2 = trace.getRecent();
    expect(snap1).not.toBe(snap2);
  });

  it("clear() empties all entries", () => {
    const trace = new DecisionTrace();
    trace.add("IDLE", "a", "first");
    trace.add("IDLE", "b", "second");
    trace.clear();
    expect(trace.getAll()).toHaveLength(0);
    expect(trace.getRecent()).toHaveLength(0);
  });

  it("auto-truncates at 200 entries", () => {
    const trace = new DecisionTrace();
    for (let i = 0; i < 250; i++) {
      trace.add("IDLE", `event_${i}`, `detail ${i}`);
    }
    expect(trace.getAll().length).toBeLessThanOrEqual(200);
  });

  it("getRecent returns at most 100 entries", () => {
    const trace = new DecisionTrace();
    for (let i = 0; i < 150; i++) {
      trace.add("IDLE", `event_${i}`, `detail ${i}`);
    }
    expect(trace.getRecent(100).length).toBeLessThanOrEqual(100);
  });

  it("subscribe() fires on add()", () => {
    const trace = new DecisionTrace();
    const listener = vi.fn();
    trace.subscribe(listener);
    trace.add("IDLE", "test", "detail");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("subscribe() fires on clear()", () => {
    const trace = new DecisionTrace();
    const listener = vi.fn();
    trace.subscribe(listener);
    trace.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops notifications", () => {
    const trace = new DecisionTrace();
    const listener = vi.fn();
    const unsub = trace.subscribe(listener);
    unsub();
    trace.add("IDLE", "test", "detail");
    expect(listener).not.toHaveBeenCalled();
  });

  it("entries have incrementing timestamps", () => {
    const trace = new DecisionTrace();
    trace.add("IDLE", "a", "first");
    trace.add("IDLE", "b", "second");
    const entries = trace.getAll();
    expect(entries[1].timestamp).toBeGreaterThanOrEqual(entries[0].timestamp);
  });
});
