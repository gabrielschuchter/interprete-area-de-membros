const TIME_ZONE = "America/Sao_Paulo";
const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

interface DateTimeParts {
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly month: number;
  readonly second: number;
  readonly year: number;
}

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const dateTimePartsAt = (date: Date): DateTimeParts => {
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)])
  ) as Record<string, number>;
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
};

const wallClockEpoch = (parts: DateTimeParts) => {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  return date.valueOf();
};

const sameMinute = (left: DateTimeParts, right: DateTimeParts) =>
  left.year === right.year &&
  left.month === right.month &&
  left.day === right.day &&
  left.hour === right.hour &&
  left.minute === right.minute;

/** Convert a datetime-local value as Sao Paulo wall time, independent of host TZ. */
export const parseAnnouncementDateTime = (value: string): Date | null => {
  const match = localDateTimePattern.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute] = match;
  const wallParts: DateTimeParts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: 0,
  };
  const wallEpoch = wallClockEpoch(wallParts);
  const normalizedWall = new Date(wallEpoch);
  if (
    !Number.isFinite(wallEpoch) ||
    normalizedWall.getUTCFullYear() !== wallParts.year ||
    normalizedWall.getUTCMonth() + 1 !== wallParts.month ||
    normalizedWall.getUTCDate() !== wallParts.day ||
    normalizedWall.getUTCHours() !== wallParts.hour ||
    normalizedWall.getUTCMinutes() !== wallParts.minute ||
    wallParts.hour > 23 ||
    wallParts.minute > 59
  ) {
    return null;
  }

  // Sao Paulo offsets have 15-minute granularity. Searching that bounded
  // offset range also rejects nonexistent wall times and picks the earlier
  // instant if a future timezone rule ever makes a local time ambiguous.
  const matches: number[] = [];
  for (
    let offsetMinutes = -14 * 60;
    offsetMinutes <= 14 * 60;
    offsetMinutes += 15
  ) {
    const candidate = wallEpoch - offsetMinutes * 60_000;
    if (sameMinute(dateTimePartsAt(new Date(candidate)), wallParts)) {
      matches.push(candidate);
    }
  }
  return matches.length > 0 ? new Date(Math.min(...matches)) : null;
};

export const announcementDateTimeForInput = (value: Date | null) => {
  if (!value) {
    return "";
  }
  const parts = dateTimePartsAt(value);
  return (
    [
      String(parts.year).padStart(4, "0"),
      String(parts.month).padStart(2, "0"),
      String(parts.day).padStart(2, "0"),
    ].join("-") +
    `T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
  );
};

export const announcementTimeZone = TIME_ZONE;
