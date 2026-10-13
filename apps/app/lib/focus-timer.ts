import "server-only";

import { randomUUID } from "node:crypto";
import {
  database,
  FocusTimerMode,
  Prisma,
  StudyActivityKind,
  StudyGoalPeriod,
} from "@repo/database";
import { z } from "zod";
import { defaultTimerSettings } from "./focus-timer-settings";
import { getPublishedLearningPaths } from "./learning";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const preferencesSchema = z.object({
  focusMinutes: z.number().int().min(1).max(180),
  shortBreakMinutes: z.number().int().min(1).max(60),
  longBreakMinutes: z.number().int().min(1).max(90),
  longBreakEvery: z.number().int().min(2).max(8),
  timerSoundEnabled: z.boolean(),
  systemNotificationsEnabled: z.boolean(),
  timerSoundType: z.enum(["SOFT_BELL", "WOOD", "DIGITAL", "NONE"]),
  timerVolume: z.number().int().min(0).max(100),
  timerTickEnabled: z.boolean(),
  timerVibrationEnabled: z.boolean(),
  timerAutoAdvance: z.boolean(),
  timerOpenFocusOnStart: z.boolean(),
  keepScreenAwake: z.boolean(),
  timezone: z.string().trim().min(1).max(80),
});

type TimerDurationSettings = Pick<
  z.infer<typeof preferencesSchema>,
  "focusMinutes" | "shortBreakMinutes" | "longBreakMinutes"
>;

const configuredTimerDurationSeconds = (
  mode: FocusTimerMode,
  preferences: TimerDurationSettings
) => {
  switch (mode) {
    case FocusTimerMode.FOCUS:
    case FocusTimerMode.COUNTDOWN:
      return preferences.focusMinutes * 60;
    case FocusTimerMode.SHORT_BREAK:
      return preferences.shortBreakMinutes * 60;
    case FocusTimerMode.LONG_BREAK:
      return preferences.longBreakMinutes * 60;
    default:
      return null;
  }
};

type TimerSession = Prisma.FocusTimerSessionGetPayload<{
  include: { segments: true };
}>;

const elapsedSecondsAt = (session: TimerSession, at: Date) => {
  const currentRun = session.runStartedAt
    ? Math.max(
        0,
        Math.floor((at.getTime() - session.runStartedAt.getTime()) / 1000)
      )
    : 0;
  return session.elapsedBeforePause + currentRun;
};

const timerExpiredAt = (session: TimerSession) => {
  if (!session.durationSeconds) {
    return null;
  }
  const elapsed = session.elapsedBeforePause;
  const remaining = session.durationSeconds - elapsed;
  if (remaining <= 0) {
    return session.pausedAt ? session.pausedAt : session.updatedAt;
  }
  if (!session.runStartedAt) {
    return null;
  }
  return new Date(session.runStartedAt.getTime() + remaining * 1000);
};

const startOfDayInTimezone = (date: Date, timezone: string) => {
  const options = {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  } as const;
  const partsAt = (value: Date) =>
    new Intl.DateTimeFormat("en-US", options).formatToParts(value);
  const read = (
    parts: Intl.DateTimeFormatPart[],
    type: Intl.DateTimeFormatPartTypes
  ) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const localParts = partsAt(date);
  const year = read(localParts, "year");
  const month = read(localParts, "month");
  const day = read(localParts, "day");
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const actual = partsAt(new Date(guess));
    guess +=
      target -
      Date.UTC(
        read(actual, "year"),
        read(actual, "month") - 1,
        read(actual, "day"),
        read(actual, "hour"),
        read(actual, "minute"),
        read(actual, "second")
      );
  }
  return new Date(guess);
};

const localMidnight = (
  year: number,
  month: number,
  day: number,
  timezone: string
) => {
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  const options = {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  } as const;
  const value = (
    parts: Intl.DateTimeFormatPart[],
    type: Intl.DateTimeFormatPartTypes
  ) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(
      new Date(guess)
    );
    guess +=
      target -
      Date.UTC(
        value(parts, "year"),
        value(parts, "month") - 1,
        value(parts, "day"),
        value(parts, "hour"),
        value(parts, "minute"),
        value(parts, "second")
      );
  }
  return new Date(guess);
};

const createStudyIntervals = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  session: TimerSession,
  endAt: Date
) => {
  if (
    session.mode !== FocusTimerMode.FOCUS &&
    session.mode !== FocusTimerMode.COUNTDOWN &&
    session.mode !== FocusTimerMode.STOPWATCH
  ) {
    return null;
  }
  const spans = session.segments
    .map((segment) => ({
      startedAt: segment.startedAt,
      endedAt: segment.endedAt ?? endAt,
    }))
    .filter((segment) => segment.endedAt > segment.startedAt);
  const intervalRows: Prisma.StudyActivityIntervalCreateManyInput[] = [];
  let sequence = 0;
  for (const span of spans) {
    let cursor = span.startedAt;
    let secondsLeft = Math.floor(
      (span.endedAt.getTime() - cursor.getTime()) / 1000
    );
    while (secondsLeft > 0) {
      const seconds = Math.min(30, secondsLeft);
      const endedAt = new Date(cursor.getTime() + seconds * 1000);
      intervalRows.push({
        memberId,
        sessionId: "",
        sequence,
        startedAt: cursor,
        endedAt,
        seconds,
        isPlayback: false,
      });
      sequence += 1;
      secondsLeft -= seconds;
      cursor = endedAt;
    }
  }
  if (intervalRows.length === 0) {
    return null;
  }
  const startedAt = spans[0]?.startedAt ?? session.startedAt;
  const tracking = await transaction.studyTrackingSession.create({
    data: {
      memberId,
      clientSessionId: session.id,
      activityKind: StudyActivityKind.PERSONAL_TIMER,
      resourceId: session.id,
      lastSequence: intervalRows.length - 1,
      lastHeartbeatAt: endAt,
      startedAt,
      endedAt: endAt,
    },
    select: { id: true },
  });
  await transaction.studyActivityInterval.createMany({
    data: intervalRows.map((interval) => ({
      ...interval,
      sessionId: tracking.id,
    })),
  });
  return tracking.id;
};

const closeSession = async (
  transaction: Prisma.TransactionClient,
  session: TimerSession,
  memberId: string,
  endedAt: Date,
  completed: boolean
) => {
  const elapsed = Math.max(0, elapsedSecondsAt(session, endedAt));
  await transaction.focusTimerSessionSegment.updateMany({
    where: { sessionId: session.id, memberId, endedAt: null },
    data: { endedAt },
  });
  const snapshot = await transaction.focusTimerSession.findFirstOrThrow({
    where: { id: session.id, memberId, endedAt: null },
    include: { segments: { orderBy: { startedAt: "asc" } } },
  });
  const studySessionId = await createStudyIntervals(
    transaction,
    memberId,
    snapshot,
    endedAt
  );
  await transaction.focusTimerSession.updateMany({
    where: { id: session.id, memberId, endedAt: null },
    data: {
      endedAt,
      completedAt: completed ? endedAt : null,
      elapsedBeforePause: elapsed,
      pausedAt: session.pausedAt ?? null,
      runStartedAt: null,
      needsReview: false,
      studyLoggedAt: studySessionId ? endedAt : null,
    },
  });
  return {
    id: session.id,
    mode: session.mode,
    endedAt: endedAt.toISOString(),
    completed,
    elapsedSeconds: session.durationSeconds
      ? Math.min(session.durationSeconds, elapsed)
      : elapsed,
  };
};

const finishIfExpired = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  session: TimerSession,
  now: Date
) => {
  if (!session.durationSeconds) {
    return null;
  }
  const elapsed = elapsedSecondsAt(session, now);
  if (elapsed < session.durationSeconds) {
    return null;
  }
  const expiry = timerExpiredAt(session) ?? now;
  const completed = await closeSession(
    transaction,
    session,
    memberId,
    expiry,
    true
  );
  if (
    session.mode !== FocusTimerMode.FOCUS &&
    session.mode !== FocusTimerMode.SHORT_BREAK &&
    session.mode !== FocusTimerMode.LONG_BREAK
  ) {
    return completed;
  }
  const preferences = await transaction.plannerPreferences.findUnique({
    where: { memberId },
    select: {
      timerAutoAdvance: true,
      focusMinutes: true,
      shortBreakMinutes: true,
      longBreakMinutes: true,
      longBreakEvery: true,
      timezone: true,
    },
  });
  if (!preferences) {
    return completed;
  }

  let nextMode: FocusTimerMode;
  if (session.mode === FocusTimerMode.FOCUS) {
    const startOfDay = startOfDayInTimezone(expiry, preferences.timezone);
    const todayFocusCount = await transaction.focusTimerSession.count({
      where: {
        memberId,
        mode: FocusTimerMode.FOCUS,
        completedAt: { not: null },
        endedAt: { gte: startOfDay, lte: expiry },
      },
    });
    nextMode =
      todayFocusCount % preferences.longBreakEvery === 0
        ? FocusTimerMode.LONG_BREAK
        : FocusTimerMode.SHORT_BREAK;
  } else {
    nextMode = FocusTimerMode.FOCUS;
  }
  const durationSeconds = configuredTimerDurationSeconds(nextMode, preferences);
  if (durationSeconds === null) {
    throw new Error(
      "A próxima fase do cronômetro não tem duração configurada."
    );
  }
  if (!preferences.timerAutoAdvance) {
    return { ...completed, nextMode, nextDurationSeconds: durationSeconds };
  }
  const nextSession = await transaction.focusTimerSession.create({
    data: {
      memberId,
      clientId: session.clientId,
      mode: nextMode,
      durationSeconds,
      startedAt: expiry,
      runStartedAt: expiry,
    },
  });
  await transaction.focusTimerSessionSegment.create({
    data: { memberId, sessionId: nextSession.id, startedAt: expiry },
  });
  return completed;
};

const snapshot = (session: TimerSession, now: Date) => {
  const elapsedSeconds = elapsedSecondsAt(session, now);
  return {
    id: session.id,
    clientId: session.clientId,
    mode: session.mode,
    title: session.title,
    durationSeconds: session.durationSeconds,
    elapsedSeconds: session.durationSeconds
      ? Math.min(session.durationSeconds, elapsedSeconds)
      : elapsedSeconds,
    remainingSeconds: session.durationSeconds
      ? Math.max(0, session.durationSeconds - elapsedSeconds)
      : null,
    startedAt: session.startedAt.toISOString(),
    runStartedAt: session.runStartedAt?.toISOString() ?? null,
    pausedAt: session.pausedAt?.toISOString() ?? null,
    linkedResourceType: session.linkedResourceType,
    linkedResourceId: session.linkedResourceId,
  };
};

const ensureTimerDefaults = async (memberId: string) => {
  await database.plannerPreferences.createMany({
    data: [{ memberId, timezone: DEFAULT_TIMEZONE }],
    skipDuplicates: true,
  });
};

const getTimerSettings = async (
  transaction: Prisma.TransactionClient,
  memberId: string
) =>
  (await transaction.plannerPreferences.findUnique({
    where: { memberId },
    select: {
      focusMinutes: true,
      shortBreakMinutes: true,
      longBreakMinutes: true,
      longBreakEvery: true,
      timerSoundEnabled: true,
      systemNotificationsEnabled: true,
      timerSoundType: true,
      timerVolume: true,
      timerTickEnabled: true,
      timerVibrationEnabled: true,
      timerAutoAdvance: true,
      timerOpenFocusOnStart: true,
      keepScreenAwake: true,
      timezone: true,
    },
  })) ?? defaultTimerSettings;

export const getFocusTimerLinkResources = async (memberId: string) => {
  const paths = await getPublishedLearningPaths(memberId);
  return paths.flatMap((path) =>
    path.courses.flatMap((course) =>
      course.modules.flatMap((module) =>
        module.lessons.map((lesson, index) => ({
          id: lesson.id,
          type: "LESSON" as const,
          title: lesson.title,
          shortLabel: `Aula ${index + 1}`,
          context: `${course.title} · ${module.title}`,
          href: `/aprender/cursos/${course.slug}/${lesson.slug}`,
        }))
      )
    )
  );
};

export const getFocusTimerState = (memberId: string) => {
  return database.$transaction(async (transaction) => {
    const now = new Date();
    let current = await transaction.focusTimerSession.findFirst({
      where: { memberId, endedAt: null },
      include: { segments: { orderBy: { startedAt: "asc" } } },
    });
    let completed: Awaited<ReturnType<typeof closeSession>> | null = null;
    if (current) {
      completed = await finishIfExpired(transaction, memberId, current, now);
      if (completed) {
        current = await transaction.focusTimerSession.findFirst({
          where: { memberId, endedAt: null },
          include: { segments: { orderBy: { startedAt: "asc" } } },
        });
      }
    }
    const [settings, history] = await Promise.all([
      getTimerSettings(transaction, memberId),
      transaction.focusTimerSession.findMany({
        where: { memberId, endedAt: { not: null }, needsReview: false },
        orderBy: { endedAt: "desc" },
        take: 100,
        select: {
          id: true,
          mode: true,
          title: true,
          linkedResourceType: true,
          linkedResourceId: true,
          durationSeconds: true,
          elapsedBeforePause: true,
          startedAt: true,
          endedAt: true,
          completedAt: true,
          sessionNote: true,
          manuallyEntered: true,
        },
      }),
    ]);
    const pendingReview = await transaction.focusTimerSession.findFirst({
      where: { memberId, endedAt: { not: null }, needsReview: true },
      orderBy: { endedAt: "desc" },
      select: {
        id: true,
        mode: true,
        title: true,
        linkedResourceType: true,
        linkedResourceId: true,
        elapsedBeforePause: true,
        startedAt: true,
        endedAt: true,
        sessionNote: true,
      },
    });
    const statsRange = await transaction.focusTimerSession.aggregate({
      where: {
        memberId,
        endedAt: { gte: new Date(now.getTime() - 30 * 86_400_000) },
        needsReview: false,
        mode: {
          in: [
            FocusTimerMode.FOCUS,
            FocusTimerMode.COUNTDOWN,
            FocusTimerMode.STOPWATCH,
          ],
        },
      },
      _sum: { elapsedBeforePause: true },
      _count: { _all: true },
    });
    const localParts = new Intl.DateTimeFormat("en-US", {
      timeZone: settings.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const localNumber = (type: Intl.DateTimeFormatPartTypes) =>
      Number(localParts.find((part) => part.type === type)?.value ?? 0);
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: settings.timezone,
      weekday: "short",
    }).format(now);
    const daysFromMonday =
      ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as const)[
        weekday as "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"
      ] ?? 0;
    const weekStartPlain = new Date(
      Date.UTC(
        localNumber("year"),
        localNumber("month") - 1,
        localNumber("day") - daysFromMonday
      )
    );
    const weekEndPlain = new Date(weekStartPlain.getTime() + 7 * 86_400_000);
    const weekStart = localMidnight(
      weekStartPlain.getUTCFullYear(),
      weekStartPlain.getUTCMonth() + 1,
      weekStartPlain.getUTCDate(),
      settings.timezone
    );
    const weekEnd = localMidnight(
      weekEndPlain.getUTCFullYear(),
      weekEndPlain.getUTCMonth() + 1,
      weekEndPlain.getUTCDate(),
      settings.timezone
    );
    const [dailyRows, weeklyGoal, byLinkRows] = await Promise.all([
      transaction.$queryRaw<
        Array<{ dayKey: string; seconds: number; sessions: number }>
      >(Prisma.sql`
        SELECT
          TO_CHAR((study_interval."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${settings.timezone}, 'YYYY-MM-DD') AS "dayKey",
          SUM(study_interval."seconds")::int AS "seconds",
          COUNT(DISTINCT study_interval."sessionId")::int AS "sessions"
        FROM "StudyActivityInterval" AS study_interval
        WHERE study_interval."memberId" = ${memberId}
          AND study_interval."isPlayback" = false
          AND study_interval."startedAt" >= ${weekStart}
          AND study_interval."startedAt" < ${weekEnd}
        GROUP BY "dayKey"
        ORDER BY "dayKey"
      `),
      transaction.studyGoal.findUnique({
        where: {
          memberId_period: { memberId, period: StudyGoalPeriod.WEEKLY },
        },
        select: { targetMinutes: true },
      }),
      transaction.focusTimerSession.groupBy({
        by: ["linkedResourceId"],
        where: {
          memberId,
          endedAt: { not: null },
          needsReview: false,
          mode: {
            in: [
              FocusTimerMode.FOCUS,
              FocusTimerMode.COUNTDOWN,
              FocusTimerMode.STOPWATCH,
            ],
          },
        },
        orderBy: { _sum: { elapsedBeforePause: "desc" } },
        take: 8,
        _sum: { elapsedBeforePause: true },
        _count: { _all: true },
      }),
    ]);
    const dailyByKey = new Map(dailyRows.map((row) => [row.dayKey, row]));
    const last7Days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStartPlain.getTime() + index * 86_400_000);
      const dayKey = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
      const row = dailyByKey.get(dayKey);
      return {
        dayKey,
        seconds: row?.seconds ?? 0,
        sessions: row?.sessions ?? 0,
      };
    });
    const weeklyStudySeconds = last7Days.reduce(
      (total, day) => total + day.seconds,
      0
    );
    return {
      active: current ? snapshot(current, now) : null,
      completed,
      pendingReview,
      settings,
      history,
      statistics: {
        last30DaysSeconds: statsRange._sum.elapsedBeforePause ?? 0,
        last30DaysSessions: statsRange._count._all,
        last7Days,
        weeklyStudySeconds,
        weeklyGoalTargetMinutes: weeklyGoal?.targetMinutes ?? null,
        byLink: byLinkRows.map((row) => ({
          linkedResourceId: row.linkedResourceId,
          seconds: row._sum.elapsedBeforePause ?? 0,
          sessions: row._count._all,
        })),
      },
    };
  });
};

export const getActiveFocusTimerState = (memberId: string) => {
  return database.$transaction(async (transaction) => {
    const now = new Date();
    let session = await transaction.focusTimerSession.findFirst({
      where: { memberId, endedAt: null },
      include: { segments: { orderBy: { startedAt: "asc" } } },
    });
    let completed: Awaited<ReturnType<typeof closeSession>> | null = null;
    if (session) {
      completed = await finishIfExpired(transaction, memberId, session, now);
      if (completed) {
        session = await transaction.focusTimerSession.findFirst({
          where: { memberId, endedAt: null },
          include: { segments: { orderBy: { startedAt: "asc" } } },
        });
      }
    }
    const settings = await getTimerSettings(transaction, memberId);
    const pendingReview = await transaction.focusTimerSession.findFirst({
      where: { memberId, endedAt: { not: null }, needsReview: true },
      orderBy: { endedAt: "desc" },
      select: {
        id: true,
        mode: true,
        title: true,
        linkedResourceType: true,
        linkedResourceId: true,
        elapsedBeforePause: true,
        startedAt: true,
        endedAt: true,
        sessionNote: true,
      },
    });
    return {
      active: session ? snapshot(session, now) : null,
      completed,
      pendingReview,
      settings,
    };
  });
};

export const saveFocusTimerSettings = (memberId: string, input: unknown) => {
  const parsed = preferencesSchema.parse(input);
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: parsed.timezone });
  } catch {
    throw new Error("Escolha um fuso horário válido.");
  }
  return database.plannerPreferences.upsert({
    where: { memberId },
    create: { memberId, ...parsed },
    update: parsed,
    select: {
      timezone: true,
      focusMinutes: true,
      shortBreakMinutes: true,
      longBreakMinutes: true,
      longBreakEvery: true,
      timerSoundEnabled: true,
      systemNotificationsEnabled: true,
      timerSoundType: true,
      timerVolume: true,
      timerTickEnabled: true,
      timerVibrationEnabled: true,
      timerAutoAdvance: true,
      timerOpenFocusOnStart: true,
      keepScreenAwake: true,
    },
  });
};

export const startFocusTimer = async (
  memberId: string,
  input: {
    clientId: string;
    mode: FocusTimerMode;
    durationSeconds?: number | null;
    linkedResourceType?: string | null;
    linkedResourceId?: string | null;
    title?: string | null;
  }
) => {
  const parsed = z
    .object({
      clientId: z.string().uuid(),
      mode: z.nativeEnum(FocusTimerMode),
      durationSeconds: z
        .number()
        .int()
        .min(1)
        .max(86_400)
        .nullable()
        .optional(),
      linkedResourceType: z.literal("LESSON").nullable().optional(),
      linkedResourceId: z.string().trim().max(255).nullable().optional(),
      title: z.string().trim().max(180).nullable().optional(),
    })
    .parse(input);
  await ensureTimerDefaults(memberId);
  if (parsed.linkedResourceId) {
    const resources = await getFocusTimerLinkResources(memberId);
    if (
      !resources.some((resource) => resource.id === parsed.linkedResourceId)
    ) {
      throw new Error("A aula vinculada não está disponível para esta conta.");
    }
  }
  const preferences = await database.plannerPreferences.findUniqueOrThrow({
    where: { memberId },
  });
  const configuredDuration = configuredTimerDurationSeconds(
    parsed.mode,
    preferences
  );
  const durationSeconds = parsed.durationSeconds ?? configuredDuration;
  const now = new Date();
  return database.$transaction(
    async (transaction) => {
      const active = await transaction.focusTimerSession.findFirst({
        where: { memberId, endedAt: null },
        include: { segments: { orderBy: { startedAt: "asc" } } },
      });
      if (active) {
        const completed = await finishIfExpired(
          transaction,
          memberId,
          active,
          now
        );
        if (!completed) {
          throw new Error("Já existe um cronômetro em andamento.");
        }
        const advanced = await transaction.focusTimerSession.findFirst({
          where: { memberId, endedAt: null },
          select: { id: true },
        });
        if (advanced) {
          throw new Error(
            "Uma nova fase do Pomodoro já começou automaticamente."
          );
        }
      }
      const id = randomUUID();
      const timer = await transaction.focusTimerSession.create({
        data: {
          id,
          memberId,
          clientId: parsed.clientId,
          mode: parsed.mode,
          title: parsed.title?.trim() || null,
          durationSeconds,
          startedAt: now,
          runStartedAt: now,
          linkedResourceType: parsed.linkedResourceType ?? null,
          linkedResourceId: parsed.linkedResourceId ?? null,
        },
      });
      await transaction.focusTimerSessionSegment.create({
        data: { sessionId: timer.id, memberId, startedAt: now },
      });
      const withSegments = await transaction.focusTimerSession.findFirstOrThrow(
        {
          where: { id: timer.id, memberId },
          include: { segments: true },
        }
      );
      return snapshot(withSegments, now);
    },
    { isolationLevel: "Serializable" }
  );
};

export const pauseFocusTimer = async (memberId: string) =>
  database.$transaction(
    async (transaction) => {
      const now = new Date();
      const session = await transaction.focusTimerSession.findFirst({
        where: { memberId, endedAt: null },
        include: { segments: { orderBy: { startedAt: "asc" } } },
      });
      if (!session) {
        throw new Error("Não há cronômetro ativo.");
      }
      const completed = await finishIfExpired(
        transaction,
        memberId,
        session,
        now
      );
      if (completed) {
        return { active: null, completed };
      }
      if (session.pausedAt) {
        return { active: snapshot(session, now), completed: null };
      }
      const elapsedBeforePause = elapsedSecondsAt(session, now);
      await transaction.focusTimerSessionSegment.updateMany({
        where: { sessionId: session.id, memberId, endedAt: null },
        data: { endedAt: now },
      });
      await transaction.focusTimerSession.updateMany({
        where: { id: session.id, memberId, endedAt: null },
        data: { pausedAt: now, runStartedAt: null, elapsedBeforePause },
      });
      return {
        active: {
          ...snapshot(
            {
              ...session,
              pausedAt: now,
              runStartedAt: null,
              elapsedBeforePause,
            },
            now
          ),
          elapsedSeconds: session.durationSeconds
            ? Math.min(session.durationSeconds, elapsedBeforePause)
            : elapsedBeforePause,
        },
        completed: null,
      };
    },
    { isolationLevel: "Serializable" }
  );

export const resumeFocusTimer = async (memberId: string) =>
  database.$transaction(
    async (transaction) => {
      const now = new Date();
      const session = await transaction.focusTimerSession.findFirst({
        where: { memberId, endedAt: null },
        include: { segments: { orderBy: { startedAt: "asc" } } },
      });
      if (!session) {
        throw new Error("Não há cronômetro para retomar.");
      }
      if (!session.pausedAt) {
        return { active: snapshot(session, now), completed: null };
      }
      const completed = await finishIfExpired(
        transaction,
        memberId,
        session,
        now
      );
      if (completed) {
        return { active: null, completed };
      }
      await transaction.focusTimerSessionSegment.create({
        data: { sessionId: session.id, memberId, startedAt: now },
      });
      await transaction.focusTimerSession.updateMany({
        where: { id: session.id, memberId, endedAt: null },
        data: { pausedAt: null, runStartedAt: now },
      });
      const resumed = await transaction.focusTimerSession.findFirstOrThrow({
        where: { id: session.id, memberId },
        include: { segments: { orderBy: { startedAt: "asc" } } },
      });
      return { active: snapshot(resumed, now), completed: null };
    },
    { isolationLevel: "Serializable" }
  );

export const stopFocusTimer = async (memberId: string) =>
  database.$transaction(
    async (transaction) => {
      const now = new Date();
      const session = await transaction.focusTimerSession.findFirst({
        where: { memberId, endedAt: null },
        include: { segments: { orderBy: { startedAt: "asc" } } },
      });
      if (!session) {
        return null;
      }
      const completed = await finishIfExpired(
        transaction,
        memberId,
        session,
        now
      );
      if (completed) {
        return completed;
      }
      const elapsed = Math.max(0, elapsedSecondsAt(session, now));
      await transaction.focusTimerSessionSegment.updateMany({
        where: { sessionId: session.id, memberId, endedAt: null },
        data: { endedAt: now },
      });
      await transaction.focusTimerSession.updateMany({
        where: { id: session.id, memberId, endedAt: null },
        data: {
          endedAt: now,
          elapsedBeforePause: elapsed,
          runStartedAt: null,
          needsReview: true,
        },
      });
      return {
        id: session.id,
        mode: session.mode,
        endedAt: now.toISOString(),
        elapsedSeconds: session.durationSeconds
          ? Math.min(session.durationSeconds, elapsed)
          : elapsed,
      };
    },
    { isolationLevel: "Serializable" }
  );

export const linkFocusTimer = async (
  memberId: string,
  linkedResourceId: string | null
) => {
  const resourceId = z
    .string()
    .trim()
    .max(255)
    .nullable()
    .parse(linkedResourceId);
  if (resourceId) {
    const resources = await getFocusTimerLinkResources(memberId);
    if (!resources.some((resource) => resource.id === resourceId)) {
      throw new Error("A aula vinculada não está disponível para esta conta.");
    }
  }
  const result = await database.focusTimerSession.updateMany({
    where: { memberId, endedAt: null },
    data: {
      linkedResourceType: resourceId ? "LESSON" : null,
      linkedResourceId: resourceId,
    },
  });
  if (result.count !== 1) {
    throw new Error("Não há cronômetro ativo para vincular.");
  }
  return { linkedResourceId: resourceId };
};

export const claimFocusTimer = async (
  memberId: string,
  sessionId: string,
  clientId: string
) => {
  const parsed = z
    .object({
      sessionId: z.string().trim().min(1).max(255),
      clientId: z.string().uuid(),
    })
    .parse({ sessionId, clientId });
  const result = await database.focusTimerSession.updateMany({
    where: {
      id: parsed.sessionId,
      memberId,
      endedAt: null,
    },
    data: { clientId: parsed.clientId },
  });
  if (result.count !== 1) {
    throw new Error("Esta sessão não está mais em andamento.");
  }
  return { sessionId: parsed.sessionId, clientId: parsed.clientId };
};

export const reviewFocusTimerSession = (memberId: string, input: unknown) => {
  const parsed = z
    .object({
      id: z.string().min(1).max(255),
      note: z.string().trim().max(4000),
      saveStudy: z.boolean(),
    })
    .parse(input);
  return database.$transaction(
    async (transaction) => {
      const session = await transaction.focusTimerSession.findFirst({
        where: {
          id: parsed.id,
          memberId,
          endedAt: { not: null },
          needsReview: true,
        },
        include: { segments: { orderBy: { startedAt: "asc" } } },
      });
      if (!session) {
        throw new Error("Esta sessão já foi revisada ou não está disponível.");
      }
      if (!parsed.saveStudy) {
        await transaction.focusTimerSession.deleteMany({
          where: { id: session.id, memberId, needsReview: true },
        });
        return { id: session.id, saved: false };
      }
      const studySessionId = await createStudyIntervals(
        transaction,
        memberId,
        session,
        session.endedAt ?? new Date()
      );
      const updated = await transaction.focusTimerSession.updateMany({
        where: { id: session.id, memberId, needsReview: true },
        data: {
          sessionNote: parsed.note || null,
          needsReview: false,
          studyLoggedAt: studySessionId ? session.endedAt : null,
        },
      });
      if (updated.count !== 1) {
        throw new Error("Esta sessão já foi revisada. Atualize o histórico.");
      }
      return {
        id: session.id,
        saved: true,
        studyLogged: Boolean(studySessionId),
      };
    },
    { isolationLevel: "Serializable" }
  );
};

const manualSessionInputSchema = z.object({
  startedAt: z.string().datetime({ offset: true }),
  elapsedSeconds: z.number().int().min(1).max(86_400),
  title: z.string().trim().max(180).nullable().optional(),
  note: z.string().trim().max(4000).nullable().optional(),
  linkedResourceId: z.string().trim().max(255).nullable().optional(),
});

const manualSessionRange = (startedAtValue: string, elapsedSeconds: number) => {
  const startedAt = new Date(startedAtValue);
  const endedAt = new Date(startedAt.getTime() + elapsedSeconds * 1000);
  const now = new Date();
  if (startedAt > now || endedAt > now) {
    throw new Error("Uma sessão manual não pode conter horário futuro.");
  }
  return { startedAt, endedAt };
};

const checkedLessonLink = async (
  memberId: string,
  resourceId: string | null
) => {
  if (!resourceId) {
    return null;
  }
  const resources = await getFocusTimerLinkResources(memberId);
  if (!resources.some((resource) => resource.id === resourceId)) {
    throw new Error("A aula vinculada não está disponível para esta conta.");
  }
  return resourceId;
};

export const addManualFocusTimerSession = async (
  memberId: string,
  input: unknown
) => {
  const parsed = manualSessionInputSchema.parse(input);
  const { startedAt, endedAt } = manualSessionRange(
    parsed.startedAt,
    parsed.elapsedSeconds
  );
  const linkedResourceId = await checkedLessonLink(
    memberId,
    parsed.linkedResourceId ?? null
  );
  return database.$transaction(
    async (transaction) => {
      const session = await transaction.focusTimerSession.create({
        data: {
          memberId,
          mode: FocusTimerMode.STOPWATCH,
          title: parsed.title?.trim() || null,
          durationSeconds: null,
          startedAt,
          endedAt,
          elapsedBeforePause: parsed.elapsedSeconds,
          sessionNote: parsed.note?.trim() || null,
          linkedResourceType: linkedResourceId ? "LESSON" : null,
          linkedResourceId,
          manuallyEntered: true,
          segments: {
            create: {
              startedAt,
              endedAt,
            },
          },
        },
        include: { segments: { orderBy: { startedAt: "asc" } } },
      });
      const studySessionId = await createStudyIntervals(
        transaction,
        memberId,
        session,
        endedAt
      );
      await transaction.focusTimerSession.updateMany({
        where: { id: session.id, memberId },
        data: { studyLoggedAt: studySessionId ? endedAt : null },
      });
      return { id: session.id, endedAt, elapsedSeconds: parsed.elapsedSeconds };
    },
    { isolationLevel: "Serializable" }
  );
};

export const updateFocusTimerHistorySession = async (
  memberId: string,
  input: unknown
) => {
  const parsed = manualSessionInputSchema
    .extend({ id: z.string().min(1).max(255) })
    .parse(input);
  const { startedAt, endedAt } = manualSessionRange(
    parsed.startedAt,
    parsed.elapsedSeconds
  );
  const linkedResourceId = await checkedLessonLink(
    memberId,
    parsed.linkedResourceId ?? null
  );
  return database.$transaction(
    async (transaction) => {
      const session = await transaction.focusTimerSession.findFirst({
        where: {
          id: parsed.id,
          memberId,
          endedAt: { not: null },
          needsReview: false,
          mode: {
            in: [
              FocusTimerMode.FOCUS,
              FocusTimerMode.COUNTDOWN,
              FocusTimerMode.STOPWATCH,
            ],
          },
        },
        include: { segments: true },
      });
      if (!session) {
        throw new Error("A sessão não está disponível para edição.");
      }
      await transaction.studyTrackingSession.deleteMany({
        where: {
          memberId,
          clientSessionId: session.id,
          activityKind: StudyActivityKind.PERSONAL_TIMER,
        },
      });
      await transaction.focusTimerSessionSegment.deleteMany({
        where: { memberId, sessionId: session.id },
      });
      const updated = await transaction.focusTimerSession.update({
        where: { id: session.id },
        data: {
          title: parsed.title?.trim() || null,
          sessionNote: parsed.note?.trim() || null,
          startedAt,
          endedAt,
          elapsedBeforePause: parsed.elapsedSeconds,
          linkedResourceType: linkedResourceId ? "LESSON" : null,
          linkedResourceId,
          manuallyEntered: session.manuallyEntered,
          segments: {
            create: {
              startedAt,
              endedAt,
            },
          },
        },
        include: { segments: { orderBy: { startedAt: "asc" } } },
      });
      const studySessionId = await createStudyIntervals(
        transaction,
        memberId,
        updated,
        endedAt
      );
      await transaction.focusTimerSession.updateMany({
        where: { id: session.id, memberId },
        data: { studyLoggedAt: studySessionId ? endedAt : null },
      });
      return { id: session.id, endedAt, elapsedSeconds: parsed.elapsedSeconds };
    },
    { isolationLevel: "Serializable" }
  );
};

export const deleteFocusTimerHistorySession = (
  memberId: string,
  id: string
) => {
  const sessionId = z.string().min(1).max(255).parse(id);
  return database.$transaction(
    async (transaction) => {
      const session = await transaction.focusTimerSession.findFirst({
        where: {
          id: sessionId,
          memberId,
          endedAt: { not: null },
          needsReview: false,
        },
        select: { id: true },
      });
      if (!session) {
        throw new Error("A sessão não está disponível para exclusão.");
      }
      await transaction.studyTrackingSession.deleteMany({
        where: {
          memberId,
          clientSessionId: session.id,
          activityKind: StudyActivityKind.PERSONAL_TIMER,
        },
      });
      await transaction.focusTimerSession.deleteMany({
        where: { id: session.id, memberId, endedAt: { not: null } },
      });
      return { id: session.id, deleted: true };
    },
    { isolationLevel: "Serializable" }
  );
};

const csvCell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

export const exportFocusTimerHistoryCsv = async (memberId: string) => {
  const rows: string[] = [
    [
      "titulo",
      "modo",
      "inicio_utc",
      "fim_utc",
      "segundos",
      "vinculo_tipo",
      "vinculo_id",
      "sessao_manual",
      "anotacao",
    ]
      .map(csvCell)
      .join(";"),
  ];
  let cursor: string | undefined;
  while (true) {
    const page = await database.focusTimerSession.findMany({
      where: { memberId, endedAt: { not: null }, needsReview: false },
      orderBy: [{ endedAt: "desc" }, { id: "desc" }],
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        mode: true,
        startedAt: true,
        endedAt: true,
        elapsedBeforePause: true,
        linkedResourceType: true,
        linkedResourceId: true,
        manuallyEntered: true,
        sessionNote: true,
      },
    });
    if (page.length === 0) {
      break;
    }
    rows.push(
      ...page.map((session) =>
        [
          session.title ?? "",
          session.mode,
          session.startedAt.toISOString(),
          session.endedAt?.toISOString() ?? "",
          session.elapsedBeforePause,
          session.linkedResourceType,
          session.linkedResourceId,
          session.manuallyEntered ? "sim" : "não",
          session.sessionNote,
        ]
          .map(csvCell)
          .join(";")
      )
    );
    cursor = page.at(-1)?.id;
    if (page.length < 500 || !cursor) {
      break;
    }
  }
  return `\uFEFF${rows.join("\r\n")}\r\n`;
};
