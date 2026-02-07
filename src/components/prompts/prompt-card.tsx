import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Copy, Check } from "lucide-react";

interface PromptCardProps {
  label: string;
  template: string;
  filled: string;
  output: string;
}

export function PromptCard({ label, filled, output }: PromptCardProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</h4>
      </div>

      {filled && (
        <div className="relative">
          <pre className="text-[10px] font-mono whitespace-pre-wrap break-all p-2 bg-muted/50 rounded max-h-32 overflow-auto">
            {filled}
          </pre>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-1 right-1 h-5 w-5"
            onClick={() => copyText(filled, "filled")}
          >
            {copied === "filled" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      )}

      {output && (
        <div className="relative">
          <div className="text-[10px] text-muted-foreground mb-0.5">Output:</div>
          <pre className="text-[10px] font-mono whitespace-pre-wrap break-all p-2 bg-primary/5 border border-primary/20 rounded max-h-24 overflow-auto">
            {output}
          </pre>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-5 right-1 h-5 w-5"
            onClick={() => copyText(output, "output")}
          >
            {copied === "output" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      )}

      {!filled && !output && (
        <div className="text-[10px] text-muted-foreground italic p-2">No data yet — run a loop iteration.</div>
      )}
    </div>
  );
}
