import { describe, it, expect } from "vitest";
import { formatTimestamp, formatTimeRange, formatTimezoneLabel, US_TIMEZONES } from "../format-time.ts";
import type { TimezoneMode } from "../format-time.ts";

describe("formatTimestamp", () => {
  // Use a known epoch: 2024-01-15 14:30:45.123 UTC
  const epoch = Date.UTC(2024, 0, 15, 14, 30, 45, 123);

  it("formats UTC correctly with HH:MM:SS.mmm (24-hour)", () => {
    const result = formatTimestamp(epoch, "utc");
    expect(result).toBe("14:30:45.123");
  });

  it("formats America/Chicago in 12-hour with AM/PM", () => {
    const result = formatTimestamp(epoch, "America/Chicago");
    // CST is UTC-6, so 14:30 UTC = 8:30 AM CST → "8:30:45.123a"
    expect(result).toBe("8:30:45.123a");
  });

  it("formats America/New_York in 12-hour with AM/PM", () => {
    const result = formatTimestamp(epoch, "America/New_York");
    // EST is UTC-5, so 14:30 UTC = 9:30 AM EST → "9:30:45.123a"
    expect(result).toBe("9:30:45.123a");
  });

  it("formats PM times correctly", () => {
    // 20:30 UTC = 2:30 PM Central
    const pmEpoch = Date.UTC(2024, 0, 15, 20, 30, 45, 123);
    const result = formatTimestamp(pmEpoch, "America/Chicago");
    expect(result).toBe("2:30:45.123p");
  });

  it("formats local timezone (result is a valid time string)", () => {
    const result = formatTimestamp(epoch, "local");
    // Should match HH:MM:SS.mmm pattern (24-hour)
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it("handles midnight epoch correctly in UTC", () => {
    const midnight = Date.UTC(2024, 5, 1, 0, 0, 0, 0);
    const result = formatTimestamp(midnight, "utc");
    expect(result).toBe("00:00:00.000");
  });

  it("preserves millisecond precision", () => {
    const withMs = Date.UTC(2024, 0, 1, 12, 0, 0, 7);
    const result = formatTimestamp(withMs, "utc");
    expect(result).toBe("12:00:00.007");
  });
});

describe("formatTimeRange", () => {
  // 14:30:45.123 UTC and 14:30:49.456 UTC — ~4.3s apart
  const startMs = Date.UTC(2024, 0, 15, 14, 30, 45, 123);
  const endMs = Date.UTC(2024, 0, 15, 14, 30, 49, 456);

  it("shows abbreviated end time for ranges > 100ms (UTC)", () => {
    const result = formatTimeRange(startMs, endMs, "utc");
    expect(result).toBe("14:30:45.123-49.456");
  });

  it("shows abbreviated end time for ranges > 100ms (12-hour)", () => {
    const result = formatTimeRange(startMs, endMs, "America/Chicago");
    // "8:30:45.123a-49.456"
    expect(result).toBe("8:30:45.123a-49.456");
  });

  it("shows single timestamp for ranges < 100ms", () => {
    const closeEnd = startMs + 50;
    const result = formatTimeRange(startMs, closeEnd, "utc");
    expect(result).toBe("14:30:45.123");
  });

  it("shows single timestamp for identical start and end", () => {
    const result = formatTimeRange(startMs, startMs, "utc");
    expect(result).toBe("14:30:45.123");
  });
});

describe("formatTimezoneLabel", () => {
  it("returns 'UTC' for utc mode", () => {
    expect(formatTimezoneLabel("utc")).toBe("UTC");
  });

  it("returns 'Central' for America/Chicago", () => {
    expect(formatTimezoneLabel("America/Chicago")).toBe("Central");
  });

  it("returns 'Local' for local mode", () => {
    expect(formatTimezoneLabel("local")).toBe("Local");
  });

  it("all US timezone modes produce a non-empty label", () => {
    const modes: TimezoneMode[] = ["utc", "local", ...US_TIMEZONES.map((tz) => tz.iana)];
    for (const mode of modes) {
      const label = formatTimezoneLabel(mode);
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
