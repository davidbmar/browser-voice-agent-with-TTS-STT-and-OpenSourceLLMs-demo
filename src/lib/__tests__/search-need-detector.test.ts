import { describe, it, expect } from "vitest";
import { detectSearchNeed, extractSearchQuery } from "../search-need-detector.ts";

describe("detectSearchNeed", () => {
  it("returns needsSearch false for empty transcript", () => {
    const result = detectSearchNeed("", "question", 0.9);
    expect(result.needsSearch).toBe(false);
    expect(result.reason).toContain("empty");
  });

  it("returns needsSearch false for whitespace-only transcript", () => {
    const result = detectSearchNeed("   ", "question", 0.9);
    expect(result.needsSearch).toBe(false);
  });

  it("returns needsSearch false for low confidence", () => {
    const result = detectSearchNeed("what is the weather today", "question", 0.2);
    expect(result.needsSearch).toBe(false);
    expect(result.reason).toContain("confidence");
  });

  it("returns needsSearch false for confidence exactly 0.3", () => {
    // 0.3 is NOT < 0.3, so it should pass the confidence check
    const result = detectSearchNeed("what is the weather today", "question", 0.3);
    expect(result.needsSearch).toBe(true);
  });

  it("returns needsSearch false for greeting intent", () => {
    const result = detectSearchNeed("hello there", "greeting", 0.9);
    expect(result.needsSearch).toBe(false);
    expect(result.reason).toContain("not searchable");
  });

  it("returns needsSearch false for acknowledgement intent", () => {
    const result = detectSearchNeed("okay thanks", "acknowledgement", 0.9);
    expect(result.needsSearch).toBe(false);
  });

  it("returns needsSearch false for farewell intent", () => {
    const result = detectSearchNeed("goodbye", "farewell", 0.9);
    expect(result.needsSearch).toBe(false);
  });

  it("triggers search for temporal marker 'today'", () => {
    const result = detectSearchNeed("what is happening today", "question", 0.9);
    expect(result.needsSearch).toBe(true);
    expect(result.reason).toContain("temporal");
  });

  it("triggers search for temporal marker 'latest'", () => {
    const result = detectSearchNeed("what are the latest news", "question", 0.9);
    expect(result.needsSearch).toBe(true);
  });

  it("triggers search for year marker '2026'", () => {
    const result = detectSearchNeed("what happened in 2026", "question", 0.9);
    expect(result.needsSearch).toBe(true);
    expect(result.reason).toContain("2026");
  });

  it("triggers search for factual pattern 'what is'", () => {
    const result = detectSearchNeed("what is the population of France", "question", 0.9);
    expect(result.needsSearch).toBe(true);
    expect(result.reason).toContain("factual");
  });

  it("triggers search for factual pattern 'who is'", () => {
    const result = detectSearchNeed("who is the president of the United States", "question", 0.9);
    expect(result.needsSearch).toBe(true);
  });

  it("triggers search for factual pattern 'how many'", () => {
    const result = detectSearchNeed("how many people live in Tokyo", "question", 0.9);
    expect(result.needsSearch).toBe(true);
  });

  it("triggers search for keyword 'weather'", () => {
    const result = detectSearchNeed("tell me the weather", "command", 0.9);
    expect(result.needsSearch).toBe(true);
    expect(result.reason).toContain("weather");
  });

  it("triggers search for keyword 'news'", () => {
    const result = detectSearchNeed("show me the news", "command", 0.9);
    expect(result.needsSearch).toBe(true);
  });

  it("triggers search for keyword 'price'", () => {
    const result = detectSearchNeed("what is the price of bitcoin", "question", 0.9);
    expect(result.needsSearch).toBe(true);
  });

  it("triggers search for keyword 'score'", () => {
    const result = detectSearchNeed("what was the score last night", "question", 0.9);
    expect(result.needsSearch).toBe(true);
  });

  it("does not trigger search when score is only 1 (question intent only)", () => {
    // "question" intent gives +1, but no temporal/factual/keyword signals
    const result = detectSearchNeed("tell me a joke", "question", 0.9);
    expect(result.needsSearch).toBe(false);
    expect(result.reason).toContain("score 1");
  });

  it("does not trigger search for statement without signals", () => {
    const result = detectSearchNeed("I like pizza", "statement", 0.9);
    expect(result.needsSearch).toBe(false);
  });

  it("triggers search for statement with keyword (score 2)", () => {
    const result = detectSearchNeed("I want to check the weather", "statement", 0.9);
    expect(result.needsSearch).toBe(true);
  });

  it("returns a searchQuery when search is triggered", () => {
    const result = detectSearchNeed("what is the weather today", "question", 0.9);
    expect(result.needsSearch).toBe(true);
    expect(result.searchQuery).toBeTruthy();
    expect(result.searchQuery.length).toBeGreaterThan(0);
  });
});

describe("extractSearchQuery", () => {
  it("strips common question prefixes", () => {
    const query = extractSearchQuery("hey can you tell me the weather");
    expect(query).not.toMatch(/^hey/i);
    expect(query).not.toMatch(/can you/i);
  });

  it("removes trailing punctuation", () => {
    const query = extractSearchQuery("what is the weather?");
    expect(query).not.toContain("?");
  });

  it("removes filler words", () => {
    const query = extractSearchQuery("um like what is actually the weather basically");
    expect(query).not.toContain("um");
    expect(query).not.toContain("like");
    expect(query).not.toContain("actually");
    expect(query).not.toContain("basically");
  });

  it("collapses whitespace", () => {
    const query = extractSearchQuery("what   is   the   weather");
    expect(query).not.toContain("  ");
  });

  it("falls back to original transcript when cleaned query is too short", () => {
    // "ok" and "um" are filler words, leaving very little
    const query = extractSearchQuery("ok um hi");
    expect(query.length).toBeGreaterThanOrEqual(3);
  });

  it("preserves meaningful words", () => {
    const query = extractSearchQuery("what is the weather in Austin today");
    expect(query).toContain("weather");
    expect(query).toContain("Austin");
    expect(query).toContain("today");
  });
});
