import { Switch } from "@/components/ui/switch.tsx";

interface ModelToggleProps {
  classifyWithLLM: boolean;
  responseWithLLM: boolean;
  isModelLoaded: boolean;
  onClassifyChange: (on: boolean) => void;
  onResponseChange: (on: boolean) => void;
}

export function ModelToggle({
  classifyWithLLM,
  responseWithLLM,
  isModelLoaded,
  onClassifyChange,
  onResponseChange,
}: ModelToggleProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">Classify w/ LLM</label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            {classifyWithLLM ? "ON" : "OFF"}
          </span>
          <Switch
            checked={classifyWithLLM}
            onCheckedChange={onClassifyChange}
            disabled={!isModelLoaded}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">Response w/ LLM</label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            {responseWithLLM ? "ON" : "OFF"}
          </span>
          <Switch
            checked={responseWithLLM}
            onCheckedChange={onResponseChange}
            disabled={!isModelLoaded}
          />
        </div>
      </div>
      {!isModelLoaded && (
        <p className="text-[10px] text-muted-foreground italic">Load a model to enable LLM features.</p>
      )}
    </div>
  );
}
