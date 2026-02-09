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
   * Load a model by ID. Downloads weights on first call (cached in Cache Storage).
   * Unloads any previously loaded model first.
   *
   * If loading fails due to cache/quota errors, clears all storage and retries once.
   */
  async loadModel(modelId: string): Promise<void> {
    if (this.currentModelId === modelId && this.engine) return;

    const previousModelId = this.currentModelId;
    await this.unloadModel();

    // Free Cache Storage from previous model to make room for the new one
    if (previousModelId && previousModelId !== modelId) {
      await this.deleteModelCacheSafe(previousModelId);
    }

    this.loading = true;

    try {
      await this.createEngine(modelId);
    } catch (firstErr) {
      // On cache/quota errors, nuke ALL storage and retry once
      if (firstErr instanceof Error && /cache|quota/i.test(firstErr.message)) {
        console.warn("[LLMEngine] Load failed with cache/quota error, clearing all storage and retrying:", firstErr.message);
        try {
          await this.clearAllStorage();
          console.log("[LLMEngine] Storage cleared, retrying model load...");
          await this.createEngine(modelId);
          return; // retry succeeded
        } catch (retryErr) {
          console.error("[LLMEngine] Retry also failed:", retryErr instanceof Error ? retryErr.message : retryErr);
          // fall through to error handling
        }
      }
      this.loading = false;
      this.engine = null;
      this.currentModelId = null;
      this.callbacks.onError?.(
        `Model load failed: ${firstErr instanceof Error ? firstErr.message : "unknown"}`
      );
      throw firstErr;
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
      const rawMsg = err instanceof Error ? err.message : "unknown";
      // Fatal WASM errors mean the engine is unusable — auto-unload
      if (/deleted object|Tokenizer|abort|disposed/i.test(rawMsg)) {
        console.error("[LLMEngine] Fatal engine error, auto-unloading:", rawMsg);
        this.engine = null;
        this.currentModelId = null;
      }
      this.callbacks.onError?.(`Generation error: ${rawMsg}`);
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

  /** Estimate available browser storage (Cache Storage + IndexedDB quota). */
  static async estimateStorage(): Promise<{ availableGB: number; usedGB: number; quotaGB: number } | null> {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return {
      usedGB: usage / 1e9,
      quotaGB: quota / 1e9,
      availableGB: (quota - usage) / 1e9,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Create engine and set instance fields on success. */
  private async createEngine(modelId: string): Promise<void> {
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
  }

  /** Delete a single model's cache via web-llm, ignoring errors. */
  private async deleteModelCacheSafe(modelId: string): Promise<void> {
    try {
      const { deleteModelAllInfoInCache } = await import("@mlc-ai/web-llm");
      await deleteModelAllInfoInCache(modelId);
    } catch (_e) { /* best-effort */ }
  }

  /**
   * Nuclear cache clear: delete ALL Cache Storage entries and ALL webllm
   * IndexedDB databases. This frees the maximum amount of origin storage.
   */
  private async clearAllStorage(): Promise<void> {
    // 1. Delete ALL Cache Storage entries (not just webllm-named ones)
    try {
      const names = await caches.keys();
      console.log("[LLMEngine] Clearing Cache Storage entries:", names);
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch (e) {
      console.warn("[LLMEngine] Cache Storage clear failed:", e);
    }

    // 2. Delete webllm IndexedDB databases
    const idbNames = ["webllm/model", "webllm/config", "webllm/wasm"];
    for (const name of idbNames) {
      try {
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.deleteDatabase(name);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
          req.onblocked = () => resolve(); // still counts as cleared
        });
      } catch (_e) { /* best-effort */ }
    }
  }
}
