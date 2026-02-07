import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Play, Square, RotateCcw, Send, Volume2 } from "lucide-react";
import type { LoopEvent, Stage } from "@/lib/loop-types.ts";

interface LoopControlsProps {
  stage: Stage;
  isRunning: boolean;
  dispatch: (event: LoopEvent) => void;
  onSpeakTest?: () => void;
}

export function LoopControls({ stage, isRunning, dispatch, onSpeakTest }: LoopControlsProps) {
  const [simulateText, setSimulateText] = useState("");

  const canStart = stage === "IDLE";
  const canStop = isRunning;

  const handleSimulate = () => {
    if (!simulateText.trim()) return;
    dispatch({ type: "SIMULATE_INPUT", text: simulateText.trim() });
    setSimulateText("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          disabled={!canStart}
          onClick={() => dispatch({ type: "MIC_START" })}
          className="gap-1.5"
        >
          <Play className="h-3.5 w-3.5" />
          Start
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={!canStop}
          onClick={() => dispatch({ type: "MIC_STOP" })}
          className="gap-1.5"
        >
          <Square className="h-3.5 w-3.5" />
          Stop
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => dispatch({ type: "RESET" })}
          className="gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
        {onSpeakTest && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSpeakTest}
            className="gap-1.5"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Speak Test
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={simulateText}
          onChange={(e) => setSimulateText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSimulate()}
          placeholder="Simulate input text..."
          className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button size="sm" variant="secondary" onClick={handleSimulate} disabled={!simulateText.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
