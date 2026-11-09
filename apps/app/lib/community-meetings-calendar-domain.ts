import {
  plannerDateFromZonedParts,
  plannerZonedParts,
} from "@repo/member-domain";

/** Fuso de referência dos encontros e eventos de turma da escola. */
export const communityCalendarTimezone = "America/Sao_Paulo";

const monthParamPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;
const dayMs = 86_400_000;
const gridDays = 42;

export interface CalendarMonth {
  readonly month: number;
  readonly year: number;
}

export type CommunityCalendarCategory =
  | "cohort"
  | "lesson"
  | "meeting"
  | "workshop";

export interface CommunityCalendarEntry {
  readonly allDay: boolean;
  readonly category: CommunityCalendarCategory;
  readonly courseTitle: string | null;
  /** Dias (AAAA-MM-DD no fuso da escola) em que o item aparece na grade. */
  readonly dateKeys: readonly string[];
  readonly description: string | null;
  readonly endsAt: string | null;
  readonly href: string | null;
  /** Só existe na janela de entrada (15 min antes até o fim). */
  readonly joinUrl: string | null;
  readonly key: string;
  readonly kindLabel: string;
  readonly registered: boolean;
  readonly startsAt: string;
  readonly title: string;
}

export const communityCalendarCategories: readonly {
  readonly id: CommunityCalendarCategory;
  readonly label: string;
}[] = [
  { id: "meeting", label: "Encontros" },
  { id: "lesson", label: "Aulas" },
  { id: "workshop", label: "Workshops" },
  { id: "cohort", label: "Eventos da turma" },
];

const meetingKindLabels: Record<string, string> = {
  FEEDBACK: "Sessão de feedback",
  GROUP: "Encontro em grupo",
  INDIVIDUAL: "Mentoria individual",
  LESSON: "Aula",
  OTHER: "Encontro",
  WORKSHOP: "Workshop",
};

export const meetingKindLabel = (kind: string) =>
  meetingKindLabels[kind] ?? "Encontro";

export const meetingCategory = (kind: string): CommunityCalendarCategory => {
  if (kind === "LESSON") {
    return "lesson";
  }
  if (kind === "WORKSHOP") {
    return "workshop";
  }
  return "meeting";
};

/** Lê `?mes=AAAA-MM`; sem valor válido, usa o mês corrente no fuso da escola. */
export const resolveCalendarMonth = (
  value: string | undefined,
  now = new Date()
): CalendarMonth => {
  const match = value?.match(monthParamPattern);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]) };
  }
  const parts = plannerZonedParts(now, communityCalendarTimezone);
  return { year: parts.year, month: parts.month };
};

export const calendarMonthParam = ({ year, month }: CalendarMonth) =>
  `${year}-${String(month).padStart(2, "0")}`;

export const shiftCalendarMonth = (
  { year, month }: CalendarMonth,
  amount: number
): CalendarMonth => {
  const index = year * 12 + (month - 1) + amount;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

const utcKey = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Seis semanas a partir do domingo anterior ao dia 1, como no planner. */
export const calendarGridDays = ({ year, month }: CalendarMonth) => {
  const first = Date.UTC(year, month - 1, 1);
  const start = first - new Date(first).getUTCDay() * dayMs;
  return Array.from({ length: gridDays }, (_, index) =>
    utcKey(start + index * dayMs)
  );
};

const zonedMidnight = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return plannerDateFromZonedParts(
    {
      year: year ?? 1970,
      month: month ?? 1,
      day: day ?? 1,
      hour: 0,
      minute: 0,
      second: 0,
    },
    communityCalendarTimezone
  );
};

/** Período consultado: da meia-noite do 1º dia da grade até o fim do 42º. */
export const calendarGridRange = (month: CalendarMonth) => {
  const days = calendarGridDays(month);
  const lastDay = days.at(-1) ?? days[0] ?? "1970-01-01";
  const end = utcKey(Date.parse(`${lastDay}T00:00:00Z`) + dayMs);
  return {
    start: zonedMidnight(days[0] ?? lastDay),
    end: zonedMidnight(end),
  };
};

export const zonedDateKey = (date: Date) => {
  const parts = plannerZonedParts(date, communityCalendarTimezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

/**
 * Dias cobertos por um item. Eventos de vários dias aparecem em cada dia;
 * um fim exatamente à meia-noite não ocupa o dia seguinte.
 */
export const entryDateKeys = (
  startsAt: Date,
  endsAt: Date | null,
  visibleDays: ReadonlySet<string>
) => {
  const first = zonedDateKey(startsAt);
  const lastInstant =
    endsAt && endsAt.getTime() > startsAt.getTime()
      ? new Date(endsAt.getTime() - 1)
      : startsAt;
  const last = zonedDateKey(lastInstant);
  const keys: string[] = [];
  let cursor = Date.parse(`${first}T00:00:00Z`);
  const stop = Date.parse(`${last}T00:00:00Z`);
  for (let guard = 0; cursor <= stop && guard < gridDays; guard += 1) {
    const key = utcKey(cursor);
    if (visibleDays.has(key)) {
      keys.push(key);
    }
    cursor += dayMs;
  }
  return keys;
};

const joinWindowMs = 15 * 60_000;

export const isWithinJoinWindow = (
  startsAt: Date,
  endsAt: Date | null,
  now: Date
) => {
  const end = endsAt ?? new Date(startsAt.getTime() + 60 * 60_000);
  return (
    now.getTime() >= startsAt.getTime() - joinWindowMs &&
    now.getTime() <= end.getTime()
  );
};
