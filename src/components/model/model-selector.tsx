import { Button } from "@/components/ui/button.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { MODEL_CATALOG } from "@/lib/loop-types.ts";
import { X, Loader2 } from "lucide-react";

interface ModelSelectorProps {
  selectedModelId: string | null;
  isLoaded: boolean;
  isLoading?: boolean;
  loadProgress: number;
  onLoad: (modelId: string) => void;
  onUnload: () => void;
}

function vramColor(gb: number): string {
  if (gb <= 1.0) return "text-green-400";
  if (gb <= 2.0) return "text-yellow-400";
  if (gb <= 3.0) return "text-orange-400";
  return "text-red-400";
}

export function ModelSelector({
  selectedModelId,
  isLoaded,
  isLoading,
  loadProgress,
  onLoad,
  onUnload,
}: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Select value={selectedModelId || ""} onValueChange={onLoad}>
        <SelectTrigger className="w-[240px] h-8 text-xs">
          <SelectValue placeholder="Select model..." />
        </SelectTrigger>
        <SelectContent>
          {MODEL_CATALOG.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              <div className="flex items-center gap-2">
                <span>{m.name}</span>
                <span className={`text-[10px] font-mono ${vramColor(m.vramGB)}`}>
                  {m.vramGB}GB
                </span>
                {m.tags.includes("new") && (
                  <span className="text-[9px] bg-primary/20 text-primary px-1 rounded">new</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading && (
        <div className="flex items-center gap-2 min-w-[160px]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
          <Progress value={loadProgress * 100} className="h-1.5 flex-1" />
          <span className="text-[10px] text-muted-foreground font-mono w-10 shrink-0">
            {(loadProgress * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {isLoaded && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-primary font-medium">Loaded</span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onUnload}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
