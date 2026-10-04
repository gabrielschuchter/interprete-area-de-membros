type Recurrence = "DAILY" | "MONTHLY" | "ONCE" | "WEEKLY";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
  year: "numeric",
});

export const studyLocalDayKey = (date: Date) => dayFormatter.format(date);

export const localStudyDayStart = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 3));
};

export const shiftStudyLocalDay = (key: string, days: number) => {
  const date = localStudyDayStart(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const studyWeekStartKey = (today: string) => {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};

export const studyPeriodKey = (recurrence: Recurrence, now = new Date()) => {
  const today = studyLocalDayKey(now);
  if (recurrence === "ONCE") {
    return "once";
  }
  if (recurrence === "DAILY") {
    return `day:${today}`;
  }
  if (recurrence === "MONTHLY") {
    return `month:${today.slice(0, 7)}`;
  }
  return `week:${studyWeekStartKey(today)}`;
};

export const currentStudyStreakDays = (
  activeDays: readonly string[],
  today: string
) => {
  const days = new Set(activeDays);
  let expected = days.has(today) ? today : shiftStudyLocalDay(today, -1);
  if (!days.has(expected)) {
    return 0;
  }
  let streak = 0;
  while (days.has(expected)) {
    streak += 1;
    expected = shiftStudyLocalDay(expected, -1);
  }
  return streak;
};
