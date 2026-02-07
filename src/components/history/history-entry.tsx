import { cn } from "@/lib/utils.ts";
import type { LoopHistoryEntry } from "@/lib/loop-types.ts";

interface HistoryEntryProps {
  entry: LoopHistoryEntry;
  isLatest?: boolean;
}

export function HistoryEntry({ entry, isLatest }: HistoryEntryProps) {
  const intentColor: Record<string, string> = {
    question: "text-blue-400",
    command: "text-orange-400",
    acknowledgement: "text-green-400",
    greeting: "text-yellow-400",
    farewell: "text-purple-400",
    clarification_needed: "text-red-400",
    statement: "text-muted-foreground",
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1 px-3 py-2 rounded-md border bg-card/50 min-w-[200px] max-w-[280px] shrink-0",
        isLatest && "border-primary/50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-primary">#{entry.id}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{entry.totalDurationMs}ms</span>
      </div>
      <div className="text-xs truncate" title={entry.transcript}>
        &ldquo;{entry.transcript}&rdquo;
      </div>
      <div className="flex items-center gap-2">
        {entry.classification && (
          <span className={cn("text-[10px] font-mono", intentColor[entry.classification.intent] || "text-muted-foreground")}>
            {entry.classification.intent}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">→</span>
        <span className="text-[10px] truncate" title={entry.response}>
          &ldquo;{entry.response}&rdquo;
        </span>
      </div>
    </div>
  );
}
