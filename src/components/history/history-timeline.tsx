import { useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.tsx";
import { HistoryEntry } from "./history-entry.tsx";
import type { LoopHistoryEntry } from "@/lib/loop-types.ts";

interface HistoryTimelineProps {
  history: LoopHistoryEntry[];
}

export function HistoryTimeline({ history }: HistoryTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [history.length]);

  return (
    <Card>
      <CardHeader className="pb-2 py-2 px-4">
        <div className="flex items-center justify-between">
          <CardTitle>History</CardTitle>
          <span className="text-xs text-muted-foreground">{history.length} iterations</span>
        </div>
      </CardHeader>
      <CardContent className="pb-3 px-4">
        {history.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-2">
            No loop iterations yet. Start the loop or use Simulate Input.
          </div>
        ) : (
          <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1">
            {history.map((entry, i) => (
              <HistoryEntry key={entry.id} entry={entry} isLatest={i === history.length - 1} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
