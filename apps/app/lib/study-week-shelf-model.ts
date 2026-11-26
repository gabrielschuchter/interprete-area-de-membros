/**
 * Modelo puro da "estante da semana": agrupa o tempo de estudo registrado em
 * três prateleiras (aula, leitura, exercícios) por dia. Sem dependências de
 * servidor para poder ser usado no cliente e testado isoladamente.
 */

export const shelfGroups = ["lesson", "reading", "exercise"] as const;
export type ShelfGroup = (typeof shelfGroups)[number];

export const shelfGroupLabels: Record<ShelfGroup, string> = {
  lesson: "Aula",
  reading: "Leitura",
  exercise: "Exercícios",
};

/** Cores dos livros na estante (mesmas do protótipo aprovado). */
export const shelfGroupColors: Record<ShelfGroup, string> = {
  lesson: "#C9A57A",
  reading: "#E2565A",
  exercise: "#E9C3C4",
};

export const MANUAL_SESSION_PREFIX = "manual:";
export const MANUAL_MIN_MINUTES = 1;
export const MANUAL_MAX_MINUTES = 180;
export const MANUAL_MAX_MINUTES_PER_DAY = 480;

export const manualClientSessionId = (group: ShelfGroup, uniqueId: string) =>
  `${MANUAL_SESSION_PREFIX}${group}:${uniqueId}`;

export const parseManualGroup = (
  clientSessionId: string | null | undefined
): ShelfGroup | null => {
  if (!clientSessionId?.startsWith(MANUAL_SESSION_PREFIX)) {
    return null;
  }
  const group = clientSessionId
    .slice(MANUAL_SESSION_PREFIX.length)
    .split(":")[0];
  return (shelfGroups as readonly string[]).includes(group)
    ? (group as ShelfGroup)
    : null;
};

/** Aula, gravação e cronômetro ligado a aula são aula; exercícios e atividades são exercícios. */
export const groupForActivity = (
  activityKind: string,
  clientSessionId: string | null | undefined,
  linkedType?: string | null
): ShelfGroup => {
  const manual = parseManualGroup(clientSessionId);
  if (manual) {
    return manual;
  }
  // Cronômetro pessoal ligado a uma aula conta como aula.
  if (activityKind === "PERSONAL_TIMER" && linkedType === "LESSON") {
    return "lesson";
  }
  switch (activityKind) {
    case "LESSON":
    case "RECORDING":
      return "lesson";
    case "EXERCISE":
    case "ACTIVITY":
      return "exercise";
    default:
      return "reading";
  }
};

export interface ShelfDay {
  readonly dayKey: string;
  readonly future: boolean;
  readonly label: string;
  readonly minutes: Readonly<Record<ShelfGroup, number>>;
  readonly today: boolean;
}

export interface ShelfRow {
  readonly dayKey: string;
  readonly group: ShelfGroup;
  readonly seconds: number;
}

const WEEKDAY_LABELS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

export const shiftDayKey = (key: string, days: number) => {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

export const buildShelfDays = (
  rows: readonly ShelfRow[],
  weekStartKey: string,
  todayKey: string
): ShelfDay[] =>
  WEEKDAY_LABELS.map((label, index) => {
    const dayKey = shiftDayKey(weekStartKey, index);
    const seconds: Record<ShelfGroup, number> = {
      lesson: 0,
      reading: 0,
      exercise: 0,
    };
    for (const row of rows) {
      if (row.dayKey === dayKey) {
        seconds[row.group] += row.seconds;
      }
    }
    return {
      dayKey,
      label,
      today: dayKey === todayKey,
      future: dayKey > todayKey,
      minutes: {
        lesson: Math.floor(seconds.lesson / 60),
        reading: Math.floor(seconds.reading / 60),
        exercise: Math.floor(seconds.exercise / 60),
      },
    };
  });

export const dayTotalMinutes = (day: ShelfDay) =>
  day.minutes.lesson + day.minutes.reading + day.minutes.exercise;

/** Altura (px) do livro: cresce com os minutos e nunca passa do nicho. */
export const bookHeight = (minutes: number, max = 172) =>
  Math.min(max, 34 + minutes * 1.9);

/** Fração de areia que ainda está no bulbo de cima (1 = meta por começar). */
export const hourglassRemainingFraction = (
  studiedMinutes: number,
  targetMinutes: number
) => {
  if (targetMinutes <= 0) {
    return 1;
  }
  return Math.max(
    0,
    Math.min(1, (targetMinutes - studiedMinutes) / targetMinutes)
  );
};

/** Semana ISO (1–53) da segunda-feira que abre a semana. */
export const isoWeekNumber = (weekStartKey: string) => {
  const [year, month, day] = weekStartKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNumber = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    )
  );
};

export const weeklyGoalPresets = (current: number | null) => {
  const base = [180, 300, 420, 600];
  if (current && !base.includes(current)) {
    base.push(current);
    base.sort((a, b) => a - b);
  }
  return base;
};
