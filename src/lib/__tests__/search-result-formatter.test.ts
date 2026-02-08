import { describe, it, expect } from "vitest";
import { formatSearchResults } from "../search-result-formatter.ts";
import type { SearchResult } from "../search-provider.ts";

const makeResult = (title: string, snippet: string): SearchResult => ({
  title,
  url: "https://example.com",
  snippet,
});

describe("formatSearchResults", () => {
  it("returns empty string for empty array", () => {
    expect(formatSearchResults([])).toBe("");
  });

  it("formats a single result correctly", () => {
    const result = formatSearchResults([makeResult("Title A", "Some snippet")]);
    expect(result).toContain("[Web Search Results]");
    expect(result).toContain("1. Title A — Some snippet");
  });

  it("formats multiple results with numbered list", () => {
    const results = [
      makeResult("First", "Snippet 1"),
      makeResult("Second", "Snippet 2"),
      makeResult("Third", "Snippet 3"),
    ];
    const output = formatSearchResults(results);
    expect(output).toContain("1. First — Snippet 1");
    expect(output).toContain("2. Second — Snippet 2");
    expect(output).toContain("3. Third — Snippet 3");
  });

  it("truncates long snippets at maxSnippetChars with ellipsis", () => {
    const longSnippet = "a".repeat(200);
    const result = formatSearchResults([makeResult("Title", longSnippet)]);
    expect(result).toContain("...");
    // Default maxSnippetChars is 150, so snippet should be 150 chars + "..."
    const line = result.split("\n")[1];
    const snippetPart = line.split(" — ")[1];
    expect(snippetPart).toBe("a".repeat(150) + "...");
  });

  it("does not truncate snippets shorter than maxSnippetChars", () => {
    const shortSnippet = "a".repeat(100);
    const result = formatSearchResults([makeResult("Title", shortSnippet)]);
    expect(result).not.toContain("...");
  });

  it("respects custom maxSnippetChars parameter", () => {
    const snippet = "a".repeat(100);
    const result = formatSearchResults([makeResult("Title", snippet)], 50);
    const line = result.split("\n")[1];
    const snippetPart = line.split(" — ")[1];
    expect(snippetPart).toBe("a".repeat(50) + "...");
  });

  it("handles results with empty snippets", () => {
    const result = formatSearchResults([makeResult("Title", "")]);
    expect(result).toContain("1. Title — ");
  });

  it("header line is always [Web Search Results]", () => {
    const result = formatSearchResults([makeResult("X", "Y")]);
    const firstLine = result.split("\n")[0];
    expect(firstLine).toBe("[Web Search Results]");
  });
});
