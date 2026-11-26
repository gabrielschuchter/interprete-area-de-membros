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
  EXERCISES: ["questão", "questões"],
};

/** Quais tipos de atividade do rastreio alimentam cada meta. */
export const countGoalActivityKinds = {
  LESSONS: ["LESSON", "RECORDING"],
  READINGS: ["LIBRARY_ITEM"],
  /** Exercícios contam questões respondidas; atividades entram por tempo. */
  EXERCISES_EXTRA: ["ACTIVITY"],
} as const satisfies Record<string, readonly string[]>;

/** Tempo mínimo (s) de um cronômetro ligado a uma aula/leitura e encerrado. */
export const COUNT_GOAL_MIN_LINKED_SECONDS = 10;

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

export const countGoalHelp: Record<CountGoalKind, string> = {
  LESSONS:
    "Conta cada aula diferente que você concluiu ou estudou por pelo menos 1 min na semana.",
  READINGS:
    "Conta cada leitura da biblioteca diferente com pelo menos 1 min de estudo na semana.",
  EXERCISES:
    "Conta cada questão de exercício que você responde na semana, mesmo que rápido.",
};

export type KindCounts = Record<CountGoalKind, number>;

export interface WeekActivityCounts {
  readonly perDay: Readonly<Record<string, KindCounts>>;
  readonly week: KindCounts;
}

export interface TrackedRow {
  readonly activityKind: string;
  readonly dayKey: string;
  readonly resourceId: string;
  readonly seconds: number;
}

export interface LinkedTimerRow {
  readonly dayKey: string;
  readonly linkedType: string;
  readonly resourceId: string;
  readonly seconds: number;
}

export interface WeekActivityInput {
  readonly answersByDay: ReadonlyArray<{
    readonly count: number;
    readonly dayKey: string;
  }>;
  readonly completedLessons: ReadonlyArray<{
    readonly dayKey: string;
    readonly lessonId: string;
  }>;
  readonly linked: readonly LinkedTimerRow[];
  readonly tracked: readonly TrackedRow[];
}

interface Candidate {
  day: string;
  seconds: number;
}

const minDay = (a: string, b: string) => (a < b ? a : b);

/** Soma segundos por recurso e guarda o primeiro dia em que apareceu. */
const collect = <T extends { dayKey: string; seconds: number }>(
  rows: readonly T[],
  pick: (row: T) => string | null
) => {
  const byResource = new Map<string, Candidate>();
  for (const row of rows) {
    const key = pick(row);
    if (!key) {
      continue;
    }
    const current = byResource.get(key);
    byResource.set(key, {
      day: current ? minDay(current.day, row.dayKey) : row.dayKey,
      seconds: (current?.seconds ?? 0) + row.seconds,
    });
  }
  return byResource;
};

const emptyKindCounts = (): KindCounts => ({
  LESSONS: 0,
  READINGS: 0,
  EXERCISES: 0,
});

const include = (
  target: Map<string, string>,
  source: Map<string, Candidate>,
  minSeconds: number
) => {
  for (const [key, candidate] of source) {
    if (candidate.seconds < minSeconds) {
      continue;
    }
    const existing = target.get(key);
    target.set(key, existing ? minDay(existing, candidate.day) : candidate.day);
  }
};

/**
 * Regra única de contagem da semana (metas, estante e card de progresso).
 * Cada aula/leitura/atividade conta uma vez, no primeiro dia em que
 * apareceu, para a soma dos dias bater com o total da semana.
 */
export const aggregateWeekActivity = (
  input: WeekActivityInput
): WeekActivityCounts => {
  const kindOf = (row: TrackedRow, kinds: readonly string[]) =>
    kinds.includes(row.activityKind) ? row.resourceId : null;
  const lessons = new Map<string, string>();
  include(
    lessons,
    collect(input.tracked, (row) =>
      kindOf(row, countGoalActivityKinds.LESSONS)
    ),
    COUNT_GOAL_MIN_SECONDS
  );
  include(
    lessons,
    collect(input.linked, (row) =>
      row.linkedType === "LESSON" ? row.resourceId : null
    ),
    COUNT_GOAL_MIN_LINKED_SECONDS
  );
  for (const item of input.completedLessons) {
    const existing = lessons.get(item.lessonId);
    lessons.set(
      item.lessonId,
      existing ? minDay(existing, item.dayKey) : item.dayKey
    );
  }

  const readings = new Map<string, string>();
  include(
    readings,
    collect(input.tracked, (row) =>
      kindOf(row, countGoalActivityKinds.READINGS)
    ),
    COUNT_GOAL_MIN_SECONDS
  );
  include(
    readings,
    collect(input.linked, (row) =>
      row.linkedType === "LIBRARY_ITEM" ? row.resourceId : null
    ),
    COUNT_GOAL_MIN_LINKED_SECONDS
  );

  const activities = new Map<string, string>();
  include(
    activities,
    collect(input.tracked, (row) =>
      kindOf(row, countGoalActivityKinds.EXERCISES_EXTRA)
    ),
    COUNT_GOAL_MIN_SECONDS
  );

  const perDay: Record<string, KindCounts> = {};
  const week = emptyKindCounts();
  const bump = (day: string, kind: CountGoalKind, amount: number) => {
    perDay[day] ??= emptyKindCounts();
    perDay[day][kind] += amount;
    week[kind] += amount;
  };
  for (const day of lessons.values()) {
    bump(day, "LESSONS", 1);
  }
  for (const day of readings.values()) {
    bump(day, "READINGS", 1);
  }
  for (const day of activities.values()) {
    bump(day, "EXERCISES", 1);
  }
  for (const item of input.answersByDay) {
    if (item.count > 0) {
      bump(item.dayKey, "EXERCISES", item.count);
    }
  }
  return { perDay, week };
};

/** Junta as contagens da semana com as metas salvas de cada tipo. */
export const mergeCountGoals = (
  goals: ReadonlyArray<{ readonly kind: string; readonly target: number }>,
  week: KindCounts
): CountGoalsOverview => {
  const overview = emptyCountGoals();
  for (const kind of countGoalKinds) {
    overview[kind] = {
      done: week[kind],
      target: goals.find((goal) => goal.kind === kind)?.target ?? null,
    };
  }
  return overview;
};

/** "3 aulas · 1 leitura · 10 questões", só o que tem valor. */
export const weekActivitySummary = (week: KindCounts) => {
  const parts = countGoalKinds
    .filter((kind) => week[kind] > 0)
    .map((kind) => `${week[kind]} ${countGoalUnit(kind, week[kind])}`);
  return parts.length > 0 ? parts.join(" · ") : "Nada registrado ainda";
};
