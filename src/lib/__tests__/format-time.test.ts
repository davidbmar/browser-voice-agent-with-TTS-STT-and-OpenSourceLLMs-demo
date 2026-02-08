import { describe, it, expect } from "vitest";
import { formatTimestamp, formatTimezoneLabel } from "../format-time.ts";
import type { TimezoneMode } from "../format-time.ts";

describe("formatTimestamp", () => {
  // Use a known epoch: 2024-01-15 14:30:45.123 UTC
  const epoch = Date.UTC(2024, 0, 15, 14, 30, 45, 123);

  it("formats UTC correctly with HH:MM:SS.mmm", () => {
    const result = formatTimestamp(epoch, "utc");
    expect(result).toBe("14:30:45.123");
  });

  it("formats america_chicago (CST = UTC-6) correctly", () => {
    const result = formatTimestamp(epoch, "america_chicago");
    // CST is UTC-6, so 14:30 UTC = 08:30 CST
    expect(result).toBe("08:30:45.123");
  });

  it("formats local timezone (result is a valid time string)", () => {
    const result = formatTimestamp(epoch, "local");
    // Should match HH:MM:SS.mmm pattern
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

describe("formatTimezoneLabel", () => {
  it("returns 'UTC' for utc mode", () => {
    expect(formatTimezoneLabel("utc")).toBe("UTC");
  });

  it("returns 'CT (Austin)' for america_chicago mode", () => {
    expect(formatTimezoneLabel("america_chicago")).toBe("CT (Austin)");
  });

  it("returns 'Local' for local mode", () => {
    expect(formatTimezoneLabel("local")).toBe("Local");
  });

  it("all TimezoneMode values produce a non-empty label", () => {
    const modes: TimezoneMode[] = ["utc", "local", "america_chicago"];
    for (const mode of modes) {
      const label = formatTimezoneLabel(mode);
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
