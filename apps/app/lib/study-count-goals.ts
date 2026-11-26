import "server-only";

import { database, Prisma, StudyGoalPeriod } from "@repo/database";
import { z } from "zod";
import {
  aggregateWeekActivity,
  COUNT_GOAL_MAX,
  type CountGoalsOverview,
  countGoalKinds,
  type LinkedTimerRow,
  mergeCountGoals,
  type TrackedRow,
  type WeekActivityCounts,
} from "./study-count-goals-model";

interface Window {
  readonly weekEnd: Date;
  readonly weekStart: Date;
}

const dayKeyFormatter = (timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  });

const trackedRows = (memberId: string, window: Window, timezone: string) =>
  database.$queryRaw<
    Array<Omit<TrackedRow, "seconds"> & { seconds: number | bigint }>
  >(Prisma.sql`
    SELECT
      TO_CHAR((study_interval."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS "dayKey",
      tracking."activityKind"::text AS "activityKind",
      tracking."resourceId" AS "resourceId",
      SUM(study_interval."seconds") AS "seconds"
    FROM "StudyActivityInterval" AS study_interval
    JOIN "StudyTrackingSession" AS tracking ON tracking."id" = study_interval."sessionId"
    WHERE study_interval."memberId" = ${memberId}
      AND study_interval."startedAt" >= ${window.weekStart}
      AND study_interval."startedAt" < ${window.weekEnd}
      AND tracking."resourceId" IS NOT NULL
      AND tracking."activityKind" <> 'PERSONAL_TIMER'
    GROUP BY 1, 2, 3
  `);

/** Cronômetros pessoais ligados a uma aula ou a uma leitura da biblioteca. */
const linkedTimerRows = (memberId: string, window: Window, timezone: string) =>
  database.$queryRaw<
    Array<Omit<LinkedTimerRow, "seconds"> & { seconds: number | bigint }>
  >(Prisma.sql`
    SELECT
      TO_CHAR((study_interval."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS "dayKey",
      timer."linkedResourceType" AS "linkedType",
      timer."linkedResourceId" AS "resourceId",
      SUM(study_interval."seconds") AS "seconds"
    FROM "StudyActivityInterval" AS study_interval
    JOIN "StudyTrackingSession" AS tracking ON tracking."id" = study_interval."sessionId"
    JOIN "FocusTimerSession" AS timer
      ON timer."id" = tracking."clientSessionId" AND timer."memberId" = tracking."memberId"
    WHERE study_interval."memberId" = ${memberId}
      AND study_interval."startedAt" >= ${window.weekStart}
      AND study_interval."startedAt" < ${window.weekEnd}
      AND tracking."activityKind" = 'PERSONAL_TIMER'
      AND timer."linkedResourceId" IS NOT NULL
      AND timer."linkedResourceType" IN ('LESSON', 'LIBRARY_ITEM')
    GROUP BY 1, 2, 3
  `);

const answerRows = (memberId: string, window: Window, timezone: string) =>
  database.$queryRaw<Array<{ count: number | bigint; dayKey: string }>>(
    Prisma.sql`
    SELECT
      TO_CHAR((answer."answeredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS "dayKey",
      COUNT(*) AS "count"
    FROM "ExerciseAnswer" AS answer
    JOIN "ExerciseSessionQuestion" AS question ON question."id" = answer."sessionQuestionId"
    JOIN "ExerciseSession" AS session ON session."id" = question."sessionId"
    WHERE session."memberId" = ${memberId}
      AND answer."answeredAt" >= ${window.weekStart}
      AND answer."answeredAt" < ${window.weekEnd}
    GROUP BY 1
  `
  );

/**
 * Contagem da semana por aulas, leituras e exercícios, no total e por dia.
 * É a única fonte dos números da ampulheta, da estante e do card de
 * progresso, então as três telas não divergem.
 */
export const getWeekActivityCounts = async (
  memberId: string,
  window: Window,
  timezone: string
): Promise<WeekActivityCounts> => {
  const formatter = dayKeyFormatter(timezone);
  const [tracked, linked, completed, answers] = await Promise.all([
    trackedRows(memberId, window, timezone),
    linkedTimerRows(memberId, window, timezone),
    database.lessonProgress.findMany({
      where: {
        memberId,
        completedAt: { gte: window.weekStart, lt: window.weekEnd },
      },
      select: { completedAt: true, lessonId: true },
    }),
    answerRows(memberId, window, timezone),
  ]);
  return aggregateWeekActivity({
    tracked: tracked.map((row) => ({ ...row, seconds: Number(row.seconds) })),
    linked: linked.map((row) => ({ ...row, seconds: Number(row.seconds) })),
    completedLessons: completed.flatMap((item) =>
      item.completedAt
        ? [
            {
              dayKey: formatter.format(item.completedAt),
              lessonId: item.lessonId,
            },
          ]
        : []
    ),
    answersByDay: answers.map((row) => ({
      dayKey: row.dayKey,
      count: Number(row.count),
    })),
  });
};

export const getCountGoalsOverview = async (
  memberId: string,
  counts: WeekActivityCounts
): Promise<CountGoalsOverview> => {
  const goals = await database.studyCountGoal.findMany({
    where: { memberId, period: StudyGoalPeriod.WEEKLY },
    select: { kind: true, target: true },
  });
  return mergeCountGoals(goals, counts.week);
};

const saveSchema = z.object({
  kind: z.enum(countGoalKinds),
  target: z.number().int().min(1).max(COUNT_GOAL_MAX),
});

export const saveCountGoal = async (memberId: string, input: unknown) => {
  const parsed = saveSchema.parse(input);
  return await database.studyCountGoal.upsert({
    where: {
      memberId_period_kind: {
        memberId,
        period: StudyGoalPeriod.WEEKLY,
        kind: parsed.kind,
      },
    },
    create: {
      memberId,
      period: StudyGoalPeriod.WEEKLY,
      kind: parsed.kind,
      target: parsed.target,
    },
    update: { target: parsed.target },
    select: { kind: true, target: true },
  });
};

export const deleteCountGoal = async (memberId: string, kind: unknown) => {
  const parsed = z.enum(countGoalKinds).parse(kind);
  await database.studyCountGoal.deleteMany({
    where: { memberId, period: StudyGoalPeriod.WEEKLY, kind: parsed },
  });
};
