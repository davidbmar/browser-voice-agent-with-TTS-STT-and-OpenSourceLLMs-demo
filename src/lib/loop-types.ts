export type Stage =
  | "IDLE"
  | "LISTENING"
  | "SIGNAL_DETECT"
  | "CLASSIFY"
  | "MICRO_RESPONSE"
  | "SPEAK"
  | "FEEDBACK_OBSERVE"
  | "UPDATE_BIAS"
  | "HANDOFF_REASON";

export const STAGES_IN_ORDER: Stage[] = [
  "IDLE",
  "LISTENING",
  "SIGNAL_DETECT",
  "CLASSIFY",
  "MICRO_RESPONSE",
  "SPEAK",
  "FEEDBACK_OBSERVE",
  "UPDATE_BIAS",
];

/** Processing pipeline stages shown in row 2 of the stage diagram. */
export const PIPELINE_STAGES: Stage[] = [
  "CLASSIFY",
  "MICRO_RESPONSE",
  "SPEAK",
  "FEEDBACK_OBSERVE",
  "UPDATE_BIAS",
];

export interface VADMetrics {
  audioLevel: number;
  isSpeaking: boolean;
  silenceDurationMs: number;
  speechDurationMs: number;
}

export interface Classification {
  intent: string;
  confidence: number;
  topics: string[];
  needsClarification: boolean;
  usedLLM: boolean;
  rawOutput: string;
}

export interface BiasValues {
  verbosity: number;
  clarificationThreshold: number;
  interruptionSensitivity: number;
  responseSpeed: number;
  silenceThresholdMs: number;
  confidenceFloor: number;
}

export const DEFAULT_BIAS: BiasValues = {
  verbosity: 0,
  clarificationThreshold: 0.6,
  interruptionSensitivity: 0.5,
  responseSpeed: 0.5,
  silenceThresholdMs: 1500,
  confidenceFloor: 0.6,
};

export interface ModelConfig {
  classifyWithLLM: boolean;
  responseWithLLM: boolean;
  searchEnabled: boolean;
  modelId: string | null;
  modelBId: string | null;
  isLoaded: boolean;
  isBLoaded: boolean;
  loadProgress: number;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  classifyWithLLM: false,
  responseWithLLM: true,
  searchEnabled: false,
  modelId: null,
  modelBId: null,
  isLoaded: false,
  isBLoaded: false,
  loadProgress: 0,
};

export interface StageTimings {
  [key: string]: number;
}

export interface LoopHistoryEntry {
  id: number;
  transcript: string;
  classification: Classification | null;
  response: string;
  responseTokenCount: number;
  totalDurationMs: number;
  stageTimings: StageTimings;
  biasSnapshot: BiasValues;
  modelUsed: string | null;
  timestamp: number;
  searchQuery: string | null;
  searchResultCount: number;
}

export interface LoopState {
  stage: Stage;
  loopCount: number;
  vad: VADMetrics;
  interimTranscript: string;
  finalTranscript: string;
  transcriptConfidence: number;
  classification: Classification | null;
  lastResponse: string;
  lastThinking: string;
  lastResponseTokens: number;
  bias: BiasValues;
  modelConfig: ModelConfig;
  history: LoopHistoryEntry[];
  isRunning: boolean;
  stageEnteredAt: number;
  currentStageTimings: StageTimings;
  filledClassifyPrompt: string;
  filledResponsePrompt: string;
  classifyRawOutput: string;
  responseRawOutput: string;
  error: string | null;
  audioDiagnostics: Record<string, string>;
  lastSearchQuery: string;
  lastSearchResults: Array<{ title: string; snippet: string }>;
  lastSearchDurationMs: number;
  lastSearchProvider: string;
  pendingTurnCount: number;
  listenerPaused: boolean;
  audioMuted: boolean;
}

export const DEFAULT_LOOP_STATE: LoopState = {
  stage: "IDLE",
  loopCount: 0,
  vad: { audioLevel: 0, isSpeaking: false, silenceDurationMs: 0, speechDurationMs: 0 },
  interimTranscript: "",
  finalTranscript: "",
  transcriptConfidence: 0,
  classification: null,
  lastResponse: "",
  lastThinking: "",
  lastResponseTokens: 0,
  bias: { ...DEFAULT_BIAS },
  modelConfig: { ...DEFAULT_MODEL_CONFIG },
  history: [],
  isRunning: false,
  stageEnteredAt: 0,
  currentStageTimings: {},
  filledClassifyPrompt: "",
  filledResponsePrompt: "",
  classifyRawOutput: "",
  responseRawOutput: "",
  error: null,
  audioDiagnostics: {},
  lastSearchQuery: "",
  lastSearchResults: [],
  lastSearchDurationMs: 0,
  lastSearchProvider: "",
  pendingTurnCount: 0,
  listenerPaused: false,
  audioMuted: false,
};

// Events
export type LoopEvent =
  | { type: "MIC_START" }
  | { type: "MIC_STOP" }
  | { type: "AUDIO_FRAME"; audioLevel: number; interimText: string }
  | { type: "TURN_END"; finalText: string; confidence: number }
  | { type: "CLASSIFY_DONE"; classification: Classification }
  | { type: "MICRO_RESPONSE_DONE"; response: string; tokenCount: number }
  | { type: "SPEAK_DONE" }
  | { type: "REACTION_DETECTED"; reactionType: string }
  | { type: "SIMULATE_INPUT"; text: string }
  | { type: "HANDOFF_COMPLETE" }
  | { type: "RESET" };

export interface TraceEntry {
  timestamp: number;
  stage: Stage;
  event: string;
  detail: string;
  data?: Record<string, unknown>;
}

export interface SpeechEvent {
  id: number;
  type: "interim" | "final" | "queued" | "dequeued" | "stale_discarded";
  text: string;
  confidence: number;
  timestampMs: number;
  fsmStage: Stage;
  processedAt?: number;
  queueDurationMs?: number;
}

export interface ModelCatalogEntry {
  id: string;
  name: string;
  vramGB: number;
  tags: string[];
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  // Tiny — fastest load, lowest quality (good for testing)
  { id: "SmolLM2-360M-Instruct-q4f16_1-MLC", name: "SmolLM2 360M", vramGB: 0.4, tags: ["fast", "mobile"] },
  { id: "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC", name: "TinyLlama 1.1B", vramGB: 0.7, tags: ["fast", "mobile"] },
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", name: "Qwen2.5 0.5B", vramGB: 0.9, tags: ["fast", "mobile"] },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", name: "Llama 3.2 1B", vramGB: 0.9, tags: ["fast", "balanced"] },
  // Small — good balance of speed and quality for voice agent
  { id: "Qwen3-0.6B-q4f16_1-MLC", name: "Qwen3 0.6B", vramGB: 1.4, tags: ["fast", "new"] },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", name: "Qwen2.5 1.5B", vramGB: 1.6, tags: ["balanced", "new"] },
  { id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC", name: "SmolLM2 1.7B", vramGB: 1.7, tags: ["fast", "balanced"] },
  { id: "gemma-2-2b-it-q4f16_1-MLC", name: "Gemma 2 2B", vramGB: 1.9, tags: ["balanced"] },
  { id: "Qwen3-1.7B-q4f16_1-MLC", name: "Qwen3 1.7B", vramGB: 2.0, tags: ["balanced", "new"] },
  // Medium — higher quality, needs more VRAM
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", name: "Llama 3.2 3B", vramGB: 2.2, tags: ["balanced", "smart"] },
  { id: "Qwen2.5-3B-Instruct-q4f16_1-MLC", name: "Qwen2.5 3B", vramGB: 2.4, tags: ["balanced", "smart"] },
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC", name: "Phi 3.5 Mini", vramGB: 2.4, tags: ["balanced", "smart"] },
  { id: "Qwen3-4B-q4f16_1-MLC", name: "Qwen3 4B", vramGB: 2.8, tags: ["smart", "new"] },
  // Large — best quality, requires significant VRAM
  { id: "Qwen2.5-7B-Instruct-q4f16_1-MLC", name: "Qwen2.5 7B", vramGB: 4.5, tags: ["smart"] },
  { id: "Llama-3.1-8B-Instruct-q4f16_1-MLC", name: "Llama 3.1 8B", vramGB: 5.1, tags: ["smart"] },
  { id: "Qwen3-8B-q4f16_1-MLC", name: "Qwen3 8B", vramGB: 5.5, tags: ["smart", "new"] },
  // Reasoning
  { id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC", name: "DeepSeek R1 7B", vramGB: 4.5, tags: ["reasoning", "smart"] },
];
