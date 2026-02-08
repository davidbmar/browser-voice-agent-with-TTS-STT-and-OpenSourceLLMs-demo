/**
 * bias-store.ts — Adaptive bias values that control FSM behavior.
 *
 * The bias system adjusts how the agent behaves over time based
 * on observed user reactions. Values can also be manually adjusted
 * via the Bias Sliders panel in the UI.
 *
 * Reaction types and their effects:
 *  - silence         → lower clarification threshold (user is passive)
 *  - repeat_request  → increase verbosity (user wants more detail)
 *  - interruption    → decrease verbosity, increase interruption sensitivity
 *  - correction      → lower confidence floor (accept more uncertain inputs)
 *  - acknowledgement → no change (positive signal, keep current settings)
 */

import type { BiasValues } from "./loop-types.ts";
import { DEFAULT_BIAS } from "./loop-types.ts";

export class BiasStore {
  private values: BiasValues = { ...DEFAULT_BIAS };
  private listeners: Set<() => void> = new Set();

  /** Get a copy of current bias values. */
  get(): BiasValues {
    return { ...this.values };
  }

  /** Merge partial updates into bias values. */
  set(partial: Partial<BiasValues>) {
    this.values = { ...this.values, ...partial };
    this.notify();
  }

  /** Reset all values to defaults. */
  reset() {
    this.values = { ...DEFAULT_BIAS };
    this.notify();
  }

  /** Adjust bias values based on an observed user reaction. */
  updateFromReaction(reactionType: string) {
    switch (reactionType) {
      case "repeat_request":
        this.values.verbosity = Math.min(1, this.values.verbosity + 0.1);
        break;
      case "interruption":
        this.values.verbosity = Math.max(-1, this.values.verbosity - 0.15);
        this.values.interruptionSensitivity = Math.min(1, this.values.interruptionSensitivity + 0.1);
        break;
      case "silence":
        this.values.clarificationThreshold = Math.max(0.3, this.values.clarificationThreshold - 0.05);
        break;
      case "acknowledgement":
        // Positive signal — keep current settings
        break;
      case "correction":
        this.values.confidenceFloor = Math.max(0.3, this.values.confidenceFloor - 0.05);
        break;
      case "follow_up":
        // User engaged with a follow-up — positive signal, slight verbosity boost
        this.values.verbosity = Math.min(1, this.values.verbosity + 0.05);
        break;
    }
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}
