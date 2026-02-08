/**
 * search-provider.ts — Pluggable web search abstraction.
 *
 * Defines the SearchProvider interface and a MockSearchProvider for
 * offline development and testing. Real providers (Brave, Tavily, etc.)
 * implement the same interface and can be swapped in at runtime.
 */

/** A single search result returned by a provider. */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

/** The response from a search query. */
export interface SearchResponse {
  query: string;
  results: SearchResult[];
  durationMs: number;
  provider: string;
}

/** Abstract interface for web search providers. */
export interface SearchProvider {
  readonly name: string;
  search(query: string, maxResults?: number): Promise<SearchResponse>;
}

// ---------------------------------------------------------------------------
// Mock provider — canned results for testing without a real API
// ---------------------------------------------------------------------------

const MOCK_RESULTS: Record<string, SearchResult[]> = {
  weather: [
    {
      title: "Current Weather Conditions",
      url: "https://weather.example.com",
      snippet: "Currently 72°F (22°C), partly cloudy with a light breeze from the southwest at 8 mph. Humidity 45%. High today 78°F, low tonight 58°F.",
    },
    {
      title: "7-Day Weather Forecast",
      url: "https://forecast.example.com",
      snippet: "Tomorrow: Mostly sunny, high 80°F. Wednesday: Chance of rain 40%, high 74°F. Thursday through weekend: Clear skies, highs in the upper 70s.",
    },
  ],
  news: [
    {
      title: "Today's Top Headlines",
      url: "https://news.example.com",
      snippet: "Major developments today: AI advances in browser-native applications, stock markets reach new highs, and international climate summit concludes with new agreements.",
    },
    {
      title: "Technology News Roundup",
      url: "https://tech.example.com",
      snippet: "WebGPU adoption accelerates as browsers enable local AI inference. New open-source models achieve impressive benchmarks at smaller parameter counts.",
    },
  ],
  price: [
    {
      title: "Market Prices Today",
      url: "https://market.example.com",
      snippet: "S&P 500: 5,842 (+0.3%). Bitcoin: $97,420 (+1.2%). Gold: $2,680/oz (-0.1%). Oil (WTI): $71.50/barrel (+0.5%).",
    },
  ],
  score: [
    {
      title: "Latest Sports Scores",
      url: "https://sports.example.com",
      snippet: "NBA: Lakers 112, Celtics 108. NFL: Chiefs advance to playoffs. MLB: Spring training begins next month. Premier League: Arsenal leads the table.",
    },
  ],
  recipe: [
    {
      title: "Popular Recipes",
      url: "https://recipes.example.com",
      snippet: "Quick weeknight dinner: Garlic butter chicken with roasted vegetables. 30 minutes, serves 4. Ingredients: 4 chicken thighs, 3 cloves garlic, 2 tbsp butter, seasonal vegetables.",
    },
  ],
  population: [
    {
      title: "World Population Statistics",
      url: "https://stats.example.com",
      snippet: "Current world population: approximately 8.1 billion (2026). Largest countries: China (1.41B), India (1.44B), United States (340M), Indonesia (277M).",
    },
  ],
};

export class MockSearchProvider implements SearchProvider {
  readonly name = "mock";

  async search(query: string, maxResults = 3): Promise<SearchResponse> {
    const start = Date.now();
    // Simulate network latency (200-500ms)
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300));

    const lower = query.toLowerCase();
    let results: SearchResult[] = [];

    for (const [keyword, data] of Object.entries(MOCK_RESULTS)) {
      if (lower.includes(keyword)) {
        results = data;
        break;
      }
    }

    // Generic fallback
    if (results.length === 0) {
      results = [
        {
          title: `Search results for: ${query}`,
          url: "https://search.example.com",
          snippet: `This is a mock result for "${query}". Connect a real search provider (Brave, Tavily) for actual web results.`,
        },
      ];
    }

    return {
      query,
      results: results.slice(0, maxResults),
      durationMs: Date.now() - start,
      provider: this.name,
    };
  }
}
