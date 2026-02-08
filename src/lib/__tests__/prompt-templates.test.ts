import { describe, it, expect } from "vitest";
import {
  fillTemplate,
  parseThinkTags,
  buildClassifyPrompt,
  buildMicroResponsePrompt,
  buildSearchAugmentedResponsePrompt,
  CLASSIFY_TEMPLATE,
  MICRO_RESPONSE_TEMPLATE,
  SEARCH_AUGMENTED_RESPONSE_TEMPLATE,
} from "../prompt-templates.ts";

describe("fillTemplate", () => {
  it("replaces a single variable", () => {
    expect(fillTemplate("Hello {{name}}", { name: "World" })).toBe("Hello World");
  });

  it("replaces multiple different variables", () => {
    const result = fillTemplate("{{a}} and {{b}}", { a: "X", b: "Y" });
    expect(result).toBe("X and Y");
  });

  it("replaces same variable appearing multiple times", () => {
    const result = fillTemplate("{{x}} + {{x}}", { x: "1" });
    expect(result).toBe("1 + 1");
  });

  it("leaves unknown {{vars}} as-is", () => {
    const result = fillTemplate("{{known}} and {{unknown}}", { known: "yes" });
    expect(result).toBe("yes and {{unknown}}");
  });

  it("handles numeric values", () => {
    expect(fillTemplate("Count: {{n}}", { n: 42 })).toBe("Count: 42");
  });

  it("handles boolean values", () => {
    expect(fillTemplate("Flag: {{f}}", { f: true })).toBe("Flag: true");
  });
});

describe("parseThinkTags", () => {
  it("returns empty thinking for text with no think tags", () => {
    const result = parseThinkTags("Hello world");
    expect(result.thinking).toBe("");
    expect(result.response).toBe("Hello world");
  });

  it("extracts single think block", () => {
    const result = parseThinkTags("<think>reasoning here</think>The answer is 42.");
    expect(result.thinking).toBe("reasoning here");
    expect(result.response).toBe("The answer is 42.");
  });

  it("extracts multiple think blocks concatenated with newline", () => {
    const result = parseThinkTags("<think>first</think>middle<think>second</think>end");
    expect(result.thinking).toBe("first\nsecond");
    expect(result.response).toBe("middleend");
  });

  it("handles empty think tags", () => {
    const result = parseThinkTags("<think></think>response");
    expect(result.thinking).toBe("");
    expect(result.response).toBe("response");
  });

  it("handles think tags with whitespace", () => {
    const result = parseThinkTags("<think>  padded  </think>answer");
    expect(result.thinking).toBe("padded");
    expect(result.response).toBe("answer");
  });

  it("handles text before think tags", () => {
    const result = parseThinkTags("before<think>inside</think>after");
    expect(result.thinking).toBe("inside");
    expect(result.response).toBe("beforeafter");
  });

  it("handles multiline think content", () => {
    const result = parseThinkTags("<think>line1\nline2\nline3</think>response");
    expect(result.thinking).toContain("line1");
    expect(result.thinking).toContain("line3");
    expect(result.response).toBe("response");
  });

  it("returns trimmed response", () => {
    const result = parseThinkTags("  <think>x</think>  hello  ");
    expect(result.response).toBe("hello");
  });
});

describe("buildClassifyPrompt", () => {
  it("fills transcript and confidence", () => {
    const prompt = buildClassifyPrompt("hello there", 0.95);
    expect(prompt).toContain("hello there");
    expect(prompt).toContain("0.95");
  });

  it("contains classification instructions", () => {
    const prompt = buildClassifyPrompt("test", 0.8);
    expect(prompt).toContain("classification engine");
    expect(prompt).toContain("intent");
  });
});

describe("buildMicroResponsePrompt", () => {
  it("fills all variables", () => {
    const prompt = buildMicroResponsePrompt("what time is it", "question", 0.9, 60, false);
    expect(prompt).toContain("what time is it");
    expect(prompt).toContain("question");
    expect(prompt).toContain("0.9");
    expect(prompt).toContain("60");
  });

  it("adds clarification note when needsClarification is true", () => {
    const prompt = buildMicroResponsePrompt("mumble", "clarification_needed", 0.4, 60, true);
    expect(prompt).toContain("unclear");
    expect(prompt).toContain("clarifying question");
  });

  it("adds acknowledgement note for acknowledgement intent", () => {
    const prompt = buildMicroResponsePrompt("okay", "acknowledgement", 0.9, 60, false);
    expect(prompt).toContain("acknowledg");
  });

  it("adds no special note for regular intents", () => {
    const prompt = buildMicroResponsePrompt("hello", "greeting", 0.9, 60, false);
    expect(prompt).not.toContain("unclear");
    expect(prompt).not.toContain("acknowledg");
  });

  it("uses default maxWords of 60", () => {
    const prompt = buildMicroResponsePrompt("test", "question", 0.9);
    expect(prompt).toContain("60");
  });
});

describe("buildSearchAugmentedResponsePrompt", () => {
  it("includes search results block", () => {
    const searchBlock = "[Web Search Results]\n1. Title — snippet";
    const prompt = buildSearchAugmentedResponsePrompt(
      "what is the weather", "question", 0.9, 80, false, searchBlock,
    );
    expect(prompt).toContain("[Web Search Results]");
    expect(prompt).toContain("Title — snippet");
  });

  it("fills all standard variables", () => {
    const prompt = buildSearchAugmentedResponsePrompt(
      "test query", "question", 0.85, 100, false, "results",
    );
    expect(prompt).toContain("test query");
    expect(prompt).toContain("question");
    expect(prompt).toContain("0.85");
    expect(prompt).toContain("100");
  });

  it("includes search instruction", () => {
    const prompt = buildSearchAugmentedResponsePrompt(
      "test", "question", 0.9, 60, false, "results",
    );
    expect(prompt).toContain("search results");
  });
});

describe("template constants", () => {
  it("CLASSIFY_TEMPLATE has transcript and confidence placeholders", () => {
    expect(CLASSIFY_TEMPLATE).toContain("{{transcript}}");
    expect(CLASSIFY_TEMPLATE).toContain("{{confidence}}");
  });

  it("MICRO_RESPONSE_TEMPLATE has all placeholders", () => {
    expect(MICRO_RESPONSE_TEMPLATE).toContain("{{transcript}}");
    expect(MICRO_RESPONSE_TEMPLATE).toContain("{{intent}}");
    expect(MICRO_RESPONSE_TEMPLATE).toContain("{{maxWords}}");
  });

  it("SEARCH_AUGMENTED_RESPONSE_TEMPLATE has searchResults placeholder", () => {
    expect(SEARCH_AUGMENTED_RESPONSE_TEMPLATE).toContain("{{searchResults}}");
  });
});
