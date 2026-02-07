/**
 * prompt-templates.ts — LLM prompt templates for classification and response.
 *
 * Templates use {{mustache}} placeholders filled by fillTemplate().
 * Also includes parseThinkTags() for extracting <think>...</think>
 * reasoning blocks from models like Qwen3 and DeepSeek R1.
 */

/** Classification prompt: asks the LLM to output a JSON intent object. */
export const CLASSIFY_TEMPLATE = `You are a classification engine. Given the user's speech transcript, output ONLY a JSON object with no other text.

Transcript: "{{transcript}}"
Confidence: {{confidence}}

Output format:
{"intent": "question|command|acknowledgement|greeting|clarification_needed|statement|farewell", "confidence": <0-1>, "topics": ["<topic1>"], "needsClarification": <true|false>}`;

/** Response prompt: asks the LLM to generate a conversational response. */
export const MICRO_RESPONSE_TEMPLATE = `You are a helpful voice assistant. Give a clear, complete, and conversational response in up to {{maxWords}} words.

User said: "{{transcript}}"
Intent: {{intent}}
Confidence: {{confidence}}
{{clarificationNote}}

Respond naturally as if speaking aloud. Give a complete answer — do not cut off mid-sentence.`;

/**
 * Replace all {{key}} placeholders in a template string.
 * Simple and fast — no external templating library needed.
 */
export function fillTemplate(
  template: string,
  vars: Record<string, string | number | boolean>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, String(value));
  }
  return result;
}

/**
 * Parse <think>...</think> tags from LLM output.
 * Used by reasoning models (Qwen3, DeepSeek R1) that emit internal
 * reasoning wrapped in think tags before their actual response.
 *
 * Returns { thinking, response } where:
 *  - thinking: content inside <think> tags (may span multiple blocks)
 *  - response: everything outside <think> tags, trimmed
 */
export function parseThinkTags(text: string): { thinking: string; response: string } {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  let thinking = "";
  let match;
  while ((match = thinkRegex.exec(text)) !== null) {
    thinking += (thinking ? "\n" : "") + match[1].trim();
  }
  const response = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  return { thinking, response };
}

/** Build a filled classification prompt. */
export function buildClassifyPrompt(transcript: string, confidence: number): string {
  return fillTemplate(CLASSIFY_TEMPLATE, { transcript, confidence });
}

/** Build a filled micro-response prompt with optional clarification note. */
export function buildMicroResponsePrompt(
  transcript: string,
  intent: string,
  confidence: number,
  maxWords: number = 60,
  needsClarification: boolean = false
): string {
  const clarificationNote = needsClarification
    ? "The user's intent is unclear. Ask a clarifying question."
    : intent === "acknowledgement"
    ? "The user is acknowledging. Give a brief acknowledgement back."
    : "";
  return fillTemplate(MICRO_RESPONSE_TEMPLATE, {
    transcript,
    intent,
    confidence,
    maxWords,
    clarificationNote,
  });
}
