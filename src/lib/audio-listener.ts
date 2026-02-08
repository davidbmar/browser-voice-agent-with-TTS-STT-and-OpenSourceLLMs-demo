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

  // Diagnostic counters for debugging device-specific issues
  private _diag = {
    getUserMediaStatus: "not-started" as string,
    recognitionResultCount: 0,
    recognitionEndCount: 0,
    recognitionErrorCount: 0,
    lastRecognitionError: "",
    recognitionStartCount: 0,
  };

  constructor(callbacks: AudioListenerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /** Check browser support for Web Speech API. */
  static isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /** Start listening: initializes SpeechRecognition and mic AudioContext.
   *
   * IMPORTANT: SpeechRecognition.start() must be called synchronously from
   * the user gesture (tap/click) — if we await getUserMedia first, Android
   * Chrome loses the gesture context and blocks recognition with "not-allowed".
   * So we start recognition FIRST, then set up AudioContext in the background.
   */
  async start(): Promise<void> {
    if (this.active) return;

    if (!AudioListener.isSupported()) {
      this.callbacks.onError?.("Speech recognition not supported. Use Chrome or Edge.");
      return;
    }

    this.active = true;
    this.paused = false;

    // --- Set up SpeechRecognition FIRST (synchronous, in user gesture context) ---
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionCtor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this._diag.recognitionResultCount++;
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
      this._diag.recognitionErrorCount++;
      this._diag.lastRecognitionError = event.error;
      // Suppress common non-fatal errors
      if (event.error !== "aborted" && event.error !== "no-speech") {
        this.callbacks.onError?.(`Speech recognition error: ${event.error}`);
      }
    };

    // Auto-restart: browsers kill recognition after ~60s of silence
    this.recognition.onend = () => {
      this._diag.recognitionEndCount++;
      if (this.active && !this.paused) {
        try {
          this.recognition?.start();
          this._diag.recognitionStartCount++;
        } catch (_e) { /* already started */ }
      }
    };

    try {
      this.recognition.start();
      this._diag.recognitionStartCount++;
      this.callbacks.onStateChange?.("started");
    } catch (_err) {
      this.callbacks.onError?.("Failed to start speech recognition.");
      this.active = false;
      return;
    }

    // --- Set up AudioContext for level monitoring (async, after recognition started) ---
    // NOTE: We do NOT restart recognition after getUserMedia. The initial start()
    // was in gesture context. If Android needs mic permission first, the onend
    // auto-restart handler will naturally re-start recognition once it times out,
    // and by then getUserMedia permission is already granted.
    try {
      this._diag.getUserMediaStatus = "requesting";
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._diag.getUserMediaStatus = "granted";
      this.mediaStream = stream;

      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);
      this.analyser.fftSize = 256;

      this.startLevelMonitoring();
    } catch (err) {
      this._diag.getUserMediaStatus = `failed: ${err instanceof Error ? err.message : "unknown"}`;
      // Audio level monitoring is optional — recognition still works without it
      this.callbacks.onError?.(
        `Microphone level monitoring unavailable: ${err instanceof Error ? err.message : "unknown"}`
      );
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

  /** Return diagnostic info for the debug panel. */
  getDiagnostics(): Record<string, string> {
    const trackStates = this.mediaStream
      ? this.mediaStream.getAudioTracks().map(t => `${t.label}:${t.readyState}${t.muted ? "(muted)" : ""}${t.enabled ? "" : "(disabled)"}`).join(", ")
      : "no stream";

    return {
      getUserMedia: this._diag.getUserMediaStatus,
      audioContext: this.audioContext?.state ?? "none",
      streamTracks: trackStates,
      recResults: String(this._diag.recognitionResultCount),
      recEnds: String(this._diag.recognitionEndCount),
      recErrors: `${this._diag.recognitionErrorCount}${this._diag.lastRecognitionError ? ` (${this._diag.lastRecognitionError})` : ""}`,
      recStarts: String(this._diag.recognitionStartCount),
    };
  }

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
