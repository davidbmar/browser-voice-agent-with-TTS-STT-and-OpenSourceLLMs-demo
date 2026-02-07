/// <reference types="vite/client" />

// WebGPU types (not yet in default DOM lib)
interface GPUAdapterInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
}

interface GPUAdapter {
  info?: GPUAdapterInfo;
  requestAdapterInfo?: () => Promise<GPUAdapterInfo>;
}

interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
}

interface Navigator {
  gpu?: GPU;
}

// Web Speech API types (Chrome/Edge vendor-prefixed)
declare class SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
