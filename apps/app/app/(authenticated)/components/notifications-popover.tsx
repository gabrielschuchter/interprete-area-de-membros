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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface NotificationItem {
  readonly body: string | null;
  readonly createdAt: string;
  readonly href: string | null;
  readonly id: string;
  readonly readAt: string | null;
  readonly title: string;
  readonly type: string;
}

interface NotificationsResponse {
  readonly error?: string;
  readonly items?: NotificationItem[];
  readonly unreadCount?: number;
}

interface NotificationsPopoverProperties {
  readonly onOpenChange: (open: boolean) => void;
  readonly onUnreadCountChange: (count: number) => void;
  readonly open: boolean;
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

export const NotificationsPopover = ({
  open,
  onOpenChange,
  onUnreadCountChange,
}: NotificationsPopoverProperties) => {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [state, setState] = useState<LoadingState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const updateUnreadCount = useCallback(
    (count: number) => {
      const normalized = Math.max(0, count);
      setUnreadCount(normalized);
      onUnreadCountChange(normalized);
    },
    [onUnreadCountChange]
  );

  const loadNotifications = useCallback(async () => {
    setState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/notifications", {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as NotificationsResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Notificações indisponíveis.");
      }
      setItems(payload.items ?? []);
      updateUnreadCount(payload.unreadCount ?? 0);
      setState("ready");
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as notificações agora."
      );
    }
  }, [updateUnreadCount]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?summary=1", {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as NotificationsResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Notificações indisponíveis.");
      }
      updateUnreadCount(payload.unreadCount ?? 0);
    } catch {
      // The header remains usable when the optional notification badge is
      // temporarily unavailable.
    }
  }, [updateUnreadCount]);

  useEffect(() => {
    loadUnreadCount().catch(() => undefined);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (open) {
      loadNotifications().catch(() => undefined);
    }
  }, [open, loadNotifications]);

  const markReadAndOpen = async (item: NotificationItem) => {
    if (!item.readAt) {
      setItems((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, readAt: new Date().toISOString() }
            : notification
        )
      );
      updateUnreadCount(unreadCount - 1);
      await fetch(`/api/notifications/${item.id}`, { method: "PATCH" });
    }

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
      }))
    );
    updateUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "POST" });
  };

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={
            unreadCount > 0
              ? `Notificações, ${unreadCount} não lidas`
              : "Notificações"
          }
          className="relative size-10 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <BellIcon aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-2 right-2 size-2 rounded-full bg-brand-classic-crimson ring-2 ring-background"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(25rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border-border/70 bg-background/95 p-0 shadow-[var(--shadow-floating)] backdrop-blur-xl"
        sideOffset={10}
      >
        <div className="flex items-center justify-between border-border/70 border-b px-4 py-4">
          <div>
            <p className="font-display text-lg">Notificações</p>
            <p className="mt-0.5 text-muted-foreground text-xs">
              Atualizações importantes da sua jornada.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              className="h-8 px-2 text-xs"
              onClick={() => {
                markAllRead().catch(() => undefined);
              }}
              type="button"
              variant="ghost"
            >
              <CheckCheckIcon aria-hidden="true" /> Marcar como lidas
            </Button>
          )}
        </div>

        <div className="max-h-[min(62vh,28rem)] overflow-y-auto p-2">
          {state === "loading" && (
            <div
              aria-live="polite"
              className="flex items-center justify-center gap-2 px-4 py-12 text-muted-foreground text-sm"
            >
              <span className="sr-only">Carregando notificações</span>
              <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
              Carregando
            </div>
          )}

          {state === "error" && (
            <div className="px-4 py-10 text-center" role="alert">
              <p className="text-muted-foreground text-sm">{errorMessage}</p>
              <Button
                className="mt-4"
                onClick={() => {
                  loadNotifications().catch(() => undefined);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCwIcon aria-hidden="true" /> Tentar novamente
              </Button>
            </div>
          )}

          {state === "ready" && items.length === 0 && (
            <div className="px-4 py-12 text-center">
              <InboxIcon
                aria-hidden="true"
                className="mx-auto size-8 text-brand-dark-amaranth/60"
              />
              <p className="mt-3 font-display text-base">Você está em dia.</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Novas respostas e feedbacks aparecerão aqui.
              </p>
            </div>
          )}

          {state === "ready" && items.length > 0 && (
            <div className="space-y-1">
              {items.map((item) => (
                <button
                  className={cn(
                    "block w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    !item.readAt && "bg-accent/45"
                  )}
                  key={item.id}
                  onClick={() => {
                    markReadAndOpen(item).catch(() => undefined);
                  }}
                  type="button"
                >
                  <span className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        item.readAt
                          ? "bg-transparent"
                          : "bg-brand-classic-crimson"
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-sm">
                        {item.title}
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
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
