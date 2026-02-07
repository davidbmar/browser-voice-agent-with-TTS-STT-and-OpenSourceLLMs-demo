import { useState, useCallback, useRef } from "react";
import { AudioListener } from "@/lib/audio-listener.ts";

export function useAudioListener() {
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const listenerRef = useRef<AudioListener | null>(null);

  if (!listenerRef.current) {
    listenerRef.current = new AudioListener({
      onAudioLevel: (level) => setAudioLevel(level),
      onStateChange: (s) => {
        setIsListening(s === "started");
        setIsPaused(s === "paused");
      },
      onError: (err) => setError(err),
    });
  }

  const start = useCallback(async () => {
    setError(null);
    await listenerRef.current!.start();
  }, []);

  const stop = useCallback(() => {
    listenerRef.current!.stop();
    setAudioLevel(0);
  }, []);

  const supported = AudioListener.isSupported();

  return { isListening, isPaused, audioLevel, error, start, stop, supported, listener: listenerRef.current };
}
