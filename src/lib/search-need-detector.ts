/**
 * search-need-detector.ts — Rule-based detection of whether a user
 * query needs web search augmentation.
 *
 * Designed to work reliably with small models (0.6B-4B) that can't
 * do function-calling. The detection is synchronous and adds zero
 * latency to queries that don't need search.
 */

export interface SearchNeedResult {
  needsSearch: boolean;
  searchQuery: string;
  reason: string;
}

// Intents that could benefit from search
const SEARCHABLE_INTENTS = new Set(["question", "command", "statement"]);

// Temporal markers — the #1 signal that a local LLM will confabulate
const TEMPORAL_MARKERS = [
  "today", "tonight", "yesterday", "tomorrow",
  "this week", "this month", "this year",
  "latest", "current", "currently", "recent", "recently",
  "now", "right now", "at the moment",
  "2024", "2025", "2026", "2027",
  "last night", "last week", "last month",
];

// Factual question patterns
const FACTUAL_PATTERNS = [
  /^what (is|are|was|were) /i,
  /^who (is|are|was|were) /i,
  /^where (is|are|was|were) /i,
  /^when (did|does|was|is|will) /i,
  /^how (many|much|old|far|long|tall) /i,
  /^(is|are|was|were|did|does|has|have|will|can) .+ (true|real|correct|alive|dead|open|closed)/i,
];

// Keywords that strongly suggest search is needed
const SEARCH_KEYWORDS = [
  "weather", "forecast", "temperature",
  "news", "headlines",
  "price", "cost", "stock", "market",
  "score", "game", "match", "tournament",
  "population", "capital", "president", "prime minister",
  "release date", "launch date",
  "recipe", "ingredients",
  "distance", "directions", "address",
  "hours", "open", "closed",
  "review", "rating",
  "definition", "meaning",
];

// Words to strip when building a search query from conversational speech
const FILLER_WORDS = new Set([
  "hey", "hi", "hello", "um", "uh", "like", "so", "well", "okay", "ok",
  "please", "thanks", "thank you", "could you", "can you", "would you",
  "tell me", "let me know", "i want to know", "i was wondering",
  "do you know", "what do you think", "i think", "just",
  "actually", "basically", "literally", "honestly",
]);

/**
 * Detect whether a user utterance needs web search augmentation.
 *
 * Uses a scoring system:
 *  - Searchable intent: +1
 *  - Contains temporal marker: +2
 *  - Matches factual pattern: +1
 *  - Contains search keyword: +2
 *  - Score >= 2 triggers search
 */
export function detectSearchNeed(
  transcript: string,
  intent: string,
  confidence: number,
): SearchNeedResult {
  const noSearch = { needsSearch: false, searchQuery: "", reason: "" };

  if (!transcript.trim()) {
    return { ...noSearch, reason: "empty transcript" };
  }

  // Non-searchable intents never trigger search
  if (!SEARCHABLE_INTENTS.has(intent)) {
    return { ...noSearch, reason: `intent "${intent}" not searchable` };
  }

  // Low confidence — don't waste a search on unclear speech
  if (confidence < 0.3) {
    return { ...noSearch, reason: "confidence too low" };
  }

  const lower = transcript.toLowerCase().trim();
  let score = 0;
  const reasons: string[] = [];

  // +1 for searchable intent
  if (intent === "question") {
    score += 1;
    reasons.push("question intent");
  }

  // +2 for temporal markers
  for (const marker of TEMPORAL_MARKERS) {
    if (lower.includes(marker)) {
      score += 2;
      reasons.push(`temporal: "${marker}"`);
      break;
    }
  }

  // +1 for factual question patterns
  for (const pattern of FACTUAL_PATTERNS) {
    if (pattern.test(lower)) {
      score += 1;
      reasons.push("factual pattern");
      break;
    }
  }

  // +2 for search keywords
  for (const keyword of SEARCH_KEYWORDS) {
    if (lower.includes(keyword)) {
      score += 2;
      reasons.push(`keyword: "${keyword}"`);
      break;
    }
  }

  if (score < 2) {
    return { ...noSearch, reason: `score ${score} < 2 (${reasons.join(", ") || "no signals"})` };
  }

  return {
    needsSearch: true,
    searchQuery: extractSearchQuery(transcript),
    reason: `score ${score}: ${reasons.join(", ")}`,
  };
}

/**
 * Extract a clean search query from conversational speech.
 * Strips filler words and question framing to produce keyword-style queries
 * that work better with search APIs.
 *
 * "Hey what's the weather like in Austin today" → "weather Austin today"
 */
export function extractSearchQuery(transcript: string): string {
  let query = transcript.trim();

  // Remove common question prefixes
  query = query.replace(/^(hey |hi |hello |ok |okay |so |well |um |uh )+/gi, "");
  query = query.replace(/^(can you |could you |would you |please |tell me |do you know |what do you think )/gi, "");
  query = query.replace(/^(i want to know |i was wondering |let me know )/gi, "");

  // Remove trailing punctuation
  query = query.replace(/[?.!,]+$/g, "");

  // Remove filler words
  const words = query.split(/\s+/).filter(w => !FILLER_WORDS.has(w.toLowerCase()));
  query = words.join(" ");

  // Collapse whitespace
  query = query.replace(/\s+/g, " ").trim();

  // If query got too short, fall back to original transcript
  if (query.length < 3) {
    query = transcript.trim().replace(/[?.!,]+$/g, "");
  }

  return query;
}
