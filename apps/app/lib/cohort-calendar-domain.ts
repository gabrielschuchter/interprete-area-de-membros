export const cohortCalendarTimezone = "America/Sao_Paulo";
export const cohortCalendarEventColors = [
  "#8C1535",
  "#410230",
  "#6B5B64",
  "#B0785A",
] as const;

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

export const isCohortCalendarEventColor = (
  value: string
): value is (typeof cohortCalendarEventColors)[number] =>
  cohortCalendarEventColors.some((color) => color === value);
