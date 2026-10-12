import type { PlannerRecurrence as PlannerRecurrenceType } from "@repo/database";

const PlannerRecurrence = {
  NONE: "NONE",
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
} satisfies Record<PlannerRecurrenceType, PlannerRecurrenceType>;

const dayMilliseconds = 86_400_000;
const maximumOccurrences = 600;

export const plannerZonedParts = (date: Date, timezone: string) => {
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

export const plannerDateFromZonedParts = (
  values: ReturnType<typeof plannerZonedParts>,
  timezone: string
) => {
  const target = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  );
  let guess = target;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const actual = plannerZonedParts(new Date(guess), timezone);
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

export const plannerOccurrenceAtIndex = (
  first: Date,
  recurrence: PlannerRecurrenceType,
  index: number,
  timezone: string
) => {
  if (recurrence === PlannerRecurrence.NONE || index < 0) {
    return null;
  }

  const parts = plannerZonedParts(first, timezone);
  const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (recurrence === PlannerRecurrence.DAILY) {
    localDate.setUTCDate(localDate.getUTCDate() + index);
  } else if (recurrence === PlannerRecurrence.WEEKLY) {
    localDate.setUTCDate(localDate.getUTCDate() + index * 7);
  } else {
    const monthIndex = parts.year * 12 + parts.month - 1 + index;
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    localDate.setUTCFullYear(year, month, Math.min(parts.day, lastDay));
  }

  return plannerDateFromZonedParts(
    {
      ...parts,
      year: localDate.getUTCFullYear(),
      month: localDate.getUTCMonth() + 1,
      day: localDate.getUTCDate(),
    },
    timezone
  );
};

export const expandPlannerOccurrences = (
  startsAt: Date,
  recurrence: PlannerRecurrenceType,
  recurrenceUntil: Date | null,
  rangeStart: Date,
  rangeEnd: Date,
  timezone: string
) => {
  if (rangeStart > rangeEnd) {
    return [];
  }
  if (recurrence === PlannerRecurrence.NONE) {
    return startsAt >= rangeStart && startsAt <= rangeEnd ? [startsAt] : [];
  }

  const dates: Date[] = [];
  const firstParts = plannerZonedParts(startsAt, timezone);
  const targetParts = plannerZonedParts(rangeStart, timezone);
  const firstDay = Date.UTC(
    firstParts.year,
    firstParts.month - 1,
    firstParts.day
  );
  const targetDay = Date.UTC(
    targetParts.year,
    targetParts.month - 1,
    targetParts.day
  );
  const dayDelta = Math.max(
    0,
    Math.floor((targetDay - firstDay) / dayMilliseconds)
  );
  let index = 0;
  if (recurrence === PlannerRecurrence.DAILY) {
    index = dayDelta;
  } else if (recurrence === PlannerRecurrence.WEEKLY) {
    index = Math.floor(dayDelta / 7);
  } else {
    index = Math.max(
      0,
      (targetParts.year - firstParts.year) * 12 +
        targetParts.month -
        firstParts.month
    );
  }
  let next = plannerOccurrenceAtIndex(startsAt, recurrence, index, timezone);
  let skipCount = 0;
  while (next && next < rangeStart && skipCount < 100_000) {
    index += 1;
    skipCount += 1;
    next = plannerOccurrenceAtIndex(startsAt, recurrence, index, timezone);
  }
  while (
    next &&
    next <= rangeEnd &&
    (!recurrenceUntil || next <= recurrenceUntil) &&
    dates.length < maximumOccurrences
  ) {
    if (next >= rangeStart) {
      dates.push(next);
    }
    index += 1;
    next = plannerOccurrenceAtIndex(startsAt, recurrence, index, timezone);
  }
  return dates;
};

export const firstPlannerOccurrenceOnOrAfter = (
  startsAt: Date,
  recurrence: PlannerRecurrenceType,
  target: Date,
  timezone: string,
  recurrenceUntil: Date | null
) => {
  if (recurrence === PlannerRecurrence.NONE) {
    return startsAt >= target &&
      (!recurrenceUntil || startsAt <= recurrenceUntil)
      ? startsAt
      : null;
  }

  const start = plannerZonedParts(startsAt, timezone);
  const targetParts = plannerZonedParts(target, timezone);
  const startDay = Date.UTC(start.year, start.month - 1, start.day);
  const targetDay = Date.UTC(
    targetParts.year,
    targetParts.month - 1,
    targetParts.day
  );
  const dayDelta = Math.floor((targetDay - startDay) / dayMilliseconds);
  let index = 0;
  if (recurrence === PlannerRecurrence.DAILY) {
    index = Math.max(0, dayDelta);
  } else if (recurrence === PlannerRecurrence.WEEKLY) {
    index = Math.max(0, Math.floor(dayDelta / 7));
  } else {
    index = Math.max(
      0,
      (targetParts.year - start.year) * 12 + targetParts.month - start.month
    );
  }

  let candidate = plannerOccurrenceAtIndex(
    startsAt,
    recurrence,
    index,
    timezone
  );
  while (candidate && candidate < target && index < maximumOccurrences) {
    index += 1;
    candidate = plannerOccurrenceAtIndex(startsAt, recurrence, index, timezone);
  }
  if (
    !candidate ||
    candidate < target ||
    (recurrenceUntil && candidate > recurrenceUntil)
  ) {
    return null;
  }
  return candidate;
};

export const isPlannerSeriesOccurrence = (
  first: Date,
  recurrence: PlannerRecurrenceType,
  occurrenceAt: Date,
  timezone: string,
  recurrenceUntil: Date | null
) =>
  firstPlannerOccurrenceOnOrAfter(
    first,
    recurrence,
    new Date(occurrenceAt.getTime() - 1),
    timezone,
    recurrenceUntil
  )?.getTime() === occurrenceAt.getTime();
