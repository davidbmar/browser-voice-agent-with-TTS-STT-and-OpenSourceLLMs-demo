/**
 * app-layout.tsx — Top-level layout grid for the Bug Loop Voice Agent.
 *
 * Structure:
 *   ┌─────────── Header ───────────┐
 *   ├──── Left (40%) ──┬── Right (60%) ──┤
 *   │  Pipeline, ctrls │  State, prompts │
 *   ├──────────────────┴─────────────────┤
 *   │         Bottom: History            │
 *   └───────────────────────────────────┘
 */

import type { ReactNode } from "react";

interface AppLayoutProps {
  header: ReactNode;
  left: ReactNode;
  right: ReactNode;
  bottom: ReactNode;
}

export function AppLayout({ header, left, right, bottom }: AppLayoutProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar: branding, model selector, docs button */}
      <header className="shrink-0 border-b bg-card/50 px-4 py-2">
        {header}
      </header>

      {/* Main content: two-column layout */}
      <div className="flex-1 min-h-0 flex">
        <div className="w-[40%] border-r overflow-y-auto p-4 space-y-4">
          {left}
        </div>
        <div className="w-[60%] overflow-y-auto p-4 space-y-4">
          {right}
        </div>
      </div>

      {/* Bottom bar: scrollable history timeline */}
      <div className="shrink-0 border-t max-h-[200px] overflow-hidden">
        {bottom}
      </div>
    </div>
  );
}
