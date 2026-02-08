import { describe, it, expect } from "vitest";
import { MockSearchProvider } from "../search-provider.ts";

describe("MockSearchProvider", () => {
  const provider = new MockSearchProvider();

  it("has name 'mock'", () => {
    expect(provider.name).toBe("mock");
  });

  it("returns weather results for query containing 'weather'", async () => {
    const response = await provider.search("what is the weather");
    expect(response.results.length).toBeGreaterThanOrEqual(1);
    expect(response.results[0].title.toLowerCase()).toContain("weather");
  });

  it("returns news results for query containing 'news'", async () => {
    const response = await provider.search("latest news today");
    expect(response.results.length).toBeGreaterThanOrEqual(1);
    expect(response.results.some(r => r.title.toLowerCase().includes("news") || r.title.toLowerCase().includes("headline"))).toBe(true);
  });

  it("returns generic fallback for unknown queries", async () => {
    const response = await provider.search("something completely random xyz");
    expect(response.results.length).toBe(1);
    expect(response.results[0].snippet).toContain("mock result");
  });

  it("respects maxResults parameter", async () => {
    const response = await provider.search("weather forecast", 1);
    expect(response.results.length).toBeLessThanOrEqual(1);
  });

  it("returns correct SearchResponse shape", async () => {
    const response = await provider.search("test query");
    expect(response).toHaveProperty("query", "test query");
    expect(response).toHaveProperty("results");
    expect(response).toHaveProperty("durationMs");
    expect(response).toHaveProperty("provider", "mock");
    expect(Array.isArray(response.results)).toBe(true);
  });

  it("reports positive durationMs", async () => {
    const response = await provider.search("weather");
    expect(response.durationMs).toBeGreaterThan(0);
  });

  it("all results have required fields", async () => {
    const response = await provider.search("weather");
    for (const result of response.results) {
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("snippet");
      expect(typeof result.title).toBe("string");
      expect(typeof result.url).toBe("string");
      expect(typeof result.snippet).toBe("string");
    }
  });
});
