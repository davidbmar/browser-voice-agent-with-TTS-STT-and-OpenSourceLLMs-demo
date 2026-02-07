import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible.tsx";
import { ChevronDown } from "lucide-react";
import { PromptCard } from "./prompt-card.tsx";
import { CLASSIFY_TEMPLATE, MICRO_RESPONSE_TEMPLATE } from "@/lib/prompt-templates.ts";
import { cn } from "@/lib/utils.ts";
import type { LoopState } from "@/lib/loop-types.ts";

interface PromptsPanelProps {
  state: LoopState;
}

export function PromptsPanel({ state }: PromptsPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle>Prompts</CardTitle>
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <PromptCard
              label="CLASSIFY"
              template={CLASSIFY_TEMPLATE}
              filled={state.filledClassifyPrompt}
              output={state.classifyRawOutput}
            />
            <PromptCard
              label="MICRO_RESPONSE"
              template={MICRO_RESPONSE_TEMPLATE}
              filled={state.filledResponsePrompt}
              output={state.responseRawOutput}
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
