import type { PlannerRecurrence as PlannerRecurrenceType } from "@repo/database";
import { expandPlannerOccurrences } from "@repo/member-domain/recurrence";

const PlannerRecurrence = {
  NONE: "NONE",
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
} satisfies Record<PlannerRecurrenceType, PlannerRecurrenceType>;

export const cohortCalendarTimezone = "America/Sao_Paulo";
export const cohortCalendarEventColors = [
  "#8C1535",
  "#410230",
  "#6B5B64",
  "#B0785A",
] as const;

export const cohortCalendarMonthGridLength = (year: number, month: number) => {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
};

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u;

const zonedParts = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
};

const dateFromZonedParts = (
  parts: ReturnType<typeof zonedParts>,
  timezone: string
) => {
  const target = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  let guess = target;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const actual = zonedParts(new Date(guess), timezone);
    guess +=
      target -
      Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
        actual.second
      );
  }
  return new Date(guess);
};

export const parseCohortCalendarDateTime = (
  value: string,
  options: { readonly allDay?: boolean; readonly timezone?: string } = {}
) => {
  const match = localDateTimePattern.exec(value);
  if (!match) {
    return null;
  }
  const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = options.allDay ? 0 : Number(hourValue);
  const minute = options.allDay ? 0 : Number(minuteValue);
  if (
    year < 1000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  const timezone = options.timezone ?? cohortCalendarTimezone;
  try {
    const result = dateFromZonedParts(
      { year, month, day, hour, minute, second: 0 },
      timezone
    );
    const roundTrip = zonedParts(result, timezone);
    if (
      roundTrip.year !== year ||
      roundTrip.month !== month ||
      roundTrip.day !== day ||
      roundTrip.hour !== hour ||
      roundTrip.minute !== minute
    ) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
};

export const cohortCalendarEventLastDate = (
  event: {
    readonly allDay: boolean;
    readonly endsAt: Date | null;
    readonly startsAt: Date;
  },
  timezone = cohortCalendarTimezone
) => cohortCalendarEventDateRange(event, timezone).last;

export const cohortCalendarEventDateRange = (
  event: {
    readonly allDay: boolean;
    readonly endsAt: Date | null;
    readonly startsAt: Date;
  },
  timezone = cohortCalendarTimezone
) => {
  const eventTimezone = event.allDay ? cohortCalendarTimezone : timezone;
  const first = zonedParts(event.startsAt, eventTimezone);
  const last = zonedParts(event.endsAt ?? event.startsAt, eventTimezone);
  let { year, month, day } = last;
  if (
    !event.allDay &&
    event.endsAt &&
    last.hour === 0 &&
    last.minute === 0 &&
    last.second === 0 &&
    event.endsAt.getMilliseconds() === 0
  ) {
    const previous = new Date(Date.UTC(year, month - 1, day - 1));
    year = previous.getUTCFullYear();
    month = previous.getUTCMonth() + 1;
    day = previous.getUTCDate();
  }
  return {
    first: `${first.year}-${String(first.month).padStart(2, "0")}-${String(first.day).padStart(2, "0")}`,
    last: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
};

export type CohortCalendarItemType =
  | "event"
  | "meeting"
  | "activity"
  | "lesson-release";

export interface CohortCalendarConflictCandidate {
  readonly allDay: boolean;
  readonly endsAt: Date | null;
  readonly id: string;
  readonly sourceType?: CohortCalendarItemType;
  readonly startsAt: Date;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readonly title: string;
}

export interface CohortCalendarDateConflict {
  readonly day: string;
  readonly eventCount: number;
  readonly sourceCounts: Partial<Record<CohortCalendarItemType, number>>;
  readonly titles: readonly string[];
}

const calendarDateKey = (value: Date) => {
  const parts = zonedParts(value, cohortCalendarTimezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};
const utcDateKey = (value: Date) =>
  `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;

export const resolveCohortCalendarDateConflicts = (
  candidates: readonly CohortCalendarConflictCandidate[],
  range: { readonly end: Date; readonly start: Date }
): CohortCalendarDateConflict[] => {
  if (
    Number.isNaN(range.start.valueOf()) ||
    Number.isNaN(range.end.valueOf()) ||
    range.end <= range.start
  ) {
    return [];
  }

  const firstVisibleDay = calendarDateKey(range.start);
  const lastVisibleDay = calendarDateKey(new Date(range.end.getTime() - 1));
  const eventsByDay = new Map<
    string,
    Map<
      string,
      {
        readonly sourceType: CohortCalendarItemType;
        readonly startsAt: Date;
        readonly title: string;
      }
    >
  >();

  for (const candidate of candidates) {
    if (candidate.status !== "PUBLISHED") {
      continue;
    }
    const eventRange = cohortCalendarEventDateRange(candidate);
    const firstDay =
      eventRange.first < firstVisibleDay ? firstVisibleDay : eventRange.first;
    const lastDay =
      eventRange.last > lastVisibleDay ? lastVisibleDay : eventRange.last;
    if (firstDay > lastDay) {
      continue;
    }

    const [year, month, day] = firstDay.split("-").map(Number);
    const cursor = new Date(Date.UTC(year, month - 1, day));
    while (utcDateKey(cursor) <= lastDay) {
      const dayKey = utcDateKey(cursor);
      const events = eventsByDay.get(dayKey) ?? new Map();
      events.set(candidate.id, {
        startsAt: candidate.startsAt,
        title: candidate.title,
        sourceType: candidate.sourceType ?? "event",
      });
      eventsByDay.set(dayKey, events);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return [...eventsByDay.entries()]
    .filter(([, events]) => events.size > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, events]) => ({
      day,
      eventCount: events.size,
      sourceCounts: Object.fromEntries(
        [...events.values()].reduce((counts, event) => {
          counts.set(event.sourceType, (counts.get(event.sourceType) ?? 0) + 1);
          return counts;
        }, new Map<CohortCalendarItemType, number>())
      ) as Partial<Record<CohortCalendarItemType, number>>,
      titles: [...events.values()]
        .sort(
          (left, right) =>
            left.startsAt.getTime() - right.startsAt.getTime() ||
            left.title.localeCompare(right.title)
        )
        .map(({ title }) => title),
    }));
};

export const isCohortCalendarEventColor = (
  value: string
): value is (typeof cohortCalendarEventColors)[number] =>
  cohortCalendarEventColors.some((color) => color === value);

export interface CohortCalendarException {
  readonly cancelledAt: Date | null;
  readonly colorOverride?: string | null;
  readonly descriptionOverride: string | null;
  readonly endsAtOverride: Date | null;
  readonly occurrenceStartsAt: Date;
  readonly startsAtOverride: Date | null;
  readonly titleOverride: string | null;
  readonly version?: number;
}

export interface CohortCalendarSource {
  readonly allDay?: boolean;
  readonly color?: string;
  readonly description: string | null;
  readonly endsAt: Date | null;
  readonly exceptions?: readonly CohortCalendarException[];
  readonly href: string;
  readonly id: string;
  readonly recurrence?: PlannerRecurrenceType;
  readonly recurrenceRule?: string | null;
  readonly recurrenceUntil?: Date | null;
  readonly sourceRevision?: number | string;
  readonly sourceType: CohortCalendarItemType;
  readonly startsAt: Date;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readonly timezone?: string;
  readonly title: string;
}

export interface CohortCalendarItem {
  readonly allDay: boolean;
  readonly cancelled: boolean;
  readonly color: string;
  readonly description: string | null;
  readonly endsAt: Date | null;
  readonly exceptionVersion: number | null;
  readonly href: string;
  readonly id: string;
  readonly occurrenceKey: string | null;
  readonly recurrence: PlannerRecurrenceType;
  readonly sourceId: string;
  readonly sourceRevision: number | string | null;
  readonly sourceType: CohortCalendarItemType;
  readonly startsAt: Date;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readonly timezone: string;
  readonly title: string;
}

export const filterCohortCalendarItems = <
  T extends Pick<CohortCalendarItem, "sourceType">,
>(
  items: readonly T[],
  visibleTypes: readonly CohortCalendarItemType[]
) => {
  const visibleTypeSet = new Set(visibleTypes);
  return items.filter((item) => visibleTypeSet.has(item.sourceType));
};

const dailyMeetingRecurrencePattern =
  /^(?:DAILY|FREQ=DAILY|RRULE:FREQ=DAILY|DIÁRIO|DIÁRIA|DIARIA|DIARIAMENTE)$/u;
const weeklyMeetingRecurrencePattern =
  /^(?:WEEKLY|FREQ=WEEKLY|RRULE:FREQ=WEEKLY|SEMANAL|SEMANALMENTE)$/u;
const monthlyMeetingRecurrencePattern =
  /^(?:MONTHLY|FREQ=MONTHLY|RRULE:FREQ=MONTHLY|MENSAL|MENSALMENTE)$/u;

export const meetingRecurrenceFromRule = (
  rule: string | null | undefined
): PlannerRecurrenceType => {
  const value = rule?.trim().toLocaleUpperCase("pt-BR") ?? "";
  if (dailyMeetingRecurrencePattern.test(value)) {
    return PlannerRecurrence.DAILY;
  }
  if (weeklyMeetingRecurrencePattern.test(value)) {
    return PlannerRecurrence.WEEKLY;
  }
  if (monthlyMeetingRecurrencePattern.test(value)) {
    return PlannerRecurrence.MONTHLY;
  }
  return PlannerRecurrence.NONE;
};

const calendarSourceRecurrence = (source: CohortCalendarSource) => {
  if (source.sourceType === "meeting") {
    return meetingRecurrenceFromRule(source.recurrenceRule);
  }
  return source.recurrence ?? PlannerRecurrence.NONE;
};

const calendarSourceOccurrences = (
  source: CohortCalendarSource,
  recurrence: PlannerRecurrenceType,
  exceptions: readonly CohortCalendarException[],
  range: { readonly end: Date; readonly start: Date },
  timezone: string
) => {
  if (recurrence === PlannerRecurrence.NONE) {
    const endsAt = source.endsAt ?? source.startsAt;
    return source.startsAt < range.end && endsAt >= range.start
      ? [source.startsAt]
      : [];
  }
  const duration = source.endsAt
    ? Math.max(0, source.endsAt.getTime() - source.startsAt.getTime())
    : 0;
  const occurrences = expandPlannerOccurrences(
    source.startsAt,
    recurrence,
    source.recurrenceUntil ?? null,
    new Date(range.start.getTime() - duration),
    range.end,
    timezone
  );
  const movedOccurrences = exceptions
    .filter(
      (exception) =>
        exception.startsAtOverride &&
        exception.startsAtOverride < range.end &&
        (exception.endsAtOverride ?? exception.startsAtOverride) >= range.start
    )
    .map((exception) => exception.occurrenceStartsAt);
  return [
    ...new Map(
      [...occurrences, ...movedOccurrences].map((date) => [
        date.toISOString(),
        date,
      ])
    ).values(),
  ].sort((left, right) => left.getTime() - right.getTime());
};

const cohortCalendarItemColor = (sourceType: CohortCalendarItemType) => {
  switch (sourceType) {
    case "meeting":
      return "#8C1535";
    case "activity":
      return "#410230";
    case "lesson-release":
      return "#B0785A";
    default:
      return "#6B5B64";
  }
};

const resolveCohortCalendarOccurrence = (
  source: CohortCalendarSource,
  recurrence: PlannerRecurrenceType,
  occurrenceStart: Date,
  exception: CohortCalendarException | undefined,
  range: { readonly end: Date; readonly start: Date },
  timezone: string
): CohortCalendarItem | null => {
  const shift = occurrenceStart.getTime() - source.startsAt.getTime();
  const startsAt = exception?.startsAtOverride ?? occurrenceStart;
  const endsAt =
    exception?.endsAtOverride ??
    (source.endsAt ? new Date(source.endsAt.getTime() + shift) : null);
  if (startsAt >= range.end || (endsAt ?? startsAt) < range.start) {
    return null;
  }
  return {
    id: `${source.sourceType}:${source.id}:${occurrenceStart.toISOString()}`,
    sourceId: source.id,
    sourceRevision: source.sourceRevision ?? null,
    sourceType: source.sourceType,
    title: exception?.titleOverride ?? source.title,
    description: exception?.descriptionOverride ?? source.description,
    startsAt,
    endsAt,
    exceptionVersion: exception?.version ?? null,
    allDay: source.allDay ?? false,
    color:
      exception?.colorOverride ??
      source.color ??
      cohortCalendarItemColor(source.sourceType),
    status: source.status,
    href: source.href,
    recurrence,
    occurrenceKey:
      recurrence === PlannerRecurrence.NONE
        ? null
        : occurrenceStart.toISOString(),
    cancelled: Boolean(exception?.cancelledAt),
    timezone,
  };
};

const resolveCohortCalendarSource = (
  source: CohortCalendarSource,
  range: { readonly end: Date; readonly start: Date }
) => {
  const timezone = source.timezone ?? cohortCalendarTimezone;
  const recurrence = calendarSourceRecurrence(source);
  const exceptions = new Map(
    (source.exceptions ?? []).map((exception) => [
      exception.occurrenceStartsAt.toISOString(),
      exception,
    ])
  );
  return calendarSourceOccurrences(
    source,
    recurrence,
    source.exceptions ?? [],
    range,
    timezone
  ).flatMap((occurrenceStart) => {
    const item = resolveCohortCalendarOccurrence(
      source,
      recurrence,
      occurrenceStart,
      exceptions.get(occurrenceStart.toISOString()),
      range,
      timezone
    );
    return item ? [item] : [];
  });
};

export const resolveCohortCalendarItems = (
  sources: readonly CohortCalendarSource[],
  range: { readonly end: Date; readonly start: Date }
): CohortCalendarItem[] => {
  if (
    Number.isNaN(range.start.valueOf()) ||
    Number.isNaN(range.end.valueOf()) ||
    range.end <= range.start
  ) {
    return [];
  }

  const items = sources.flatMap((source) =>
    resolveCohortCalendarSource(source, range)
  );
  return items.sort(
    (left, right) =>
      left.startsAt.getTime() - right.startsAt.getTime() ||
      left.title.localeCompare(right.title) ||
      left.id.localeCompare(right.id)
  );
};
