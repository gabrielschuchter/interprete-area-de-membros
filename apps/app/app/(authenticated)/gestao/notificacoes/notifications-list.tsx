"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GestaoIcon } from "../gestao-icon";
import { GestaoNotificationItemRow } from "../gestao-notifications";
import type { GestaoNotificationItem } from "../gestao-notifications-domain";

interface Page {
  readonly items?: GestaoNotificationItem[];
  readonly nextCursor?: string | null;
}

const tabs = [
  ["all", "Todas"],
  ["unread", "Não lidas"],
] as const;

export const GestaoNotificationsList = ({
  initialCursor,
  initialItems,
  initialUnread,
}: {
  readonly initialCursor: string | null;
  readonly initialItems: readonly GestaoNotificationItem[];
  readonly initialUnread: number;
}) => {
  const router = useRouter();
  const [items, setItems] =
    useState<readonly GestaoNotificationItem[]>(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const unread = items.filter((item) => !item.readAt).length;
  const visible =
    tab === "unread" ? items.filter((item) => !item.readAt) : items;

  const loadMore = async () => {
    if (!cursor) {
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/notifications?filter=ALL&limit=30&cursor=${encodeURIComponent(cursor)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!response.ok) {
        throw new Error("page failed");
      }
      const page = (await response.json()) as Page;
      setItems((current) => [...current, ...(page.items ?? [])]);
      setCursor(page.nextCursor ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    const before = items;
    const now = new Date().toISOString();
    setItems(
      items.map((item) => ({
        ...item,
        readAt: item.readAt ?? now,
        seenAt: item.seenAt ?? now,
      }))
    );
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("read-all failed");
      }
    } catch {
      setItems(before);
      setFailed(true);
    }
  };

  const open = async (item: GestaoNotificationItem) => {
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, readAt: entry.readAt ?? new Date().toISOString() }
          : entry
      )
    );
    try {
      await fetch(`/api/notifications/${item.id}`, {
        body: JSON.stringify({ read: true }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
    } finally {
      if (item.href) {
        router.push(item.href);
      }
    }
  };

  return (
    <section className="gt-page gk-assignments">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Notificações</h1>
          <p>Tudo o que chegou para você na Gestão.</p>
        </div>
        <div className="gk-head-actions">
          {unread > 0 || initialUnread > 0 ? (
            <button
              className="gk-btn"
              disabled={unread === 0}
              onClick={() => markAllRead().catch(() => undefined)}
              type="button"
            >
              Marcar todas como lidas
            </button>
          ) : null}
        </div>
      </header>

      <div className="gk-tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            aria-selected={tab === key}
            className="gk-tab"
            key={key}
            onClick={() => setTab(key)}
            role="tab"
            type="button"
          >
            {label}
            {key === "unread" && unread > 0 ? ` · ${unread}` : ""}
          </button>
        ))}
      </div>

      <div className="gk-card gk-bellpage">
        {visible.length === 0 ? (
          <p className="gk-empty-note">Nada novo.</p>
        ) : (
          visible.map((item) => (
            <GestaoNotificationItemRow
              item={item}
              key={item.id}
              onOpen={(entry) => open(entry).catch(() => undefined)}
            />
          ))
        )}
      </div>
      {failed ? (
        <p className="gk-error-box" role="alert">
          <GestaoIcon name="alert-circle" size={16} /> Não foi possível
          atualizar as notificações agora.
        </p>
      ) : null}
      {cursor ? (
        <div className="gk-form-actions gk-form-actions--start">
          <button
            className="gk-btn"
            disabled={loading}
            onClick={() => loadMore().catch(() => undefined)}
            type="button"
          >
            {loading ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      ) : null}
    </section>
  );
};
