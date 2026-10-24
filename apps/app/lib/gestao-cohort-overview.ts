import "server-only";
import { database, Prisma } from "@repo/database";
import { requireGestaoCohortActor } from "./gestao-authorization";
import {
  queryStudentTracking,
  type StudentTrackingRow,
} from "./gestao-student-tracking";

const dayMs = 86_400_000;
const attentionListSize = 5;

export interface CohortWeekItem {
  readonly at: Date;
  readonly detail: string;
  readonly draft: boolean;
  readonly href: string;
  readonly kind: "meeting" | "deadline" | "release" | "event";
  readonly title: string;
}

interface RateRow {
  readonly attendance: bigint;
  readonly onTime: bigint;
  readonly present: bigint;
  readonly submitted: bigint;
}

const utc = (date: Date) =>
  Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

export const getGestaoCohortOverviewExtras = async (cohortId: string) => {
  const { actor } = await requireGestaoCohortActor(cohortId);
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * dayMs);
  const activeTarget = { revokedAt: null, cohortId };
  const [
    meetings,
    deadlines,
    releases,
    events,
    openActivities,
    futureMeetings,
    tracking,
    rates,
  ] = await Promise.all([
    database.meeting.findMany({
      where: {
        status: { in: ["DRAFT", "PUBLISHED"] },
        startsAt: { gte: now, lte: weekEnd },
        cohortTargets: { some: activeTarget },
      },
      orderBy: { startsAt: "asc" },
      take: 10,
      select: { id: true, title: true, startsAt: true, status: true },
    }),
    database.activity.findMany({
      where: {
        status: "PUBLISHED",
        dueAt: { gte: now, lte: weekEnd },
        cohortTargets: { some: { ...activeTarget, activeKey: { not: null } } },
      },
      orderBy: { dueAt: "asc" },
      take: 10,
      select: {
        id: true,
        title: true,
        dueAt: true,
        _count: {
          select: {
            submissions: {
              where: { status: { in: ["SUBMITTED", "REVIEWED"] } },
            },
          },
        },
      },
    }),
    database.cohortLessonRelease.findMany({
      where: { cohortId, releaseAt: { gte: now, lte: weekEnd } },
      orderBy: { releaseAt: "asc" },
      take: 10,
      select: {
        releaseAt: true,
        lesson: { select: { title: true } },
      },
    }),
    database.cohortEvent.findMany({
      where: {
        cohortId,
        status: { in: ["DRAFT", "PUBLISHED"] },
        startsAt: { gte: now, lte: weekEnd },
      },
      orderBy: { startsAt: "asc" },
      take: 10,
      select: { id: true, title: true, startsAt: true, status: true },
    }),
    database.activity.count({
      where: {
        status: "PUBLISHED",
        OR: [{ dueAt: null }, { dueAt: { gt: now } }],
        cohortTargets: { some: { ...activeTarget, activeKey: { not: null } } },
      },
    }),
    database.meeting.count({
      where: {
        status: "PUBLISHED",
        startsAt: { gt: now },
        cohortTargets: { some: activeTarget },
      },
    }),
    queryStudentTracking(actor, { cohortId, limit: 200 }, now),
    database.$queryRaw<RateRow[]>(Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM "ActivitySubmission" s
          JOIN "Activity" a ON a.id=s."activityId"
          JOIN "ActivityCohortTarget" t ON t."activityId"=a.id AND t."cohortId"=${cohortId} AND t."revokedAt" IS NULL
          JOIN "CohortMembership" cm ON cm."memberId"=s."memberId" AND cm."cohortId"=${cohortId}
            AND cm.status='ACTIVE' AND cm."leftAt" IS NULL
          WHERE s.status IN ('SUBMITTED','REVIEWED') AND a."dueAt" IS NOT NULL
            AND s."submittedAt"<=a."dueAt") AS "onTime",
        (SELECT COUNT(*) FROM "ActivitySubmission" s
          JOIN "Activity" a ON a.id=s."activityId"
          JOIN "ActivityCohortTarget" t ON t."activityId"=a.id AND t."cohortId"=${cohortId} AND t."revokedAt" IS NULL
          JOIN "CohortMembership" cm ON cm."memberId"=s."memberId" AND cm."cohortId"=${cohortId}
            AND cm.status='ACTIVE' AND cm."leftAt" IS NULL
          WHERE s.status IN ('SUBMITTED','REVIEWED') AND a."dueAt" IS NOT NULL) AS submitted,
        (SELECT COUNT(*) FROM "MeetingAttendance" ma
          JOIN "Meeting" m ON m.id=ma."meetingId" AND m."startsAt"<${utc(now)}
          JOIN "MeetingCohortTarget" mt ON mt."meetingId"=m.id AND mt."cohortId"=${cohortId} AND mt."revokedAt" IS NULL
          JOIN "CohortMembership" cm ON cm."memberId"=ma."memberId" AND cm."cohortId"=${cohortId}
            AND cm.status='ACTIVE' AND cm."leftAt" IS NULL
          WHERE ma."isPresent") AS present,
        (SELECT COUNT(*) FROM "MeetingAttendance" ma
          JOIN "Meeting" m ON m.id=ma."meetingId" AND m."startsAt"<${utc(now)}
          JOIN "MeetingCohortTarget" mt ON mt."meetingId"=m.id AND mt."cohortId"=${cohortId} AND mt."revokedAt" IS NULL
          JOIN "CohortMembership" cm ON cm."memberId"=ma."memberId" AND cm."cohortId"=${cohortId}
            AND cm.status='ACTIVE' AND cm."leftAt" IS NULL) AS attendance
    `),
  ]);
  const week: CohortWeekItem[] = [
    ...meetings.map(
      (meeting): CohortWeekItem => ({
        at: meeting.startsAt,
        kind: "meeting",
        title: meeting.title,
        detail: "Encontro",
        draft: meeting.status === "DRAFT",
        href: "/gestao/comunidade/encontros",
      })
    ),
    ...deadlines.flatMap((activity): CohortWeekItem[] =>
      activity.dueAt
        ? [
            {
              at: activity.dueAt,
              kind: "deadline",
              title: activity.title,
              detail: `Prazo · ${activity._count.submissions} entregas`,
              draft: false,
              href: `/gestao/ensino/atividades/${activity.id}/entregas`,
            },
          ]
        : []
    ),
    ...releases.map(
      (release): CohortWeekItem => ({
        at: release.releaseAt,
        kind: "release",
        title: release.lesson.title,
        detail: "Liberação de aula",
        draft: false,
        href: `/gestao/alunos/turmas/${cohortId}/conteudo`,
      })
    ),
    ...events.map(
      (event): CohortWeekItem => ({
        at: event.startsAt,
        kind: "event",
        title: event.title,
        detail: "Evento da turma",
        draft: event.status === "DRAFT",
        href: `/gestao/alunos/turmas/${cohortId}/calendario`,
      })
    ),
  ]
    .sort((left, right) => left.at.getTime() - right.at.getTime())
    .slice(0, 8);
  const attention: StudentTrackingRow[] = tracking.rows
    .filter((row) => row.situation !== "ON_TRACK")
    .slice(0, attentionListSize);
  const rate = rates[0];
  const percent = (part: bigint | undefined, whole: bigint | undefined) =>
    whole && whole > 0n
      ? Math.round((Number(part) / Number(whole)) * 100)
      : null;
  return {
    attention,
    attentionTotal: tracking.rows.filter((row) => row.situation !== "ON_TRACK")
      .length,
    futureMeetings,
    onTimeRate: percent(rate?.onTime, rate?.submitted),
    openActivities,
    attendanceRate: percent(rate?.present, rate?.attendance),
    week,
  };
};
