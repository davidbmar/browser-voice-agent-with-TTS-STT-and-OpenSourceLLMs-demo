import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { StateSummary } from "./state-summary.tsx";
import type { LoopState } from "@/lib/loop-types.ts";

interface InternalStatePanelProps {
  state: LoopState;
}

export function InternalStatePanel({ state }: InternalStatePanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Internal State</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary">
          <TabsList className="w-full">
            <TabsTrigger value="summary" className="flex-1">Summary</TabsTrigger>
            <TabsTrigger value="json" className="flex-1">JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <ScrollArea className="h-[300px] pr-2">
              <StateSummary state={state} />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="json">
            <ScrollArea className="h-[300px]">
              <pre className="text-[10px] font-mono whitespace-pre-wrap break-all p-2 bg-muted/50 rounded">
                {JSON.stringify(state, null, 2)}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
