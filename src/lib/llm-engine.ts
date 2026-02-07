/**
 * llm-engine.ts — Wraps @mlc-ai/web-llm for in-browser LLM inference via WebGPU.
 *
 * Integration point: browser-llm-local-ai-chat
 * See: https://github.com/davidbmar/browser-llm-local-ai-chat
 * Pattern from: index.html in the LLM repo
 *
 * Key behaviors:
 *  - Dynamic import of web-llm (keeps initial bundle small)
 *  - CreateMLCEngine() with progress callback for download tracking
 *  - Streaming inference via chat.completions.create({ stream: true })
 *  - Token-by-token callback for real-time UI updates and TTS sentence detection
 */

import type { MLCEngine } from "@mlc-ai/web-llm";

/** Callbacks for LLM lifecycle events. */
export interface LLMEngineCallbacks {
  onLoadProgress?: (progress: { text: string; progress: number }) => void;
  onLoadComplete?: () => void;
  onToken?: (token: string, full: string) => void;
  onGenerateComplete?: (text: string, stats: string) => void;
  onError?: (error: string) => void;
}

/** Options for a single generate() call. */
export interface GenerateOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  /** Per-token callback: receives the new token and the full text so far. */
  onToken?: (token: string, full: string) => void;
}

export class LLMEngine {
  private engine: MLCEngine | null = null;
  private currentModelId: string | null = null;
  private loading = false;
  private callbacks: LLMEngineCallbacks;

  constructor(callbacks: LLMEngineCallbacks = {}) {
    this.callbacks = callbacks;
  }

  isLoaded(): boolean {
    return this.engine !== null && this.currentModelId !== null;
  }

  isLoading(): boolean { return this.loading; }
  getModelId(): string | null { return this.currentModelId; }

  /**
   * Load a model by ID. Downloads weights on first call (cached in IndexedDB).
   * Unloads any previously loaded model first.
   */
  async loadModel(modelId: string): Promise<void> {
    if (this.currentModelId === modelId && this.engine) return;

    await this.unloadModel();
    this.loading = true;

    try {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

      this.engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (report) => {
          this.callbacks.onLoadProgress?.({
            text: report.text,
            progress: report.progress,
          });
        },
      });

      this.currentModelId = modelId;
      this.loading = false;
      this.callbacks.onLoadComplete?.();
    } catch (err) {
      this.loading = false;
      this.engine = null;
      this.currentModelId = null;
      this.callbacks.onError?.(
        `Model load failed: ${err instanceof Error ? err.message : "unknown"}`
      );
      throw err;
    }
  }

  /** Unload the current model and free WebGPU resources. */
  async unloadModel(): Promise<void> {
    if (this.engine) {
      try { await this.engine.unload(); } catch (_e) { /* ignore */ }
      this.engine = null;
      this.currentModelId = null;
    }
  }

  /**
   * Run streaming inference. Returns the full generated text.
   * Calls onToken() for each new token during generation.
   */
  async generate(options: GenerateOptions): Promise<string> {
    if (!this.engine) throw new Error("No model loaded");

    const { messages, maxTokens = 128, temperature = 0.7, topP = 0.95, onToken } = options;
    let fullText = "";

    try {
      const chunks = await this.engine.chat.completions.create({
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        stream: true,
      });

      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullText += delta;
          onToken?.(delta, fullText);
          this.callbacks.onToken?.(delta, fullText);
        }
      }

      this.callbacks.onGenerateComplete?.(fullText, "");
      return fullText;
    } catch (err) {
      const msg = `Generation error: ${err instanceof Error ? err.message : "unknown"}`;
      this.callbacks.onError?.(msg);
      throw err;
    }
  }

  /** Simple status string for debugging. */
  async getStats(): Promise<string> {
    if (!this.engine) return "No model loaded";
    return `Model: ${this.currentModelId}`;
  }

  /** Check if the browser supports WebGPU. */
  static checkWebGPU(): { supported: boolean; info: string } {
    if (!navigator.gpu) {
      return { supported: false, info: "WebGPU not available in this browser" };
    }
    return { supported: true, info: "WebGPU available" };
  }
}
