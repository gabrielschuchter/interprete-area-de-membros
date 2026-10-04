"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { toast } from "@repo/design-system/lib/toast";
import { SearchIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { NotificationRealtime } from "./notification-realtime";
import { NotificationsPopover } from "./notifications-popover";

const GlobalSearch = dynamic(
  () => import("./global-search").then((module) => module.GlobalSearch),
  { ssr: false }
);

type ActiveOverlay = "search" | "notifications" | null;

interface BadgeNotification {
  readonly body?: string | null;
  readonly createdAt?: string;
  readonly entityType?: string | null;
  readonly id: string;
  readonly title?: string;
  readonly type: string;
}

const fetchRecentBadgeNotifications = async () => {
  const response = await fetch("/api/notifications?filter=BADGES&limit=10", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { items?: BadgeNotification[] };
  return payload.items ?? [];
};

const announceNewBadgeNotifications = (
  items: readonly BadgeNotification[],
  memberId: string,
  knownNotifications: Set<string>,
  announceNew: boolean
) => {
  for (const item of items) {
    if (item.type !== "BADGE_AWARDED" || item.entityType !== "BADGE") {
      continue;
    }
    const firstObservation = !knownNotifications.has(item.id);
    knownNotifications.add(item.id);
    if (!firstObservation) {
      continue;
    }
    const createdAt = item.createdAt ? Date.parse(item.createdAt) : 0;
    const recentlyAwarded = createdAt > 0 && Date.now() - createdAt <= 45_000;
    if (!(announceNew || recentlyAwarded)) {
      continue;
    }
    const storageKey = `interprete:badge-toast:v1:${memberId}:${item.id}`;
    try {
      if (window.localStorage.getItem(storageKey)) {
        continue;
      }
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // The toast can still appear if local storage is unavailable.
    }
    toast.success(
      `Medalha conquistada: ${item.body ?? item.title ?? "Nova conquista"}`
    );
  }
};

interface MemberHeaderControlsProperties {
  readonly memberId: string;
}

export const MemberHeaderControls = ({
  memberId,
}: MemberHeaderControlsProperties) => {
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const crossTabChannel = useRef<BroadcastChannel | null>(null);
  const knownBadgeNotifications = useRef(new Set<string>());
  const badgeNotificationRequest = useRef(false);
  const badgeRefreshPending = useRef(false);
  const badgeAnnouncePending = useRef(false);
  const loadBadgeNotifications = useCallback(
    async (announceNew: boolean) => {
      if (badgeNotificationRequest.current) {
        badgeRefreshPending.current = true;
        badgeAnnouncePending.current ||= announceNew;
        return;
      }
      badgeNotificationRequest.current = true;
      let shouldAnnounceNew = announceNew;
      try {
        do {
          badgeRefreshPending.current = false;
          const items = await fetchRecentBadgeNotifications();
          announceNewBadgeNotifications(
            items,
            memberId,
            knownBadgeNotifications.current,
            shouldAnnounceNew
          );
          shouldAnnounceNew = badgeAnnouncePending.current;
          badgeAnnouncePending.current = false;
        } while (badgeRefreshPending.current);
      } catch {
        // The durable notification remains available in the central inbox.
      } finally {
        badgeNotificationRequest.current = false;
      }
    },
    [memberId]
  );
  useEffect(() => {
    loadBadgeNotifications(false).catch(() => undefined);
  }, [loadBadgeNotifications]);
  const handleRealtimeNotification = useCallback(() => {
    setRefreshSignal((current) => current + 1);
    crossTabChannel.current?.postMessage({ memberId, type: "invalidate" });
    loadBadgeNotifications(true).catch(() => undefined);
  }, [loadBadgeNotifications, memberId]);
  const handleRealtimeResync = useCallback(() => {
    setRefreshSignal((current) => current + 1);
    loadBadgeNotifications(false).catch(() => undefined);
  }, [loadBadgeNotifications]);
  const handleUnreadCountChange = useCallback(
    (count: number) => setUnreadCount(count),
    []
  );
  const handleRealtimeStatusChange = useCallback(
    (connected: boolean) => setRealtimeConnected(connected),
    []
  );

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }
    const channel = new BroadcastChannel("interprete:member-notifications:v1");
    crossTabChannel.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (
        event.data &&
        typeof event.data === "object" &&
        "type" in event.data &&
        event.data.type === "invalidate" &&
        "memberId" in event.data &&
        event.data.memberId === memberId
      ) {
        setRefreshSignal((current) => current + 1);
      }
    };
    return () => {
      channel.close();
      crossTabChannel.current = null;
    };
  }, [memberId]);

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
        realtimeConnected={realtimeConnected}
        refreshSignal={refreshSignal}
      />

      <NotificationRealtime
        memberId={memberId}
        onNotification={handleRealtimeNotification}
        onResync={handleRealtimeResync}
        onStatusChange={handleRealtimeStatusChange}
      />

      {activeOverlay === "search" && (
        <GlobalSearch
          onOpenChange={(open) => setActiveOverlay(open ? "search" : null)}
          open
        />
      )}

      <span aria-live="polite" className="sr-only">
        {unreadCount > 0
          ? `${unreadCount} notificações não lidas`
          : "Nenhuma notificação não lida"}
      </span>
    </div>
  );
};
