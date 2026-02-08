/**
 * format-time.ts — Timezone-aware timestamp formatting.
 *
 * Uses the native Intl API for timezone conversion.
 * No external date library needed.
 */

export type TimezoneMode = "utc" | "local" | "america_chicago";

/** Format an epoch timestamp with millisecond precision in the given timezone. */
export function formatTimestamp(epochMs: number, mode: TimezoneMode): string {
  const d = new Date(epochMs);
  const tz = mode === "utc" ? "UTC"
    : mode === "america_chicago" ? "America/Chicago"
    : undefined; // browser local

  return d.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

/** Human-readable label for a timezone mode. */
export function formatTimezoneLabel(mode: TimezoneMode): string {
  switch (mode) {
    case "utc": return "UTC";
    case "america_chicago": return "CT (Austin)";
    case "local": return "Local";
  }
}
