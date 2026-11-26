import "server-only";

import { database, Prisma, StudyGoalPeriod } from "@repo/database";
import { z } from "zod";
import {
  COUNT_GOAL_MAX,
  COUNT_GOAL_MIN_SECONDS,
  type CountGoalKind,
  type CountGoalsOverview,
  countGoalActivityKinds,
  countGoalKinds,
  emptyCountGoals,
} from "./study-count-goals-model";

interface CountRow {
  readonly activityKind: string;
  readonly resources: number | bigint;
}

/**
 * Quantos recursos distintos o membro estudou na janela da semana, com pelo
 * menos 1 min de tempo registrado cada. Usa o mesmo rastreio da meta em
 * minutos, então tudo que tem cronômetro (aula, leitura da biblioteca,
 * exercício) conta sem depender de outra tabela.
 */
const countStudiedResources = async (
  memberId: string,
  window: { readonly weekEnd: Date; readonly weekStart: Date }
) => {
  const rows = await database.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT per_resource."activityKind", COUNT(*) AS "resources"
    FROM (
      SELECT tracking."activityKind"::text AS "activityKind", tracking."resourceId"
      FROM "StudyActivityInterval" AS study_interval
      JOIN "StudyTrackingSession" AS tracking ON tracking."id" = study_interval."sessionId"
      WHERE study_interval."memberId" = ${memberId}
        AND study_interval."startedAt" >= ${window.weekStart}
        AND study_interval."startedAt" < ${window.weekEnd}
        AND tracking."resourceId" IS NOT NULL
      GROUP BY tracking."activityKind", tracking."resourceId"
      HAVING SUM(study_interval."seconds") >= ${COUNT_GOAL_MIN_SECONDS}
    ) AS per_resource
    GROUP BY per_resource."activityKind"
  `);
  const byKind = new Map(
    rows.map((row) => [row.activityKind, Number(row.resources)])
  );
  const done: Record<CountGoalKind, number> = {
    LESSONS: 0,
    READINGS: 0,
    EXERCISES: 0,
  };
  for (const kind of countGoalKinds) {
    done[kind] = countGoalActivityKinds[kind].reduce(
      (sum, activity) => sum + (byKind.get(activity) ?? 0),
      0
    );
  }
  return done;
};

export const getCountGoalsOverview = async (
  memberId: string,
  window: { readonly weekEnd: Date; readonly weekStart: Date }
): Promise<CountGoalsOverview> => {
  const [goals, done] = await Promise.all([
    database.studyCountGoal.findMany({
      where: { memberId, period: StudyGoalPeriod.WEEKLY },
      select: { kind: true, target: true },
    }),
    countStudiedResources(memberId, window),
  ]);
  const overview = emptyCountGoals();
  for (const kind of countGoalKinds) {
    overview[kind] = {
      done: done[kind],
      target: goals.find((goal) => goal.kind === kind)?.target ?? null,
    };
  }
  return overview;
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
