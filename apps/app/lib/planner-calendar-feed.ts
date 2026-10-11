import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { database } from "@repo/database";
import { getPlannerDashboard } from "./planner";

export interface PlannerCalendarFeedItem {
  allDay?: boolean;
  description?: string | null;
  endsAt: Date;
  location?: string | null;
  startsAt: Date;
  timezone?: string;
  title: string;
  uid: string;
  url?: string | null;
}

type PlannerCalendarData = Awaited<ReturnType<typeof getPlannerDashboard>>;
const CALENDAR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;
const UTC_MILLISECONDS_PATTERN = /\.\d{3}Z$/;
const HTTP_URL_PATTERN = /^https?:\/\//;

const hashFeedToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

export const issuePlannerCalendarFeedToken = async (memberId: string) => {
  const token = randomBytes(32).toString("base64url");
  await database.plannerCalendarFeed.upsert({
    where: { memberId },
    create: { memberId, tokenHash: hashFeedToken(token) },
    update: { tokenHash: hashFeedToken(token) },
    select: { id: true },
  });
  return token;
};

export const memberForPlannerCalendarFeedToken = async (token: string) => {
  if (!CALENDAR_TOKEN_PATTERN.test(token)) {
    return null;
  }
  const feed = await database.plannerCalendarFeed.findUnique({
    where: {
      tokenHash: hashFeedToken(token),
      member: { deactivatedAt: null, onboardingStatus: "COMPLETED" },
    },
    select: { memberId: true },
  });
  return feed?.memberId ?? null;
};

const localDateParts = (date: Date, timezone: string) => {
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
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
};

const fromLocalParts = (
  parts: ReturnType<typeof localDateParts>,
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
    const actual = localDateParts(new Date(guess), timezone);
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

const goalDeadline = (
  period: "WEEKLY" | "MONTHLY",
  date: Date,
  timezone: string
) => {
  const localNow = localDateParts(date, timezone);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  const dayOfWeek =
    ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const)[
      weekday as "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"
    ] ?? 0;
  const endDate =
    period === "WEEKLY"
      ? new Date(
          Date.UTC(
            localNow.year,
            localNow.month - 1,
            localNow.day + ((7 - dayOfWeek) % 7) + 1
          )
        )
      : new Date(Date.UTC(localNow.year, localNow.month, 1));
  const nextMidnight = fromLocalParts(
    {
      year: endDate.getUTCFullYear(),
      month: endDate.getUTCMonth() + 1,
      day: endDate.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timezone
  );
  return new Date(nextMidnight.getTime() - 60_000);
};

const rangeContains = (date: Date, start: Date, end: Date) =>
  date >= start && date <= end;

const goalDeadlineFeedItems = (
  goals: PlannerCalendarData["goals"],
  rangeStart: Date,
  rangeEnd: Date,
  timezone: string,
  absoluteUrl: (path: string) => string
) => {
  const deadlineDates = new Map<string, Date>();
  const startLocal = localDateParts(rangeStart, timezone);
  const endLocal = localDateParts(rangeEnd, timezone);
  for (
    let day = new Date(
      Date.UTC(startLocal.year, startLocal.month - 1, startLocal.day, 12)
    );
    day <=
    new Date(Date.UTC(endLocal.year, endLocal.month - 1, endLocal.day, 12));
    day = new Date(day.getTime() + 86_400_000)
  ) {
    for (const goal of goals) {
      const deadline = goalDeadline(goal.period, day, timezone);
      if (rangeContains(deadline, rangeStart, rangeEnd)) {
        deadlineDates.set(`${goal.id}:${deadline.toISOString()}`, deadline);
      }
    }
  }
  const items: PlannerCalendarFeedItem[] = [];
  for (const [key, deadline] of deadlineDates) {
    const [goalId] = key.split(":");
    const goal = goals.find((item) => item.id === goalId);
    if (!goal) {
      continue;
    }
    items.push({
      uid: `goal-${goal.id}-${deadline.toISOString()}`,
      title: `Meta ${goal.period === "WEEKLY" ? "semanal" : "mensal"}`,
      startsAt: deadline,
      endsAt: new Date(deadline.getTime() + 30 * 60_000),
      allDay: true,
      description: `Meta de ${goal.targetMinutes} minutos no período.`,
      url: absoluteUrl("/planejamento?view=goals"),
    });
  }
  return items;
};

export const getPlannerCalendarFeedItems = async (
  memberId: string,
  rangeStart: Date,
  rangeEnd: Date,
  origin: string
) => {
  const data = await getPlannerDashboard(memberId, {
    start: rangeStart.toISOString(),
    end: rangeEnd.toISOString(),
  });
  const items: PlannerCalendarFeedItem[] = [];
  const absoluteUrl = (path: string) => new URL(path, origin).toString();
  for (const event of data.events) {
    items.push({
      uid: `event-${event.id}-${event.occurrenceKey}`,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      timezone: event.timezone,
      description: event.description,
      location: event.location,
      url: absoluteUrl(
        `/planejamento?view=calendar&event=${encodeURIComponent(event.id)}&occurrence=${encodeURIComponent(event.occurrenceKey)}`
      ),
    });
  }
  for (const meeting of data.meetings) {
    items.push({
      uid: `meeting-${meeting.id}`,
      title: meeting.title,
      startsAt: meeting.startsAt,
      endsAt:
        meeting.endsAt ?? new Date(meeting.startsAt.getTime() + 30 * 60_000),
      timezone: meeting.timezone,
      description: meeting.description,
      url: meeting.joinUrl,
    });
  }
  for (const activity of data.activities) {
    items.push({
      uid: `activity-${activity.id}`,
      title: `Prazo: ${activity.title}`,
      startsAt: activity.dueAt,
      endsAt: new Date(activity.dueAt.getTime() + 30 * 60_000),
      description: `Atividade atribuída no Interprete. Status: ${activity.status}.`,
      url: absoluteUrl(activity.href),
    });
  }
  for (const task of data.tasks) {
    if (!(task.dueAt && rangeContains(task.dueAt, rangeStart, rangeEnd))) {
      continue;
    }
    items.push({
      uid: `task-${task.id}-${task.occurrenceKey ?? task.dueAt.toISOString()}`,
      title: task.title,
      startsAt: task.dueAt,
      endsAt: new Date(task.dueAt.getTime() + 30 * 60_000),
      description: task.description,
      url: absoluteUrl(
        `/planejamento?view=tasks&task=${encodeURIComponent(task.id)}`
      ),
    });
  }
  for (const session of data.studySessions) {
    if (!rangeContains(session.startedAt, rangeStart, rangeEnd)) {
      continue;
    }
    items.push({
      uid: `study-${session.id}`,
      title: session.title,
      startsAt: session.startedAt,
      endsAt: session.endedAt,
      url: absoluteUrl(session.href),
    });
  }
  items.push(
    ...goalDeadlineFeedItems(
      data.goals,
      rangeStart,
      rangeEnd,
      data.preferences.timezone,
      absoluteUrl
    )
  );
  return { items, timezone: data.preferences.timezone };
};

const escapeIcsText = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");

const foldIcsLine = (line: string) => {
  const chunks: string[] = [];
  let chunk = "";
  let byteLength = 0;
  for (const character of line) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (byteLength + characterBytes > 75) {
      chunks.push(chunk);
      chunk = ` ${character}`;
      byteLength = 1 + characterBytes;
    } else {
      chunk += character;
      byteLength += characterBytes;
    }
  }
  chunks.push(chunk);
  return chunks.join("\r\n");
};

const toIcsDateTime = (date: Date) =>
  date
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(UTC_MILLISECONDS_PATTERN, "Z");

const toIcsDate = (date: Date, timezone: string) => {
  const parts = localDateParts(date, timezone);
  return `${String(parts.year).padStart(4, "0")}${String(parts.month).padStart(2, "0")}${String(parts.day).padStart(2, "0")}`;
};

const nextIcsDate = (date: Date, timezone: string) => {
  const parts = localDateParts(date, timezone);
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return `${String(next.getUTCFullYear()).padStart(4, "0")}${String(next.getUTCMonth() + 1).padStart(2, "0")}${String(next.getUTCDate()).padStart(2, "0")}`;
};

export const serializePlannerCalendarFeed = (
  items: readonly PlannerCalendarFeedItem[],
  timezone: string,
  generatedAt = new Date()
) => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Interprete//Planejamento//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText("Interprete · Planejamento")}`,
    `X-WR-TIMEZONE:${escapeIcsText(timezone)}`,
  ];
  for (const item of items) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(item.uid)}@interprete`);
    lines.push(`DTSTAMP:${toIcsDateTime(generatedAt)}`);
    lines.push(`LAST-MODIFIED:${toIcsDateTime(generatedAt)}`);
    if (item.allDay) {
      const itemTimezone = item.timezone ?? timezone;
      const startDate = toIcsDate(item.startsAt, itemTimezone);
      let endDate = toIcsDate(item.endsAt, itemTimezone);
      if (endDate <= startDate) {
        endDate = nextIcsDate(item.startsAt, itemTimezone);
      }
      lines.push(`DTSTART;VALUE=DATE:${startDate}`);
      lines.push(`DTEND;VALUE=DATE:${endDate}`);
    } else {
      lines.push(`DTSTART:${toIcsDateTime(item.startsAt)}`);
      lines.push(`DTEND:${toIcsDateTime(item.endsAt)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(item.title)}`);
    if (item.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(item.description)}`);
    }
    if (item.location) {
      lines.push(`LOCATION:${escapeIcsText(item.location)}`);
    }
    if (item.url && HTTP_URL_PATTERN.test(item.url)) {
      lines.push(`URL:${escapeIcsText(item.url)}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
};
