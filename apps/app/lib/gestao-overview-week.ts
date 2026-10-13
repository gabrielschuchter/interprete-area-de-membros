import "server-only";
import { database, Prisma } from "@repo/database";
import { forbidden } from "next/navigation";
import { requireGestaoAction } from "./gestao-authorization";
import {
  localStudyDayStart,
  studyLocalDayKey,
  studyWeekStartKey,
} from "./study-periods";

interface WeekRow {
  readonly accessible: boolean;
  readonly activeCohorts: bigint;
  readonly activeStudents: bigint;
  readonly lessons: bigint;
  readonly previousLessons: bigint;
  readonly reviewed: bigint;
  readonly students: bigint;
  readonly studySeconds: bigint;
  readonly submissions: bigint;
}

// Prisma's existing DateTime columns store UTC without a zone. Explicit UTC
// conversion keeps comparisons independent of the PostgreSQL session timezone.
const utcTimestamp = (date: Date) =>
  Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

export const getGestaoOverviewWeek = async (input: {
  readonly cohortId?: string;
}) => {
  const { actor } = await requireGestaoAction("assignments.manage");
  const cohortId = input.cohortId?.trim() || null;
  if (cohortId && cohortId.length > 255) {
    forbidden();
  }
  const now = new Date();
  const start = localStudyDayStart(studyWeekStartKey(studyLocalDayKey(now)));
  const previousStart = new Date(start.getTime() - 7 * 86_400_000);
  const previousEnd = new Date(now.getTime() - 7 * 86_400_000);
  const rows = await database.$queryRaw<WeekRow[]>(Prisma.sql`
    WITH scoped_cohorts AS MATERIALIZED (
      SELECT c.id,c."startsAt",c."endsAt" FROM "Cohort" c
      WHERE c."archivedAt" IS NULL AND (${cohortId}::text IS NULL OR c.id=${cohortId})
      AND (${actor.role === "ADMIN"} OR EXISTS (
        SELECT 1 FROM "CohortTeacher" t WHERE t."cohortId"=c.id AND t."memberId"=${actor.userId}
      ))
    ), active_cohorts AS (
      SELECT id FROM scoped_cohorts WHERE "startsAt"<=${utcTimestamp(now)}
      AND ("endsAt" IS NULL OR "endsAt">${utcTimestamp(now)})
    ), scoped_members AS MATERIALIZED (
      SELECT m.id FROM "Member" m WHERE m.role='MEMBER'::"MemberRole" AND m."deactivatedAt" IS NULL
      AND ((${actor.role === "ADMIN"} AND ${cohortId}::text IS NULL) OR EXISTS (
        SELECT 1 FROM "CohortMembership" cm JOIN scoped_cohorts c ON c.id=cm."cohortId"
        WHERE cm."memberId"=m.id AND cm.status='ACTIVE' AND cm."leftAt" IS NULL
      ))
    ), deliveries AS (
      SELECT s.status FROM "ActivitySubmission" s JOIN scoped_members m ON m.id=s."memberId"
      WHERE s."submittedAt">=${utcTimestamp(start)} AND s."submittedAt"<=${utcTimestamp(now)}
      AND s.status IN ('SUBMITTED','REVIEWED')
    ), completed_lessons AS (
      SELECT p."completedAt" FROM "LessonProgress" p JOIN scoped_members m ON m.id=p."memberId"
      WHERE p.status='COMPLETED' AND p."completedAt">=${utcTimestamp(previousStart)} AND p."completedAt"<=${utcTimestamp(now)}
    ), per_member_study AS (
      SELECT i."memberId",range_agg(tsrange(GREATEST(i."startedAt",${utcTimestamp(start)}),LEAST(i."endedAt",${utcTimestamp(now)}),'[)')) AS ranges
      FROM "StudyActivityInterval" i JOIN scoped_members m ON m.id=i."memberId"
      WHERE i."endedAt">${utcTimestamp(start)} AND i."startedAt"<${utcTimestamp(now)} AND i."endedAt">i."startedAt"
      GROUP BY i."memberId"
    )
    SELECT (${cohortId}::text IS NULL OR EXISTS(SELECT 1 FROM scoped_cohorts)) AS accessible,
      (SELECT COUNT(*) FROM active_cohorts) AS "activeCohorts",
      (SELECT COUNT(*) FROM scoped_members m WHERE EXISTS (
        SELECT 1 FROM "CohortMembership" cm JOIN active_cohorts c ON c.id=cm."cohortId"
        WHERE cm."memberId"=m.id AND cm.status='ACTIVE' AND cm."leftAt" IS NULL
      )) AS "activeStudents",
      (SELECT COUNT(*) FROM scoped_members) AS students,
      (SELECT COUNT(*) FROM deliveries) AS submissions,
      (SELECT COUNT(*) FROM deliveries WHERE status='REVIEWED') AS reviewed,
      (SELECT COUNT(*) FROM completed_lessons WHERE "completedAt">=${utcTimestamp(start)}) AS lessons,
      (SELECT COUNT(*) FROM completed_lessons WHERE "completedAt"<=${utcTimestamp(previousEnd)}) AS "previousLessons",
      (SELECT COALESCE(FLOOR(SUM(EXTRACT(EPOCH FROM upper(r)-lower(r)))),0)::bigint FROM per_member_study CROSS JOIN LATERAL unnest(ranges) AS r) AS "studySeconds"
  `);
  const row = rows[0];
  if (!row?.accessible) {
    forbidden();
  }
  const students = Number(row.students);
  const lessons = Number(row.lessons);
  const previousLessons = Number(row.previousLessons);
  return {
    startsAt: start.toISOString(),
    endsAt: now.toISOString(),
    activeCohorts: Number(row.activeCohorts),
    activeStudents: Number(row.activeStudents),
    students,
    submissions: Number(row.submissions),
    reviewed: Number(row.reviewed),
    lessons,
    previousLessons,
    lessonChangePercent: previousLessons
      ? Math.round((lessons / previousLessons - 1) * 100)
      : null,
    averageStudySeconds: students
      ? Math.floor(Number(row.studySeconds) / students)
      : null,
  };
};
