import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { SpeechEvent } from "@/lib/loop-types.ts";
import { SpeechEventLog } from "@/lib/speech-event-log.ts";
import { formatTimestamp, formatTimezoneLabel, type TimezoneMode } from "@/lib/format-time.ts";

const TYPE_COLORS: Record<SpeechEvent["type"], string> = {
  interim: "text-muted-foreground",
  final: "text-foreground",
  queued: "text-yellow-400",
  dequeued: "text-green-400",
  stale_discarded: "text-red-400",
};

const TYPE_LABELS: Record<SpeechEvent["type"], string> = {
  interim: "INTERIM",
  final: "FINAL",
  queued: "QUEUED",
  dequeued: "DEQUEUED",
  stale_discarded: "STALE",
};

interface SpeechEventPanelProps {
  speechLog: SpeechEventLog;
  pendingTurnCount: number;
}

export function SpeechEventPanel({ speechLog, pendingTurnCount }: SpeechEventPanelProps) {
  const [open, setOpen] = useState(true);
  const [timezone, setTimezone] = useState<TimezoneMode>("utc");
  const bottomRef = useRef<HTMLDivElement>(null);

  const entries = useSyncExternalStore(
    (cb) => speechLog.subscribe(cb),
    () => speechLog.getRecent(100),
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  const tzModes: TimezoneMode[] = ["utc", "local", "america_chicago"];

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle>Speech Events</CardTitle>
            <div className="flex items-center gap-2">
              {pendingTurnCount > 0 && (
                <span className="text-xs text-yellow-400 font-medium">
                  Queue: {pendingTurnCount}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{entries.length} events</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div className="flex gap-1 mb-2">
              {tzModes.map((tz) => (
                <button
                  key={tz}
                  onClick={(e) => { e.stopPropagation(); setTimezone(tz); }}
                  className={cn(
                    "px-2 py-0.5 text-[10px] rounded border",
                    timezone === tz
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {formatTimezoneLabel(tz)}
                </button>
              ))}
            </div>
            <ScrollArea className="h-[180px]">
              <div className="space-y-0.5 font-mono text-[10px]">
                {entries.length === 0 && (
                  <div className="text-muted-foreground italic">No speech events yet.</div>
                )}
                {entries.map((evt) => (
                  <div key={evt.id} className="flex gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <span className="shrink-0 text-muted-foreground/60">
                      {formatTimestamp(evt.timestampMs, timezone)}
                    </span>
                    <span className="shrink-0 w-10 text-right text-muted-foreground/80">{evt.fsmStage.slice(0, 6)}</span>
                    <span className={cn("shrink-0 w-12", TYPE_COLORS[evt.type])}>
                      {TYPE_LABELS[evt.type]}
                    </span>
                    <span className="text-foreground truncate">
                      {evt.text.slice(0, 60)}
                      {evt.confidence > 0 && <span className="text-muted-foreground/60"> ({evt.confidence.toFixed(2)})</span>}
                      {evt.queueDurationMs != null && (
                        <span className="text-green-400"> +{evt.queueDurationMs}ms</span>
                      )}
                    </span>
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
