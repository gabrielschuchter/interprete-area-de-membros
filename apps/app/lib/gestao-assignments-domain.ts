import type { LearningAssignmentTargetType } from "@repo/database";

export const assignmentTabs = [
  ["active", "Ativas"],
  ["scheduled", "Agendadas"],
  ["closed", "Encerradas"],
] as const;

export type AssignmentTab = (typeof assignmentTabs)[number][0];

export const assignmentTypeLabels: Record<
  LearningAssignmentTargetType,
  string
> = {
  ACTIVITY: "Atividade",
  ASSET: "Material de aula",
  COURSE: "Curso",
  EXERCISE_LIST: "Lista de exercícios",
  LESSON: "Aula",
  LIBRARY_ITEM: "Material da biblioteca",
  MODULE: "Módulo",
  RECORDING: "Gravação",
};

export const assignmentDueOptions = [
  ["with", "Com prazo"],
  ["without", "Sem prazo"],
  ["late", "Atrasadas"],
] as const;

export type AssignmentDue = (typeof assignmentDueOptions)[number][0];

export const parseAssignmentTab = (value: string | undefined): AssignmentTab =>
  assignmentTabs.find(([key]) => key === value)?.[0] ?? "active";

export const parseAssignmentType = (
  value: string | undefined
): LearningAssignmentTargetType | null =>
  (Object.keys(assignmentTypeLabels) as LearningAssignmentTargetType[]).find(
    (type) => type === value
  ) ?? null;

export const parseAssignmentDue = (
  value: string | undefined
): AssignmentDue | null =>
  assignmentDueOptions.find(([key]) => key === value)?.[0] ?? null;

export type AssignmentStateKey =
  | "active"
  | "done"
  | "expired"
  | "late"
  | "revoked"
  | "scheduled";

export interface AssignmentState {
  readonly key: AssignmentStateKey;
  readonly label: string;
  readonly tab: AssignmentTab;
}

export const assignmentState = (
  input: {
    readonly availableAt: Date | null;
    readonly completed: number;
    readonly dueAt: Date | null;
    readonly expiresAt: Date | null;
    readonly live: number;
  },
  now: Date
): AssignmentState => {
  if (input.live === 0) {
    return { key: "revoked", label: "Revogada", tab: "closed" };
  }
  if (input.expiresAt && input.expiresAt <= now) {
    return { key: "expired", label: "Encerrada", tab: "closed" };
  }
  if (input.completed >= input.live) {
    return { key: "done", label: "Concluída", tab: "closed" };
  }
  if (input.availableAt && input.availableAt > now) {
    return { key: "scheduled", label: "Agendada", tab: "scheduled" };
  }
  if (input.dueAt && input.dueAt < now) {
    return { key: "late", label: "Atrasada", tab: "active" };
  }
  return { key: "active", label: "Ativa", tab: "active" };
};

export interface GestaoAssignmentRow {
  readonly availableAt: Date | null;
  readonly completed: number;
  readonly createdAt: Date;
  readonly dueAt: Date | null;
  readonly expiresAt: Date | null;
  readonly id: string;
  readonly live: number;
  readonly message: string | null;
  readonly recipientNames: readonly string[];
  readonly recipients: string;
  readonly state: AssignmentState;
  readonly targetHref: string | null;
  readonly title: string;
  readonly total: number;
  readonly type: LearningAssignmentTargetType;
}

export const matchesAssignmentDue = (
  row: Pick<GestaoAssignmentRow, "dueAt" | "state">,
  due: AssignmentDue | null
) => {
  if (!due) {
    return true;
  }
  if (due === "late") {
    return row.state.key === "late";
  }
  return due === "with" ? row.dueAt !== null : row.dueAt === null;
};

export const assignmentIconName = (
  type: LearningAssignmentTargetType
): "book" | "checklist" | "file" | "inbox" | "play" => {
  switch (type) {
    case "ACTIVITY":
      return "inbox";
    case "COURSE":
    case "MODULE":
      return "book";
    case "LESSON":
    case "RECORDING":
      return "play";
    case "EXERCISE_LIST":
      return "checklist";
    default:
      return "file";
  }
};
