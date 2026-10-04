import "server-only";

import {
  ActivitySubmissionStatus,
  database,
  Prisma,
  StudyGoalPeriod,
} from "@repo/database";
import {
  localStudyDayStart,
  shiftStudyLocalDay,
  studyLocalDayKey,
  studyPeriodKey,
  studyWeekStartKey,
} from "./study-periods";

interface DailyStudyTotal {
  readonly date: string;
  readonly playbackSeconds: number | bigint;
  readonly studySeconds: number | bigint;
}

const readMemberStudyTotals = (
  memberId: string,
  startsAt: Date,
  endsAt: Date
) =>
  database.$queryRaw<DailyStudyTotal[]>(Prisma.sql`
    WITH clipped AS (
      SELECT
        GREATEST("startedAt", ${startsAt}) AS clipped_start,
        LEAST("endedAt", ${endsAt}) AS clipped_end,
        "isPlayback"
      FROM "StudyActivityInterval"
      WHERE "memberId" = ${memberId}
        AND "endedAt" > ${startsAt}
        AND "startedAt" < ${endsAt}
    ),
    day_slices AS (
      SELECT
        to_char(days.day_start, 'YYYY-MM-DD') AS day,
        tstzrange(
          GREATEST(clipped.clipped_start, days.day_start AT TIME ZONE 'America/Sao_Paulo'),
          LEAST(clipped.clipped_end, (days.day_start + interval '1 day') AT TIME ZONE 'America/Sao_Paulo'),
          '[)'
        ) AS slice,
        clipped."isPlayback"
      FROM clipped
      CROSS JOIN LATERAL generate_series(
        date_trunc('day', clipped.clipped_start AT TIME ZONE 'America/Sao_Paulo'),
        date_trunc('day', (clipped.clipped_end - interval '1 microsecond') AT TIME ZONE 'America/Sao_Paulo'),
        interval '1 day'
      ) AS days(day_start)
    ),
    grouped AS (
      SELECT
        day,
        range_agg(slice) AS study_ranges,
        range_agg(slice) FILTER (WHERE "isPlayback") AS playback_ranges
      FROM day_slices
      GROUP BY day
    )
    SELECT
      day AS date,
      COALESCE((SELECT SUM(EXTRACT(EPOCH FROM upper(r) - lower(r))) FROM unnest(study_ranges) AS r), 0)::bigint AS "studySeconds",
      COALESCE((SELECT SUM(EXTRACT(EPOCH FROM upper(r) - lower(r))) FROM unnest(playback_ranges) AS r), 0)::bigint AS "playbackSeconds"
    FROM grouped
    ORDER BY day ASC
  `);

const readCampaignContribution = (startsAt: Date, endsAt: Date) =>
  database.$queryRaw<Array<{ seconds: number | bigint }>>(Prisma.sql`
    WITH clipped AS (
      SELECT
        interval."memberId",
        GREATEST(interval."startedAt", ${startsAt}) AS clipped_start,
        LEAST(interval."endedAt", ${endsAt}) AS clipped_end
      FROM "StudyActivityInterval" AS interval
      INNER JOIN "Member" AS member ON member.id = interval."memberId"
      WHERE member.role = 'MEMBER'::"MemberRole"
        AND member."deactivatedAt" IS NULL
        AND interval."endedAt" > ${startsAt}
        AND interval."startedAt" < ${endsAt}
    ),
    day_slices AS (
      SELECT
        clipped."memberId",
        days.day_start AS day,
        tstzrange(
          GREATEST(clipped.clipped_start, days.day_start AT TIME ZONE 'America/Sao_Paulo'),
          LEAST(clipped.clipped_end, (days.day_start + interval '1 day') AT TIME ZONE 'America/Sao_Paulo'),
          '[)'
        ) AS slice
      FROM clipped
      CROSS JOIN LATERAL generate_series(
        date_trunc('day', clipped.clipped_start AT TIME ZONE 'America/Sao_Paulo'),
        date_trunc('day', (clipped.clipped_end - interval '1 microsecond') AT TIME ZONE 'America/Sao_Paulo'),
        interval '1 day'
      ) AS days(day_start)
    ),
    per_member_day AS (
      SELECT "memberId", day, range_agg(slice) AS ranges
      FROM day_slices
      GROUP BY "memberId", day
    ),
    per_member AS (
      SELECT "memberId", SUM(EXTRACT(EPOCH FROM upper(r) - lower(r))) AS seconds
      FROM per_member_day
      CROSS JOIN LATERAL unnest(ranges) AS r
      GROUP BY "memberId"
    )
    SELECT COALESCE(SUM(seconds), 0)::bigint AS seconds FROM per_member
  `);

export const getStudyDashboardData = async (memberId: string) => {
  const now = new Date();
  const today = studyLocalDayKey(now);
  const monday = studyWeekStartKey(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const thirtyDaysAgo = localStudyDayStart(shiftStudyLocalDay(today, -29));

  const [
    dailyRows,
    goals,
    taskAssignments,
    campaign,
    lessonsConsumed,
    exerciseAnswers,
    activitySubmissions,
  ] = await Promise.all([
    readMemberStudyTotals(memberId, thirtyDaysAgo, now),
    database.studyGoal.findMany({
      where: { memberId },
      select: { period: true, targetMinutes: true },
    }),
    database.learningTaskRecipient.findMany({
      where: {
        memberId,
        task: { is: { archivedAt: null, startsAt: { lte: now } } },
      },
      orderBy: [{ task: { dueAt: "asc" } }, { assignedAt: "desc" }],
      take: 50,
      select: {
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            recurrence: true,
            dueAt: true,
            createdByMemberId: true,
            completions: {
              where: { memberId },
              select: { periodKey: true, completedAt: true },
            },
          },
        },
      },
    }),
    database.studyCampaign.findFirst({
      where: {
        publishedAt: { not: null },
        archivedAt: null,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        targetMinutes: true,
        startsAt: true,
        endsAt: true,
      },
    }),
    database.lessonProgress.count({
      where: { memberId, completedAt: { gte: thirtyDaysAgo } },
    }),
    database.exerciseAnswer.count({
      where: {
        answeredAt: { gte: thirtyDaysAgo },
        sessionQuestion: { is: { session: { is: { memberId } } } },
      },
    }),
    database.activitySubmission.count({
      where: {
        memberId,
        status: {
          in: [
            ActivitySubmissionStatus.SUBMITTED,
            ActivitySubmissionStatus.REVIEWED,
          ],
        },
        submittedAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  const daily = new Map(
    dailyRows.map((row) => [
      row.date,
      {
        playbackSeconds: Number(row.playbackSeconds),
        studySeconds: Number(row.studySeconds),
      },
    ])
  );
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shiftStudyLocalDay(today, index - 6);
    return {
      date,
      studySeconds: daily.get(date)?.studySeconds ?? 0,
      playbackSeconds: daily.get(date)?.playbackSeconds ?? 0,
    };
  });
  const lastThirtyDaySeconds = [...daily.entries()].reduce(
    (total, [date, value]) =>
      date >= shiftStudyLocalDay(today, -29)
        ? total + value.studySeconds
        : total,
    0
  );
  const lastThirtyDayPlaybackSeconds = [...daily.entries()].reduce(
    (total, [date, value]) =>
      date >= shiftStudyLocalDay(today, -29)
        ? total + value.playbackSeconds
        : total,
    0
  );
  const weekSeconds = [...daily.entries()].reduce(
    (total, [date, value]) =>
      date >= monday && date <= today ? total + value.studySeconds : total,
    0
  );
  const monthSeconds = [...daily.entries()].reduce(
    (total, [date, value]) =>
      date >= monthStart && date <= today ? total + value.studySeconds : total,
    0
  );
  const playbackSeconds = [...daily.entries()].reduce(
    (total, [date, value]) =>
      date >= monthStart ? total + value.playbackSeconds : total,
    0
  );
  const currentGoals = new Map(
    goals.map((goal) => [goal.period, goal.targetMinutes])
  );
  const tasks = taskAssignments.map(({ task }) => {
    const periodKey = studyPeriodKey(task.recurrence, now);
    const completion = task.completions.find(
      (item) => item.periodKey === periodKey
    );
    return { ...task, isCompleted: Boolean(completion), periodKey };
  });

  let campaignProgress: {
    contributedMinutes: number;
    description: string | null;
    endsAt: Date;
    id: string;
    memberCount: number;
    startsAt: Date;
    targetMinutes: number;
    title: string;
  } | null = null;
  if (campaign) {
    const [contribution, memberCount] = await Promise.all([
      readCampaignContribution(campaign.startsAt, now),
      database.member.count({
        where: { role: "MEMBER", deactivatedAt: null },
      }),
    ]);
    campaignProgress = {
      ...campaign,
      contributedMinutes: Math.floor(
        Number(contribution[0]?.seconds ?? 0) / 60
      ),
      memberCount,
    };
  }

  return {
    averageWeeklyPlaybackMinutes: Math.round(
      ((lastThirtyDayPlaybackSeconds / 30) * 7) / 60
    ),
    averageWeeklyMinutes: Math.round(((lastThirtyDaySeconds / 30) * 7) / 60),
    campaign: campaignProgress,
    days,
    exerciseAnswers,
    goals: {
      monthlyMinutes: currentGoals.get(StudyGoalPeriod.MONTHLY) ?? null,
      weeklyMinutes: currentGoals.get(StudyGoalPeriod.WEEKLY) ?? null,
    },
    lessonsConsumed,
    monthMinutes: Math.floor(monthSeconds / 60),
    monthPlaybackMinutes: Math.floor(playbackSeconds / 60),
    openTasks: tasks.filter(({ isCompleted }) => !isCompleted).length,
    tasks,
    today,
    todayMinutes: Math.floor((daily.get(today)?.studySeconds ?? 0) / 60),
    weekMinutes: Math.floor(weekSeconds / 60),
    activitySubmissions,
  };
};

export const getMemberTaskHistory = async (memberId: string) =>
  database.learningTaskCompletion.findMany({
    where: { memberId },
    orderBy: { completedAt: "desc" },
    take: 50,
    select: {
      periodKey: true,
      completedAt: true,
      task: { select: { title: true, recurrence: true } },
    },
  });

export type MemberStudyDashboard = Awaited<
  ReturnType<typeof getStudyDashboardData>
>;
