import { useCallback } from "react";
import { Button } from "@/components/ui/button.tsx";
import { History } from "lucide-react";
import { getChangelogHTML } from "./changelog-content.ts";

export function ChangelogButton() {
  const openChangelog = useCallback(() => {
    const win = window.open("", "_blank", "width=1000,height=800,scrollbars=yes");
    if (!win) return;
    win.document.open();
    win.document.write(getChangelogHTML());
    win.document.close();
  }, []);

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 gap-1.5 text-xs"
      onClick={openChangelog}
    >
      <History className="h-3.5 w-3.5" />
      Changelog
    </Button>
  );
}
