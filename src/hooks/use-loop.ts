/**
 * use-loop.ts — React hook that bridges LoopController to React state.
 *
 * Uses useSyncExternalStore to subscribe to the LoopController's state
 * and the DecisionTrace's entries. The controller is a plain TypeScript
 * class (framework-independent), and this hook is the thin React adapter.
 *
 * Important: getState() and getRecent() must return referentially stable
 * objects (same reference if data hasn't changed) to avoid infinite
 * re-render loops with useSyncExternalStore.
 */

import { useRef, useSyncExternalStore, useCallback } from "react";
import { LoopController } from "@/lib/loop-controller.ts";
import type { LoopState, LoopEvent, BiasValues, TraceEntry } from "@/lib/loop-types.ts";

export function useLoop() {
  // Create a single LoopController instance for the lifetime of the app
  const controllerRef = useRef<LoopController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new LoopController();
  }
  const controller = controllerRef.current;

  // Subscribe to FSM state changes
  const state = useSyncExternalStore(
    useCallback((cb: () => void) => controller.subscribe(cb), [controller]),
    useCallback(() => controller.getState(), [controller])
  );

  // Subscribe to decision trace entries
  const traceEntries = useSyncExternalStore(
    useCallback((cb: () => void) => controller.trace.subscribe(cb), [controller]),
    useCallback(() => controller.trace.getRecent(100), [controller])
  );

  // Stable dispatch function
  const dispatch = useCallback(
    (event: LoopEvent) => controller.dispatch(event),
    [controller]
  );

  // Model management
  const loadModel = useCallback(
    (modelId: string) => controller.loadModel(modelId),
    [controller]
  );

  const unloadModel = useCallback(
    () => controller.unloadModel(),
    [controller]
  );

  // LLM toggle controls
  const setClassifyWithLLM = useCallback(
    (on: boolean) => controller.setClassifyWithLLM(on),
    [controller]
  );

  const setResponseWithLLM = useCallback(
    (on: boolean) => controller.setResponseWithLLM(on),
    [controller]
  );

  // Bias slider controls
  const setBias = useCallback(
    (partial: Partial<BiasValues>) => controller.setBias(partial),
    [controller]
  );

  // Search toggle
  const setSearchEnabled = useCallback(
    (on: boolean) => controller.setSearchEnabled(on),
    [controller]
  );

  // Audio mute toggle
  const setAudioMuted = useCallback(
    (muted: boolean) => controller.setAudioMuted(muted),
    [controller]
  );

  return {
    state,
    traceEntries,
    dispatch,
    loadModel,
    unloadModel,
    setClassifyWithLLM,
    setResponseWithLLM,
    setBias,
    setSearchEnabled,
    setAudioMuted,
    controller,
  };
}

export type UseLoopReturn = ReturnType<typeof useLoop>;
export type { LoopState, LoopEvent, BiasValues, TraceEntry };
