import "server-only";
import { database, Prisma } from "@repo/database";
import { forbidden } from "next/navigation";
import { requireGestaoAction } from "./gestao-authorization";
import { getGestaoCorrectionCohortScope } from "./gestao-correction-scope";
import { queryStudentTracking } from "./gestao-student-tracking";

const dayMs = 86_400_000;
const brokenVideoStatuses = [
  "PRIVATE_OR_NOT_FOUND",
  "EMBEDDING_DISABLED",
  "INVALID",
];

export interface OverviewAttentionItem {
  readonly action: string;
  readonly detail: string;
  readonly href: string;
  readonly icon: "inbox" | "alert" | "meeting" | "draft" | "video" | "people";
  readonly id: string;
  readonly title: string;
}

export interface OverviewMeeting {
  readonly draft: boolean;
  readonly id: string;
  readonly startsAt: Date;
  readonly title: string;
}

export interface OverviewMovement {
  readonly at: Date;
  readonly href: string;
  readonly id: string;
  readonly object: string;
  readonly verb: string;
  readonly who: string;
}

interface MovementRow {
  readonly at: Date;
  readonly id: string;
  readonly lessonId: string;
  readonly title: string;
  readonly who: string | null;
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

interface AttentionCounts {
  readonly brokenVideos: number;
  readonly cohortId: string | null;
  readonly draftActivities: number;
  readonly draftCourses: number;
  readonly draftMeetings: number;
  readonly overdue: number;
  readonly overdueStudents: number;
  readonly stalled: number;
  readonly unassignedRecordings: number;
}

const buildAttentionItems = (counts: AttentionCounts) => {
  const { cohortId } = counts;
  const cohortParam = cohortId ? `turma=${encodeURIComponent(cohortId)}` : "";
  const items: OverviewAttentionItem[] = [];
  if (counts.overdue > 0) {
    items.push({
      id: "overdue",
      icon: "alert",
      title: `${plural(counts.overdue, "entrega atrasada", "entregas atrasadas")}`,
      detail: `${plural(counts.overdueStudents, "aluno", "alunos")} com prazo vencido e sem entrega.`,
      action: "Ver pendência",
      href: `/gestao/alunos/acompanhamento?situacao=ATTENTION${cohortParam ? `&${cohortParam}` : ""}`,
    });
  }
  if (counts.stalled > 0) {
    items.push({
      id: "stalled",
      icon: "people",
      title: `${plural(counts.stalled, "aluno pede", "alunos pedem")} atenção`,
      detail:
        "Sem estudar há 5 dias ou mais, inativos ou com entregas atrasadas.",
      action: "Acompanhar",
      href: `/gestao/alunos/acompanhamento${cohortParam ? `?${cohortParam}` : ""}`,
    });
  }
  if (counts.draftMeetings > 0) {
    items.push({
      id: "draft-meetings",
      icon: "meeting",
      title: `${plural(counts.draftMeetings, "encontro em rascunho", "encontros em rascunho")}`,
      detail: "Ainda não aparecem para os alunos da turma.",
      action: "Revisar e publicar",
      href: "/gestao/comunidade/encontros",
    });
  }
  const { draftCourses, draftActivities } = counts;
  const draftContent = draftCourses + draftActivities;
  if (draftContent > 0) {
    items.push({
      id: "draft-content",
      icon: "draft",
      title: `${plural(draftContent, "conteúdo em rascunho", "conteúdos em rascunho")}`,
      detail: `${plural(draftCourses, "curso", "cursos")} e ${plural(draftActivities, "atividade", "atividades")}.`,
      action: "Organizar",
      href:
        draftCourses > 0
          ? "/gestao/ensino/cursos?estado=DRAFT"
          : "/gestao/ensino/atividades?estado=DRAFT",
    });
  }
  if (counts.brokenVideos > 0) {
    items.push({
      id: "broken-videos",
      icon: "video",
      title: `${plural(counts.brokenVideos, "vídeo indisponível", "vídeos indisponíveis")}`,
      detail:
        "O YouTube informa que o vídeo é privado, removido ou sem incorporação.",
      action: "Corrigir vídeo",
      href: "/gestao/ensino/cursos",
    });
  }
  if (counts.unassignedRecordings > 0) {
    items.push({
      id: "recordings",
      icon: "video",
      title: `${plural(counts.unassignedRecordings, "grupo de gravações sem vínculo", "grupos de gravações sem vínculo")}`,
      detail: "Gravações históricas que ainda precisam de um membro.",
      action: "Vincular",
      href: "/gestao/administracao/gravacoes-historicas",
    });
  }
  return items;
};

export const getGestaoOverviewExtras = async (input: {
  readonly cohortId?: string;
}) => {
  const { actor } = await requireGestaoAction("assignments.manage");
  const isAdmin = actor.role === "ADMIN";
  const cohortId = input.cohortId?.trim() || null;
  if (cohortId && cohortId.length > 255) {
    forbidden();
  }
  const now = new Date();
  const scope = getGestaoCorrectionCohortScope(actor);
  const cohortFilter: Prisma.CohortWhereInput = cohortId
    ? { AND: [scope, { id: cohortId }] }
    : scope;
  const meetingWhere: Prisma.MeetingWhereInput = {
    startsAt: { gte: now },
    cohortTargets: { some: { revokedAt: null, cohort: { is: cohortFilter } } },
  };
  const ownContent = isAdmin
    ? {}
    : { OR: [{ createdBy: actor.userId }, { teacherId: actor.userId }] };
  const ownActivity = isAdmin ? {} : { createdBy: actor.userId };
  const courseScope: Prisma.CourseWhereInput = {
    cohortCourseAccesses: {
      some: { revokedAt: null, cohort: { is: cohortFilter } },
    },
  };
  const [
    tracking,
    draftMeetings,
    upcoming,
    draftCourses,
    draftActivities,
    brokenVideos,
    movementSubmissions,
    movementLessons,
    unassignedRecordings,
    newMembers,
    expiringGrants,
    publishedBadges,
  ] = await Promise.all([
    queryStudentTracking(
      actor,
      { cohortId: cohortId ?? undefined, limit: 5000 },
      now
    ),
    database.meeting.count({
      where: { ...meetingWhere, status: "DRAFT" },
    }),
    database.meeting.findMany({
      where: { ...meetingWhere, status: { in: ["DRAFT", "PUBLISHED"] } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: 3,
      select: { id: true, title: true, startsAt: true, status: true },
    }),
    database.course.count({ where: { status: "DRAFT", ...ownContent } }),
    database.activity.count({ where: { status: "DRAFT", ...ownActivity } }),
    database.lessonAsset.count({
      where: {
        kind: "VIDEO",
        mediaProvider: "YOUTUBE",
        youtubeVerificationStatus: { in: brokenVideoStatuses },
        lesson: {
          is: {
            status: "PUBLISHED",
            module: { is: { course: { is: courseScope } } },
          },
        },
      },
    }),
    database.activitySubmission.findMany({
      where: {
        status: { in: ["SUBMITTED", "REVIEWED"] },
        submittedAt: { not: null },
        member: {
          is: {
            deactivatedAt: null,
            cohortMemberships: {
              some: {
                status: "ACTIVE",
                leftAt: null,
                cohort: { is: cohortFilter },
              },
            },
          },
        },
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: 6,
      select: {
        id: true,
        submittedAt: true,
        member: { select: { displayName: true, email: true } },
        activity: { select: { id: true, title: true } },
      },
    }),
    database.$queryRaw<MovementRow[]>(Prisma.sql`
      SELECT lp.id, lp."completedAt" AS at, lp."lessonId", l.title, m."displayName" AS who
      FROM "LessonProgress" lp
      JOIN "Lesson" l ON l.id=lp."lessonId"
      JOIN "Member" m ON m.id=lp."memberId" AND m."deactivatedAt" IS NULL
      WHERE lp.status='COMPLETED' AND lp."completedAt" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "CohortMembership" cm JOIN "Cohort" c ON c.id=cm."cohortId"
        WHERE cm."memberId"=lp."memberId" AND cm.status='ACTIVE' AND cm."leftAt" IS NULL
        AND c."archivedAt" IS NULL
        AND (${cohortId}::text IS NULL OR c.id=${cohortId})
        AND (${isAdmin} OR EXISTS (
          SELECT 1 FROM "CohortTeacher" t WHERE t."cohortId"=c.id AND t."memberId"=${actor.userId}
        ))
      )
      ORDER BY lp."completedAt" DESC, lp.id DESC
      LIMIT 6
    `),
    isAdmin
      ? database.importedRecordingGroup.count({ where: { memberId: null } })
      : Promise.resolve(0),
    isAdmin
      ? database.member.count({
          where: {
            deactivatedAt: null,
            createdAt: { gte: new Date(now.getTime() - 7 * dayMs) },
          },
        })
      : Promise.resolve(0),
    isAdmin
      ? database.accessGrant.count({
          where: {
            expiresAt: { gte: now, lte: new Date(now.getTime() + 7 * dayMs) },
          },
        })
      : Promise.resolve(0),
    isAdmin
      ? database.badgeDefinition.count({ where: { status: "PUBLISHED" } })
      : Promise.resolve(0),
  ]);
  const overdue = tracking.rows.reduce(
    (sum, row) => sum + row.overdueDeliveries,
    0
  );
  const overdueStudents = tracking.rows.filter(
    (row) => row.overdueDeliveries > 0
  ).length;
  const stalled = tracking.rows.filter(
    (row) => row.situation !== "ON_TRACK"
  ).length;
  const items = buildAttentionItems({
    brokenVideos,
    cohortId,
    draftActivities,
    draftCourses,
    draftMeetings,
    overdue,
    overdueStudents,
    stalled,
    unassignedRecordings,
  });
  const movement: OverviewMovement[] = [
    ...movementSubmissions.flatMap((submission): OverviewMovement[] =>
      submission.submittedAt
        ? [
            {
              id: `s-${submission.id}`,
              at: submission.submittedAt,
              who:
                submission.member.displayName ??
                submission.member.email ??
                "Aluno",
              verb: "entregou",
              object: submission.activity.title,
              href: `/gestao/ensino/atividades/${submission.activity.id}/entregas`,
            },
          ]
        : []
    ),
    ...movementLessons.map(
      (row): OverviewMovement => ({
        id: `l-${row.id}`,
        at: row.at,
        who: row.who ?? "Aluno",
        verb: "concluiu a aula",
        object: row.title,
        href: "/gestao/alunos/acompanhamento",
      })
    ),
  ]
    .sort((left, right) => right.at.getTime() - left.at.getTime())
    .slice(0, 6);
  return {
    isAdmin,
    items,
    movement,
    upcoming: upcoming.map(
      (meeting): OverviewMeeting => ({
        id: meeting.id,
        title: meeting.title,
        startsAt: meeting.startsAt,
        draft: meeting.status === "DRAFT",
      })
    ),
    institutional: isAdmin
      ? { newMembers, expiringGrants, publishedBadges }
      : null,
  };
};
