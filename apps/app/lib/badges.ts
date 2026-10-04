import "server-only";

import {
  BadgeCriterion,
  ContentStatus,
  database,
  Prisma,
  type Prisma as PrismaTypes,
  StudyGoalPeriod,
} from "@repo/database";
import {
  enqueueNotificationBatch,
  withMemberIdentityLock,
} from "@repo/member-domain";
import {
  currentStudyStreakDays,
  localStudyDayStart,
  studyLocalDayKey,
  studyWeekStartKey,
} from "./study-periods";

interface BadgeDefinitionForEvaluation {
  readonly criterion: BadgeCriterion;
  readonly id: string;
  readonly slug: string;
  readonly threshold: number;
  readonly title: string;
  readonly version: number;
}

const readEligibleBadgeDefinitions = async (
  transaction: PrismaTypes.TransactionClient,
  memberId: string,
  definitions: readonly BadgeDefinitionForEvaluation[],
  now: Date
) => {
  const metrics = new Map<BadgeCriterion, number>();
  const eligible: BadgeDefinitionForEvaluation[] = [];
  for (const badge of definitions) {
    let metric = metrics.get(badge.criterion);
    if (metric === undefined) {
      metric = await readBadgeMetric(
        transaction,
        memberId,
        badge.criterion,
        now
      );
      metrics.set(badge.criterion, metric);
    }
    if (metric >= badge.threshold) {
      eligible.push(badge);
    }
  }
  return eligible;
};

const notifyBadgeAwards = async (
  transaction: PrismaTypes.TransactionClient,
  memberId: string,
  now: Date,
  badges: readonly BadgeDefinitionForEvaluation[]
) => {
  for (const badge of badges) {
    await enqueueNotificationBatch(transaction, {
      actorId: null,
      aggregateType: "BADGE_AWARD",
      aggregateId: `${memberId}:${badge.id}`,
      idempotencyKey: `badge-awarded:${memberId}:${badge.id}`,
      occurredAt: now,
      notifications: [
        {
          recipientId: memberId,
          type: "BADGE_AWARDED",
          entityType: "BADGE",
          entityId: badge.id,
          dedupeKey: `badge-awarded:${memberId}:${badge.id}`,
          href: "/perfil#conquistas",
        },
      ],
    });
  }
};

const shouldRefreshStudyGoals = (
  criteria: readonly BadgeCriterion[] | undefined
) => !criteria?.length || criteria.includes(BadgeCriterion.STUDY_GOALS_MET);

const studyBadgeCriteria = new Set<BadgeCriterion>([
  BadgeCriterion.STUDY_MINUTES,
  BadgeCriterion.STUDY_STREAK_DAYS,
  BadgeCriterion.STUDY_GOALS_MET,
]);

export const shouldThrottleBadgeEvaluation = (
  criteria: readonly BadgeCriterion[] | undefined,
  force: boolean
) =>
  !force &&
  (!criteria?.length ||
    criteria.every((criterion) => studyBadgeCriteria.has(criterion)));

const readStudySeconds = async (
  transaction: PrismaTypes.TransactionClient,
  memberId: string,
  startsAt?: Date,
  endsAt?: Date
) => {
  const lowerBound = startsAt
    ? Prisma.sql`GREATEST("startedAt", ${startsAt})`
    : Prisma.sql`"startedAt"`;
  const upperBound = endsAt
    ? Prisma.sql`LEAST("endedAt", ${endsAt})`
    : Prisma.sql`"endedAt"`;
  const range = await transaction.$queryRaw<
    Array<{ seconds: number | bigint }>
  >(
    Prisma.sql`
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM upper(r) - lower(r))), 0)::bigint AS seconds
      FROM (
        SELECT range_agg(tstzrange(${lowerBound}, ${upperBound}, '[)')) AS ranges
        FROM "StudyActivityInterval"
        WHERE "memberId" = ${memberId}
          ${startsAt ? Prisma.sql`AND "endedAt" > ${startsAt}` : Prisma.empty}
          ${endsAt ? Prisma.sql`AND "startedAt" < ${endsAt}` : Prisma.empty}
      ) AS intervals
      CROSS JOIN LATERAL unnest(ranges) AS r
    `
  );
  return Number(range[0]?.seconds ?? 0);
};

const readCurrentStudyStreak = async (
  transaction: PrismaTypes.TransactionClient,
  memberId: string,
  now: Date
) => {
  const rows = await transaction.$queryRaw<Array<{ day: string }>>(Prisma.sql`
    SELECT DISTINCT to_char(date_trunc('day', "startedAt" AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS day
    FROM "StudyActivityInterval"
    WHERE "memberId" = ${memberId}
    ORDER BY day DESC
  `);
  return currentStudyStreakDays(
    rows.map(({ day }) => day),
    studyLocalDayKey(now)
  );
};

const upsertReachedStudyGoals = async (
  transaction: PrismaTypes.TransactionClient,
  memberId: string,
  now: Date
) => {
  const goals = await transaction.studyGoal.findMany({
    where: { memberId },
    select: { id: true, period: true, targetMinutes: true },
  });
  const today = studyLocalDayKey(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStart = studyWeekStartKey(today);
  for (const goal of goals) {
    const isWeekly = goal.period === StudyGoalPeriod.WEEKLY;
    const periodKey = isWeekly
      ? `week:${weekStart}`
      : `month:${today.slice(0, 7)}`;
    const start = localStudyDayStart(isWeekly ? weekStart : monthStart);
    const seconds = await readStudySeconds(transaction, memberId, start, now);
    if (seconds < goal.targetMinutes * 60) {
      continue;
    }
    await transaction.studyGoalAchievement.upsert({
      where: { goalId_periodKey: { goalId: goal.id, periodKey } },
      create: { goalId: goal.id, memberId, periodKey },
      update: {},
    });
  }
};

const readCompletedLearningPaths = async (
  transaction: PrismaTypes.TransactionClient,
  memberId: string
) => {
  const completedPaths = await transaction.$queryRaw<
    Array<{ count: number }>
  >(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT learning_path.id
      FROM "LearningPath" AS learning_path
      INNER JOIN "Course" AS course
        ON course."learningPathId" = learning_path.id
        AND course."status" = 'PUBLISHED'
        AND course."experience" = 'ASYNC'
      INNER JOIN "Module" AS content_module
        ON content_module."courseId" = course.id
        AND content_module."status" = 'PUBLISHED'
      INNER JOIN "Lesson" AS lesson
        ON lesson."moduleId" = content_module.id
        AND lesson."status" = 'PUBLISHED'
      LEFT JOIN "LessonProgress" AS progress
        ON progress."lessonId" = lesson.id
        AND progress."memberId" = ${memberId}
      WHERE learning_path."status" = 'PUBLISHED'
        AND EXISTS (
          SELECT 1
          FROM "Member" AS member_record
          WHERE member_record.id = ${memberId}
            AND member_record."deactivatedAt" IS NULL
            AND (
              member_record.role IN ('TEACHER', 'ADMIN')
              OR EXISTS (
                SELECT 1
                FROM "Enrollment" AS enrollment
                WHERE enrollment."memberId" = member_record.id
                  AND enrollment."courseId" = course.id
                  AND enrollment.status IN ('ACTIVE', 'COMPLETED')
              )
              OR EXISTS (
                SELECT 1
                FROM "AccessGrant" AS access_grant
                WHERE access_grant."memberId" = member_record.id
                  AND (access_grant."expiresAt" IS NULL OR access_grant."expiresAt" > NOW())
                  AND (
                    (access_grant."resourceType" = 'COURSE' AND access_grant."resourceId" = course.id)
                    OR (access_grant."resourceType" = 'MODULE' AND access_grant."resourceId" = content_module.id)
                    OR (access_grant."resourceType" = 'LESSON' AND access_grant."resourceId" = lesson.id)
                    OR (
                      access_grant."resourceType" = 'ASSET'
                      AND EXISTS (
                        SELECT 1
                        FROM "LessonAsset" AS asset
                        WHERE asset.id = access_grant."resourceId"
                          AND asset."lessonId" = lesson.id
                      )
                    )
                  )
              )
              OR EXISTS (
                SELECT 1
                FROM "ActivityAssignment" AS assignment
                WHERE assignment."memberId" = member_record.id
                  AND assignment."status" IN ('NEW', 'VIEWED', 'STARTED', 'COMPLETED')
                  AND assignment."revokedAt" IS NULL
                  AND (assignment."availableAt" IS NULL OR assignment."availableAt" <= NOW())
                  AND (assignment."expiresAt" IS NULL OR assignment."expiresAt" > NOW())
                  AND (
                    (assignment."targetType" = 'COURSE' AND assignment."targetId" = course.id)
                    OR (assignment."targetType" = 'MODULE' AND assignment."targetId" = content_module.id)
                    OR (assignment."targetType" = 'LESSON' AND assignment."targetId" = lesson.id)
                    OR (
                      assignment."targetType" = 'ASSET'
                      AND EXISTS (
                        SELECT 1
                        FROM "LessonAsset" AS asset
                        WHERE asset.id = assignment."targetId"
                          AND asset."lessonId" = lesson.id
                      )
                    )
                  )
              )
            )
        )
      GROUP BY learning_path.id
      HAVING COUNT(lesson.id) > 0
        AND COUNT(lesson.id) = COUNT(progress.id)
          FILTER (WHERE progress."status" = 'COMPLETED')
    ) AS completed_paths
  `);
  return Number(completedPaths[0]?.count ?? 0);
};

const readBadgeMetric = async (
  transaction: PrismaTypes.TransactionClient,
  memberId: string,
  criterion: BadgeCriterion,
  now: Date
) => {
  switch (criterion) {
    case BadgeCriterion.STUDY_MINUTES:
      return Math.floor((await readStudySeconds(transaction, memberId)) / 60);
    case BadgeCriterion.STUDY_STREAK_DAYS:
      return readCurrentStudyStreak(transaction, memberId, now);
    case BadgeCriterion.STUDY_GOALS_MET:
      return transaction.studyGoalAchievement.count({ where: { memberId } });
    case BadgeCriterion.EXERCISE_ANSWERS:
      return transaction.exerciseAnswer.count({
        where: { sessionQuestion: { is: { session: { is: { memberId } } } } },
      });
    case BadgeCriterion.ACTIVITIES_COMPLETED:
      return transaction.activitySubmission.count({
        where: { memberId, status: { in: ["SUBMITTED", "REVIEWED"] } },
      });
    case BadgeCriterion.COMMUNITY_PUBLICATIONS:
      return transaction.communityPost.count({
        where: {
          authorId: memberId,
          status: ContentStatus.PUBLISHED,
          deletedAt: null,
        },
      });
    case BadgeCriterion.LESSONS_COMPLETED:
      return transaction.lessonProgress.count({
        where: { memberId, status: "COMPLETED" },
      });
    case BadgeCriterion.LEARNING_PATHS_COMPLETED: {
      return readCompletedLearningPaths(transaction, memberId);
    }
    case BadgeCriterion.MEETINGS_ATTENDED:
      return transaction.meetingAttendance.count({
        where: { memberId, isPresent: true },
      });
    case BadgeCriterion.TASKS_COMPLETED:
      return transaction.learningTaskCompletion.count({ where: { memberId } });
    default:
      return 0;
  }
};

export const evaluateMemberBadges = async (
  transaction: PrismaTypes.TransactionClient,
  memberId: string,
  now = new Date(),
  options: {
    readonly criteria?: readonly BadgeCriterion[];
    readonly force?: boolean;
  } = {}
) =>
  withMemberIdentityLock(transaction, memberId, async () => {
    const usesThrottle = shouldThrottleBadgeEvaluation(
      options.criteria,
      options.force ?? false
    );
    const state = usesThrottle
      ? await transaction.badgeEvaluationState.findUnique({
          where: { memberId },
          select: { id: true, lastEvaluatedAt: true },
        })
      : null;
    if (
      usesThrottle &&
      state?.lastEvaluatedAt &&
      now.getTime() - state.lastEvaluatedAt.getTime() < 60_000
    ) {
      return [];
    }

    if (usesThrottle) {
      await transaction.badgeEvaluationState.upsert({
        where: { memberId },
        create: { memberId, lastEvaluatedAt: now },
        update: { lastEvaluatedAt: now },
      });
    }
    if (shouldRefreshStudyGoals(options.criteria)) {
      await upsertReachedStudyGoals(transaction, memberId, now);
    }

    const definitions = await transaction.badgeDefinition.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        ...(options.criteria?.length
          ? { criterion: { in: [...options.criteria] } }
          : {}),
      },
      orderBy: [{ criterion: "asc" }, { threshold: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        criterion: true,
        threshold: true,
        version: true,
      },
    });
    const eligible = await readEligibleBadgeDefinitions(
      transaction,
      memberId,
      definitions,
      now
    );
    if (!eligible.length) {
      return [];
    }

    const existingAwards = await transaction.badgeAward.findMany({
      where: { memberId, badgeId: { in: eligible.map(({ id }) => id) } },
      select: { badgeId: true },
    });
    const awardedIds = new Set(existingAwards.map(({ badgeId }) => badgeId));
    const newlyAwarded = eligible.filter(({ id }) => !awardedIds.has(id));
    if (!newlyAwarded.length) {
      return [];
    }

    const revisions = await transaction.badgeDefinitionRevision.findMany({
      where: {
        OR: newlyAwarded.map(({ id, version }) => ({ badgeId: id, version })),
      },
      select: { id: true, badgeId: true, version: true },
    });
    const revisionByBadge = new Map(
      revisions.map((revision) => [
        `${revision.badgeId}:${revision.version}`,
        revision.id,
      ])
    );
    const awards = newlyAwarded.map((badge) => {
      const definitionRevisionId = revisionByBadge.get(
        `${badge.id}:${badge.version}`
      );
      if (!definitionRevisionId) {
        throw new Error(
          `Badge ${badge.slug} has no current definition revision.`
        );
      }
      return { badge, definitionRevisionId };
    });

    await transaction.badgeAward.createMany({
      data: awards.map(({ badge, definitionRevisionId }) => ({
        memberId,
        badgeId: badge.id,
        definitionRevisionId,
        awardedAt: now,
      })),
      skipDuplicates: true,
    });
    await notifyBadgeAwards(
      transaction,
      memberId,
      now,
      awards.map(({ badge }) => badge)
    );
    return newlyAwarded;
  });

export const awardBadgesAfterMemberEvent = async (memberId: string) =>
  database.$transaction((transaction) =>
    evaluateMemberBadges(transaction, memberId)
  );
