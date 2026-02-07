import { useState, useEffect } from "react";
import { STAGES_IN_ORDER } from "@/lib/loop-types.ts";
import type { Stage } from "@/lib/loop-types.ts";
import { StageNode } from "./stage-node.tsx";
import { ArrowRight } from "lucide-react";

interface StageDiagramProps {
  currentStage: Stage;
  stageEnteredAt: number;
}

export function StageDiagram({ currentStage, stageEnteredAt }: StageDiagramProps) {
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

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STAGES_IN_ORDER.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1">
          <StageNode
            stage={stage}
            isActive={currentStage === stage}
            elapsedMs={currentStage === stage ? elapsed : undefined}
          />
          {i < STAGES_IN_ORDER.length - 1 && (
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
