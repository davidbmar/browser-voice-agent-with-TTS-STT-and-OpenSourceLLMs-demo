/**
 * proxy-search-provider.ts — Browser-side search provider that calls
 * the AWS Lambda search proxy. Implements the SearchProvider interface.
 *
 * The proxy cascades through Google → Brave → Tavily and returns
 * quota usage alongside results so the UI can display it.
 */

import type { SearchProvider, SearchResponse, SearchResult } from "./search-provider.ts";

/** Per-provider quota info returned by the Lambda proxy. */
export interface ProviderQuota {
  used: number;
  limit: number;
  period: string;
}

export interface SearchQuota {
  google: ProviderQuota;
  brave: ProviderQuota;
  tavily: ProviderQuota;
}

export class ProxySearchProvider implements SearchProvider {
  readonly name = "proxy";
  private readonly endpointUrl: string;
  private lastQuota: SearchQuota | null = null;

  constructor(endpointUrl: string) {
    // Strip trailing slash
    this.endpointUrl = endpointUrl.replace(/\/+$/, "");
  }

  async search(query: string, maxResults = 3): Promise<SearchResponse> {
    const start = Date.now();

    const resp = await fetch(`${this.endpointUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, maxResults }),
    });

    if (!resp.ok) {
      throw new Error(`Search proxy returned ${resp.status}: ${resp.statusText}`);
    }

    const data = await resp.json();

    // Cache quota from response
    if (data.quota) {
      this.lastQuota = data.quota as SearchQuota;
    }

    // Defensively map results to ensure correct shape
    const results: SearchResult[] = (data.results || []).map(
      (r: Record<string, string>) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.snippet || "",
        publishedDate: r.publishedDate,
      })
    );

    return {
      query: data.query || query,
      results,
      durationMs: data.durationMs || (Date.now() - start),
      provider: data.provider || "proxy",
    };
  }

  /** Fetch current quota without performing a search. */
  async fetchQuota(): Promise<SearchQuota | null> {
    try {
      const resp = await fetch(`${this.endpointUrl}/quota`);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data.quota) {
        this.lastQuota = data.quota as SearchQuota;
      }
      return this.lastQuota;
    } catch {
      return null;
    }
  }

  /** Get the most recently received quota info (from search or fetchQuota). */
  getLastQuota(): SearchQuota | null {
    return this.lastQuota;
  }
}
