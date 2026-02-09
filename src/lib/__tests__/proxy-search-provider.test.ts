import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProxySearchProvider } from "../proxy-search-provider.ts";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  };
}

describe("ProxySearchProvider", () => {
  let provider: ProxySearchProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ProxySearchProvider("https://api.example.com/prod");
  });

  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------
  it("has name 'proxy'", () => {
    expect(provider.name).toBe("proxy");
  });

  it("strips trailing slashes from endpoint URL", () => {
    const p = new ProxySearchProvider("https://api.example.com/prod///");
    // Verify by making a search call and checking the URL
    mockFetch.mockResolvedValue(mockResponse(200, { query: "test", results: [], durationMs: 50, provider: "google" }));
    p.search("test");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/prod/search",
      expect.any(Object),
    );
  });

  // -----------------------------------------------------------------------
  // search — happy path
  // -----------------------------------------------------------------------
  it("returns SearchResponse from successful search", async () => {
    const mockBody = {
      query: "weather Austin",
      results: [
        { title: "Weather", url: "https://weather.com", snippet: "Sunny 72F" },
        { title: "Forecast", url: "https://forecast.com", snippet: "Clear skies" },
      ],
      durationMs: 350,
      provider: "google",
      quota: {
        google: { used: 5, limit: 100, period: "2026-02-08" },
        brave: { used: 0, limit: 2000, period: "2026-02" },
        tavily: { used: 0, limit: 1000, period: "2026-02" },
      },
    };
    mockFetch.mockResolvedValue(mockResponse(200, mockBody));

    const result = await provider.search("weather Austin", 3);

    expect(result.query).toBe("weather Austin");
    expect(result.results).toHaveLength(2);
    expect(result.results[0].title).toBe("Weather");
    expect(result.results[0].url).toBe("https://weather.com");
    expect(result.results[0].snippet).toBe("Sunny 72F");
    expect(result.durationMs).toBe(350);
    expect(result.provider).toBe("google");
  });

  it("calls correct endpoint with POST", async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { query: "test", results: [], durationMs: 50, provider: "mock" }));

    await provider.search("test query", 5);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/prod/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "test query", maxResults: 5 }),
      },
    );
  });

  // -----------------------------------------------------------------------
  // search — error handling
  // -----------------------------------------------------------------------
  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValue(mockResponse(500, { error: "Internal error" }));

    await expect(provider.search("test")).rejects.toThrow("Search proxy returned 500");
  });

  it("throws on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));

    await expect(provider.search("test")).rejects.toThrow("Network failure");
  });

  // -----------------------------------------------------------------------
  // search — defensive mapping
  // -----------------------------------------------------------------------
  it("handles missing results array gracefully", async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { query: "test", durationMs: 50, provider: "none" }));

    const result = await provider.search("test");
    expect(result.results).toEqual([]);
  });

  it("handles malformed result objects", async () => {
    mockFetch.mockResolvedValue(mockResponse(200, {
      query: "test",
      results: [{ foo: "bar" }],
      durationMs: 50,
      provider: "google",
    }));

    const result = await provider.search("test");
    expect(result.results[0]).toEqual({
      title: "",
      url: "",
      snippet: "",
      publishedDate: undefined,
    });
  });

  // -----------------------------------------------------------------------
  // Quota piggybacking
  // -----------------------------------------------------------------------
  it("caches quota from search response", async () => {
    const quota = {
      google: { used: 10, limit: 100, period: "2026-02-08" },
      brave: { used: 50, limit: 2000, period: "2026-02" },
      tavily: { used: 0, limit: 1000, period: "2026-02" },
    };
    mockFetch.mockResolvedValue(mockResponse(200, {
      query: "test", results: [], durationMs: 50, provider: "google", quota,
    }));

    expect(provider.getLastQuota()).toBeNull();
    await provider.search("test");
    expect(provider.getLastQuota()).toEqual(quota);
  });

  it("does not overwrite quota when response has no quota", async () => {
    // First call with quota
    const quota = {
      google: { used: 10, limit: 100, period: "2026-02-08" },
      brave: { used: 0, limit: 2000, period: "2026-02" },
      tavily: { used: 0, limit: 1000, period: "2026-02" },
    };
    mockFetch.mockResolvedValue(mockResponse(200, {
      query: "test", results: [], durationMs: 50, provider: "google", quota,
    }));
    await provider.search("test");

    // Second call without quota
    mockFetch.mockResolvedValue(mockResponse(200, {
      query: "test2", results: [], durationMs: 50, provider: "mock",
    }));
    await provider.search("test2");

    // Quota should still be from first call
    expect(provider.getLastQuota()).toEqual(quota);
  });

  // -----------------------------------------------------------------------
  // fetchQuota
  // -----------------------------------------------------------------------
  it("fetches quota from GET /quota endpoint", async () => {
    const quota = {
      google: { used: 23, limit: 100, period: "2026-02-08" },
      brave: { used: 145, limit: 2000, period: "2026-02" },
      tavily: { used: 0, limit: 1000, period: "2026-02" },
    };
    mockFetch.mockResolvedValue(mockResponse(200, { quota }));

    const result = await provider.fetchQuota();

    expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/prod/quota");
    expect(result).toEqual(quota);
    expect(provider.getLastQuota()).toEqual(quota);
  });

  it("returns null on fetchQuota HTTP error", async () => {
    mockFetch.mockResolvedValue(mockResponse(500, {}));

    const result = await provider.fetchQuota();
    expect(result).toBeNull();
  });

  it("returns null on fetchQuota network error", async () => {
    mockFetch.mockRejectedValue(new Error("Offline"));

    const result = await provider.fetchQuota();
    expect(result).toBeNull();
  });
});
