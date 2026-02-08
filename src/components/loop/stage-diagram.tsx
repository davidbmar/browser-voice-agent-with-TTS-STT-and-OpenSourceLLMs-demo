import { useState, useEffect } from "react";
import { PIPELINE_STAGES } from "@/lib/loop-types.ts";
import type { Stage } from "@/lib/loop-types.ts";
import { StageNode } from "./stage-node.tsx";
import { ArrowRight, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface StageDiagramProps {
  currentStage: Stage;
  stageEnteredAt: number;
  listenerPaused: boolean;
  isRunning: boolean;
}

export function StageDiagram({ currentStage, stageEnteredAt, listenerPaused, isRunning }: StageDiagramProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (currentStage === "IDLE" || !stageEnteredAt) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - stageEnteredAt);
    const interval = setInterval(() => {
      setElapsed(Date.now() - stageEnteredAt);
    }, 100);
    return () => clearInterval(interval);
  }, [currentStage, stageEnteredAt]);

  if (!isRunning) {
    return (
      <div className="flex items-center gap-2">
        <StageNode stage="IDLE" isActive={currentStage === "IDLE"} />
        <span className="text-xs text-muted-foreground">Loop not running</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Row 1: Listener status */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs transition-all",
            listenerPaused
              ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
              : "border-green-500/50 bg-green-500/10 text-green-400"
          )}
        >
          {listenerPaused ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          <span className="font-medium">
            {listenerPaused ? "Paused" : "Listening"}
          </span>
          {listenerPaused && (
            <span className="text-[10px] text-yellow-400/70">(echo cancel)</span>
          )}
        </div>
        {(currentStage === "LISTENING" || currentStage === "SIGNAL_DETECT") && (
          <StageNode
            stage={currentStage}
            isActive={true}
            elapsedMs={elapsed}
          />
        )}
      </div>

      {/* Row 2: Processing pipeline */}
      <div className="flex items-center gap-1 flex-wrap">
        {PIPELINE_STAGES.map((stage, i) => (
          <div key={stage} className="flex items-center gap-1">
            <StageNode
              stage={stage}
              isActive={currentStage === stage}
              elapsedMs={currentStage === stage ? elapsed : undefined}
            />
            {i < PIPELINE_STAGES.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
