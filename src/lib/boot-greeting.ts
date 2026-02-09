/**
 * boot-greeting.ts — Mobile voice welcome during model loading.
 *
 * On iOS, speechSynthesis.speak() MUST be called in the synchronous call stack
 * of a user gesture (click/tap). The first speak() call in the gesture context
 * "unlocks" the audio session; subsequent calls (even async) will then work.
 *
 * On Android, this restriction is relaxed but the same pattern works fine.
 */

import { generateDingBlob, generateHappyJingleBlob } from "@/lib/ding-tone.ts";

export interface BootGreetingHandle {
  /** Call when model finishes loading — clears dings, plays jingle + "ready". */
  onModelLoaded: () => void;
  /** Call to clean up (e.g. on unmount). */
  cleanup: () => void;
}

/**
 * Start the boot greeting sequence.
 * MUST be called synchronously from a click/tap handler for iOS compatibility.
 *
 * Sequence:
 * 1. Say "Well, hello there! How are you doing?" (synchronous speak — unlocks iOS audio)
 * 2. Say "On first boot I have to load an LLM model so give me a second please."
 * 3. Play ding tone every 2 seconds while model loads
 * 4. When onModelLoaded() is called: stop dings, play happy jingle, say "Ok ready"
 */
export function startBootGreeting(): BootGreetingHandle {
  let dingInterval: ReturnType<typeof setInterval> | null = null;
  let modelLoaded = false;

  function sayNative(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof speechSynthesis === "undefined") { resolve(); return; }
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.0;
      utter.lang = "en-US";
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      speechSynthesis.speak(utter);
    });
  }

  // First utterance MUST be synchronous in the tap call stack (iOS audio unlock)
  if (typeof speechSynthesis !== "undefined") {
    const first = new SpeechSynthesisUtterance("Well, hello there! How are you doing?");
    first.rate = 1.0;
    first.lang = "en-US";
    speechSynthesis.speak(first);

    first.onend = () => {
      // If model loaded before first utterance finished, skip dings and go to ready
      if (modelLoaded) {
        playReady();
        return;
      }

      (async () => {
        await sayNative("On first boot I have to load an LLM model so give me a second please.");

        // Don't start dings if model already loaded during speech
        if (modelLoaded) {
          playReady();
          return;
        }

        let blob: Blob | null = null;
        try { blob = await generateDingBlob(); } catch {}

        dingInterval = setInterval(() => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.volume = 0.3;
          audio.play().catch(() => {});
          audio.onended = () => URL.revokeObjectURL(url);
        }, 2000);
      })();
    };
  }

  async function playReady() {
    try {
      const jingleBlob = await generateHappyJingleBlob();
      const url = URL.createObjectURL(jingleBlob);
      const audio = new Audio(url);
      audio.volume = 0.5;
      await audio.play().catch(() => {});
      audio.onended = () => URL.revokeObjectURL(url);
      await new Promise((r) => setTimeout(r, 900));
    } catch {}

    if (typeof speechSynthesis !== "undefined") {
      const utter = new SpeechSynthesisUtterance("Ok ready, how can I help you?");
      utter.lang = "en-US";
      speechSynthesis.speak(utter);
    }
  }

  return {
    onModelLoaded() {
      modelLoaded = true;
      if (dingInterval) {
        clearInterval(dingInterval);
        dingInterval = null;
        playReady();
      }
    },
    cleanup() {
      if (dingInterval) {
        clearInterval(dingInterval);
        dingInterval = null;
      }
    },
  };
}
