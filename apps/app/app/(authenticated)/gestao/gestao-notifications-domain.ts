import type { GestaoIconName } from "./gestao-icon";

export interface GestaoNotificationItem {
  readonly body: string | null;
  readonly createdAt: string;
  readonly entityType?: string | null;
  readonly href: string | null;
  readonly id: string;
  readonly readAt: string | null;
  readonly seenAt: string | null;
  readonly title: string;
  readonly type: string;
}

const iconByEntity: Readonly<Record<string, GestaoIconName>> = {
  ACTIVITY: "inbox",
  ANNOUNCEMENT: "bell",
  BADGE: "star",
  COMMENT: "chat",
  LEARNING_TASK: "checklist",
  LESSON: "book",
  MEETING: "video",
  MODULE: "book",
  SUBMISSION: "inbox",
  TOPIC: "chat",
};

export const gestaoNotificationIcon = (
  item: Pick<GestaoNotificationItem, "entityType">
): GestaoIconName => iconByEntity[item.entityType ?? ""] ?? "bell";

const zone = "America/Sao_Paulo";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: zone });
const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  timeZone: zone,
});
const monthFormat = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: zone,
});
const shortDate = {
  format: (date: Date) =>
    `${dayFormat.format(date)} ${monthFormat.format(date)}`,
};

const minute = 60_000;
const hour = 60 * minute;

/** "agora", "há 25 min", "há 2 h", "ontem" ou "10 out.". */
export const gestaoRelativeTime = (value: string, now = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < minute) {
    return "agora";
  }
  if (elapsed < hour) {
    return `há ${Math.floor(elapsed / minute)} min`;
  }
  const sameDay = dayKey.format(date) === dayKey.format(now);
  if (sameDay) {
    return `há ${Math.floor(elapsed / hour)} h`;
  }
  const yesterday = new Date(now.getTime() - 24 * hour);
  return dayKey.format(date) === dayKey.format(yesterday)
    ? "ontem"
    : shortDate.format(date);
};
