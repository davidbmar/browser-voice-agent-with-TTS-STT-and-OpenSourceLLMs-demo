import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock browser globals
// ---------------------------------------------------------------------------
vi.stubGlobal("navigator", { gpu: {} });

const mockCachesKeys = vi.fn().mockResolvedValue([]);
const mockCachesDelete = vi.fn().mockResolvedValue(true);
vi.stubGlobal("caches", { keys: mockCachesKeys, delete: mockCachesDelete });

const mockDeleteDatabase = vi.fn().mockReturnValue({ onsuccess: null, onerror: null, onblocked: null });
vi.stubGlobal("indexedDB", { deleteDatabase: (name: string) => {
  const req = mockDeleteDatabase(name);
  // Simulate async success
  setTimeout(() => req.onsuccess?.(), 0);
  return req;
}});

// ---------------------------------------------------------------------------
// Mock @mlc-ai/web-llm
// ---------------------------------------------------------------------------
const mockCreateMLCEngine = vi.fn();
const mockDeleteModelAllInfoInCache = vi.fn().mockResolvedValue(undefined);

vi.mock("@mlc-ai/web-llm", () => ({
  CreateMLCEngine: (...args: unknown[]) => mockCreateMLCEngine(...args),
  deleteModelAllInfoInCache: (...args: unknown[]) => mockDeleteModelAllInfoInCache(...args),
}));

import { LLMEngine } from "../llm-engine.ts";
import type { LLMEngineCallbacks } from "../llm-engine.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockEngine() {
  return {
    unload: vi.fn().mockResolvedValue(undefined),
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  };
}

describe("LLMEngine", () => {
  let callbacks: Required<LLMEngineCallbacks>;
  let engine: LLMEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCachesKeys.mockResolvedValue([]);

    callbacks = {
      onLoadProgress: vi.fn(),
      onLoadComplete: vi.fn(),
      onToken: vi.fn(),
      onGenerateComplete: vi.fn(),
      onError: vi.fn(),
    };
    engine = new LLMEngine(callbacks);

    // Default: CreateMLCEngine succeeds
    mockCreateMLCEngine.mockResolvedValue(makeMockEngine());
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------
  it("starts unloaded", () => {
    expect(engine.isLoaded()).toBe(false);
    expect(engine.isLoading()).toBe(false);
    expect(engine.getModelId()).toBeNull();
  });

  // -----------------------------------------------------------------------
  // loadModel — success path
  // -----------------------------------------------------------------------
  it("loads a model successfully", async () => {
    await engine.loadModel("test-model");
    expect(engine.isLoaded()).toBe(true);
    expect(engine.getModelId()).toBe("test-model");
    expect(callbacks.onLoadComplete).toHaveBeenCalledOnce();
  });

  it("calls onLoadProgress during model load", async () => {
    mockCreateMLCEngine.mockImplementation(async (_id: string, opts: { initProgressCallback?: (r: { text: string; progress: number }) => void }) => {
      opts.initProgressCallback?.({ text: "Loading...", progress: 0.5 });
      return makeMockEngine();
    });

    await engine.loadModel("test-model");
    expect(callbacks.onLoadProgress).toHaveBeenCalledWith({ text: "Loading...", progress: 0.5 });
  });

  it("is a no-op if the same model is already loaded", async () => {
    await engine.loadModel("test-model");
    mockCreateMLCEngine.mockClear();

    await engine.loadModel("test-model");
    expect(mockCreateMLCEngine).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // loadModel — switching models
  // -----------------------------------------------------------------------
  it("unloads previous model when switching", async () => {
    const firstEngine = makeMockEngine();
    mockCreateMLCEngine.mockResolvedValueOnce(firstEngine);

    await engine.loadModel("model-a");
    await engine.loadModel("model-b");

    expect(firstEngine.unload).toHaveBeenCalledOnce();
    expect(engine.getModelId()).toBe("model-b");
  });

  it("deletes previous model cache when switching to a different model", async () => {
    await engine.loadModel("model-a");
    await engine.loadModel("model-b");

    expect(mockDeleteModelAllInfoInCache).toHaveBeenCalledWith("model-a");
  });

  it("does NOT delete cache when reloading the same model (after unload)", async () => {
    await engine.loadModel("model-a");
    await engine.unloadModel();
    await engine.loadModel("model-a");

    expect(mockDeleteModelAllInfoInCache).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // loadModel — error path
  // -----------------------------------------------------------------------
  it("resets state on load failure (non-cache error)", async () => {
    mockCreateMLCEngine.mockRejectedValue(new Error("WebGPU device lost"));

    await expect(engine.loadModel("bad-model")).rejects.toThrow("WebGPU device lost");

    expect(engine.isLoaded()).toBe(false);
    expect(engine.isLoading()).toBe(false);
    expect(engine.getModelId()).toBeNull();
    expect(callbacks.onError).toHaveBeenCalledWith(
      "Model load failed: WebGPU device lost"
    );
  });

  // -----------------------------------------------------------------------
  // loadModel — cache/quota error → retry
  // -----------------------------------------------------------------------
  it("retries after clearing all storage on quota error", async () => {
    const quotaError = new Error("Quota exceeded");
    mockCreateMLCEngine
      .mockRejectedValueOnce(quotaError)        // first try fails
      .mockResolvedValueOnce(makeMockEngine());  // retry succeeds

    mockCachesKeys.mockResolvedValue(["webllm/model", "webllm/config", "other-cache"]);

    await engine.loadModel("model-b");

    // Should have loaded successfully on retry
    expect(engine.isLoaded()).toBe(true);
    expect(engine.getModelId()).toBe("model-b");

    // Should have cleared ALL caches (nuclear approach)
    expect(mockCachesDelete).toHaveBeenCalledWith("webllm/model");
    expect(mockCachesDelete).toHaveBeenCalledWith("webllm/config");
    expect(mockCachesDelete).toHaveBeenCalledWith("other-cache");

    // Should have also cleared IndexedDB
    expect(mockDeleteDatabase).toHaveBeenCalledWith("webllm/model");
    expect(mockDeleteDatabase).toHaveBeenCalledWith("webllm/config");
    expect(mockDeleteDatabase).toHaveBeenCalledWith("webllm/wasm");
  });

  it("retries after clearing storage on Cache API error", async () => {
    const cacheError = new Error("Failed to execute 'add' on 'Cache': Unexpected internal error.");
    mockCreateMLCEngine
      .mockRejectedValueOnce(cacheError)
      .mockResolvedValueOnce(makeMockEngine());

    mockCachesKeys.mockResolvedValue(["webllm/model"]);

    await engine.loadModel("model-x");

    expect(engine.isLoaded()).toBe(true);
    expect(mockCachesDelete).toHaveBeenCalledWith("webllm/model");
  });

  it("propagates error if retry also fails", async () => {
    const quotaError = new Error("Quota exceeded");
    mockCreateMLCEngine.mockRejectedValue(quotaError);
    mockCachesKeys.mockResolvedValue([]);

    await expect(engine.loadModel("model-z")).rejects.toThrow("Quota exceeded");

    expect(engine.isLoaded()).toBe(false);
    expect(callbacks.onError).toHaveBeenCalledWith("Model load failed: Quota exceeded");
  });

  it("does NOT retry on non-cache errors", async () => {
    mockCreateMLCEngine.mockRejectedValue(new Error("Network failure"));

    await expect(engine.loadModel("model-net")).rejects.toThrow("Network failure");

    // CreateMLCEngine called only once (no retry)
    expect(mockCreateMLCEngine).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // unloadModel
  // -----------------------------------------------------------------------
  it("unloads and resets state", async () => {
    await engine.loadModel("model-a");
    expect(engine.isLoaded()).toBe(true);

    await engine.unloadModel();
    expect(engine.isLoaded()).toBe(false);
    expect(engine.getModelId()).toBeNull();
  });

  it("unload is safe to call when nothing is loaded", async () => {
    await expect(engine.unloadModel()).resolves.toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // generate
  // -----------------------------------------------------------------------
  it("throws if no model is loaded", async () => {
    await expect(
      engine.generate({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow("No model loaded");
  });

  it("returns generated text from streaming chunks", async () => {
    const mockEngine = makeMockEngine();
    // Simulate async iterator of chunks
    const chunks = [
      { choices: [{ delta: { content: "Hello" } }] },
      { choices: [{ delta: { content: " world" } }] },
    ];
    mockEngine.chat.completions.create.mockResolvedValue(
      (async function* () { for (const c of chunks) yield c; })()
    );
    mockCreateMLCEngine.mockResolvedValue(mockEngine);

    await engine.loadModel("gen-model");
    const result = await engine.generate({
      messages: [{ role: "user", content: "test" }],
    });

    expect(result).toBe("Hello world");
    expect(callbacks.onToken).toHaveBeenCalledTimes(2);
    expect(callbacks.onGenerateComplete).toHaveBeenCalledWith("Hello world", "");
  });

  // -----------------------------------------------------------------------
  // generate — auto-unload on fatal errors
  // -----------------------------------------------------------------------
  it("auto-unloads on Tokenizer error during generate", async () => {
    const mockEngine = makeMockEngine();
    mockEngine.chat.completions.create.mockRejectedValue(
      new Error("Cannot pass deleted object as a pointer of type Tokenizer*")
    );
    mockCreateMLCEngine.mockResolvedValue(mockEngine);

    await engine.loadModel("model-tok");
    expect(engine.isLoaded()).toBe(true);

    await expect(
      engine.generate({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow("Tokenizer");

    // Engine should be auto-unloaded
    expect(engine.isLoaded()).toBe(false);
    expect(engine.getModelId()).toBeNull();
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining("Generation error:")
    );
  });

  it("auto-unloads on 'disposed' error during generate", async () => {
    const mockEngine = makeMockEngine();
    mockEngine.chat.completions.create.mockRejectedValue(
      new Error("Engine has been disposed")
    );
    mockCreateMLCEngine.mockResolvedValue(mockEngine);

    await engine.loadModel("model-disp");
    await expect(
      engine.generate({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow("disposed");

    expect(engine.isLoaded()).toBe(false);
  });

  it("does NOT auto-unload on non-fatal generation errors", async () => {
    const mockEngine = makeMockEngine();
    mockEngine.chat.completions.create.mockRejectedValue(
      new Error("Rate limit exceeded")
    );
    mockCreateMLCEngine.mockResolvedValue(mockEngine);

    await engine.loadModel("model-rate");
    await expect(
      engine.generate({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow("Rate limit");

    // Engine should still be loaded
    expect(engine.isLoaded()).toBe(true);
    expect(engine.getModelId()).toBe("model-rate");
  });

  // -----------------------------------------------------------------------
  // estimateStorage
  // -----------------------------------------------------------------------
  it("returns storage estimate when navigator.storage.estimate is available", async () => {
    vi.stubGlobal("navigator", {
      gpu: {},
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 500_000_000, quota: 2_000_000_000 }),
      },
    });

    const result = await LLMEngine.estimateStorage();
    expect(result).toEqual({
      usedGB: 0.5,
      quotaGB: 2,
      availableGB: 1.5,
    });

    // Restore navigator for other tests
    vi.stubGlobal("navigator", { gpu: {} });
  });

  it("returns null when navigator.storage.estimate is not available", async () => {
    vi.stubGlobal("navigator", { gpu: {} });
    const result = await LLMEngine.estimateStorage();
    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // checkWebGPU
  // -----------------------------------------------------------------------
  it("reports WebGPU available when navigator.gpu exists", () => {
    expect(LLMEngine.checkWebGPU()).toEqual({ supported: true, info: "WebGPU available" });
  });
});
