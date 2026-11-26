/** Metas por quantidade, ao lado da meta em minutos. Regras puras, sem banco. */

export const countGoalKinds = ["LESSONS", "READINGS", "EXERCISES"] as const;
export type CountGoalKind = (typeof countGoalKinds)[number];

export const COUNT_GOAL_MAX = 1000;
/** Tempo mínimo (s) para um recurso contar como estudado na meta. */
export const COUNT_GOAL_MIN_SECONDS = 60;

export const countGoalLabels: Record<CountGoalKind, string> = {
  LESSONS: "Aulas",
  READINGS: "Leituras",
  EXERCISES: "Exercícios",
};

export const countGoalUnits: Record<CountGoalKind, [string, string]> = {
  LESSONS: ["aula", "aulas"],
  READINGS: ["leitura", "leituras"],
  EXERCISES: ["exercício", "exercícios"],
};

/** Quais tipos de atividade do rastreio alimentam cada meta. */
export const countGoalActivityKinds: Record<CountGoalKind, string[]> = {
  LESSONS: ["LESSON", "RECORDING"],
  READINGS: ["LIBRARY_ITEM"],
  EXERCISES: ["EXERCISE", "ACTIVITY"],
};

const basePresets: Record<CountGoalKind, number[]> = {
  LESSONS: [3, 5, 8, 12],
  READINGS: [2, 4, 6, 10],
  EXERCISES: [5, 10, 20, 30],
};

export const countGoalPresets = (kind: CountGoalKind, current: number | null) =>
  [...new Set([...basePresets[kind], ...(current ? [current] : [])])].sort(
    (a, b) => a - b
  );

export const countGoalUnit = (kind: CountGoalKind, amount: number) =>
  countGoalUnits[kind][amount === 1 ? 0 : 1];

export interface CountGoalState {
  readonly done: number;
  readonly target: number | null;
}

export type CountGoalsOverview = Record<CountGoalKind, CountGoalState>;

export const emptyCountGoals = (): CountGoalsOverview => ({
  LESSONS: { done: 0, target: null },
  READINGS: { done: 0, target: null },
  EXERCISES: { done: 0, target: null },
});

export const isCountGoalKind = (value: unknown): value is CountGoalKind =>
  typeof value === "string" &&
  (countGoalKinds as readonly string[]).includes(value);

export type GoalMode = "MINUTES" | CountGoalKind;

export interface GoalProgress {
  readonly hasGoal: boolean;
  readonly percent: number;
  readonly reached: boolean;
  readonly remaining: number;
  readonly studied: number;
  readonly target: number;
  readonly title: string;
  readonly unit: string;
  readonly unitTotal: string;
}

const unitFor = (mode: GoalMode, amount: number) =>
  mode === "MINUTES" ? "min" : countGoalUnit(mode, amount);

/** Progresso da meta semanal no tipo escolhido (minutos ou quantidade). */
export const goalProgress = (
  mode: GoalMode,
  minutes: { readonly studied: number; readonly target: number | null },
  counts: CountGoalsOverview
): GoalProgress => {
  const state = mode === "MINUTES" ? minutes : counts[mode];
  const studied = mode === "MINUTES" ? minutes.studied : counts[mode].done;
  const target = state.target ?? 0;
  const hasGoal = target > 0;
  const remaining = hasGoal ? Math.max(0, target - studied) : 0;
  const reached = hasGoal && studied >= target;
  let title = "Defina sua meta";
  if (hasGoal) {
    title = reached
      ? "Meta batida"
      : `Faltam ${remaining.toLocaleString("pt-BR")} ${unitFor(mode, remaining)}`;
  }
  return {
    hasGoal,
    percent: hasGoal ? Math.min(100, Math.round((studied / target) * 100)) : 0,
    remaining,
    reached,
    studied,
    target,
    title,
    unit: unitFor(mode, remaining),
    unitTotal: unitFor(mode, target),
  };
};
