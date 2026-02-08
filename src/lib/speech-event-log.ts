/**
 * speech-event-log.ts — Ring buffer for timestamped speech events.
 *
 * Tracks when speech arrives, what FSM stage it hit, and whether it was
 * queued/dequeued/discarded. Used by the Speech Event Panel for debugging.
 *
 * Same subscribe/notify pattern as DecisionTrace for React integration.
 */

import type { SpeechEvent, Stage } from "./loop-types.ts";

const MAX_ENTRIES = 200;
const DEFAULT_RECENT = 100;

export class SpeechEventLog {
  private entries: SpeechEvent[] = [];
  private nextId = 1;
  private listeners: Set<() => void> = new Set();
  private recentCache: SpeechEvent[] | null = null;
  private recentCacheN = DEFAULT_RECENT;

  add(
    type: SpeechEvent["type"],
    text: string,
    confidence: number,
    fsmStage: Stage,
    extra?: { processedAt?: number; queueDurationMs?: number },
  ): SpeechEvent {
    const event: SpeechEvent = {
      id: this.nextId++,
      type,
      text,
      confidence,
      timestampMs: Date.now(),
      fsmStage,
      ...extra,
    };
    this.entries.push(event);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
    this.recentCache = null;
    this.notify();
    return event;
  }

  getAll(): SpeechEvent[] {
    return [...this.entries];
  }

  getRecent(n: number = DEFAULT_RECENT): SpeechEvent[] {
    if (this.recentCache && this.recentCacheN === n) return this.recentCache;
    this.recentCacheN = n;
    this.recentCache = this.entries.slice(-n);
    return this.recentCache;
  }

  clear() {
    this.entries = [];
    this.recentCache = null;
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) l();
  }
}
