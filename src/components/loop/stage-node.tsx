import { cn } from "@/lib/utils.ts";
import type { Stage } from "@/lib/loop-types.ts";

const STAGE_LABELS: Record<Stage, string> = {
  IDLE: "Idle",
  LISTENING: "Listen",
  SIGNAL_DETECT: "Signal",
  CLASSIFY: "Classify",
  MICRO_RESPONSE: "Response",
  SPEAK: "Speak",
  FEEDBACK_OBSERVE: "Observe",
  UPDATE_BIAS: "Update",
  HANDOFF_REASON: "Handoff",
};

const STAGE_ICONS: Record<Stage, string> = {
  IDLE: "~",
  LISTENING: "((•))",
  SIGNAL_DETECT: "!",
  CLASSIFY: "?",
  MICRO_RESPONSE: ">",
  SPEAK: "))))",
  FEEDBACK_OBSERVE: "👁",
  UPDATE_BIAS: "⚙",
  HANDOFF_REASON: "→",
};

interface StageNodeProps {
  stage: Stage;
  isActive: boolean;
  elapsedMs?: number;
}

export function StageNode({ stage, isActive, elapsedMs }: StageNodeProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 px-2 py-1.5 rounded-md border text-xs transition-all min-w-[60px]",
        isActive
          ? "stage-active border-primary bg-primary/10 text-primary-foreground"
          : "border-border bg-card/50 text-muted-foreground"
      )}
    >
      <span className="text-base leading-none">{STAGE_ICONS[stage]}</span>
      <span className="font-medium">{STAGE_LABELS[stage]}</span>
      {isActive && elapsedMs !== undefined && (
        <span className="text-[10px] text-muted-foreground font-mono">
          {elapsedMs}ms
        </span>
      )}
    </div>
  );
}
