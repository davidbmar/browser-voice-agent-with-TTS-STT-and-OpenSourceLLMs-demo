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
import { SpeechEventPanel } from "@/components/trace/speech-event-panel.tsx";
import { ModelSelector } from "@/components/model/model-selector.tsx";
import { ModelToggle } from "@/components/model/model-toggle.tsx";
import { ModelABPanel } from "@/components/model/model-ab-panel.tsx";
import { HistoryTimeline } from "@/components/history/history-timeline.tsx";
import { DocsButton } from "@/components/docs/docs-button.tsx";
import { ChangelogButton } from "@/components/changelog/changelog-button.tsx";
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
    setAudioMuted,
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
    } catch (_err) {
      setPendingModelId(null);
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

  // --- BroadcastChannel: LLM service for other windows (Changelog Q&A) ---
  useEffect(() => {
    const channel = new BroadcastChannel('llm-service');

    channel.addEventListener('message', async (e) => {
      const { id, type, query, sessionIds } = e.data;

      if (type === 'ask') {
        // Check if LLM is loaded
        const llmEngine = controller.getLLMEngine();
        if (!state.modelConfig.isLoaded || !llmEngine.isLoaded()) {
          channel.postMessage({
            id,
            type: 'error',
            error: 'No LLM loaded. Please load a model first.'
          });
          return;
        }

        try {
          // Read full session content from disk
          const sessionContent = await readSessionFiles(sessionIds);

          if (!sessionContent.trim()) {
            channel.postMessage({
              id,
              type: 'error',
              error: 'Could not read session files. They may not exist or failed to load.'
            });
            return;
          }

          // Build context with actual session content
          const systemPrompt = `You are a helpful assistant answering questions about a software project's history.

Here are the relevant sessions:

${sessionContent}

When answering:
- Cite specific Session IDs (e.g., "In session S-2026-02-08-1400...")
- Quote relevant parts from the sessions
- Be concise but accurate`;

          // Generate response
          let answerText = await llmEngine.generate({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query }
            ],
            maxTokens: 512,
            temperature: 0.7
          });

          // Strip thinking tags if present (some models output internal reasoning)
          answerText = answerText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

          // Send answer back
          channel.postMessage({
            id,
            type: 'answer',
            text: answerText
          });
        } catch (error) {
          channel.postMessage({
            id,
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          });
        }
      }
    });

    return () => channel.close();
  }, [state.modelConfig.isLoaded, controller]);

  // Helper to read session files from disk
  async function readSessionFiles(sessionIds: string[]): Promise<string> {
    const sessions = [];

    for (const sessionId of sessionIds) {
      try {
        const response = await fetch(`/docs/project-memory/sessions/${sessionId}.md`);
        if (response.ok) {
          const content = await response.text();
          sessions.push(`## ${sessionId}\n\n${content}\n\n---\n`);
        }
      } catch (err) {
        console.warn(`Failed to read session ${sessionId}`, err);
      }
    }

    return sessions.join('\n');
  }

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
            <ChangelogButton />
            <span className="text-[10px] text-muted-foreground/50 font-mono">{__BUILD_NUMBER__}</span>
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
              listenerPaused={state.listenerPaused}
              isRunning={state.isRunning}
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
              audioMuted={state.audioMuted}
              isModelLoaded={state.modelConfig.isLoaded}
              onClassifyChange={setClassifyWithLLM}
              onResponseChange={setResponseWithLLM}
              onSearchChange={setSearchEnabled}
              onAudioMuteChange={setAudioMuted}
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
              <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex justify-between items-start gap-2">
                <span>{state.error}</span>
                <button onClick={() => controller.clearError()} className="shrink-0 text-destructive/60 hover:text-destructive text-sm leading-none">&times;</button>
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
          <SpeechEventPanel speechLog={controller.speechLog} pendingTurnCount={state.pendingTurnCount} />
          <BiasSliders bias={state.bias} onChange={setBias} />
        </>
      }
      bottom={<HistoryTimeline history={state.history} />}
    />
  );
}

export default App;
