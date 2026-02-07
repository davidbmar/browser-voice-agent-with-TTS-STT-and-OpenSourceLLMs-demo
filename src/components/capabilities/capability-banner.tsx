/**
 * capability-banner.tsx — Shows a dismissible banner with browser capability results.
 *
 * Runs detectCapabilities() on mount and displays:
 *  - Green "All systems go" if everything passes
 *  - Yellow warnings for non-critical missing features
 *  - Red blockers for required missing features (WebGPU, SharedArrayBuffer, etc.)
 *
 * Users can dismiss the banner. It stays dismissed for the session.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button.tsx";
import { X, CheckCircle, AlertTriangle, XCircle, Monitor } from "lucide-react";
import { detectCapabilities, type CapabilityReport, type CapabilityStatus } from "@/lib/capabilities.ts";
import { cn } from "@/lib/utils.ts";

const STATUS_ICON: Record<CapabilityStatus, typeof CheckCircle> = {
  pass: CheckCircle,
  warn: AlertTriangle,
  fail: XCircle,
};

const STATUS_COLOR: Record<CapabilityStatus, string> = {
  pass: "text-green-400",
  warn: "text-yellow-400",
  fail: "text-red-400",
};

function isSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  return ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("CriOS") && !ua.includes("Chromium");
}

export function CapabilityBanner() {
  const [report, setReport] = useState<CapabilityReport | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isSafari] = useState(isSafariBrowser);

  useEffect(() => {
    detectCapabilities().then(setReport);
  }, []);

  // Safari: show unsupported message (cannot be dismissed)
  if (isSafari) {
    return (
      <div className="border rounded-md px-3 py-3 text-xs border-red-500/30 bg-red-500/5">
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0 text-red-400" />
          <div>
            <span className="font-medium text-red-400">Safari is not supported.</span>
            <span className="text-muted-foreground ml-1">
              This app requires <strong>Google Chrome</strong> for WebGPU, Web Speech API, and TTS. Please open this page in Chrome.
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!report || dismissed) return null;

  // Auto-expand if there are failures
  const autoExpand = report.overall === "blocked";
  const isExpanded = expanded || autoExpand;

  const overallColor =
    report.overall === "ready"
      ? "border-green-500/30 bg-green-500/5"
      : report.overall === "degraded"
      ? "border-yellow-500/30 bg-yellow-500/5"
      : "border-red-500/30 bg-red-500/5";

  const overallText =
    report.overall === "ready"
      ? "All systems go"
      : report.overall === "degraded"
      ? "Some features limited"
      : "Missing required capabilities";

  const overallTextColor =
    report.overall === "ready"
      ? "text-green-400"
      : report.overall === "degraded"
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className={cn("border rounded-md px-3 py-2 text-xs", overallColor)}>
      {/* Summary row */}
      <div className="flex items-center justify-between gap-3">
        <button
          className="flex items-center gap-2 text-left flex-1"
          onClick={() => setExpanded(!isExpanded)}
        >
          <Monitor className={cn("h-3.5 w-3.5 shrink-0", overallTextColor)} />
          <span className={cn("font-medium", overallTextColor)}>{overallText}</span>
          {report.gpuInfo && (
            <span className="text-muted-foreground truncate hidden sm:inline">
              GPU: {report.gpuInfo}
            </span>
          )}
          <span className="text-muted-foreground ml-auto shrink-0">
            {report.checks.filter((c) => c.status === "pass").length}/{report.checks.length} checks passed
          </span>
        </button>
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 shrink-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
          {report.checks.map((check) => {
            const Icon = STATUS_ICON[check.status];
            return (
              <div key={check.name} className="flex items-start gap-2">
                <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", STATUS_COLOR[check.status])} />
                <div>
                  <span className="font-medium">{check.name}</span>
                  {!check.required && <span className="text-muted-foreground ml-1">(optional)</span>}
                  <span className="text-muted-foreground ml-1">— {check.detail}</span>
                </div>
              </div>
            );
          })}

          {report.overall === "blocked" && (
            <div className="mt-2 p-2 rounded bg-red-500/10 text-red-300">
              <strong>LLM features require WebGPU.</strong> Try Chrome 113+ or Edge 113+ on a device with a
              supported GPU. Simulate Input with rule-based responses will still work without WebGPU.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
