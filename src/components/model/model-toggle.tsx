import { Switch } from "@/components/ui/switch.tsx";

interface ModelToggleProps {
  classifyWithLLM: boolean;
  responseWithLLM: boolean;
  searchEnabled: boolean;
  isModelLoaded: boolean;
  onClassifyChange: (on: boolean) => void;
  onResponseChange: (on: boolean) => void;
  onSearchChange: (on: boolean) => void;
}

export function ModelToggle({
  classifyWithLLM,
  responseWithLLM,
  searchEnabled,
  isModelLoaded,
  onClassifyChange,
  onResponseChange,
  onSearchChange,
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
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">Web Search</label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            {searchEnabled ? "ON" : "OFF"}
          </span>
          <Switch
            checked={searchEnabled}
            onCheckedChange={onSearchChange}
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
