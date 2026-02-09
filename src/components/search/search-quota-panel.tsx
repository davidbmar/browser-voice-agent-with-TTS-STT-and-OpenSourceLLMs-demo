/**
 * search-quota-panel.tsx — Displays per-provider search quota usage
 * with color-coded progress bars.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import type { SearchQuota, ProviderQuota } from "@/lib/proxy-search-provider.ts";

function pctColor(pct: number): string {
  if (pct < 50) return "bg-green-500";
  if (pct < 80) return "bg-yellow-500";
  return "bg-red-500";
}

function periodLabel(provider: string, period: string): string {
  if (provider === "google") return `today (${period})`;
  return `this month (${period})`;
}

function QuotaBar({ name, quota }: { name: string; quota: ProviderQuota }) {
  const pct = quota.limit > 0 ? Math.min(100, (quota.used / quota.limit) * 100) : 0;
  const label = `${name.charAt(0).toUpperCase() + name.slice(1)}`;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-mono">
          {quota.used.toLocaleString()} / {quota.limit.toLocaleString()}{" "}
          <span className="text-muted-foreground">{periodLabel(name, quota.period)}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pctColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface SearchQuotaPanelProps {
  quota: SearchQuota | null;
}

export function SearchQuotaPanel({ quota }: SearchQuotaPanelProps) {
  const [open, setOpen] = useState(false);

  if (!quota) {
    return null;
  }

  return (
    <div className="space-y-1">
      <button
        className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 w-full text-left"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <BarChart3 className="h-3 w-3" />
        Search Quota
      </button>

      {open && (
        <div className="space-y-2 px-1">
          <QuotaBar name="google" quota={quota.google} />
          <QuotaBar name="brave" quota={quota.brave} />
          <QuotaBar name="tavily" quota={quota.tavily} />
        </div>
      )}
    </div>
  );
}
