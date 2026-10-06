const fourDigitYearPattern = /^\d{4}$/;

const dateTimeParts = (value: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(value);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

const utcDate = (year: number, month: number, day: number) => {
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  value.setUTCHours(0, 0, 0, 0);
  return value;
};

const localYearBoundaryInUtc = (year: number, timezone: string) => {
  const targetAsUtc = utcDate(year, 1, 1).getTime();
  let candidate = targetAsUtc;

  // Correct the UTC guess until its local wall-clock value is Jan 1 at 00:00.
  // This keeps database filtering aligned with the year shown to members.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = dateTimeParts(new Date(candidate), timezone);
    const representedAsUtcDate = utcDate(
      Number(parts.year),
      Number(parts.month),
      Number(parts.day)
    );
    representedAsUtcDate.setUTCHours(
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const representedAsUtc = representedAsUtcDate.getTime();
    const correction = targetAsUtc - representedAsUtc;
    candidate += correction;
    if (correction === 0) {
      break;
    }
  }

  return new Date(candidate);
};

export const recordingYearInTimezone = (
  value: Date,
  timezone = "America/Sao_Paulo"
) =>
  new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
  }).format(value);

export const recordingYearRange = (
  year: string,
  timezone = "America/Sao_Paulo"
) => {
  if (!fourDigitYearPattern.test(year)) {
    return null;
  }

  const numericYear = Number(year);
  return {
    gte: localYearBoundaryInUtc(numericYear, timezone),
    lt: localYearBoundaryInUtc(numericYear + 1, timezone),
  };
};
