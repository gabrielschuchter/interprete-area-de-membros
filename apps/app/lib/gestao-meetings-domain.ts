import {
  meetingRecurrenceFromRule,
  parseCohortCalendarDateTime,
} from "./cohort-calendar-domain";
import { getYoutubeVideoId, getYoutubeWatchUrl } from "./youtube-video";

export type GestaoMeetingState =
  | "archived"
  | "draft"
  | "published"
  | "scheduled";
export type GestaoMeetingTab = "agenda" | "drafts" | "past" | "published";
export type GestaoMeetingRecurrence = "DAILY" | "MONTHLY" | "NONE" | "WEEKLY";

export const gestaoMeetingTabs: readonly (readonly [
  GestaoMeetingTab,
  string,
])[] = [
  ["agenda", "Agenda"],
  ["drafts", "Rascunhos"],
  ["published", "Publicados"],
  ["past", "Passados"],
];

export const gestaoMeetingTabFromParam = (
  value: string | undefined
): GestaoMeetingTab =>
  gestaoMeetingTabs.find(([key]) => key === value)?.[0] ?? "agenda";

export const gestaoMeetingStateLabels: Record<GestaoMeetingState, string> = {
  archived: "Arquivado",
  draft: "Rascunho",
  published: "Publicado",
  scheduled: "Agendado",
};

export const gestaoMeetingKinds = [
  ["INDIVIDUAL", "Mentoria"],
  ["LESSON", "Aula"],
  ["GROUP", "Encontro em grupo"],
  ["WORKSHOP", "Workshop"],
  ["FEEDBACK", "Sessão de feedback"],
  ["OTHER", "Outro"],
] as const;

export const gestaoMeetingTimezones: readonly (readonly [string, string])[] = [
  ["America/Sao_Paulo", "Brasília (America/São Paulo)"],
  ["America/Manaus", "Manaus (America/Manaus)"],
  ["America/Fortaleza", "Fortaleza (America/Fortaleza)"],
  ["America/Rio_Branco", "Rio Branco (America/Rio Branco)"],
  ["America/Noronha", "Fernando de Noronha (America/Noronha)"],
  ["Europe/Lisbon", "Lisboa (Europe/Lisbon)"],
  ["America/New_York", "Nova York (America/New York)"],
  ["UTC", "Tempo universal (UTC)"],
];

export const gestaoMeetingTimezoneOptions = (current: string) =>
  gestaoMeetingTimezones.some(([value]) => value === current)
    ? gestaoMeetingTimezones
    : [...gestaoMeetingTimezones, [current, current] as const];

export const gestaoMeetingTimezoneIsValid = (value: string) => {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

const weekdayPlurals = [
  "aos domingos",
  "às segundas",
  "às terças",
  "às quartas",
  "às quintas",
  "às sextas",
  "aos sábados",
];

const zonedFormat = (timezone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: timezone });

const partsOf = (date: Date, timezone: string) => {
  const parts = zonedFormat(timezone, {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return {
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    month: pick("month"),
    year: pick("year"),
  };
};

/** Valores de `<input type="date">` e `<input type="time">` no fuso do encontro. */
export const gestaoMeetingInputParts = (date: Date, timezone: string) => {
  const parts = partsOf(date, timezone);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
};

export const gestaoMeetingWeekday = (date: Date, timezone: string) => {
  const name = zonedFormat(timezone, { weekday: "short" }).format(date);
  const index = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].findIndex(
    (item) => name.toLowerCase().startsWith(item.slice(0, 3))
  );
  return Math.max(0, index);
};

export const gestaoMeetingRecurrenceOptions = (
  startsAt: Date,
  timezone: string
): readonly (readonly [GestaoMeetingRecurrence, string])[] => {
  const weekday = weekdayPlurals[gestaoMeetingWeekday(startsAt, timezone)];
  const day = Number(partsOf(startsAt, timezone).day);
  return [
    ["NONE", "Não repetir"],
    ["DAILY", "Todo dia"],
    ["WEEKLY", `Toda semana, ${weekday}`],
    ["MONTHLY", `Todo mês, no dia ${day}`],
  ];
};

export const gestaoMeetingRecurrence = (
  rule: string | null | undefined
): GestaoMeetingRecurrence => meetingRecurrenceFromRule(rule);

/** Combina `AAAA-MM-DD` e `HH:MM` no fuso do encontro. */
export const gestaoMeetingDateTime = (
  date: string,
  time: string,
  timezone: string
) =>
  date && time
    ? parseCohortCalendarDateTime(`${date}T${time}`, { timezone })
    : null;

const monthShort = (date: Date, timezone: string) =>
  zonedFormat(timezone, { month: "short" })
    .format(date)
    .replace(".", "")
    .slice(0, 3);

export const gestaoMeetingTile = (date: Date, timezone: string) => ({
  day: String(Number(partsOf(date, timezone).day)),
  month: monthShort(date, timezone),
});

export const gestaoMeetingHourLabel = (date: Date, timezone: string) => {
  const { hour, minute } = partsOf(date, timezone);
  return minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
};

export const gestaoMeetingState = (
  meeting: {
    readonly publishedAt: Date | null;
    readonly status: "ARCHIVED" | "DRAFT" | "PUBLISHED";
  },
  now = new Date()
): GestaoMeetingState => {
  if (meeting.status === "ARCHIVED") {
    return "archived";
  }
  if (meeting.status === "PUBLISHED") {
    return "published";
  }
  return meeting.publishedAt && meeting.publishedAt > now
    ? "scheduled"
    : "draft";
};

interface TimingInput {
  readonly endsAt: Date | null;
  readonly recurrenceRule: string | null;
  readonly recurrenceUntil: Date | null;
  readonly startsAt: Date;
}

/** Encontros que se repetem sem data final continuam "próximos". */
export const gestaoMeetingIsUpcoming = (
  meeting: TimingInput,
  now = new Date()
) => {
  if (gestaoMeetingRecurrence(meeting.recurrenceRule) !== "NONE") {
    return !meeting.recurrenceUntil || meeting.recurrenceUntil >= now;
  }
  return (meeting.endsAt ?? meeting.startsAt) >= now;
};

export const gestaoMeetingTabMatches = (
  tab: GestaoMeetingTab,
  state: GestaoMeetingState,
  upcoming: boolean
) => {
  if (tab === "drafts") {
    return state === "draft" || state === "scheduled";
  }
  if (tab === "published") {
    return state === "published" && upcoming;
  }
  if (tab === "past") {
    return state === "archived" || !upcoming;
  }
  return state !== "archived" && upcoming;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export const gestaoMeetingAudienceLabel = ({
  cohorts,
  courseTitle,
  people,
}: {
  readonly cohorts: readonly string[];
  readonly courseTitle: string | null;
  readonly people: number;
}) => {
  const [first] = cohorts;
  if (first && cohorts.length === 1 && people === 0) {
    return first;
  }
  if (cohorts.length === 0 && people > 0) {
    return plural(people, "participante", "participantes");
  }
  if (cohorts.length > 0) {
    const turmas = plural(cohorts.length, "turma", "turmas");
    return people > 0
      ? `${turmas} e ${plural(people, "aluno", "alunos")}`
      : turmas;
  }
  return courseTitle ? "alunos do curso" : "todos os membros";
};

export const gestaoMeetingSubline = (input: {
  readonly audience: string;
  readonly courseTitle: string | null;
  readonly hour: string;
}) =>
  [
    input.hour,
    "online",
    input.audience,
    input.courseTitle ? `curso: ${input.courseTitle}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

/** Aceita só links do YouTube; devolve o endereço normalizado. */
export const gestaoMeetingRecording = (value: string) => {
  const input = value.trim();
  if (!input) {
    return { ok: true as const, value: null };
  }
  const id = getYoutubeVideoId(input);
  const url = id ? getYoutubeWatchUrl(id) : null;
  return url ? { ok: true as const, value: url } : { ok: false as const };
};

const maxLink = 2000;

export const gestaoMeetingJoinUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? { ok: true as const, value: url.toString().slice(0, maxLink) }
      : { ok: false as const };
  } catch {
    return { ok: false as const };
  }
};
