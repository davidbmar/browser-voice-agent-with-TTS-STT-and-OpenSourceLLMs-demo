import { useState } from "react";
import { Slider } from "@/components/ui/slider.tsx";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible.tsx";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { BiasValues } from "@/lib/loop-types.ts";

interface BiasSlidersProps {
  bias: BiasValues;
  onChange: (partial: Partial<BiasValues>) => void;
}

function BiasSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="flex-1"
      />
      <span className="text-[10px] font-mono text-muted-foreground w-12 text-right">{display}</span>
    </div>
  );
}

export function BiasSliders({ bias, onChange }: BiasSlidersProps) {
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle>Bias Sliders</CardTitle>
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            <BiasSlider
              label="Silence threshold"
              value={bias.silenceThresholdMs}
              min={500}
              max={3000}
              step={100}
              display={`${bias.silenceThresholdMs}ms`}
              onChange={(v) => onChange({ silenceThresholdMs: v })}
            />
            <BiasSlider
              label="Confidence floor"
              value={bias.confidenceFloor}
              min={0.1}
              max={0.9}
              step={0.05}
              display={bias.confidenceFloor.toFixed(2)}
              onChange={(v) => onChange({ confidenceFloor: v })}
            />
            <BiasSlider
              label="Verbosity"
              value={bias.verbosity}
              min={-1}
              max={1}
              step={0.1}
              display={bias.verbosity.toFixed(1)}
              onChange={(v) => onChange({ verbosity: v })}
            />
            <BiasSlider
              label="Interruption sens."
              value={bias.interruptionSensitivity}
              min={0}
              max={1}
              step={0.05}
              display={bias.interruptionSensitivity.toFixed(2)}
              onChange={(v) => onChange({ interruptionSensitivity: v })}
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
