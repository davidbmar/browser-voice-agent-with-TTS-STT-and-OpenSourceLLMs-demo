import type { LoopController } from "./loop-controller.ts";

export function collectAppState(controller: LoopController): Record<string, unknown> {
  const state = controller.getState();
  return {
    stage: state.stage,
    isRunning: state.isRunning,
    loopCount: state.loopCount,
    error: state.error,
    vad: state.vad,
    interimTranscript: state.interimTranscript,
    finalTranscript: state.finalTranscript,
    modelConfig: {
      modelId: state.modelConfig.modelId,
      isLoaded: state.modelConfig.isLoaded,
    },
    audioDiagnostics: state.audioDiagnostics,
    bias: state.bias,
    decisionTrace: controller.trace.getRecent(50),
    speechLog: controller.speechLog.getRecent(50),
    history: state.history.slice(-10),
    pendingTurnCount: state.pendingTurnCount,
  };
}
