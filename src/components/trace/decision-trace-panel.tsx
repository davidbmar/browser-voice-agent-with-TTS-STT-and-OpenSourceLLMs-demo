import { useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { TraceEntry } from "@/lib/loop-types.ts";
import { formatTimestamp, formatTimezoneLabel, type TimezoneMode } from "@/lib/format-time.ts";

interface DecisionTracePanelProps {
  entries: TraceEntry[];
  timezone?: TimezoneMode;
}

export function DecisionTracePanel({ entries, timezone = "utc" }: DecisionTracePanelProps) {
  const [open, setOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle>Decision Trace</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{entries.length} entries ({formatTimezoneLabel(timezone)})</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <ScrollArea className="h-[180px]">
              <div className="space-y-0.5 font-mono text-[10px]">
                {entries.length === 0 && (
                  <div className="text-muted-foreground italic">No trace entries yet.</div>
                )}
                {entries.map((entry, i) => (
                  <div key={i} className="flex gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <span className="shrink-0 text-muted-foreground/60">
                      {formatTimestamp(entry.timestamp, timezone)}
                    </span>
                    <span className="shrink-0 text-primary w-16 text-right">{entry.stage}</span>
                    <span className="text-foreground">{entry.detail}</span>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
