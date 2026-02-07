import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Button } from "@/components/ui/button.tsx";
import { MODEL_CATALOG } from "@/lib/loop-types.ts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible.tsx";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface ModelABPanelProps {
  currentModelId: string | null;
  isLoaded: boolean;
}

export function ModelABPanel({ currentModelId, isLoaded }: ModelABPanelProps) {
  const [open, setOpen] = useState(false);
  const [modelA, setModelA] = useState<string>("");
  const [modelB, setModelB] = useState<string>("");
  const [resultA] = useState<string>("");
  const [resultB] = useState<string>("");

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle>A/B Model Comparison</CardTitle>
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Model A</label>
                <Select value={modelA} onValueChange={setModelA}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_CATALOG.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Model B</label>
                <Select value={modelB} onValueChange={setModelB}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_CATALOG.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button size="sm" variant="outline" className="text-xs w-full" disabled={!modelA || !modelB}>
              Compare (Coming Soon)
            </Button>

            {(resultA || resultB) && (
              <div className="grid grid-cols-2 gap-3">
                <pre className="text-[10px] font-mono p-2 bg-muted/50 rounded max-h-24 overflow-auto">{resultA || "—"}</pre>
                <pre className="text-[10px] font-mono p-2 bg-muted/50 rounded max-h-24 overflow-auto">{resultB || "—"}</pre>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              Current model: {currentModelId || "(none)"} {isLoaded ? "(loaded)" : ""}
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
