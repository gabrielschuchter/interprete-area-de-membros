import "server-only";
import { database, Prisma } from "@repo/database";
import { forbidden } from "next/navigation";
import { type GestaoActor, requireGestaoAction } from "./gestao-authorization";

// Rules shared by "Alunos e acompanhamento" and "Alunos que pedem atenção"
// in the cohort overview: attention after 5 days without studying (or any
// overdue delivery), inactive after 21 days.
export const attentionAfterDays = 5;
export const inactiveAfterDays = 21;

export type StudentSituation = "ON_TRACK" | "ATTENTION" | "INACTIVE";
export const studentSituations = [
  "ON_TRACK",
  "ATTENTION",
  "INACTIVE",
] as const satisfies readonly StudentSituation[];

export const situationLabels: Record<StudentSituation, string> = {
  ON_TRACK: "Em ritmo",
  ATTENTION: "Atenção",
  INACTIVE: "Inativo",
};

export const parseSituation = (value: string | undefined) =>
  studentSituations.find((situation) => situation === value);

export interface StudentTrackingRow {
  readonly activitiesDone: number;
  readonly activitiesTotal: number;
  readonly cohorts: readonly string[];
  readonly daysSinceActivity: number;
  readonly displayName: string;
  readonly email: string | null;
  readonly id: string;
  readonly lastStudyAt: Date | null;
  readonly lessonsDone: number;
  readonly lessonsTotal: number;
  readonly overdueDeliveries: number;
  readonly situation: StudentSituation;
  readonly studySecondsLast7Days: number;
}

interface RawRow {
  readonly activitiesDone: number;
  readonly activitiesTotal: number;
  readonly cohorts: string[] | null;
  readonly counts: Record<string, number> | null;
  readonly daysSinceActivity: number;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly id: string;
  readonly lastStudyAt: Date | null;
  readonly lessonsDone: number;
  readonly lessonsTotal: number;
  readonly overdueDeliveries: number;
  readonly situation: StudentSituation;
  readonly studySeconds7: number;
  readonly total: bigint;
}

const utc = (date: Date) =>
  Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

export interface StudentTrackingInput {
  readonly cohortId?: string;
  readonly courseId?: string;
  /** Inclui progresso em aulas e atividades; custa duas varreduras por aluno. */
  readonly detail?: boolean;
  readonly limit?: number;
  readonly memberId?: string;
  readonly offset?: number;
  readonly query?: string;
  readonly situation?: StudentSituation;
}

export const queryStudentTracking = async (
  actor: Pick<GestaoActor, "role" | "userId">,
  input: StudentTrackingInput,
  now = new Date()
) => {
  const isAdmin = actor.role === "ADMIN";
  const cohortId = input.cohortId?.trim() || null;
  const courseId = input.courseId?.trim() || null;
  const query = input.query?.trim().slice(0, 120) || null;
  const pattern = query ? `%${query.replace(/[\\%_]/gu, "\\$&")}%` : null;
  const memberId = input.memberId?.trim() || null;
  const situation = input.situation ?? null;
  const detail = input.detail ?? false;
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 5000);
  const offset = Math.max(input.offset ?? 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const rows = await database.$queryRaw<RawRow[]>(Prisma.sql`
    WITH scoped_cohorts AS MATERIALIZED (
      SELECT c.id, c.name, c."lateJoinPolicy", c."startsAt" FROM "Cohort" c
      WHERE c."archivedAt" IS NULL
      AND (${cohortId}::text IS NOT NULL OR c."endsAt" IS NULL OR c."endsAt">${utc(now)})
      AND (${cohortId}::text IS NULL OR c.id=${cohortId})
      AND (${isAdmin} OR EXISTS (
        SELECT 1 FROM "CohortTeacher" t WHERE t."cohortId"=c.id AND t."memberId"=${actor.userId}
      ))
      AND (${courseId}::text IS NULL OR EXISTS (
        SELECT 1 FROM "CohortCourseAccess" a
        WHERE a."cohortId"=c.id AND a."courseId"=${courseId} AND a."revokedAt" IS NULL
      ))
    ), roster AS MATERIALIZED (
      SELECT cm."memberId", MIN(GREATEST(cm."joinedAt", c."startsAt")) AS "joinedAt",
        array_agg(DISTINCT c.name ORDER BY c.name) AS cohorts
      FROM "CohortMembership" cm JOIN scoped_cohorts c ON c.id=cm."cohortId"
      WHERE cm.status='ACTIVE' AND cm."leftAt" IS NULL
      AND (${memberId}::text IS NULL OR cm."memberId"=${memberId})
      GROUP BY cm."memberId"
    ), base AS (
      SELECT m.id, m."displayName", m.email, r.cohorts, r."joinedAt",
        (SELECT MAX(i."endedAt") FROM "StudyActivityInterval" i WHERE i."memberId"=m.id) AS "lastStudyAt",
        (SELECT COALESCE(SUM(i.seconds),0) FROM "StudyActivityInterval" i
          WHERE i."memberId"=m.id AND i."endedAt">${utc(sevenDaysAgo)}) AS "studySeconds7",
        (SELECT COUNT(DISTINCT a.id) FROM "Activity" a
          WHERE a.status='PUBLISHED' AND a."dueAt" IS NOT NULL AND a."dueAt"<${utc(now)}
          AND NOT EXISTS (
            SELECT 1 FROM "ActivitySubmission" s WHERE s."activityId"=a.id AND s."memberId"=m.id
            AND s.status IN ('SUBMITTED','REVIEWED')
          )
          AND (
            EXISTS (
              SELECT 1 FROM "ActivityCohortTarget" t
              JOIN "CohortMembership" cm2 ON cm2."cohortId"=t."cohortId" AND cm2."memberId"=m.id
                AND cm2.status='ACTIVE' AND cm2."leftAt" IS NULL
              JOIN scoped_cohorts sc ON sc.id=t."cohortId"
              WHERE t."activityId"=a.id AND t."revokedAt" IS NULL
              AND (sc."lateJoinPolicy"<>'FROM_JOIN' OR t."assignedAt">=cm2."joinedAt")
            )
            OR EXISTS (
              SELECT 1 FROM "ActivityAssignment" x
              WHERE x."activityId"=a.id AND x."memberId"=m.id AND x."revokedAt" IS NULL
              AND x.status<>'REVOKED'
            )
          )
        )::int AS "overdueDeliveries",
        CASE WHEN ${detail} THEN (
          SELECT COUNT(DISTINCT l.id)::int FROM "CohortCourseAccess" a
          JOIN scoped_cohorts sc ON sc.id=a."cohortId"
          JOIN "CohortMembership" cm3 ON cm3."cohortId"=sc.id AND cm3."memberId"=m.id
            AND cm3.status='ACTIVE' AND cm3."leftAt" IS NULL
          JOIN "Module" mo ON mo."courseId"=a."courseId" AND mo.status='PUBLISHED'
          JOIN "Lesson" l ON l."moduleId"=mo.id AND l.status='PUBLISHED'
          WHERE a."revokedAt" IS NULL
        ) ELSE 0 END AS "lessonsTotal",
        CASE WHEN ${detail} THEN (
          SELECT COUNT(DISTINCT l.id)::int FROM "CohortCourseAccess" a
          JOIN scoped_cohorts sc ON sc.id=a."cohortId"
          JOIN "CohortMembership" cm3 ON cm3."cohortId"=sc.id AND cm3."memberId"=m.id
            AND cm3.status='ACTIVE' AND cm3."leftAt" IS NULL
          JOIN "Module" mo ON mo."courseId"=a."courseId" AND mo.status='PUBLISHED'
          JOIN "Lesson" l ON l."moduleId"=mo.id AND l.status='PUBLISHED'
          JOIN "LessonProgress" lp ON lp."lessonId"=l.id AND lp."memberId"=m.id AND lp.status='COMPLETED'
          WHERE a."revokedAt" IS NULL
        ) ELSE 0 END AS "lessonsDone",
        CASE WHEN ${detail} THEN (
          SELECT COUNT(DISTINCT a.id)::int FROM "Activity" a
          WHERE a.status='PUBLISHED' AND (
            EXISTS (
              SELECT 1 FROM "ActivityCohortTarget" t
              JOIN "CohortMembership" cm2 ON cm2."cohortId"=t."cohortId" AND cm2."memberId"=m.id
                AND cm2.status='ACTIVE' AND cm2."leftAt" IS NULL
              JOIN scoped_cohorts sc ON sc.id=t."cohortId"
              WHERE t."activityId"=a.id AND t."revokedAt" IS NULL
              AND (sc."lateJoinPolicy"<>'FROM_JOIN' OR t."assignedAt">=cm2."joinedAt")
            )
            OR EXISTS (
              SELECT 1 FROM "ActivityAssignment" x
              WHERE x."activityId"=a.id AND x."memberId"=m.id AND x."revokedAt" IS NULL
              AND x.status<>'REVOKED'
            )
          )
        ) ELSE 0 END AS "activitiesTotal",
        CASE WHEN ${detail} THEN (
          SELECT COUNT(DISTINCT s."activityId")::int FROM "ActivitySubmission" s
          JOIN "Activity" a ON a.id=s."activityId" AND a.status='PUBLISHED'
          WHERE s."memberId"=m.id AND s.status IN ('SUBMITTED','REVIEWED')
        ) ELSE 0 END AS "activitiesDone"
      FROM "Member" m JOIN roster r ON r."memberId"=m.id
      WHERE m."deactivatedAt" IS NULL AND m.role='MEMBER'::"MemberRole"
      AND (${pattern}::text IS NULL OR m."displayName" ILIKE ${pattern} OR m.email ILIKE ${pattern})
    ), classified AS (
      SELECT b.*,
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (${utc(now)} - COALESCE(b."lastStudyAt", b."joinedAt")))/86400))::int AS "daysSinceActivity"
      FROM base b
    ), final AS (
      SELECT c.*,
        CASE
          WHEN c."daysSinceActivity">=${inactiveAfterDays} THEN 'INACTIVE'
          WHEN c."daysSinceActivity">=${attentionAfterDays} OR c."overdueDeliveries">0 THEN 'ATTENTION'
          ELSE 'ON_TRACK'
        END AS situation
      FROM classified c
    )
    SELECT f.id, f."displayName", f.email, f.cohorts, f."lastStudyAt", f."studySeconds7",
      f."overdueDeliveries", f."daysSinceActivity", f.situation,
      f."lessonsTotal", f."lessonsDone", f."activitiesTotal", f."activitiesDone",
      (SELECT jsonb_object_agg(g.situation, g.n) FROM (
        SELECT situation, COUNT(*)::int AS n FROM final GROUP BY situation
      ) g) AS counts,
      COUNT(*) OVER () AS total
    FROM final f
    WHERE ${situation}::text IS NULL OR f.situation=${situation}
    ORDER BY CASE f.situation WHEN 'INACTIVE' THEN 0 WHEN 'ATTENTION' THEN 1 ELSE 2 END,
      f."daysSinceActivity" DESC, f."displayName" ASC NULLS LAST, f.id ASC
    LIMIT ${limit} OFFSET ${offset}
  `);
  const counts = rows[0]?.counts ?? {};
  return {
    counts: {
      ATTENTION: counts.ATTENTION ?? 0,
      INACTIVE: counts.INACTIVE ?? 0,
      ON_TRACK: counts.ON_TRACK ?? 0,
    } satisfies Record<StudentSituation, number>,
    total: rows[0] ? Number(rows[0].total) : 0,
    rows: rows.map<StudentTrackingRow>((row) => ({
      activitiesDone: Number(row.activitiesDone),
      activitiesTotal: Number(row.activitiesTotal),
      lessonsDone: Number(row.lessonsDone),
      lessonsTotal: Number(row.lessonsTotal),
      id: row.id,
      displayName: row.displayName ?? row.email ?? "Aluno sem nome",
      email: row.email,
      cohorts: row.cohorts ?? [],
      lastStudyAt: row.lastStudyAt,
      daysSinceActivity: row.daysSinceActivity,
      overdueDeliveries: row.overdueDeliveries,
      studySecondsLast7Days: Number(row.studySeconds7),
      situation: row.situation,
    })),
  };
};

export const listGestaoStudentTracking = async (
  input: StudentTrackingInput
) => {
  const { actor } = await requireGestaoAction("students.read");
  const cohortId = input.cohortId?.trim();
  if (cohortId && cohortId.length > 255) {
    forbidden();
  }
  return { actor, ...(await queryStudentTracking(actor, input)) };
};
