/**
 * decision-trace.ts — Observable trace log for FSM decisions.
 *
 * Accumulates timestamped entries showing what the FSM decided and why.
 * Used by the Decision Trace panel to display a mechanical log like:
 *   silence_ms=1520 >= 1500 => turn_end
 *
 * Implements a subscribe/snapshot pattern compatible with
 * React's useSyncExternalStore (snapshot must be referentially stable).
 */

import type { TraceEntry, Stage } from "./loop-types.ts";

const MAX_ENTRIES = 200;

export class DecisionTrace {
  private entries: TraceEntry[] = [];
  /** Cached snapshot for useSyncExternalStore (referential stability). */
  private snapshot: TraceEntry[] = [];
  private listeners: Set<() => void> = new Set();

  /** Add a trace entry and notify subscribers. */
  add(stage: Stage, event: string, detail: string, data?: Record<string, unknown>) {
    this.entries.push({ timestamp: Date.now(), stage, event, detail, data });

    // Cap at MAX_ENTRIES to bound memory
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }

    // Create new snapshot array (required for useSyncExternalStore)
    this.snapshot = this.entries.slice(-100);
    this.notify();
  }

  /** Get all entries (creates a copy). */
  getAll(): TraceEntry[] {
    return [...this.entries];
  }

  /** Get recent entries (returns cached snapshot — referentially stable). */
  getRecent(_count: number = 100): TraceEntry[] {
    return this.snapshot;
  }

  /** Clear all entries. */
  clear() {
    this.entries = [];
    this.snapshot = [];
    this.notify();
  }

  /** Subscribe to changes (for useSyncExternalStore). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}
