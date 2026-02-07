import { useState, useCallback, useRef } from "react";
import { LLMEngine } from "@/lib/llm-engine.ts";

export function useLLM() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadText, setLoadText] = useState("");
  const [modelId, setModelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<LLMEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new LLMEngine({
      onLoadProgress: (p) => {
        setLoadProgress(p.progress);
        setLoadText(p.text);
      },
      onLoadComplete: () => {
        setIsLoaded(true);
        setIsLoading(false);
      },
      onError: (err) => setError(err),
    });
  }

  const loadModel = useCallback(async (id: string) => {
    setIsLoading(true);
    setIsLoaded(false);
    setLoadProgress(0);
    setModelId(id);
    setError(null);
    try {
      await engineRef.current!.loadModel(id);
    } catch (_e) {
      setIsLoading(false);
    }
  }, []);

  const unloadModel = useCallback(async () => {
    await engineRef.current!.unloadModel();
    setIsLoaded(false);
    setModelId(null);
    setLoadProgress(0);
  }, []);

  const webGPUStatus = LLMEngine.checkWebGPU();

  return {
    isLoading,
    isLoaded,
    loadProgress,
    loadText,
    modelId,
    error,
    loadModel,
    unloadModel,
    engine: engineRef.current,
    webGPUStatus,
  };
}
