import { Slider } from "@/components/ui/slider.tsx";
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
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bias Sliders</h4>
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
    </div>
  );
}
