/**
 * mobile-layout.tsx — Simplified chat-style layout for mobile/iPhone.
 *
 * Shows a conversation flow like a messaging app:
 *  - Oldest messages at top, newest at bottom
 *  - Auto-scrolls to latest message
 *  - Voice-only: mic Start/Stop controls at bottom
 */

import { useRef, useEffect } from "react";
import type { LoopState, LoopEvent, LoopHistoryEntry } from "@/lib/loop-types.ts";
import { MODEL_CATALOG } from "@/lib/loop-types.ts";
import { Button } from "@/components/ui/button.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { CapabilityBanner } from "@/components/capabilities/capability-banner.tsx";
import { Bug, Mic, Square, Loader2, Brain, MessageCircle, User, X } from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface MobileLayoutProps {
  state: LoopState;
  dispatch: (event: LoopEvent) => void;
  isLoadingModel: boolean;
  onSpeakTest: () => void;
  selectedModelId: string | null;
  onModelLoad: (modelId: string) => void;
  onModelUnload: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  IDLE: "Idle",
  LISTENING: "Listening...",
  SIGNAL_DETECT: "Detecting speech...",
  CLASSIFY: "Classifying...",
  MICRO_RESPONSE: "Generating response...",
  SPEAK: "Speaking...",
  FEEDBACK_OBSERVE: "Observing...",
  UPDATE_BIAS: "Adapting...",
};

const STAGE_COLORS: Record<string, string> = {
  IDLE: "bg-muted text-muted-foreground",
  LISTENING: "bg-green-500/20 text-green-400",
  SIGNAL_DETECT: "bg-yellow-500/20 text-yellow-400",
  CLASSIFY: "bg-blue-500/20 text-blue-400",
  MICRO_RESPONSE: "bg-purple-500/20 text-purple-400",
  SPEAK: "bg-primary/20 text-primary",
  FEEDBACK_OBSERVE: "bg-orange-500/20 text-orange-400",
  UPDATE_BIAS: "bg-cyan-500/20 text-cyan-400",
};

function HistoryBubble({ entry }: { entry: LoopHistoryEntry }) {
  return (
    <div className="space-y-2">
      {/* User bubble — left aligned */}
      <div className="flex gap-2 items-start">
        <User className="h-4 w-4 mt-1 shrink-0 text-blue-400" />
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm max-w-[85%]">
          {entry.transcript || "(no transcript)"}
        </div>
      </div>
      {/* AI response bubble — right aligned */}
      <div className="flex gap-2 items-start justify-end">
        <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm max-w-[85%]">
          {entry.response || "(no response)"}
        </div>
        <MessageCircle className="h-4 w-4 mt-1 shrink-0 text-primary" />
      </div>
    </div>
  );
}

export function MobileLayout({ state, dispatch, isLoadingModel, selectedModelId, onModelLoad, onModelUnload }: MobileLayoutProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.stage, state.lastResponse, state.lastThinking, state.finalTranscript, state.interimTranscript, state.history.length]);

  const transcript = state.finalTranscript || state.interimTranscript;
  const hasCurrentTurn = !!(transcript || state.lastThinking || state.lastResponse);
  const isProcessing = ["CLASSIFY", "MICRO_RESPONSE", "SPEAK", "SIGNAL_DETECT"].includes(state.stage);
  const showEmptyState = !hasCurrentTurn && state.history.length === 0 && !state.error;

  return (
    <div className="flex flex-col bg-background text-foreground" style={{ height: "100dvh" }}>
      {/* --- Compact header --- */}
      <header className="shrink-0 border-b bg-card/50 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Left: branding + stage */}
          <div className="flex items-center gap-2 shrink-0">
            <Bug className="h-4 w-4 text-primary" />
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-medium",
              STAGE_COLORS[state.stage] || "bg-muted text-muted-foreground"
            )}>
              {STAGE_LABELS[state.stage] || state.stage}
            </span>
          </div>

          {/* Right: model selector */}
          <div className="flex items-center gap-1.5 min-w-0">
            {state.modelConfig.isLoaded ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-primary font-medium truncate">
                  {MODEL_CATALOG.find(m => m.id === selectedModelId)?.name || "Loaded"}
                </span>
                <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={onModelUnload}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : isLoadingModel ? (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                <span className="text-[10px] text-muted-foreground font-mono">
                  {(state.modelConfig.loadProgress * 100).toFixed(0)}%
                </span>
              </div>
            ) : (
              <Select value={selectedModelId || ""} onValueChange={onModelLoad}>
                <SelectTrigger className="h-7 text-[11px] w-[140px]">
                  <SelectValue placeholder="Select model..." />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_CATALOG.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <span>{m.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">{m.vramGB}GB</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        {/* Loading progress bar */}
        {isLoadingModel && (
          <Progress value={state.modelConfig.loadProgress * 100} className="h-1 mt-1.5" />
        )}
      </header>

      {/* --- Scrollable chat area --- */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4">
        {/* Capability banner */}
        <CapabilityBanner />

        {/* Error */}
        {state.error && (
          <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {state.error}
          </div>
        )}

        {/* Conversation history — full opacity, chronological */}
        {state.history.map((entry) => (
          <HistoryBubble key={entry.id} entry={entry} />
        ))}

        {/* --- Current turn (only while actively processing) --- */}

        {/* User transcript */}
        {transcript && (
          <div className="flex gap-2 items-start">
            <User className="h-4 w-4 mt-1 shrink-0 text-blue-400" />
            <div>
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm max-w-[85%]">
                {transcript}
                {state.interimTranscript && !state.finalTranscript && (
                  <span className="text-muted-foreground animate-pulse">...</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Thinking / internal monologue */}
        {state.lastThinking && (
          <div className="flex gap-2 items-start">
            <Brain className="h-4 w-4 mt-1 shrink-0 text-purple-400" />
            <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-2 text-sm italic text-muted-foreground max-w-[85%]">
              {state.lastThinking}
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && !state.lastResponse && (
          <div className="flex gap-2 items-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">{STAGE_LABELS[state.stage]}</span>
          </div>
        )}

        {/* AI response (current turn) */}
        {state.lastResponse && (
          <div className="flex gap-2 items-start justify-end">
            <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm max-w-[85%]">
              {state.lastResponse}
            </div>
            <MessageCircle className="h-4 w-4 mt-1 shrink-0 text-primary" />
          </div>
        )}

        {/* Empty state: instructions + start button */}
        {showEmptyState && (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-12">
            <Bug className="h-10 w-10 mb-4 opacity-30" />
            <p className="text-base font-medium text-foreground">Bug Loop Voice Agent</p>

            <div className="mt-4 mb-6 space-y-3 text-xs leading-relaxed max-w-[260px]">
              <p>
                <span className="font-semibold text-foreground">1.</span>{" "}
                Select an AI model in the{" "}
                <span className="font-semibold text-primary">upper right corner</span>.
              </p>
              <p>
                <span className="font-semibold text-foreground">2.</span>{" "}
                Tap <span className="font-semibold text-primary">Start</span> below, then just begin talking.
                The agent will listen, think, and respond with voice.
              </p>
            </div>

            {isLoadingModel && (
              <div className="flex items-center gap-2 mb-4 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Loading model... {(state.modelConfig.loadProgress * 100).toFixed(0)}%</span>
              </div>
            )}

            {state.modelConfig.isLoaded && (
              <p className="text-xs text-primary font-medium mb-4">Model ready. Tap the mic to begin.</p>
            )}

            <Button
              size="lg"
              className="h-16 w-16 rounded-full gap-0"
              onClick={() => dispatch({ type: "MIC_START" })}
              disabled={state.stage !== "IDLE" || !state.modelConfig.isLoaded}
            >
              <Mic className="h-7 w-7" />
            </Button>
            <p className="text-[10px] mt-2 text-muted-foreground">Tap to start listening</p>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* --- Sticky bottom controls --- */}
      <div className="shrink-0 border-t bg-card/80 backdrop-blur px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={state.isRunning ? "outline" : "default"}
            className="flex-1 h-10 text-sm gap-1.5"
            onClick={() => dispatch({ type: "MIC_START" })}
            disabled={state.stage !== "IDLE"}
          >
            <Mic className="h-4 w-4" />
            Start
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-10 text-sm gap-1.5"
            onClick={() => dispatch({ type: "MIC_STOP" })}
            disabled={!state.isRunning}
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
        </div>
      </div>
    </div>
  );
}
