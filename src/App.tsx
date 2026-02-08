/**
 * App.tsx — Root component for the Bug Loop Voice Agent.
 *
 * Wires together the LoopController (via useLoop hook) with
 * all UI panels arranged in a two-column + bottom-bar layout.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/app-layout.tsx";
import { StageDiagram } from "@/components/loop/stage-diagram.tsx";
import { LoopControls } from "@/components/loop/loop-controls.tsx";
import { InternalStatePanel } from "@/components/state/internal-state-panel.tsx";
import { BiasSliders } from "@/components/state/bias-sliders.tsx";
import { PromptsPanel } from "@/components/prompts/prompts-panel.tsx";
import { DecisionTracePanel } from "@/components/trace/decision-trace-panel.tsx";
import { ModelSelector } from "@/components/model/model-selector.tsx";
import { ModelToggle } from "@/components/model/model-toggle.tsx";
import { ModelABPanel } from "@/components/model/model-ab-panel.tsx";
import { HistoryTimeline } from "@/components/history/history-timeline.tsx";
import { DocsButton } from "@/components/docs/docs-button.tsx";
import { CapabilityBanner } from "@/components/capabilities/capability-banner.tsx";
import { MobileLayout } from "@/components/layout/mobile-layout.tsx";
import { SearchResultsPanel } from "@/components/search/search-results-panel.tsx";
import { useLoop } from "@/hooks/use-loop.ts";
import { useMobile } from "@/hooks/use-mobile.ts";
import { Bug } from "lucide-react";

function App() {
  const {
    state,
    traceEntries,
    dispatch,
    loadModel,
    unloadModel,
    setClassifyWithLLM,
    setResponseWithLLM,
    setSearchEnabled,
    setBias,
    controller,
  } = useLoop();

  // --- Model loading state (local to UI) ---
  const DEFAULT_MODEL = "Qwen3-0.6B-q4f16_1-MLC";
  const [pendingModelId, setPendingModelId] = useState<string | null>(DEFAULT_MODEL);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const autoLoadAttempted = useRef(false);

  // Auto-load default model on startup
  useEffect(() => {
    if (autoLoadAttempted.current) return;
    autoLoadAttempted.current = true;
    setIsLoadingModel(true);
    loadModel(DEFAULT_MODEL).finally(() => setIsLoadingModel(false));
  }, [loadModel]);

  const handleModelLoad = useCallback(async (modelId: string) => {
    setPendingModelId(modelId);
    setIsLoadingModel(true);
    try {
      await loadModel(modelId);
    } finally {
      setIsLoadingModel(false);
    }
  }, [loadModel]);

  const handleUnload = useCallback(async () => {
    await unloadModel();
    setPendingModelId(null);
  }, [unloadModel]);

  const handleSpeakTest = useCallback(() => {
    controller.getSpeaker().speak("Hello! I am the bug loop voice agent. Testing audio output.");
  }, [controller]);

  const effectiveModelId = state.modelConfig.modelId || pendingModelId;
  const isMobile = useMobile();

  // --- Mobile: simplified chat view ---
  if (isMobile) {
    return (
      <MobileLayout
        state={state}
        dispatch={dispatch}
        isLoadingModel={isLoadingModel}
        onSpeakTest={handleSpeakTest}
        selectedModelId={effectiveModelId}
        onModelLoad={handleModelLoad}
        onModelUnload={handleUnload}
      />
    );
  }

  // --- Desktop: full dashboard ---
  return (
    <AppLayout
      header={
        <div className="flex items-center justify-between gap-4">
          {/* Left: branding */}
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Bug Loop</h1>
            <span className="text-xs text-muted-foreground">Voice Agent FSM</span>
          </div>

          {/* Right: model selector + docs */}
          <div className="flex items-center gap-3">
            <ModelSelector
              selectedModelId={effectiveModelId}
              isLoaded={state.modelConfig.isLoaded}
              isLoading={isLoadingModel}
              loadProgress={state.modelConfig.loadProgress}
              onLoad={handleModelLoad}
              onUnload={handleUnload}
            />
            <DocsButton />
          </div>
        </div>
      }
      left={
        <>
          {/* Browser capability detection banner */}
          <CapabilityBanner />

          {/* Stage pipeline visualization */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Stage Pipeline
            </h3>
            <StageDiagram
              currentStage={state.stage}
              stageEnteredAt={state.stageEnteredAt}
            />
          </div>

          {/* Start / Stop / Reset / Simulate */}
          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Controls
            </h3>
            <LoopControls
              stage={state.stage}
              isRunning={state.isRunning}
              dispatch={dispatch}
              onSpeakTest={handleSpeakTest}
            />
          </div>

          {/* LLM on/off switches */}
          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              LLM Toggles
            </h3>
            <ModelToggle
              classifyWithLLM={state.modelConfig.classifyWithLLM}
              responseWithLLM={state.modelConfig.responseWithLLM}
              searchEnabled={state.modelConfig.searchEnabled}
              isModelLoaded={state.modelConfig.isLoaded}
              onClassifyChange={setClassifyWithLLM}
              onResponseChange={setResponseWithLLM}
              onSearchChange={setSearchEnabled}
            />
          </div>

          {/* Side-by-side model comparison (experimental) */}
          <div className="border-t pt-4">
            <ModelABPanel
              currentModelId={state.modelConfig.modelId}
              isLoaded={state.modelConfig.isLoaded}
            />
          </div>

          {/* Error display */}
          {state.error && (
            <div className="border-t pt-4">
              <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {state.error}
              </div>
            </div>
          )}
        </>
      }
      right={
        <>
          <InternalStatePanel state={state} />
          <PromptsPanel state={state} />
          {state.modelConfig.searchEnabled && <SearchResultsPanel state={state} />}
          <DecisionTracePanel entries={traceEntries} />
          <BiasSliders bias={state.bias} onChange={setBias} />
        </>
      }
      bottom={<HistoryTimeline history={state.history} />}
    />
  );
}

export default App;
