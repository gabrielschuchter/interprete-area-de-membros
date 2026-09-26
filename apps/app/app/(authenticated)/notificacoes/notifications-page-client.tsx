"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import {
  BellIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Filter = "ALL" | "MENTIONS" | "COMMUNITY" | "ACTIVITIES" | "LEARNING";

interface Item {
  readonly actor?: {
    readonly avatarUrl: string | null;
    readonly displayName: string | null;
    readonly profile: {
      readonly avatarUrl: string | null;
      readonly displayName: string | null;
    } | null;
  } | null;
  readonly body: string | null;
  readonly createdAt: string;
  readonly entityId: string | null;
  readonly entityType: string | null;
  readonly groupKey: string | null;
  readonly href: string | null;
  readonly id: string;
  readonly metadata: unknown;
  readonly readAt: string | null;
  readonly seenAt: string | null;
  readonly title: string;
  readonly type: string;
}

interface InitialData {
  readonly items: Item[];
  readonly nextCursor: string | null;
  readonly unreadCount: number;
  readonly unseenCount: number;
}

interface Properties {
  readonly initial: InitialData;
}

const filters: readonly { label: string; value: Filter }[] = [
  { label: "Todas", value: "ALL" },
  { label: "Menções", value: "MENTIONS" },
  { label: "Comunidade", value: "COMMUNITY" },
  { label: "Atividades", value: "ACTIVITIES" },
  { label: "Aprender", value: "LEARNING" },
];

const topicActivitySuffixPattern = /:activity$/;

const periodFor = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const difference = date.getTime() - start.getTime();
  if (difference >= 0) {
    return "Hoje";
  }
  if (difference >= -86_400_000) {
    return "Ontem";
  }
  if (difference >= -7 * 86_400_000) {
    return "Esta semana";
  }
  return "Mais antigas";
};

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const actorName = (item: Item) =>
  item.actor?.profile?.displayName ?? item.actor?.displayName ?? "Interprete";

const displayTitle = (item: Item) => {
  if (item.type === "ANNOUNCEMENT") {
    return item.title;
  }
  const name = actorName(item);
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

const topicIdFromItem = (item: Item) => {
  const metadata = item.metadata;
  if (
    metadata &&
    typeof metadata === "object" &&
    "postId" in metadata &&
    typeof metadata.postId === "string"
  ) {
    return metadata.postId;
  }
  return item.groupKey?.startsWith("topic:")
    ? item.groupKey.slice(6).replace(topicActivitySuffixPattern, "")
    : null;
};

export const NotificationsPageClient = ({ initial }: Properties) => {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [items, setItems] = useState(initial.items);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");

  const grouped = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const item of items) {
      const period = periodFor(item.createdAt);
      groups.set(period, [...(groups.get(period) ?? []), item]);
    }
    return [...groups.entries()];
  }, [items]);

  const loadFilter = async (nextFilter: Filter) => {
    setFilter(nextFilter);
    setMessage("");
    try {
      const response = await fetch(
        `/api/notifications?filter=${nextFilter}&limit=30`,
        { headers: { Accept: "application/json" } }
      );
      const payload = (await response.json()) as {
        error?: string;
        items?: Item[];
        nextCursor?: string | null;
      };
      if (!response.ok) {
        setMessage(payload.error ?? "Não foi possível carregar esse filtro.");
        return;
      }
      setItems(payload.items ?? []);
      setNextCursor(payload.nextCursor ?? null);
    } catch {
      setMessage("Não foi possível carregar esse filtro agora.");
    }
  };

  const loadMore = async () => {
    if (!nextCursor) {
      return;
    }
    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/notifications?filter=${filter}&limit=30&cursor=${encodeURIComponent(nextCursor)}`
      );
      const payload = (await response.json()) as {
        items?: Item[];
        nextCursor?: string | null;
      };
      if (response.ok) {
        setItems((current) => [...current, ...(payload.items ?? [])]);
        setNextCursor(payload.nextCursor ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const setRead = async (item: Item, read: boolean) => {
    await fetch(`/api/notifications/${item.id}`, {
      body: JSON.stringify({ read }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, readAt: read ? new Date().toISOString() : null }
          : entry
      )
    );
  };

  const openItem = async (item: Item) => {
    if (!item.href) {
      return;
    }
    try {
      await setRead(item, true);
    } finally {
      router.push(item.href);
    }
  };

  const mute = async (item: Item) => {
    const topicId = topicIdFromItem(item);
    if (!topicId) {
      return;
    }
    await fetch("/api/notifications/mute", {
      body: JSON.stringify({ muted: true, topicId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setMessage(
      "Discussão silenciada. Menções e respostas diretas continuam chegando."
    );
  };

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto w-full max-w-[960px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <header className="max-w-2xl">
          <p className="brand-eyebrow text-muted-foreground">
            Interprete · Central
          </p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-4xl leading-tight sm:text-5xl">
            Notificações
          </h1>
          <p className="mt-5 text-muted-foreground leading-7">
            Respostas, menções, atividades e novidades importantes da sua
            jornada.
          </p>
        </header>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="tablist">
            {filters.map((entry) => (
              <button
                className={cn(
                  "rounded-full border px-3 py-2 text-sm",
                  filter === entry.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-accent"
                )}
                key={entry.value}
                onClick={() => loadFilter(entry.value).catch(() => undefined)}
                role="tab"
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() =>
                fetch("/api/notifications/read-all", { method: "POST" })
                  .then(() =>
                    setItems((current) =>
                      current.map((item) => ({
                        ...item,
                        readAt: item.readAt ?? new Date().toISOString(),
                      }))
                    )
                  )
                  .catch(() => undefined)
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <CheckCheckIcon aria-hidden="true" /> Marcar todas como lidas
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/configuracoes#notificacoes">
                <SettingsIcon aria-hidden="true" /> Configurar
              </Link>
            </Button>
          </div>
        </div>
        {message && (
          <output className="mt-5 border border-border bg-muted/30 px-4 py-3 text-sm">
            {message}
          </output>
        )}
        <div className="mt-10 space-y-10">
          {grouped.length === 0 && (
            <div className="paper-surface border p-8 text-center sm:p-12">
              <BellIcon
                aria-hidden="true"
                className="mx-auto size-8 text-brand-action"
              />
              <h2 className="mt-4 font-display text-2xl">
                Nenhuma notificação por aqui.
              </h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm leading-6">
                Quando alguém responder, mencionar você ou houver uma novidade
                relevante, ela aparecerá nesta central.
              </p>
            </div>
          )}
          {grouped.map(([period, periodItems]) => (
            <section aria-labelledby={`notifications-${period}`} key={period}>
              <h2
                className="font-display text-2xl"
                id={`notifications-${period}`}
              >
                {period}
              </h2>
              <div className="mt-4 divide-y border-border border-y">
                {periodItems.map((item) => (
                  <div
                    className={cn(
                      "group flex gap-4 px-3 py-4 sm:px-4",
                      !item.readAt && "bg-accent/35"
                    )}
                    key={item.id}
                  >
                    {item.actor?.profile?.avatarUrl ? (
                      // biome-ignore lint/performance/noImgElement: authenticated member asset route.
                      <img
                        alt=""
                        className="size-9 shrink-0 rounded-full object-cover object-center"
                        height={36}
                        src={item.actor.profile.avatarUrl}
                        width={36}
                      />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-xs">
                        {actorName(item).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">
                            {displayTitle(item)}
                          </p>
                          {item.body && (
                            <p className="mt-1 text-muted-foreground text-sm">
                              {item.body}
                            </p>
                          )}
                        </div>
                        {!item.readAt && (
                          <span
                            className="mt-1 size-2 rounded-full bg-brand-classic-crimson"
                            title="Não lida"
                          />
                        )}
                      </div>
                      <p className="mt-2 text-muted-foreground text-xs">
                        {dateLabel(item.createdAt)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                        {item.href && (
                          <Link
                            className="text-primary underline underline-offset-4"
                            href={item.href}
                            onClick={(event) => {
                              event.preventDefault();
                              openItem(item).catch(() =>
                                router.push(item.href ?? "/notificacoes")
                              );
                            }}
                          >
                            Abrir contexto
                          </Link>
                        )}
                        <details className="relative">
                          <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground">
                            <ChevronDownIcon
                              aria-hidden="true"
                              className="size-3"
                            />
                            Opções
                          </summary>
                          <div className="absolute top-6 left-0 z-10 min-w-48 rounded-sm border bg-background p-1 shadow-[var(--shadow-floating)]">
                            <button
                              className="block w-full rounded-sm px-3 py-2 text-left hover:bg-accent"
                              onClick={() =>
                                setRead(item, !item.readAt).catch(
                                  () => undefined
                                )
                              }
                              type="button"
                            >
                              {item.readAt
                                ? "Marcar como não lida"
                                : "Marcar como lida"}
                            </button>
                            {topicIdFromItem(item) && (
                              <button
                                className="block w-full rounded-sm px-3 py-2 text-left hover:bg-accent"
                                onClick={() =>
                                  mute(item).catch(() => undefined)
                                }
                                type="button"
                              >
                                Silenciar esta discussão
                              </button>
                            )}
                            <Link
                              className="block rounded-sm px-3 py-2 hover:bg-accent"
                              href="/configuracoes#notificacoes"
                            >
                              Configurar notificações
                            </Link>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        {nextCursor && (
          <div className="mt-8 flex justify-center">
            <Button
              disabled={loadingMore}
              onClick={() => loadMore().catch(() => undefined)}
              type="button"
              variant="outline"
            >
              {loadingMore && (
                <Loader2Icon aria-hidden="true" className="animate-spin" />
              )}
              Carregar mais
            </Button>
          </div>
        )}
      </div>
    </main>
  );
};
