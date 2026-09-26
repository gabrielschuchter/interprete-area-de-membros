"use client";

import { cn } from "@repo/design-system/lib/utils";
import { BellIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

type PreferenceKey =
  | "mentions"
  | "commentReplies"
  | "topicComments"
  | "followedTopicActivity"
  | "lessonAvailable"
  | "moduleAvailable"
  | "activityAssigned"
  | "feedbackReceived"
  | "activityDeadline"
  | "announcements";

type Preferences = Record<PreferenceKey, boolean>;

const groups: readonly {
  items: readonly { key: PreferenceKey; label: string }[];
  label: string;
}[] = [
  {
    label: "Comunidade",
    items: [
      { key: "mentions", label: "Menções" },
      { key: "commentReplies", label: "Respostas aos meus comentários" },
      { key: "topicComments", label: "Comentários nos meus tópicos" },
      {
        key: "followedTopicActivity",
        label: "Atualizações de discussões que sigo",
      },
    ],
  },
  {
    label: "Aprendizado",
    items: [
      { key: "lessonAvailable", label: "Novas aulas disponíveis" },
      { key: "moduleAvailable", label: "Novos módulos disponíveis" },
    ],
  },
  {
    label: "Atividades",
    items: [
      { key: "activityAssigned", label: "Nova atividade" },
      { key: "feedbackReceived", label: "Feedback recebido" },
      { key: "activityDeadline", label: "Lembretes de prazo" },
    ],
  },
  {
    label: "Avisos",
    items: [{ key: "announcements", label: "Comunicados dos professores" }],
  },
];

const emptyPreferences: Preferences = {
  activityAssigned: true,
  activityDeadline: true,
  announcements: true,
  commentReplies: true,
  feedbackReceived: true,
  followedTopicActivity: true,
  lessonAvailable: true,
  mentions: true,
  moduleAvailable: true,
  topicComments: true,
};

export const NotificationPreferences = () => {
  const [preferences, setPreferences] = useState<Preferences>(emptyPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PreferenceKey | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/notifications/preferences", {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          preferences?: Preferences;
        };
        if (response.ok && payload.preferences) {
          setPreferences(payload.preferences);
        } else {
          throw new Error("Não foi possível carregar as preferências.");
        }
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar as preferências."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  const update = async (key: PreferenceKey) => {
    const previous = preferences[key];
    const next = !previous;
    setPreferences((current) => ({ ...current, [key]: next }));
    setSaving(key);
    setError("");
    try {
      const response = await fetch("/api/notifications/preferences", {
        body: JSON.stringify({ [key]: next }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!response.ok) {
        throw new Error("Não foi possível salvar a preferência.");
      }
    } catch (updateError) {
      setPreferences((current) => ({ ...current, [key]: previous }));
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Não foi possível salvar a preferência."
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <section
      aria-labelledby="notification-settings-heading"
      className="paper-surface border p-6 shadow-[var(--shadow-paper)] sm:p-8"
      id="notificacoes"
    >
      <div className="flex items-start gap-3">
        <BellIcon
          aria-hidden="true"
          className="mt-1 size-5 shrink-0 text-brand-action"
        />
        <div>
          <p className="brand-eyebrow text-muted-foreground">Preferências</p>
          <h2
            className="mt-3 font-display text-2xl text-foreground"
            id="notification-settings-heading"
          >
            Notificações
          </h2>
          <p className="mt-3 text-muted-foreground text-sm leading-6">
            Escolha quais novidades devem aparecer na central de notificações.
            Menções diretas e respostas importantes respeitam estas
            preferências.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />{" "}
          Carregando preferências…
        </div>
      ) : (
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="font-medium text-sm">{group.label}</h3>
              <div className="mt-3 space-y-3">
                {group.items.map((item) => (
                  <label
                    className="flex cursor-pointer items-center justify-between gap-4 text-sm"
                    key={item.key}
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <button
                      aria-checked={preferences[item.key]}
                      className={cn(
                        "relative h-6 w-10 rounded-full border transition-colors",
                        preferences[item.key]
                          ? "border-brand-action bg-brand-action"
                          : "border-border bg-muted"
                      )}
                      disabled={saving !== null}
                      onClick={() => update(item.key).catch(() => undefined)}
                      role="switch"
                      type="button"
                    >
                      <span
                        className={cn(
                          "absolute top-1 size-4 rounded-full bg-white transition-transform",
                          preferences[item.key]
                            ? "translate-x-5"
                            : "translate-x-1"
                        )}
                      />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="mt-6 text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
