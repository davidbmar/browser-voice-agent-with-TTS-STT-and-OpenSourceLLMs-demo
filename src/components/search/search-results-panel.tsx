/**
 * search-results-panel.tsx — Displays web search query and results
 * in the desktop right-column debug area.
 */

import { useState } from "react";
import type { LoopState } from "@/lib/loop-types.ts";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

export function SearchResultsPanel({ state }: { state: LoopState }) {
  const [open, setOpen] = useState(true);
  const { lastSearchQuery, lastSearchResults, lastSearchDurationMs, lastSearchProvider } = state;

  if (!lastSearchQuery && lastSearchResults.length === 0) {
    return (
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Search className="h-3 w-3" />
          Web Search
        </h3>
        <p className="text-[10px] text-muted-foreground italic">
          No search performed this turn. Ask a factual or time-sensitive question.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 w-full text-left"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Search className="h-3 w-3" />
        Web Search
        {lastSearchResults.length > 0 && (
          <span className="text-[10px] font-normal ml-auto text-cyan-400">
            {lastSearchResults.length} results
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-2 text-xs">
          {lastSearchQuery && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Query:</span>
              <span className="font-mono text-cyan-400">"{lastSearchQuery}"</span>
            </div>
          )}

          {lastSearchDurationMs > 0 && (
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>{lastSearchDurationMs}ms</span>
              <span>{lastSearchProvider}</span>
            </div>
          )}

          {lastSearchResults.map((r, i) => (
            <div key={i} className="p-2 rounded bg-muted/30 border border-border/50 space-y-0.5">
              <div className="font-medium text-foreground text-[11px]">{r.title}</div>
              <div className="text-[10px] text-muted-foreground leading-relaxed">{r.snippet}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
