"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GestaoIcon, type GestaoIconName } from "./gestao-icon";
import {
  type GestaoNotificationItem,
  gestaoNotificationIcon,
  gestaoRelativeTime,
} from "./gestao-notifications-domain";

const NotificationRealtime = dynamic(
  () =>
    import("../components/notification-realtime").then(
      (module) => module.NotificationRealtime
    ),
  { ssr: false }
);

interface NotificationsResponse {
  readonly items?: GestaoNotificationItem[];
  readonly unreadCount?: number;
}

const previewLimit = 6;
const pollingMs = 60_000;

const requestJson = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error("request failed");
  }
  return (await response.json()) as NotificationsResponse;
};

export const GestaoNotificationItemRow = ({
  item,
  onOpen,
}: {
  readonly item: GestaoNotificationItem;
  readonly onOpen: (item: GestaoNotificationItem) => void;
}) => {
  const icon: GestaoIconName = gestaoNotificationIcon(item);
  return (
    <button
      className="gk-bellitem"
      data-unread={!item.readAt}
      onClick={() => onOpen(item)}
      type="button"
    >
      <GestaoIcon name={icon} size={18} />
      <span className="gk-bellitem-copy">
        <strong>{item.title}</strong>
        {item.body ? <span>{item.body}</span> : null}
      </span>
      <time dateTime={item.createdAt}>
        {gestaoRelativeTime(item.createdAt)}
      </time>
    </button>
  );
};

export const GestaoNotificationsBell = ({
  memberId,
}: {
  readonly memberId: string;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<GestaoNotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState<"error" | "idle" | "loading" | "ready">(
    "idle"
  );
  const [connected, setConnected] = useState(false);
  const [signal, setSignal] = useState(0);

  const loadSummary = useCallback(async () => {
    try {
      const payload = await requestJson("/api/notifications?summary=1");
      setUnread(Math.max(0, payload.unreadCount ?? 0));
    } catch {
      // O sino continua utilizável sem o contador.
    }
  }, []);

  const loadItems = useCallback(async () => {
    setStatus("loading");
    try {
      const payload = await requestJson(
        `/api/notifications?filter=ALL&limit=${previewLimit}`
      );
      const next = payload.items ?? [];
      setItems(next);
      setUnread(Math.max(0, payload.unreadCount ?? 0));
      setStatus("ready");
      const unseen = next.filter((item) => !item.seenAt).map((item) => item.id);
      if (unseen.length > 0) {
        await fetch("/api/notifications/seen", {
          body: JSON.stringify({ ids: unseen }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
      }
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (signal >= 0) {
      loadSummary().catch(() => undefined);
    }
  }, [loadSummary, signal]);

  useEffect(() => {
    if (open && signal >= 0) {
      loadItems().catch(() => undefined);
    }
  }, [open, loadItems, signal]);

  useEffect(() => {
    if (connected) {
      return;
    }
    const tick = () => {
      if (document.visibilityState === "visible") {
        loadSummary().catch(() => undefined);
      }
    };
    const timer = window.setInterval(tick, pollingMs);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [connected, loadSummary]);

  const openItem = async (item: GestaoNotificationItem) => {
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, readAt: entry.readAt ?? new Date().toISOString() }
          : entry
      )
    );
    if (!item.readAt) {
      setUnread((count) => Math.max(0, count - 1));
    }
    try {
      await fetch(`/api/notifications/${item.id}`, {
        body: JSON.stringify({ read: true }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
    } finally {
      setOpen(false);
      if (item.href) {
        router.push(item.href);
      }
    }
  };

  const markAllRead = async () => {
    const before = items;
    const beforeUnread = unread;
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) => ({
        ...item,
        readAt: item.readAt ?? now,
        seenAt: item.seenAt ?? now,
      }))
    );
    setUnread(0);
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("read-all failed");
      }
    } catch {
      setItems(before);
      setUnread(beforeUnread);
    }
  };

  const badge = unread > 9 ? "9+" : String(unread);
  return (
    <>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <button
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={
              unread > 0 ? `Notificações, ${unread} não lidas` : "Notificações"
            }
            className="gk-bell"
            type="button"
          >
            <GestaoIcon name="bell" size={18} strokeWidth={1.6} />
            {unread > 0 ? <span className="gk-bell-badge">{badge}</span> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="gk-bellmenu"
          onOpenAutoFocus={(event) => event.preventDefault()}
          sideOffset={8}
        >
          <div className="gk-bellmenu-head">
            <h2>Notificações</h2>
            {unread > 0 ? (
              <button
                className="gk-link-btn"
                onClick={() => markAllRead().catch(() => undefined)}
                type="button"
              >
                Marcar todas como lidas
              </button>
            ) : null}
          </div>
          <div className="gk-bellmenu-list">
            {status === "loading" && items.length === 0 ? (
              <p className="gk-bellmenu-note">Carregando…</p>
            ) : null}
            {status === "error" ? (
              <p className="gk-bellmenu-note" role="alert">
                Não foi possível carregar as notificações agora.{" "}
                <button
                  className="gk-link-btn"
                  onClick={() => loadItems().catch(() => undefined)}
                  type="button"
                >
                  Tentar novamente
                </button>
              </p>
            ) : null}
            {status === "ready" && items.length === 0 ? (
              <p className="gk-bellmenu-note">Nada novo por aqui.</p>
            ) : null}
            {items.map((item) => (
              <GestaoNotificationItemRow
                item={item}
                key={item.id}
                onOpen={(entry) => openItem(entry).catch(() => undefined)}
              />
            ))}
          </div>
          <div className="gk-bellmenu-foot">
            <Link
              className="gk-link-btn"
              href="/gestao/notificacoes"
              onClick={() => setOpen(false)}
              prefetch={false}
            >
              Ver todas <GestaoIcon name="arrow-right" size={14} />
            </Link>
          </div>
        </PopoverContent>
      </Popover>
      <NotificationRealtime
        memberId={memberId}
        onNotification={() => setSignal((value) => value + 1)}
        onResync={() => setSignal((value) => value + 1)}
        onStatusChange={setConnected}
      />
    </>
  );
};
