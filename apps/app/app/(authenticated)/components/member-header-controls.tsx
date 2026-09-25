"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { SearchIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { NotificationsPopover } from "./notifications-popover";

const GlobalSearch = dynamic(
  () => import("./global-search").then((module) => module.GlobalSearch),
  { ssr: false }
);

type ActiveOverlay = "search" | "notifications" | null;

export const MemberHeaderControls = () => {
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const handleUnreadCountChange = useCallback(
    (count: number) => setUnreadCount(count),
    []
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (
        (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !isTyping)
      ) {
        event.preventDefault();
        setActiveOverlay("search");
        return;
      }

      if (event.key === "Escape" && activeOverlay) {
        setActiveOverlay(null);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeOverlay]);

  return (
    <div className="ml-auto flex items-center gap-1">
      <Button
        aria-expanded={activeOverlay === "search"}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        aria-label="Buscar no Interprete"
        className="size-10 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={() => setActiveOverlay("search")}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <SearchIcon aria-hidden="true" />
      </Button>

      <NotificationsPopover
        onOpenChange={(open) => setActiveOverlay(open ? "notifications" : null)}
        onUnreadCountChange={handleUnreadCountChange}
        open={activeOverlay === "notifications"}
      />

      <GlobalSearch
        onOpenChange={(open) => setActiveOverlay(open ? "search" : null)}
        open={activeOverlay === "search"}
      />

      <span aria-live="polite" className="sr-only">
        {unreadCount > 0
          ? `${unreadCount} notificações não lidas`
          : "Nenhuma notificação não lida"}
      </span>
    </div>
  );
};
