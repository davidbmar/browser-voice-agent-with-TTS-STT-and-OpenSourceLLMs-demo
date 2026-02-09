import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { SpeechEvent } from "@/lib/loop-types.ts";
import { SpeechEventLog } from "@/lib/speech-event-log.ts";
import { formatTimestamp, formatTimeRange, US_TIMEZONES, type TimezoneMode } from "@/lib/format-time.ts";

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

interface CollapsedInterim {
  kind: "collapsed_interim";
  startMs: number;
  endMs: number;
  text: string;
  count: number;
  stage: string;
}

interface SingleEvent {
  kind: "single";
  event: SpeechEvent;
}

type DisplayItem = CollapsedInterim | SingleEvent;

function groupEvents(events: SpeechEvent[]): DisplayItem[] {
  const result: DisplayItem[] = [];
  let interimBatch: SpeechEvent[] = [];

  const flushInterims = () => {
    if (interimBatch.length === 0) return;
    const last = interimBatch[interimBatch.length - 1];
    result.push({
      kind: "collapsed_interim",
      startMs: interimBatch[0].timestampMs,
      endMs: last.timestampMs,
      text: last.text,
      count: interimBatch.length,
      stage: last.fsmStage,
    });
    interimBatch = [];
  };

  for (const evt of events) {
    if (evt.type === "interim") {
      interimBatch.push(evt);
    } else {
      flushInterims();
      result.push({ kind: "single", event: evt });
    }
  }
  flushInterims();
  return result;
}

interface SpeechEventPanelProps {
  speechLog: SpeechEventLog;
  pendingTurnCount: number;
}

export function SpeechEventPanel({ speechLog, pendingTurnCount }: SpeechEventPanelProps) {
  const [open, setOpen] = useState(true);
  const [timezone, setTimezone] = useState<TimezoneMode>("America/Chicago");
  const bottomRef = useRef<HTMLDivElement>(null);

  const entries = useSyncExternalStore(
    (cb) => speechLog.subscribe(cb),
    () => speechLog.getRecent(100),
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

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
            <div className="mb-2">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value as TimezoneMode)}
                onClick={(e) => e.stopPropagation()}
                className="px-1.5 py-0.5 text-[10px] rounded border border-border bg-background text-foreground"
              >
                <option value="utc">UTC</option>
                <option value="local">Local</option>
                {US_TIMEZONES.map((tz) => (
                  <option key={tz.iana} value={tz.iana}>{tz.label}</option>
                ))}
              </select>
            </div>
            <ScrollArea className="h-[180px]">
              <div className="space-y-0.5 font-mono text-[10px]">
                {entries.length === 0 && (
                  <div className="text-muted-foreground italic">No speech events yet.</div>
                )}
                {groupEvents(entries).map((item, i) => {
                  if (item.kind === "collapsed_interim") {
                    return (
                      <div key={`interim-${i}`} className="flex gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                        <span className="shrink-0 min-w-[7rem] text-muted-foreground/60">
                          {formatTimeRange(item.startMs, item.endMs, timezone)}
                        </span>
                        <span className="shrink-0 min-w-[2.75rem] w-11 text-right text-muted-foreground/80">{item.stage.slice(0, 6)}</span>
                        <span className={cn("shrink-0 min-w-[3.25rem] w-13", TYPE_COLORS.interim)}>
                          INTERIM
                        </span>
                        <span className="min-w-0 text-foreground break-words">
                          {item.text}
                          <span className="text-muted-foreground/60"> ({item.count})</span>
                        </span>
                      </div>
                    );
                  }
                  const evt = item.event;
                  return (
                    <div key={evt.id} className="flex gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                      <span className="shrink-0 min-w-[7rem] text-muted-foreground/60">
                        {formatTimestamp(evt.timestampMs, timezone)}
                      </span>
                      <span className="shrink-0 min-w-[2.75rem] w-11 text-right text-muted-foreground/80">{evt.fsmStage.slice(0, 6)}</span>
                      <span className={cn("shrink-0 min-w-[3.25rem] w-13", TYPE_COLORS[evt.type])}>
                        {TYPE_LABELS[evt.type]}
                      </span>
                      <span className="min-w-0 text-foreground break-words">
                        {evt.text}
                        {evt.confidence > 0 && <span className="text-muted-foreground/60"> ({evt.confidence.toFixed(2)})</span>}
                        {evt.queueDurationMs != null && (
                          <span className="text-green-400"> +{evt.queueDurationMs}ms</span>
                        )}
                      </span>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
