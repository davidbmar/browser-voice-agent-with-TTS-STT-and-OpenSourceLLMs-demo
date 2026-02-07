/**
 * audio-listener.ts — Wraps the Web Speech API and AudioContext for
 * real-time speech-to-text transcription and audio level monitoring.
 *
 * Integration point: Browser-Text-to-Speech-TTS-Realtime
 * See: https://github.com/davidbmar/Browser-Text-to-Speech-TTS-Realtime
 * Pattern from: live-transcription.tsx in the ASR repo
 *
 * Key behaviors:
 *  - `SpeechRecognition` with continuous=true, interimResults=true
 *  - Auto-restarts on `onend` if still active (browser kills recognition periodically)
 *  - `AudioContext` + `AnalyserNode` for real-time audio level (0–100 scale)
 *  - pause() / resume() used for echo cancellation during TTS playback
 */

// Vendor prefix for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechRecognition: typeof SpeechRecognition;
  }
}

/** Callbacks fired by AudioListener during operation. */
export interface AudioListenerCallbacks {
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string, confidence: number) => void;
  onAudioLevel?: (level: number) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: "started" | "stopped" | "paused") => void;
}

export class AudioListener {
  private recognition: SpeechRecognition | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animationFrame: number | null = null;
  private active = false;
  private paused = false;
  private callbacks: AudioListenerCallbacks;

  constructor(callbacks: AudioListenerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /** Check browser support for Web Speech API. */
  static isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /** Start listening: initializes mic, AudioContext, and SpeechRecognition. */
  async start(): Promise<void> {
    if (this.active) return;

    if (!AudioListener.isSupported()) {
      this.callbacks.onError?.("Speech recognition not supported. Use Chrome or Edge.");
      return;
    }

    this.active = true;
    this.paused = false;

    // --- Set up AudioContext for level monitoring ---
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;

      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);
      this.analyser.fftSize = 256;

      this.startLevelMonitoring();
    } catch (err) {
      this.callbacks.onError?.(
        `Microphone access denied: ${err instanceof Error ? err.message : "unknown"}`
      );
      this.active = false;
      return;
    }

    // --- Set up SpeechRecognition ---
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionCtor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          this.callbacks.onFinalTranscript?.(transcript.trim(), confidence);
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        this.callbacks.onInterimTranscript?.(interim);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Suppress common non-fatal errors
      if (event.error !== "aborted" && event.error !== "no-speech") {
        this.callbacks.onError?.(`Speech recognition error: ${event.error}`);
      }
    };

    // Auto-restart: browsers kill recognition after ~60s of silence
    this.recognition.onend = () => {
      if (this.active && !this.paused) {
        try { this.recognition?.start(); } catch (_e) { /* already started */ }
      }
    };

    try {
      this.recognition.start();
      this.callbacks.onStateChange?.("started");
    } catch (_err) {
      this.callbacks.onError?.("Failed to start speech recognition.");
      this.active = false;
    }
  }

  /** Stop listening: tears down mic, AudioContext, and SpeechRecognition. */
  stop() {
    this.active = false;
    this.paused = false;

    if (this.recognition) {
      try { this.recognition.stop(); } catch (_e) { /* ignore */ }
      this.recognition = null;
    }

    this.stopLevelMonitoring();
    this.stopMediaStream();
    this.callbacks.onStateChange?.("stopped");
  }

  /** Pause recognition (used during TTS playback for echo cancellation). */
  pause() {
    if (!this.active || this.paused) return;
    this.paused = true;

    if (this.recognition) {
      try { this.recognition.stop(); } catch (_e) { /* ignore */ }
    }
    // Suspend AudioContext to free the audio session (prevents iOS conflicts with TTS)
    if (this.audioContext?.state === "running") {
      this.audioContext.suspend().catch(() => {});
    }
    this.callbacks.onStateChange?.("paused");
  }

  /** Resume recognition after TTS playback completes. */
  resume() {
    if (!this.active || !this.paused) return;
    this.paused = false;

    // Resume AudioContext before restarting recognition
    if (this.audioContext?.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }

    if (this.recognition) {
      try {
        this.recognition.start();
        this.callbacks.onStateChange?.("started");
      } catch (_e) {
        this.callbacks.onError?.("Failed to resume recognition.");
      }
    }
  }

  isActive(): boolean { return this.active; }
  isPaused(): boolean { return this.paused; }

  // --- Audio level monitoring via AnalyserNode ---

  private startLevelMonitoring() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const update = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      // Scale to 0–100 range
      this.callbacks.onAudioLevel?.(Math.min(100, avg * 1.5));
      this.animationFrame = requestAnimationFrame(update);
    };

    update();
  }

  private stopLevelMonitoring() {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }

  private stopMediaStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }
}
