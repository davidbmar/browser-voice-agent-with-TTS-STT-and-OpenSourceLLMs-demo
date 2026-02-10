/**
 * model-browser.tsx — Full-screen model selection page.
 *
 * Shows all available models with their details.
 * Accessible from the desktop header "Models" button.
 */

import { MODEL_CATALOG } from "@/lib/loop-types.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { ArrowLeft, Loader2, Check, Download } from "lucide-react";

interface ModelBrowserProps {
  selectedModelId: string | null;
  isLoaded: boolean;
  isLoading: boolean;
  loadProgress: number;
  onLoad: (modelId: string) => void;
  onUnload: () => void;
  onBack: () => void;
}

export function ModelBrowser({
  selectedModelId,
  isLoaded,
  isLoading,
  loadProgress,
  onLoad,
  onUnload,
  onBack,
}: ModelBrowserProps) {
  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button size="icon" variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Model Browser</h1>
        </div>

        <div className="grid gap-3">
          {MODEL_CATALOG.map((model) => {
            const isSelected = selectedModelId === model.id;
            const isThisLoading = isLoading && isSelected;
            const isThisLoaded = isLoaded && isSelected;

            return (
              <Card
                key={model.id}
                className={`p-4 flex items-center justify-between gap-4 ${
                  isThisLoaded ? "border-primary" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm">{model.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {model.vramGB} GB VRAM
                    {model.tags.length > 0 && (
                      <span className="ml-2">
                        {model.tags.map((t) => (
                          <span
                            key={t}
                            className="inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] mr-1"
                          >
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  {isThisLoading && (
                    <Progress value={loadProgress * 100} className="h-1 mt-2" />
                  )}
                </div>

                <div className="shrink-0">
                  {isThisLoaded ? (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <Button size="sm" variant="outline" onClick={onUnload}>
                        Unload
                      </Button>
                    </div>
                  ) : isThisLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onLoad(model.id)}
                      disabled={isLoading}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Load
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
