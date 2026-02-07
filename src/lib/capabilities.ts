/**
 * capabilities.ts — Detects browser and hardware capabilities at runtime.
 *
 * Checks whether the user's environment can run each component of the app:
 *  - WebGPU          (required for LLM inference)
 *  - Web Speech API  (required for microphone/ASR)
 *  - AudioContext     (required for audio level monitoring)
 *  - WASM + ONNX     (required for TTS via vits-web)
 *  - SharedArrayBuffer (required for web-llm worker threads)
 *
 * Returns a structured report with pass/fail/warn per capability
 * and an overall readiness level.
 */

export type CapabilityStatus = "pass" | "warn" | "fail";

export interface CapabilityCheck {
  name: string;
  status: CapabilityStatus;
  detail: string;
  required: boolean;
}

export interface CapabilityReport {
  checks: CapabilityCheck[];
  /** Overall readiness: "ready" = all required pass, "degraded" = some warns, "blocked" = a required check failed */
  overall: "ready" | "degraded" | "blocked";
  gpuInfo: string | null;
}

/** Run all capability checks. Some are async (GPU adapter info). */
export async function detectCapabilities(): Promise<CapabilityReport> {
  const checks: CapabilityCheck[] = [];
  let gpuInfo: string | null = null;

  // --- WebGPU ---
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        // adapter.info is the modern API (Chrome 121+); requestAdapterInfo() is deprecated
        const info = adapter.info ?? (typeof adapter.requestAdapterInfo === "function"
          ? await adapter.requestAdapterInfo()
          : null);
        const vendor = info?.vendor || "unknown vendor";
        const arch = info?.architecture || "";
        const desc = info?.description || (info as any)?.device || "";
        gpuInfo = [vendor, arch, desc].filter(Boolean).join(" — ");
        checks.push({
          name: "WebGPU",
          status: "pass",
          detail: `Available (${gpuInfo})`,
          required: true,
        });
      } else {
        checks.push({
          name: "WebGPU",
          status: "fail",
          detail: "navigator.gpu exists but no adapter found. Your GPU may not be supported.",
          required: true,
        });
      }
    } catch (err) {
      checks.push({
        name: "WebGPU",
        status: "fail",
        detail: `Adapter request failed: ${err instanceof Error ? err.message : "unknown"}`,
        required: true,
      });
    }
  } else {
    checks.push({
      name: "WebGPU",
      status: "fail",
      detail: "Not available. LLM inference requires Chrome 113+ or Edge 113+ with WebGPU enabled.",
      required: true,
    });
  }

  // --- SharedArrayBuffer (needed for web-llm worker threads) ---
  if (typeof SharedArrayBuffer !== "undefined") {
    checks.push({
      name: "SharedArrayBuffer",
      status: "pass",
      detail: "Available (COOP/COEP headers are set correctly)",
      required: true,
    });
  } else {
    checks.push({
      name: "SharedArrayBuffer",
      status: "fail",
      detail: "Not available. The server must set Cross-Origin-Embedder-Policy and Cross-Origin-Opener-Policy headers.",
      required: true,
    });
  }

  // --- Web Speech API ---
  const hasSpeechRecognition = !!(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
  if (hasSpeechRecognition) {
    checks.push({
      name: "Web Speech API",
      status: "pass",
      detail: "SpeechRecognition available",
      required: false,
    });
  } else {
    checks.push({
      name: "Web Speech API",
      status: "warn",
      detail: "Not available. Microphone input won't work, but Simulate Input still works. Use Chrome or Edge.",
      required: false,
    });
  }

  // --- AudioContext ---
  const hasAudioContext = !!(window.AudioContext || (window as any).webkitAudioContext);
  if (hasAudioContext) {
    checks.push({
      name: "AudioContext",
      status: "pass",
      detail: "Available for audio level monitoring",
      required: false,
    });
  } else {
    checks.push({
      name: "AudioContext",
      status: "warn",
      detail: "Not available. Audio level meter won't work.",
      required: false,
    });
  }

  // --- WebAssembly (needed for ONNX / TTS) ---
  if (typeof WebAssembly !== "undefined") {
    checks.push({
      name: "WebAssembly",
      status: "pass",
      detail: "Available (required for TTS via ONNX runtime)",
      required: true,
    });
  } else {
    checks.push({
      name: "WebAssembly",
      status: "fail",
      detail: "Not available. TTS will not work.",
      required: true,
    });
  }

  // --- Secure context (needed for mic, WebGPU) ---
  if (window.isSecureContext) {
    checks.push({
      name: "Secure Context",
      status: "pass",
      detail: `Running on ${location.protocol}//${location.host}`,
      required: true,
    });
  } else {
    checks.push({
      name: "Secure Context",
      status: "fail",
      detail: "Not a secure context. WebGPU and mic require HTTPS or localhost.",
      required: true,
    });
  }

  // --- Compute overall ---
  const hasRequiredFail = checks.some((c) => c.required && c.status === "fail");
  const hasWarn = checks.some((c) => c.status === "warn");

  return {
    checks,
    overall: hasRequiredFail ? "blocked" : hasWarn ? "degraded" : "ready",
    gpuInfo,
  };
}
