/**
 * tts-speaker.ts — Streaming text-to-speech with concurrent generation and playback.
 *
 * Integration point: Browser-Text-to-Speech-TTS-Realtime
 * See: https://github.com/davidbmar/Browser-Text-to-Speech-TTS-Realtime
 * Pattern from: tts-engine.ts — chunked generation + playback loop
 *
 * Key features:
 *  - Simple speak(text): all text upfront, sentences split and generated concurrently
 *  - Streaming API: beginStream() → pushSentence() → endStream()
 *    Used during LLM generation for sentence-by-sentence TTS
 *  - Dual voice: internal monologue (soft female) + response (British)
 *  - Concurrent generation: up to maxConcurrent=2 chunks generate at once
 *  - Sequential playback: chunks play in order, waiting for each to be ready
 *  - Mobile fallback: uses native SpeechSynthesis when ONNX/VITS fails (iOS)
 */

import * as tts from "@diffusionstudio/vits-web";

export const VOICE_RESPONSE = "en_GB-cori-high";
export const VOICE_MONOLOGUE = "en_US-hfc_female-medium";

type ChunkStatus = "pending" | "generating" | "ready" | "playing" | "done" | "error";

interface TTSChunk {
  text: string;
  voice: string;
  volume: number;
  speed: number;
  status: ChunkStatus;
  audio?: Blob;
}

export interface TTSSpeakerCallbacks {
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
  onError?: (error: string) => void;
  onChunkPlaying?: (text: string, index: number, total: number) => void;
}

export class TTSSpeaker {
  private chunks: TTSChunk[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private playbackIndex = 0;
  private aborted = false;
  private speaking = false;
  private finished = false;       // LLM done feeding sentences
  private volume = 0.8;
  private speed = 1.0;
  private muted = false;
  private activeGenerations = 0;
  private maxConcurrent: number;
  private playbackResolve: (() => void) | null = null;
  private callbacks: TTSSpeakerCallbacks;

  // Mobile fallback: use native SpeechSynthesis when VITS/ONNX fails
  private useNativeTTS = false;
  private nativeTTSChecked = false;
  private isMobile: boolean;
  private isIOS: boolean;

  constructor(callbacks: TTSSpeakerCallbacks = {}) {
    this.callbacks = callbacks;
    this.isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    this.maxConcurrent = this.isMobile ? 1 : 2;

    // iOS: ONNX/VITS never works, skip straight to native SpeechSynthesis
    if (this.isIOS) {
      this.useNativeTTS = true;
      this.nativeTTSChecked = true;
    }
  }

  /**
   * Call from a user gesture handler (tap/click) to unlock iOS audio.
   * iOS blocks speechSynthesis.speak() unless it was first called
   * in a user gesture context.
   */
  unlockAudio(): void {
    if (typeof speechSynthesis === "undefined") return;
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    utterance.rate = 1;
    speechSynthesis.speak(utterance);
  }

  setVolume(vol: number) {
    this.volume = vol;
    if (this.currentAudio) this.currentAudio.volume = this.muted ? 0 : vol;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.currentAudio) this.currentAudio.volume = muted ? 0 : this.volume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setSpeed(spd: number) {
    this.speed = spd;
    if (this.currentAudio) this.currentAudio.playbackRate = spd;
  }

  // ---------------------------------------------------------------------------
  // Simple speak — all text available upfront (used for rule-based responses)
  // ---------------------------------------------------------------------------
  async speak(text: string, voice?: string): Promise<void> {
    this.stop();
    if (!text.trim()) return;

    // Use native TTS if VITS already failed on this device
    if (this.useNativeTTS) {
      return this.speakNative(text);
    }

    this.reset();
    this.speaking = true;
    this.callbacks.onSpeakStart?.();

    const v = voice || VOICE_RESPONSE;
    const sentences = splitSentences(text);
    for (const s of sentences) {
      this.enqueueChunk(s, v, this.volume, this.speed);
    }
    this.finished = true;

    this.pumpGeneration();
    await this.runPlaybackLoop();

    this.speaking = false;
    if (!this.aborted) this.callbacks.onSpeakEnd?.();
  }

  // ---------------------------------------------------------------------------
  // Streaming speak — call beginStream(), push sentences with pushSentence(),
  // call endStream() when LLM is done. Returns a promise that resolves when
  // all audio has finished playing.
  // ---------------------------------------------------------------------------
  beginStream(): void {
    this.stop();
    this.reset();
    this.speaking = true;
    this.finished = false;
    this.callbacks.onSpeakStart?.();
  }

  pushSentence(text: string, voice?: string, volume?: number, speed?: number): void {
    if (this.aborted || !text.trim()) return;

    // Native TTS fallback: speak immediately
    if (this.useNativeTTS) {
      this.speakNativeChunk(text.trim(), volume ?? this.volume, speed ?? this.speed);
      return;
    }

    this.enqueueChunk(text.trim(), voice || VOICE_RESPONSE, volume ?? this.volume, speed ?? this.speed);
    this.pumpGeneration();
  }

  endStream(): Promise<void> {
    this.finished = true;

    // Native TTS: wait for speechSynthesis to finish
    if (this.useNativeTTS) {
      return this.waitForNativeTTS();
    }

    // Wake up playback loop if it's waiting
    if (this.playbackResolve) this.playbackResolve();
    return this.playbackPromise ?? Promise.resolve();
  }

  private playbackPromise: Promise<void> | null = null;

  // Start playback loop (called once per stream)
  private startPlaybackLoop() {
    if (this.playbackPromise) return;
    this.playbackPromise = this.runPlaybackLoop().then(() => {
      this.speaking = false;
      if (!this.aborted) this.callbacks.onSpeakEnd?.();
    });
  }

  // ---------------------------------------------------------------------------
  // Internal monologue + response with two voices
  // ---------------------------------------------------------------------------
  async speakWithMonologue(monologue: string, response: string): Promise<void> {
    this.stop();
    if (!monologue.trim() && !response.trim()) return;

    // Native fallback: skip monologue, speak only the response
    if (this.useNativeTTS) {
      if (!response.trim()) return;
      return this.speakNative(response.trim());
    }

    this.reset();
    this.speaking = true;
    this.callbacks.onSpeakStart?.();

    // Enqueue monologue sentences (female, soft, slightly faster)
    if (monologue.trim()) {
      for (const s of splitSentences(monologue)) {
        this.enqueueChunk(s, VOICE_MONOLOGUE, this.volume * 0.55, this.speed * 1.15);
      }
    }

    // Enqueue response sentences (British voice, normal)
    if (response.trim()) {
      for (const s of splitSentences(response)) {
        this.enqueueChunk(s, VOICE_RESPONSE, this.volume, this.speed);
      }
    }

    this.finished = true;
    this.pumpGeneration();
    await this.runPlaybackLoop();

    this.speaking = false;
    if (!this.aborted) this.callbacks.onSpeakEnd?.();
  }

  // ---------------------------------------------------------------------------
  // Streaming with monologue: pushes monologue first, then response sentences
  // as they arrive from LLM
  // ---------------------------------------------------------------------------
  beginStreamWithMonologue(monologue: string): void {
    this.stop();
    this.reset();
    this.speaking = true;
    this.finished = false;
    this.callbacks.onSpeakStart?.();

    // Native fallback: skip monologue, just wait for response sentences
    if (this.useNativeTTS) {
      return;
    }

    // Enqueue monologue up front
    if (monologue.trim()) {
      for (const s of splitSentences(monologue)) {
        this.enqueueChunk(s, VOICE_MONOLOGUE, this.volume * 0.55, this.speed * 1.15);
      }
      this.pumpGeneration();
    }

    this.startPlaybackLoop();
  }

  pushResponseSentence(text: string): void {
    this.pushSentence(text, VOICE_RESPONSE, this.volume, this.speed);
    // Ensure playback loop is running (only for VITS path)
    if (!this.useNativeTTS) {
      this.startPlaybackLoop();
    }
  }

  stop() {
    this.aborted = true;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    // Stop native TTS if active
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.cancel();
    }
    if (this.playbackResolve) this.playbackResolve();
    this.speaking = false;
  }

  pause() { this.currentAudio?.pause(); }
  resume() { this.currentAudio?.play(); }
  isSpeaking(): boolean { return this.speaking; }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------
  private reset() {
    this.chunks = [];
    this.playbackIndex = 0;
    this.aborted = false;
    this.finished = false;
    this.activeGenerations = 0;
    this.playbackResolve = null;
    this.playbackPromise = null;
  }

  private enqueueChunk(text: string, voice: string, volume: number, speed: number) {
    this.chunks.push({ text, voice, volume, speed, status: "pending" });
  }

  // Integration point: Browser-Text-to-Speech-TTS-Realtime — concurrent generation
  // See: https://github.com/davidbmar/Browser-Text-to-Speech-TTS-Realtime
  // Start generating the next pending chunks (up to maxConcurrent in parallel)
  private pumpGeneration() {
    for (let i = 0; i < this.chunks.length; i++) {
      if (this.aborted) break;
      if (this.activeGenerations >= this.maxConcurrent) break;
      if (this.chunks[i].status !== "pending") continue;

      this.chunks[i].status = "generating";
      this.activeGenerations++;
      this.generateChunk(i).finally(() => {
        this.activeGenerations--;
        this.pumpGeneration(); // try to fill the slot
      });
    }
  }

  // Integration point: Browser-Text-to-Speech-TTS-Realtime — vits-web audio generation
  // See: https://github.com/davidbmar/Browser-Text-to-Speech-TTS-Realtime
  private async generateChunk(index: number): Promise<void> {
    const chunk = this.chunks[index];
    if (!chunk || this.aborted) return;

    try {
      // Race VITS generation against a timeout to prevent hanging
      const blob = await Promise.race([
        tts.predict({
          text: chunk.text,
          voiceId: chunk.voice as Parameters<typeof tts.predict>[0]["voiceId"],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TTS generation timed out")), 10000)
        ),
      ]);
      if (this.aborted) return;
      chunk.audio = blob;
      chunk.status = "ready";

      // First successful generation — VITS works on this device
      this.nativeTTSChecked = true;

      // Wake up playback loop
      if (this.playbackResolve) this.playbackResolve();
    } catch (err) {
      console.warn("VITS TTS failed for chunk, falling back to native SpeechSynthesis:", err);

      // Fall back to native SpeechSynthesis for this chunk
      chunk.status = "done";
      this.speakNativeChunk(chunk.text, chunk.volume, chunk.speed);

      // On first failure, switch all future chunks to native TTS too
      if (!this.nativeTTSChecked) {
        this.useNativeTTS = true;
        this.nativeTTSChecked = true;

        // Speak all remaining pending chunks via native TTS
        for (let i = index + 1; i < this.chunks.length; i++) {
          if (this.chunks[i].status === "pending" || this.chunks[i].status === "generating") {
            this.chunks[i].status = "done";
            this.speakNativeChunk(this.chunks[i].text, this.chunks[i].volume, this.chunks[i].speed);
          }
        }
        this.finished = true;
      }

      if (this.playbackResolve) this.playbackResolve();
    }
  }

  // Integration point: Browser-Text-to-Speech-TTS-Realtime — playback loop
  // See: https://github.com/davidbmar/Browser-Text-to-Speech-TTS-Realtime
  // Plays chunks in order, waiting for each to become ready
  private async runPlaybackLoop(): Promise<void> {
    while (!this.aborted) {
      // If we switched to native TTS mid-stream, exit the loop
      if (this.useNativeTTS) break;

      // Check if we have a chunk to play
      if (this.playbackIndex < this.chunks.length) {
        const chunk = this.chunks[this.playbackIndex];

        if (chunk.status === "error" || chunk.status === "done") {
          this.playbackIndex++;
          continue;
        }

        if (chunk.status === "ready" && chunk.audio) {
          chunk.status = "playing";
          this.callbacks.onChunkPlaying?.(chunk.text, this.playbackIndex, this.chunks.length);
          await this.playBlob(chunk.audio, chunk.volume, chunk.speed);
          chunk.status = "done";
          this.playbackIndex++;
          continue;
        }

        // Chunk not ready yet — wait for notification
        await new Promise<void>(resolve => {
          this.playbackResolve = resolve;
          setTimeout(resolve, 100); // fallback poll
        });
        this.playbackResolve = null;
        continue;
      }

      // No more chunks yet — are we done?
      if (this.finished) break;

      // Wait for more chunks to arrive
      await new Promise<void>(resolve => {
        this.playbackResolve = resolve;
        setTimeout(resolve, 100);
      });
      this.playbackResolve = null;
    }
  }

  /** Number of chunks waiting to be generated or currently generating. */
  getQueueDepth(): number {
    return this.chunks.filter(c => c.status === "pending" || c.status === "generating").length;
  }

  private playBlob(blob: Blob, volume: number, speed: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.aborted) { resolve(); return; }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = this.muted ? 0 : volume;
      audio.playbackRate = speed;
      this.currentAudio = audio;

      let resolved = false;
      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        audio.onended = null;
        audio.onerror = null;
        this.currentAudio = null;
        resolve();
      };

      // Safety timeout: prevents hanging on iOS if play() never resolves
      const timeout = setTimeout(() => {
        audio.pause();
        cleanup();
      }, 30000);

      audio.onended = cleanup;
      audio.onerror = cleanup;
      audio.play().catch(cleanup);
    });
  }

  // ---------------------------------------------------------------------------
  // Native SpeechSynthesis fallback (for mobile when VITS/ONNX fails)
  // ---------------------------------------------------------------------------
  private speakNative(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof speechSynthesis === "undefined") {
        resolve();
        return;
      }

      this.speaking = true;
      this.callbacks.onSpeakStart?.();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = this.muted ? 0 : this.volume;
      utterance.rate = this.speed;
      utterance.lang = "en-US";

      utterance.onend = () => {
        this.speaking = false;
        this.callbacks.onSpeakEnd?.();
        resolve();
      };
      utterance.onerror = () => {
        this.speaking = false;
        this.callbacks.onSpeakEnd?.();
        resolve();
      };

      speechSynthesis.speak(utterance);
    });
  }

  private speakNativeChunk(text: string, volume: number, speed: number): void {
    if (typeof speechSynthesis === "undefined") return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = this.muted ? 0 : volume;
    utterance.rate = speed;
    utterance.lang = "en-US";
    speechSynthesis.speak(utterance);
  }

  private waitForNativeTTS(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof speechSynthesis === "undefined") { resolve(); return; }

      const check = () => {
        if (!speechSynthesis.speaking) {
          this.speaking = false;
          if (!this.aborted) this.callbacks.onSpeakEnd?.();
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      // Give a small delay for the last utterance to start
      setTimeout(check, 200);
    });
  }
}

function splitSentences(text: string): string[] {
  const regex = /[^.!?]*[.!?]+["']?\s*/g;
  const sentences: string[] = [];
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    sentences.push(match[0].trim());
    lastIndex = regex.lastIndex;
  }

  const remaining = text.slice(lastIndex).trim();
  if (remaining) sentences.push(remaining);

  return sentences.filter((s) => s.length > 0);
}
