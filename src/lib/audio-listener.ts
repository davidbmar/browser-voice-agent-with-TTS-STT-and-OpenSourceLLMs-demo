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

  // Diagnostic event log for debugging device-specific issues
  private _diagLog: string[] = [];
  private _diagMaxEntries = 30;

  private _log(msg: string) {
    const ts = new Date();
    const time = `${ts.getMinutes().toString().padStart(2, "0")}:${ts.getSeconds().toString().padStart(2, "0")}.${ts.getMilliseconds().toString().padStart(3, "0")}`;
    this._diagLog.push(`[${time}] ${msg}`);
    if (this._diagLog.length > this._diagMaxEntries) {
      this._diagLog.shift();
    }
  }

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
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          this._log(`FINAL: "${transcript.trim()}" (conf=${confidence.toFixed(2)})`);
          this.callbacks.onFinalTranscript?.(transcript.trim(), confidence);
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        this._log(`INTERIM: "${interim.slice(0, 40)}"`);
        this.callbacks.onInterimTranscript?.(interim);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this._log(`ERROR: ${event.error} (msg=${event.message || "none"})`);
      // Suppress common non-fatal errors
      if (event.error !== "aborted" && event.error !== "no-speech") {
        this.callbacks.onError?.(`Speech recognition error: ${event.error}`);
      }
    };

    // Auto-restart: browsers kill recognition after ~60s of silence
    this.recognition.onend = () => {
      this._log(`ONEND (active=${this.active}, paused=${this.paused})`);
      if (this.active && !this.paused) {
        try {
          this.recognition?.start();
          this._log("RESTART ok");
        } catch (e) {
          this._log(`RESTART fail: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    };

    // These events exist on SpeechRecognition but aren't in all TS typings
    const rec = this.recognition as unknown as Record<string, unknown>;
    rec.onaudiostart = () => { this._log("AUDIO_START (mic capturing)"); };
    rec.onaudioend = () => { this._log("AUDIO_END (mic stopped)"); };
    rec.onspeechstart = () => { this._log("SPEECH_START (voice detected)"); };
    rec.onspeechend = () => { this._log("SPEECH_END (voice stopped)"); };

    this._log("recognition.start() calling...");
    try {
      this.recognition.start();
      this._log("recognition.start() ok");
      this.callbacks.onStateChange?.("started");
    } catch (err) {
      this._log(`recognition.start() FAILED: ${err instanceof Error ? err.message : String(err)}`);
      this.callbacks.onError?.("Failed to start speech recognition.");
      this.active = false;
      return;
    }

    // --- Set up AudioContext for level monitoring (async, after recognition started) ---
    // IMPORTANT: On Android, getUserMedia can steal the mic from SpeechRecognition,
    // causing recognition to receive silence. Skip audio level monitoring on Android.
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      this._log("Android detected — skipping getUserMedia (mic contention fix)");
    } else {
      this._log("getUserMedia requesting...");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this._log(`getUserMedia granted (${stream.getAudioTracks().length} tracks)`);
        this.mediaStream = stream;

        this.audioContext = new AudioContext();
        this._log(`AudioContext created (state=${this.audioContext.state})`);
        this.analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
        this.analyser.fftSize = 256;

        this.startLevelMonitoring();
        this._log("Level monitoring started");
      } catch (err) {
        this._log(`getUserMedia FAILED: ${err instanceof Error ? err.message : "unknown"}`);
        // Audio level monitoring is optional — recognition still works without it
        this.callbacks.onError?.(
          `Microphone level monitoring unavailable: ${err instanceof Error ? err.message : "unknown"}`
        );
      }
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
      audioContext: this.audioContext?.state ?? "none",
      streamTracks: trackStates,
      eventLog: this._diagLog.join("\n"),
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
