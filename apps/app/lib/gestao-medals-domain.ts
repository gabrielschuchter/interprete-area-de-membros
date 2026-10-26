import type { BadgeCriterion, ContentStatus } from "@repo/database";

export const medalCriterionLabels: Record<BadgeCriterion, string> = {
  ACTIVITIES_COMPLETED: "Atividades entregues",
  COMMUNITY_PUBLICATIONS: "Publicações na comunidade",
  EXERCISE_ANSWERS: "Questões respondidas",
  LEARNING_PATHS_COMPLETED: "Trilhas concluídas",
  LESSONS_COMPLETED: "Aulas concluídas",
  MEETINGS_ATTENDED: "Encontros com presença confirmada",
  STUDY_GOALS_MET: "Metas de estudo atingidas",
  STUDY_MINUTES: "Minutos estudados",
  STUDY_STREAK_DAYS: "Dias consecutivos de estudo",
  TASKS_COMPLETED: "Tarefas concluídas",
};

export const medalStatusLabel = (status: ContentStatus) => {
  if (status === "PUBLISHED") {
    return "Publicado";
  }
  return status === "ARCHIVED" ? "Arquivado" : "Rascunho";
};

export const medalStatusTone = (status: ContentStatus) => {
  if (status === "PUBLISHED") {
    return "active";
  }
  return status === "ARCHIVED" ? "muted" : "neutral";
};

export type MedalView = "lista" | "museu";

export const parseMedalView = (value: string | undefined): MedalView =>
  value === "lista" ? "lista" : "museu";

export const parseMedalStatus = (
  value: string | undefined
): ContentStatus | null => {
  if (value === "publicado") {
    return "PUBLISHED";
  }
  if (value === "rascunho") {
    return "DRAFT";
  }
  return value === "arquivado" ? "ARCHIVED" : null;
};

/** "AULAS CONCLUÍDAS · 7" como aparece sob o nome da medalha. */
export const medalCriterionLine = (
  criterion: BadgeCriterion,
  threshold: number
) => `${medalCriterionLabels[criterion]} · ${threshold}`;

export const conquestLabel = (count: number) =>
  `${count} ${count === 1 ? "conquista" : "conquistas"}`;
