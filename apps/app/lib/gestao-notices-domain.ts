export type GestaoNoticeState = "draft" | "ended" | "published" | "scheduled";
export type GestaoNoticeTab = "all" | GestaoNoticeState;
export type GestaoNoticeAudienceKind = "all" | "cohorts" | "people" | "staff";

export const gestaoNoticeTabs: readonly (readonly [GestaoNoticeTab, string])[] =
  [
    ["all", "Todos"],
    ["published", "Publicados"],
    ["scheduled", "Agendados"],
    ["draft", "Rascunhos"],
    ["ended", "Encerrados"],
  ];

export const gestaoNoticeAudienceOptions: readonly (readonly [
  GestaoNoticeAudienceKind,
  string,
])[] = [
  ["all", "Todos os membros"],
  ["cohorts", "Turmas"],
  ["people", "Pessoas"],
  ["staff", "Equipe"],
];

export const gestaoNoticeStateLabels: Record<GestaoNoticeState, string> = {
  draft: "Rascunho",
  ended: "Encerrado",
  published: "Publicado",
  scheduled: "Agendado",
};

export const gestaoNoticeTabFromParam = (value: string | undefined) =>
  gestaoNoticeTabs.find(([key]) => key === value)?.[0] ?? "all";

export const gestaoNoticeAudienceFromParam = (value: string | undefined) =>
  gestaoNoticeAudienceOptions.find(([key]) => key === value)?.[0] ?? null;

interface NoticeStateInput {
  readonly endsAt: Date | null;
  readonly startsAt: Date | null;
  readonly status: "ARCHIVED" | "DRAFT" | "PUBLISHED";
}

/** Rascunho nunca aparece; arquivado ou vencido está encerrado. */
export const gestaoNoticeState = (
  notice: NoticeStateInput,
  now = new Date()
): GestaoNoticeState => {
  if (notice.status === "DRAFT") {
    return "draft";
  }
  if (notice.status === "ARCHIVED" || (notice.endsAt && notice.endsAt <= now)) {
    return "ended";
  }
  if (notice.startsAt && notice.startsAt > now) {
    return "scheduled";
  }
  return "published";
};

const zone = "America/Sao_Paulo";
const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  timeZone: zone,
});
const monthFormat = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: zone,
});
const clockFormat = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  timeZone: zone,
});
const isoDayFormat = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: zone,
  year: "numeric",
});

const dayKey = (date: Date) => isoDayFormat.format(date);
const monthLabel = (date: Date) => monthFormat.format(date);
const shortDay = (date: Date) =>
  `${dayFormat.format(date)} ${monthLabel(date)}`;

const hourLabel = (date: Date) => {
  const [hours, minutes] = clockFormat.format(date).split(":");
  return minutes === "00" ? `${hours}h` : `${hours}h${minutes}`;
};

const isMidnight = (date: Date) => clockFormat.format(date) === "00:00";

/** "1 a 17 out.", "10 out., 06h–08h", "a partir de 10 out.", "Sem período". */
export const gestaoNoticePeriodLabel = (
  startsAt: Date | null,
  endsAt: Date | null
) => {
  if (startsAt && endsAt) {
    if (dayKey(startsAt) === dayKey(endsAt)) {
      return isMidnight(startsAt)
        ? shortDay(startsAt)
        : `${shortDay(startsAt)}, ${hourLabel(startsAt)}–${hourLabel(endsAt)}`;
    }
    return monthLabel(startsAt) === monthLabel(endsAt)
      ? `${dayFormat.format(startsAt)} a ${shortDay(endsAt)}`
      : `${shortDay(startsAt)} a ${shortDay(endsAt)}`;
  }
  if (startsAt) {
    return `a partir de ${shortDay(startsAt)}`;
  }
  if (endsAt) {
    return `até ${shortDay(endsAt)}`;
  }
  return "Sem período";
};

/** Valor de `<input type="date">` no fuso de Brasília. */
export const gestaoNoticeDateInput = (date: Date | null) =>
  date ? dayKey(date) : "";

/** Início do dia (00:00) em Brasília; o Brasil não tem horário de verão. */
export const gestaoNoticeStartOfDay = (value: string) => {
  const date = new Date(`${value}T00:00:00-03:00`);
  return Number.isFinite(date.valueOf()) ? date : null;
};

/** Fim do dia (23:59:59) em Brasília. */
export const gestaoNoticeEndOfDay = (value: string) => {
  const date = new Date(`${value}T23:59:59-03:00`);
  return Number.isFinite(date.valueOf()) ? date : null;
};

const maxLinkLength = 500;

/** Rotas da plataforma (começam com uma barra) ou endereços http(s). */
export const gestaoNoticeHref = (value: string) => {
  const href = value.trim();
  if (!href) {
    return { ok: true as const, value: null };
  }
  if (href.startsWith("/") && !href.startsWith("//")) {
    return { ok: true as const, value: href.slice(0, maxLinkLength) };
  }
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:"
      ? { ok: true as const, value: url.toString().slice(0, maxLinkLength) }
      : { ok: false as const };
  } catch {
    return { ok: false as const };
  }
};

export const gestaoNoticeAudienceLabel = ({
  audience,
  cohortNames,
  people,
}: {
  readonly audience: "ALL" | "COHORT" | "SELECTED" | "STAFF";
  readonly cohortNames: readonly string[];
  readonly people: number;
}) => {
  if (audience === "ALL") {
    return "Todos os membros";
  }
  if (audience === "STAFF") {
    return "Equipe";
  }
  if (cohortNames.length > 0) {
    const [first, ...rest] = cohortNames;
    return rest.length > 0 ? `${first} e mais ${rest.length}` : (first ?? "");
  }
  if (audience === "COHORT") {
    return "Turmas";
  }
  return `${people} ${people === 1 ? "pessoa" : "pessoas"}`;
};

export const gestaoNoticeAudienceKind = ({
  audience,
  cohortNames,
}: {
  readonly audience: "ALL" | "COHORT" | "SELECTED" | "STAFF";
  readonly cohortNames: readonly string[];
}): GestaoNoticeAudienceKind => {
  if (audience === "ALL") {
    return "all";
  }
  if (audience === "STAFF") {
    return "staff";
  }
  return audience === "COHORT" || cohortNames.length > 0 ? "cohorts" : "people";
};
