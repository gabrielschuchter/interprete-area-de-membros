"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { cn } from "@repo/design-system/lib/utils";
import {
  AtSignIcon,
  BellIcon,
  CheckCheckIcon,
  InboxIcon,
  Loader2Icon,
  MessageCircleIcon,
  RefreshCwIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./notification-bell.css";
import { NotificationActorAvatar } from "@/components/notifications/notification-actor-avatar";
import { NotificationInvitationActions } from "./notification-invitation-actions";

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
  readonly entityId?: string | null;
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
  readonly unreadCount?: number;
  readonly unseenCount?: number;
}

interface NotificationsPopoverProperties {
  readonly noteEditorMode?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onUnreadCountChange: (count: number) => void;
  readonly open: boolean;
  readonly realtimeConnected: boolean;
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
  if (item.type === "GROUP_INVITATION") {
    return `${name} convidou você para um grupo de estudo`;
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

interface CalloutChip {
  readonly count: number;
  readonly kind: "invite" | "mention" | "reply" | "other";
}

const calloutKind = (type: string): CalloutChip["kind"] => {
  if (type === "MENTION") {
    return "mention";
  }
  if (type === "GROUP_INVITATION") {
    return "invite";
  }
  if (
    type === "COMMENT_REPLY" ||
    type === "TOPIC_COMMENT" ||
    type === "FOLLOWED_TOPIC_ACTIVITY" ||
    type === "GROUP_POST"
  ) {
    return "reply";
  }
  return "other";
};

const calloutIcons = {
  invite: UsersIcon,
  mention: AtSignIcon,
  reply: MessageCircleIcon,
  other: BellIcon,
} as const;

const loadCalloutChips = async (total: number): Promise<CalloutChip[]> => {
  const fallback: CalloutChip[] = [{ kind: "other", count: total }];
  try {
    const response = await fetch("/api/notifications?scope=fresh&limit=20", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return fallback;
    }
    const payload = (await response.json()) as NotificationsResponse;
    const counts = new Map<CalloutChip["kind"], number>();
    for (const item of payload.items ?? []) {
      if (!item.seenAt) {
        const kind = calloutKind(item.type);
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
    }
    return counts.size > 0
      ? [...counts.entries()].map(([kind, count]) => ({ kind, count }))
      : fallback;
  } catch {
    // O total continua suficiente para chamar a atenção.
    return fallback;
  }
};

const popoverSubtitle = (
  state: LoadingState,
  newCount: number,
  recentCount: number
) => {
  if (state !== "ready") {
    return "O que chegou desde a sua última visita.";
  }
  if (newCount > 0) {
    return newCount === 1
      ? "1 nova desde a última visita."
      : `${newCount} novas desde a última visita.`;
  }
  if (recentCount > 0) {
    return "Nada novo desde a última visita.";
  }
  return "Você está em dia.";
};

const relativeTime = (value: string) => {
  const date = new Date(value);
  const diff = Date.now() - date.valueOf();
  if (Number.isNaN(diff)) {
    return "";
  }
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) {
    return "agora";
  }
  if (minutes < 60) {
    return `há ${minutes} min`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `há ${hours} h`;
  }
  return formatDate(value);
};

const NotificationGroup = ({
  heading,
  isNew,
  items,
  onInvitationResponded,
  onOpen,
}: {
  readonly heading: string;
  readonly isNew: boolean;
  readonly items: readonly NotificationItem[];
  readonly onInvitationResponded: (item: NotificationItem) => void;
  readonly onOpen: (item: NotificationItem) => Promise<void>;
}) => (
  <section aria-label={heading}>
    <p className="px-3 pt-1 pb-1.5 font-medium text-[0.68rem] text-muted-foreground uppercase tracking-[0.14em]">
      {heading}
    </p>
    <ul className="space-y-1">
      {items.map((item) => (
        <li
          className={cn(
            "relative rounded-lg px-3 py-3 transition-colors hover:bg-accent",
            isNew && !item.readAt && "bg-[#FBF3F4]"
          )}
          data-notification-new={isNew ? "true" : undefined}
          key={item.id}
        >
          {isNew && !item.readAt ? (
            <span
              aria-hidden="true"
              className="absolute top-3 bottom-3 left-0 w-[3px] rounded-full bg-brand-classic-crimson"
            />
          ) : null}
          <button
            className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => onOpen(item).catch(() => undefined)}
            type="button"
          >
            <span className="flex items-start gap-3">
              <NotificationActorAvatar
                className="mt-0.5 size-8"
                name={actorName(item.actor)}
                src={actorAvatar(item.actor)}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm",
                    item.readAt ? "text-muted-foreground" : "font-medium"
                  )}
                >
                  {displayTitle(item)}
                </span>
                {item.body && (
                  <span className="mt-1 line-clamp-2 block text-muted-foreground text-xs">
                    {item.body}
                  </span>
                )}
                <span className="mt-1.5 flex items-center gap-2 text-[0.68rem] text-muted-foreground">
                  {isNew && !item.readAt ? (
                    <span className="font-semibold text-brand-classic-crimson uppercase tracking-[0.08em]">
                      Nova
                    </span>
                  ) : null}
                  <span>{relativeTime(item.createdAt)}</span>
                </span>
              </span>
            </span>
          </button>
          {item.type === "GROUP_INVITATION" && item.entityId ? (
            <div className="pl-11">
              <NotificationInvitationActions
                invitationId={item.entityId}
                onResponded={() => onInvitationResponded(item)}
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  </section>
);

const calloutDurationMs = 7000;

export const NotificationsPopover = ({
  open,
  onOpenChange,
  onUnreadCountChange,
  noteEditorMode = false,
  refreshSignal = 0,
  realtimeConnected,
}: NotificationsPopoverProperties) => {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unseenCount, setUnseenCount] = useState(0);
  const [state, setState] = useState<LoadingState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  // Ids que ainda não tinham sido vistos quando o sino abriu: ficam marcados
  // como "Nova" até o sino fechar, mesmo depois de registrados como vistos.
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(() => new Set());
  const [callout, setCallout] = useState<{
    readonly chips: readonly CalloutChip[];
    readonly leaving: boolean;
  } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [calloutAnchor, setCalloutAnchor] = useState<{
    readonly right: number;
    readonly top: number;
  } | null>(null);
  const lastUnseenRef = useRef<number | null>(null);
  const calloutTimers = useRef<number[]>([]);
  const openRef = useRef(open);
  openRef.current = open;

  const dismissCallout = useCallback(() => {
    for (const timer of calloutTimers.current) {
      window.clearTimeout(timer);
    }
    calloutTimers.current = [];
    setCallout((current) => (current ? { ...current, leaving: true } : null));
    calloutTimers.current.push(window.setTimeout(() => setCallout(null), 300));
  }, []);

  const measureCalloutAnchor = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      return;
    }
    const viewportWidth = document.documentElement.clientWidth;
    setCalloutAnchor({
      right: Math.max(8, viewportWidth - rect.right - 6),
      top: rect.bottom + 10,
    });
  }, []);

  const showCallout = useCallback(
    async (total: number) => {
      const chips = await loadCalloutChips(total);
      if (openRef.current) {
        return;
      }
      for (const timer of calloutTimers.current) {
        window.clearTimeout(timer);
      }
      calloutTimers.current = [
        window.setTimeout(dismissCallout, calloutDurationMs),
      ];
      measureCalloutAnchor();
      setCallout({ chips, leaving: false });
    },
    [dismissCallout, measureCalloutAnchor]
  );

  // O balão acompanha o sino: a posição é refeita ao redimensionar, rolar ou
  // quando o cabeçalho muda de largura (fontes, barra lateral, zoom).
  const calloutVisible = callout !== null;
  useEffect(() => {
    if (!calloutVisible) {
      return;
    }
    measureCalloutAnchor();
    const frame = window.requestAnimationFrame(measureCalloutAnchor);
    const settle = window.setTimeout(measureCalloutAnchor, 400);
    window.addEventListener("resize", measureCalloutAnchor);
    window.addEventListener("scroll", measureCalloutAnchor, true);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measureCalloutAnchor);
    observer?.observe(document.documentElement);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener("resize", measureCalloutAnchor);
      window.removeEventListener("scroll", measureCalloutAnchor, true);
      observer?.disconnect();
    };
  }, [calloutVisible, measureCalloutAnchor]);

  useEffect(
    () => () => {
      for (const timer of calloutTimers.current) {
        window.clearTimeout(timer);
      }
    },
    []
  );

  const updateCounts = useCallback(
    (counts: {
      readonly unreadCount?: number;
      readonly unseenCount?: number;
    }) => {
      const nextUnread = Math.max(0, counts.unreadCount ?? 0);
      setUnreadCount(nextUnread);
      const nextUnseen = Math.max(0, counts.unseenCount ?? 0);
      setUnseenCount(nextUnseen);
      onUnreadCountChange(nextUnread);
      const previous = lastUnseenRef.current;
      lastUnseenRef.current = nextUnseen;
      if (nextUnseen > 0 && (previous === null || nextUnseen > previous)) {
        let alreadyAnnounced = false;
        try {
          const key = "interprete:bell-announced:v1";
          alreadyAnnounced =
            previous === null &&
            window.sessionStorage.getItem(key) === String(nextUnseen);
          window.sessionStorage.setItem(key, String(nextUnseen));
        } catch {
          // Sem sessionStorage, o balão aparece normalmente.
        }
        if (!(openRef.current || alreadyAnnounced)) {
          showCallout(nextUnseen).catch(() => undefined);
        }
      } else if (nextUnseen === 0) {
        setCallout(null);
      }
    },
    [onUnreadCountChange, showCallout]
  );

  const loadNotifications = useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    try {
      const response = await fetch("/api/notifications?scope=fresh&limit=30", {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as NotificationsResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Notificações indisponíveis.");
      }
      const nextItems = payload.items ?? [];
      setItems(nextItems);
      updateCounts(payload);
      setState("ready");
      const ids = nextItems
        .filter((item) => !item.seenAt)
        .map((item) => item.id);
      setNewIds((current) => new Set([...current, ...ids]));
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
          updateCounts(summary);
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
  }, [updateCounts]);

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?summary=1", {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as NotificationsResponse;
      if (response.ok) {
        updateCounts(payload);
      }
    } catch {
      // The header remains usable when the optional badge is unavailable.
    }
  }, [updateCounts]);

  useEffect(() => {
    if (refreshSignal >= 0) {
      loadSummary().catch(() => undefined);
    }
  }, [loadSummary, refreshSignal]);

  useEffect(() => {
    if (open && refreshSignal >= 0) {
      loadNotifications().catch(() => undefined);
    }
  }, [open, loadNotifications, refreshSignal]);

  useEffect(() => {
    if (!open) {
      setNewIds(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (realtimeConnected) {
      return;
    }

    let disposed = false;
    let timer: number | undefined;
    let delayMs = 15_000;

    const schedule = () => {
      if (disposed || document.visibilityState !== "visible") {
        return;
      }
      const jitter = Math.round(delayMs * (Math.random() * 0.2 - 0.1));
      timer = window.setTimeout(async () => {
        await loadSummary();
        delayMs = Math.min(delayMs * 2, 120_000);
        schedule();
      }, delayMs + jitter);
    };

    const refreshWhenActive = () => {
      if (document.visibilityState !== "visible") {
        if (timer !== undefined) {
          window.clearTimeout(timer);
        }
        return;
      }
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      delayMs = 15_000;
      loadSummary()
        .finally(schedule)
        .catch(() => undefined);
    };

    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);
    schedule();

    return () => {
      disposed = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
    };
  }, [loadSummary, realtimeConnected]);

  const markReadAndOpen = async (item: NotificationItem) => {
    const wasUnread = !item.readAt;
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
    if (wasUnread) {
      updateCounts({ unreadCount: unreadCount - 1, unseenCount });
    }
    try {
      const response = await fetch(`/api/notifications/${item.id}`, {
        body: JSON.stringify({ read: true }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        throw new Error("Não foi possível atualizar a notificação.");
      }
      onOpenChange(false);
      if (item.href) {
        router.push(item.href);
      }
    } catch {
      await loadNotifications();
    }
  };

  const markAllRead = async () => {
    const previousItems = items;
    const previousCount = unreadCount;
    setItems((current) =>
      current.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
        seenAt: item.seenAt ?? new Date().toISOString(),
      }))
    );
    updateCounts({ unreadCount: 0, unseenCount: 0 });
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Não foi possível atualizar as notificações.");
      }
    } catch {
      setItems(previousItems);
      updateCounts({ unreadCount: previousCount, unseenCount });
      await loadSummary();
    }
  };

  const markInvitationResponded = (item: NotificationItem) => {
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
    fetch(`/api/notifications/${item.id}`, {
      body: JSON.stringify({ read: true }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    })
      .then(() => loadSummary())
      .catch(() => undefined);
  };

  const displayItems = useMemo(() => groupNotifications(items), [items]);
  const badgeLabel = unseenCount > 9 ? "9+" : String(unseenCount);
  const newItems = displayItems.filter((item) => newIds.has(item.id));
  const recentItems = displayItems.filter((item) => !newIds.has(item.id));
  const historyHref = pathname.startsWith("/gestao")
    ? "/gestao/notificacoes"
    : "/notificacoes";

  const fresh = unseenCount > 0;
  return (
    <div className="relative" ref={anchorRef}>
      <Popover
        onOpenChange={(next) => {
          if (next) {
            dismissCallout();
          }
          onOpenChange(next);
        }}
        open={open}
      >
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={
              unseenCount > 0
                ? `Notificações, ${unseenCount} ${unseenCount === 1 ? "nova" : "novas"}`
                : "Notificações"
            }
            className={`bell-trigger relative ${noteEditorMode ? "size-11" : "size-10"} rounded-full ${fresh ? "text-brand-classic-crimson" : "text-muted-foreground"} hover:bg-accent hover:text-foreground`}
            data-fresh={fresh}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <BellIcon aria-hidden="true" />
            {unseenCount > 0 && (
              <span className="bell-badge" data-fresh={fresh}>
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
          <div className="flex items-start justify-between gap-3 border-border/70 border-b px-4 py-4">
            <div>
              <p className="font-display text-lg">Notificações</p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {popoverSubtitle(state, newItems.length, recentItems.length)}
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
          <div className="max-h-[min(62vh,30rem)] overflow-y-auto p-2">
            {state === "loading" && items.length === 0 && (
              <div
                aria-live="polite"
                className="flex items-center justify-center gap-2 px-4 py-12 text-muted-foreground text-sm"
              >
                <Loader2Icon
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
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
              <div className="px-4 py-10 text-center">
                <InboxIcon
                  aria-hidden="true"
                  className="mx-auto size-8 text-brand-dark-amaranth/60"
                />
                <p className="mt-3 font-display text-base">
                  Nada novo por aqui.
                </p>
                <p className="mx-auto mt-1 max-w-64 text-muted-foreground text-xs">
                  Respostas, menções, convites e avisos aparecem aqui assim que
                  chegam. O que você já abriu fica no histórico.
                </p>
              </div>
            )}
            {(state === "ready" || items.length > 0) &&
              displayItems.length > 0 && (
                <div className="space-y-3">
                  {newItems.length > 0 ? (
                    <NotificationGroup
                      heading="Novas"
                      isNew
                      items={newItems}
                      onInvitationResponded={markInvitationResponded}
                      onOpen={markReadAndOpen}
                    />
                  ) : null}
                  {recentItems.length > 0 ? (
                    <NotificationGroup
                      heading="Vistas há pouco"
                      isNew={false}
                      items={recentItems}
                      onInvitationResponded={markInvitationResponded}
                      onOpen={markReadAndOpen}
                    />
                  ) : null}
                </div>
              )}
          </div>
          <div className="flex items-center justify-between border-border/70 border-t px-4 py-3">
            <Link
              className="font-medium text-primary text-sm underline-offset-4 hover:underline"
              href={historyHref}
              onClick={() => onOpenChange(false)}
            >
              Ver todas
            </Link>
            <span className="text-muted-foreground text-xs">
              Histórico completo
            </span>
          </div>
        </PopoverContent>
      </Popover>
      {callout && calloutAnchor && !open
        ? createPortal(
            <button
              aria-label={`${unseenCount} ${unseenCount === 1 ? "nova notificação" : "novas notificações"}. Abrir`}
              className="bell-callout"
              data-leaving={callout.leaving}
              onClick={() => {
                dismissCallout();
                onOpenChange(true);
              }}
              style={{ right: calloutAnchor.right, top: calloutAnchor.top }}
              type="button"
            >
              {callout.chips.map(({ kind, count }) => {
                const Icon = calloutIcons[kind];
                return (
                  <span className="bell-callout-chip" key={kind}>
                    <Icon aria-hidden="true" className="size-4" />
                    {count}
                  </span>
                );
              })}
            </button>,
            document.body
          )
        : null}
    </div>
  );
};
