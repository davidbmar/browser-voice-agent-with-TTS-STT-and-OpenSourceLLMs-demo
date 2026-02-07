/**
 * docs-button.tsx — Header button that opens full documentation in a new window.
 *
 * Uses `window.open()` with a data URI to render self-contained HTML
 * so the docs work offline and don't require an extra route or page.
 */

import { useCallback } from "react";
import { Button } from "@/components/ui/button.tsx";
import { BookOpen } from "lucide-react";
import { getDocsHTML } from "./docs-content.ts";

export function DocsButton() {
  const openDocs = useCallback(() => {
    const win = window.open("", "_blank", "width=1000,height=800,scrollbars=yes");
    if (!win) return;
    win.document.open();
    win.document.write(getDocsHTML());
    win.document.close();
  }, []);

  return (
    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={openDocs}>
      <BookOpen className="h-3.5 w-3.5" />
      Docs
    </Button>
  );
}
