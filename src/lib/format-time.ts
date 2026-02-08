/**
 * format-time.ts — Timezone-aware timestamp formatting.
 *
 * Uses the native Intl API for timezone conversion.
 * No external date library needed.
 */

export type TimezoneMode = "utc" | "local" | (typeof US_TIMEZONES)[number]["iana"];

export const US_TIMEZONES = [
  { iana: "America/New_York",    label: "Eastern" },
  { iana: "America/Chicago",     label: "Central" },
  { iana: "America/Denver",      label: "Mountain" },
  { iana: "America/Phoenix",     label: "Arizona" },
  { iana: "America/Los_Angeles", label: "Pacific" },
  { iana: "America/Anchorage",   label: "Alaska" },
  { iana: "Pacific/Honolulu",    label: "Hawaii" },
] as const;

/** Format an epoch timestamp with millisecond precision in the given timezone. */
export function formatTimestamp(epochMs: number, mode: TimezoneMode): string {
  const d = new Date(epochMs);
  const isIana = mode !== "utc" && mode !== "local";
  const tz = mode === "utc" ? "UTC" : isIana ? mode : undefined;
  const hour12 = isIana; // 12-hour AM/PM for US timezones

  const base = d.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour12,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });

  if (!hour12) return base;

  // Intl returns e.g. "02:30:45.123 PM" — compact to "2:30:45.123p"
  const match = base.match(/^0?(\d{1,2}:\d{2}:\d{2}\.\d{3})\s*(AM|PM)$/);
  if (!match) return base;
  return `${match[1]}${match[2][0].toLowerCase()}`;
}

/** Format a time range, showing abbreviated end time for ranges > 100ms. */
export function formatTimeRange(startMs: number, endMs: number, mode: TimezoneMode): string {
  const startStr = formatTimestamp(startMs, mode);
  if (endMs - startMs < 100) return startStr;
  const endStr = formatTimestamp(endMs, mode);
  // Only show seconds.ms portion for end time (e.g., "2:53:22.734p-26.242")
  const endShort = endStr.replace(/[ap]$/, "").slice(-6); // "SS.mmm"
  return `${startStr}-${endShort}`;
}

/** Human-readable label for a timezone mode. */
export function formatTimezoneLabel(mode: TimezoneMode): string {
  if (mode === "utc") return "UTC";
  if (mode === "local") return "Local";
  const entry = US_TIMEZONES.find((tz) => tz.iana === mode);
  return entry?.label ?? mode;
}
