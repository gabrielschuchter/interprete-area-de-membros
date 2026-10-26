export type TaskRecurrence = "DAILY" | "MONTHLY" | "ONCE" | "WEEKLY";

export const taskRecurrenceLabels: Record<TaskRecurrence, string> = {
  DAILY: "Diária",
  MONTHLY: "Mensal",
  ONCE: "Uma vez",
  WEEKLY: "Semanal",
};

export const taskStateOptions = [
  ["active", "Ativo"],
  ["scheduled", "Agendado"],
  ["closed", "Encerrada"],
] as const;

export type TaskStateKey = (typeof taskStateOptions)[number][0];

export const taskState = (
  task: {
    readonly archivedAt: Date | null;
    readonly dueAt: Date | null;
    readonly recurrence: TaskRecurrence;
    readonly startsAt: Date;
  },
  now: Date
): { readonly key: TaskStateKey; readonly label: string } => {
  if (task.archivedAt) {
    return { key: "closed", label: "Arquivada" };
  }
  if (task.startsAt > now) {
    return { key: "scheduled", label: "Agendado" };
  }
  if (task.dueAt && task.dueAt < now) {
    return { key: "closed", label: "Encerrada" };
  }
  return { key: "active", label: "Ativo" };
};

export const parseTaskState = (value: string | undefined) =>
  taskStateOptions.find(([key]) => key === value)?.[0] ?? null;

export const parseTaskRecurrence = (
  value: string | undefined
): TaskRecurrence | null =>
  (Object.keys(taskRecurrenceLabels) as TaskRecurrence[]).find(
    (key) => key === value
  ) ?? null;

export type CampaignStateKey =
  | "archived"
  | "closed"
  | "draft"
  | "running"
  | "scheduled";

export const campaignState = (
  campaign: {
    readonly archivedAt: Date | null;
    readonly endsAt: Date;
    readonly publishedAt: Date | null;
    readonly startsAt: Date;
  },
  now: Date
): { readonly key: CampaignStateKey; readonly label: string } => {
  if (campaign.archivedAt) {
    return { key: "archived", label: "Arquivada" };
  }
  if (!campaign.publishedAt) {
    return { key: "draft", label: "Rascunho" };
  }
  if (campaign.startsAt > now) {
    return { key: "scheduled", label: "Agendada" };
  }
  if (campaign.endsAt < now) {
    return { key: "closed", label: "Encerrada" };
  }
  return { key: "running", label: "Em andamento" };
};

const dayMs = 86_400_000;

export const campaignKind = (startsAt: Date, endsAt: Date) => {
  const days = (endsAt.getTime() - startsAt.getTime()) / dayMs;
  if (days <= 8) {
    return "Semanal";
  }
  return days >= 27 && days <= 32 ? "Mensal" : "Período";
};

const hourFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const formatHours = (minutes: number) =>
  hourFormat.format(Math.round((minutes / 60) * 10) / 10);
