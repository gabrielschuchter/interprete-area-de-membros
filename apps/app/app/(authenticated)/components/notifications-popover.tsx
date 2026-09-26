"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { cn } from "@repo/design-system/lib/utils";
import {
  BellIcon,
  CheckCheckIcon,
  InboxIcon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type NotificationFilter = "ALL" | "MENTIONS" | "ACTIVITIES";

interface NotificationActor {
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
  readonly profile: {
    readonly avatarUrl: string | null;
    readonly displayName: string | null;
    readonly username: string;
  } | null;
}

interface NotificationItem {
  readonly actor: NotificationActor | null;
  readonly body: string | null;
  readonly createdAt: string;
  readonly groupKey: string | null;
  readonly href: string | null;
  readonly id: string;
  readonly readAt: string | null;
  readonly seenAt: string | null;
  readonly title: string;
  readonly type: string;
}

interface NotificationsResponse {
  readonly error?: string;
  readonly items?: NotificationItem[];
  readonly unseenCount?: number;
}

interface NotificationsPopoverProperties {
  readonly onOpenChange: (open: boolean) => void;
  readonly onUnreadCountChange: (count: number) => void;
  readonly open: boolean;
  readonly refreshSignal?: number;
}

type LoadingState = "idle" | "loading" | "ready" | "error";

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const actorName = (actor: NotificationActor | null) =>
  actor?.profile?.displayName ?? actor?.displayName ?? "Interprete";

const actorAvatar = (actor: NotificationActor | null) =>
  actor?.profile?.avatarUrl ?? actor?.avatarUrl ?? null;

const displayTitle = (item: NotificationItem) => {
  if (item.type === "ANNOUNCEMENT" || item.title.includes("movimentaram")) {
    return item.title;
  }
  const name = actorName(item.actor);
  if (item.type === "MENTION") {
    return `${name} mencionou você`;
  }
  if (item.type === "COMMENT_REPLY") {
    return `${name} respondeu ao seu comentário`;
  }
  if (item.type === "TOPIC_COMMENT") {
    return `${name} comentou no seu tópico`;
  }
  if (item.type === "ACTIVITY_ASSIGNED") {
    return "Uma nova atividade foi atribuída a você";
  }
  if (item.type === "FEEDBACK_RECEIVED") {
    return "Você recebeu feedback";
  }
  if (item.type === "ACTIVITY_DEADLINE") {
    return "O prazo de uma atividade está se aproximando";
  }
  if (item.type === "LESSON_AVAILABLE") {
    return "Uma nova aula está disponível";
  }
  if (item.type === "MODULE_AVAILABLE") {
    return "Um novo módulo está disponível";
  }
  return item.title;
};

const filterLabel = (value: NotificationFilter) => {
  if (value === "ALL") {
    return "Todas";
  }
  if (value === "MENTIONS") {
    return "Menções";
  }
  return "Atividades";
};

const groupNotifications = (items: readonly NotificationItem[]) => {
  const grouped = new Map<string, NotificationItem[]>();
  for (const item of items) {
    const key =
      item.groupKey && item.type === "FOLLOWED_TOPIC_ACTIVITY"
        ? item.groupKey
        : item.id;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return [...grouped.values()].map((group) => {
    if (group.length < 2) {
      return group[0];
    }
    const first = group[0];
    const names = group.slice(0, 2).map((item) => actorName(item.actor));
    const remainder = group.length - names.length;
    return {
      ...first,
      title: `${names.join(", ")}${remainder > 0 ? ` e mais ${remainder}` : ""} movimentaram uma discussão seguida`,
    };
  });
};

export const NotificationsPopover = ({
  open,
  onOpenChange,
  onUnreadCountChange,
  refreshSignal = 0,
}: NotificationsPopoverProperties) => {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [state, setState] = useState<LoadingState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [filter, setFilter] = useState<NotificationFilter>("ALL");

  const updateUnseenCount = useCallback(
    (count: number) => {
      const normalized = Math.max(0, count);
      setUnseenCount(normalized);
      onUnreadCountChange(normalized);
    },
    [onUnreadCountChange]
  );

  const loadNotifications = useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    try {
      const response = await fetch(`/api/notifications?filter=${filter}`, {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as NotificationsResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Notificações indisponíveis.");
      }
      const nextItems = payload.items ?? [];
      setItems(nextItems);
      updateUnseenCount(payload.unseenCount ?? 0);
      setState("ready");
      const ids = nextItems
        .filter((item) => !item.seenAt)
        .map((item) => item.id);
      if (ids.length > 0) {
        await fetch("/api/notifications/seen", {
          body: JSON.stringify({ ids }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        setItems((current) =>
          current.map((item) =>
            ids.includes(item.id)
              ? { ...item, seenAt: new Date().toISOString() }
              : item
          )
        );
        const summaryResponse = await fetch("/api/notifications?summary=1", {
          headers: { Accept: "application/json" },
        });
        if (summaryResponse.ok) {
          const summary =
            (await summaryResponse.json()) as NotificationsResponse;
          updateUnseenCount(summary.unseenCount ?? 0);
        }
      }
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as notificações agora."
      );
    }
  }, [filter, updateUnseenCount]);

  const loadUnseenCount = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?summary=1", {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as NotificationsResponse;
      if (response.ok) {
        updateUnseenCount(payload.unseenCount ?? 0);
      }
    } catch {
      // The header remains usable when the optional badge is unavailable.
    }
  }, [updateUnseenCount]);

  useEffect(() => {
    if (refreshSignal >= 0) {
      loadUnseenCount().catch(() => undefined);
    }
  }, [loadUnseenCount, refreshSignal]);

  useEffect(() => {
    if (open && refreshSignal >= 0) {
      loadNotifications().catch(() => undefined);
    }
  }, [open, loadNotifications, refreshSignal]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadUnseenCount().catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [loadUnseenCount]);

  const markReadAndOpen = async (item: NotificationItem) => {
    setItems((current) =>
      current.map((notification) =>
        notification.id === item.id
          ? {
              ...notification,
              readAt: notification.readAt ?? new Date().toISOString(),
            }
          : notification
      )
    );
    await fetch(`/api/notifications/${item.id}`, {
      body: JSON.stringify({ read: true }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    onOpenChange(false);
    if (item.href) {
      router.push(item.href);
    }
  };

  const markAllRead = async () => {
    setItems((current) =>
      current.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
        seenAt: item.seenAt ?? new Date().toISOString(),
      }))
    );
    await fetch("/api/notifications/read-all", { method: "POST" });
    updateUnseenCount(0);
  };

  const displayItems = useMemo(() => groupNotifications(items), [items]);
  const badgeLabel = unseenCount > 9 ? "9+" : String(unseenCount);

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={
            unseenCount > 0
              ? `Notificações, ${unseenCount} novas`
              : "Notificações"
          }
          className="relative size-10 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <BellIcon aria-hidden="true" />
          {unseenCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-brand-classic-crimson px-1 text-[0.6rem] text-white leading-4">
              {badgeLabel}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(27rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border-border/70 bg-background/95 p-0 shadow-[var(--shadow-floating)] backdrop-blur-xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
        sideOffset={10}
      >
        <div className="flex items-start justify-between border-border/70 border-b px-4 py-4">
          <div>
            <p className="font-display text-lg">Notificações</p>
            <p className="mt-0.5 text-muted-foreground text-xs">
              O que merece sua atenção agora.
            </p>
          </div>
          {items.some((item) => !item.readAt) && (
            <Button
              className="h-8 px-2 text-xs"
              onClick={() => markAllRead().catch(() => undefined)}
              type="button"
              variant="ghost"
            >
              <CheckCheckIcon aria-hidden="true" /> Marcar como lidas
            </Button>
          )}
        </div>
        <div className="flex gap-1 border-border/70 border-b px-3 py-2">
          {(["ALL", "MENTIONS", "ACTIVITIES"] as const).map((value) => (
            <button
              className={cn(
                "rounded-full px-3 py-1.5 text-xs transition-colors",
                filter === value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent"
              )}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {filterLabel(value)}
            </button>
          ))}
        </div>
        <div className="max-h-[min(62vh,30rem)] overflow-y-auto p-2">
          {state === "loading" && (
            <div
              aria-live="polite"
              className="flex items-center justify-center gap-2 px-4 py-12 text-muted-foreground text-sm"
            >
              <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
              Carregando
            </div>
          )}
          {state === "error" && (
            <div className="px-4 py-10 text-center" role="alert">
              <p className="text-muted-foreground text-sm">{errorMessage}</p>
              <Button
                className="mt-4"
                onClick={() => loadNotifications().catch(() => undefined)}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCwIcon aria-hidden="true" /> Tentar novamente
              </Button>
            </div>
          )}
          {state === "ready" && displayItems.length === 0 && (
            <div className="px-4 py-12 text-center">
              <InboxIcon
                aria-hidden="true"
                className="mx-auto size-8 text-brand-dark-amaranth/60"
              />
              <p className="mt-3 font-display text-base">
                Nenhuma notificação por aqui.
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                Quando houver uma resposta, menção ou novidade importante, ela
                aparecerá aqui.
              </p>
            </div>
          )}
          {state === "ready" && displayItems.length > 0 && (
            <div className="motion-stagger space-y-1">
              {displayItems.map((item) => (
                <button
                  className={cn(
                    "block w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    !item.readAt && "bg-accent/45"
                  )}
                  key={item.id}
                  onClick={() => markReadAndOpen(item).catch(() => undefined)}
                  type="button"
                >
                  <span className="flex items-start gap-3">
                    {actorAvatar(item.actor) ? (
                      // biome-ignore lint/performance/noImgElement: member assets resolve through an authenticated route.
                      <img
                        alt=""
                        className="mt-0.5 size-8 shrink-0 rounded-full object-cover object-center"
                        height={32}
                        src={actorAvatar(item.actor) ?? undefined}
                        width={32}
                      />
                    ) : (
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-xs">
                        {actorName(item.actor).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block font-medium text-sm">
                        {displayTitle(item)}
                      </span>
                      {item.body && (
                        <span className="mt-1 line-clamp-2 block text-muted-foreground text-xs">
                          {item.body}
                        </span>
                      )}
                      <span className="mt-2 block text-[0.68rem] text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </span>
                    </span>
                    {!item.readAt && (
                      <span
                        className="mt-2 size-2 shrink-0 rounded-full bg-brand-classic-crimson"
                        title="Não lida"
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-border/70 border-t px-4 py-3">
          <Link
            className="text-primary text-sm underline underline-offset-4"
            href="/notificacoes"
            onClick={() => onOpenChange(false)}
          >
            Ver todas
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};
