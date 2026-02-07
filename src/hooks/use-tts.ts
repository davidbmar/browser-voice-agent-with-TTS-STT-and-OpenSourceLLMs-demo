import { useState, useCallback, useRef } from "react";
import { TTSSpeaker } from "@/lib/tts-speaker.ts";

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speakerRef = useRef<TTSSpeaker | null>(null);

  if (!speakerRef.current) {
    speakerRef.current = new TTSSpeaker({
      onSpeakStart: () => setIsSpeaking(true),
      onSpeakEnd: () => setIsSpeaking(false),
      onError: (err) => setError(err),
    });
  }

  const warmUp = useCallback(async () => {
    setIsWarmingUp(true);
    setError(null);
    // TTSSpeaker initializes lazily on first speak — warmUp is a no-op placeholder
    setIsWarmingUp(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    setError(null);
    await speakerRef.current!.speak(text);
  }, []);

  const stop = useCallback(() => {
    speakerRef.current!.stop();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, isWarmingUp, error, warmUp, speak, stop, speaker: speakerRef.current };
}
