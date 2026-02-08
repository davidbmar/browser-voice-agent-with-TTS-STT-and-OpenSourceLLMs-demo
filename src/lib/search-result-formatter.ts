/**
 * search-result-formatter.ts — Formats search results into a compact
 * text block for injection into LLM prompts.
 *
 * Designed to be token-efficient for small models with limited
 * context windows (2K-4K tokens).
 */

import type { SearchResult } from "./search-provider.ts";

/**
 * Format search results into a block suitable for prompt injection.
 *
 * Output format:
 *   [Web Search Results]
 *   1. Title — snippet
 *   2. Title — snippet
 *   3. Title — snippet
 */
export function formatSearchResults(
  results: SearchResult[],
  maxSnippetChars = 150,
): string {
  if (results.length === 0) return "";

  const lines = results.map((r, i) => {
    const snippet =
      r.snippet.length > maxSnippetChars
        ? r.snippet.slice(0, maxSnippetChars) + "..."
        : r.snippet;
    return `${i + 1}. ${r.title} — ${snippet}`;
  });

  return `[Web Search Results]\n${lines.join("\n")}`;
}
