import "server-only";

import { createHash } from "node:crypto";

import { ContentStatus, database, MemberRole, Prisma } from "@repo/database";
import { forbidden } from "next/navigation";
import { cache } from "react";
import { requireOnboardedMemberId } from "./authorization";
import {
  resolveCohortCalendarDateConflicts,
  resolveCohortCalendarItems,
} from "./cohort-calendar-domain";
import {
  type CohortLifecycleStatus,
  cohortLifecycleStatusAt,
} from "./cohort-domain";
import { requireGestaoActor } from "./gestao-authorization";
import type { GestaoRole } from "./gestao-permissions";

export type GestaoCohortTab = CohortLifecycleStatus | "ALL";
export interface GestaoCohortListInput {
  readonly page?: number;
  readonly query?: string;
  readonly status?: GestaoCohortTab;
}
const inviteTokenPattern = /^[a-f\d]{32}$/iu;
const pageSize = 24;
const rosterPageSize = 25;
const cohortEventPageSize = 50;
const cohortCalendarConflictReadLimit = 500;
const queryMaxLength = 120;
const cohortLearningProgress = async (
  cohortIds: readonly string[],
  activeStudentCounts: ReadonlyMap<string, number>
) => {
  if (cohortIds.length === 0) {
    return new Map<string, number>();
  }
  const rows = await database.$queryRaw<
    Array<{
      cohortId: string;
      completedLessonCount: number;
      lessonCount: number;
    }>
  >(Prisma.sql`
    SELECT
      access."cohortId" AS "cohortId",
      COUNT(DISTINCT lesson.id)::integer AS "lessonCount",
      COUNT(DISTINCT progress.id)::integer AS "completedLessonCount"
    FROM "CohortCourseAccess" AS access
    JOIN "Module" AS module ON module."courseId" = access."courseId"
    JOIN "Lesson" AS lesson ON lesson."moduleId" = module.id
    LEFT JOIN "LessonProgress" AS progress
      ON progress."lessonId" = lesson.id
      AND progress.status = 'COMPLETED'::"ProgressStatus"
      AND EXISTS (
        SELECT 1
        FROM "CohortMembership" AS membership
        WHERE membership."cohortId" = access."cohortId"
          AND membership."memberId" = progress."memberId"
          AND membership.status = 'ACTIVE'::"CohortMemberStatus"
          AND membership."leftAt" IS NULL
      )
    WHERE access."cohortId" IN (${Prisma.join(cohortIds)})
      AND access."revokedAt" IS NULL
      AND lesson.status = 'PUBLISHED'::"ContentStatus"
    GROUP BY access."cohortId"
  `);
  const progressByCohort = new Map<string, number>();
  for (const row of rows) {
    const studentCount = activeStudentCounts.get(row.cohortId) ?? 0;
    const denominator = studentCount * row.lessonCount;
    progressByCohort.set(
      row.cohortId,
      denominator > 0
        ? Math.round((row.completedLessonCount / denominator) * 100)
        : 0
    );
  }
  return progressByCohort;
};
const statusFilter = (
  status: GestaoCohortTab,
  now: Date
): Prisma.CohortWhereInput => {
  switch (status) {
    case "ACTIVE":
      return {
        archivedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      };
    case "NOT_STARTED":
      return { archivedAt: null, startsAt: { gt: now } };
    case "ENDED":
      return { archivedAt: null, endsAt: { lte: now } };
    case "ARCHIVED":
      return { archivedAt: { not: null } };
    default:
      return { archivedAt: null };
  }
};
const actorScope = (
  userId: string,
  role: GestaoRole
): Prisma.CohortWhereInput =>
  role === "ADMIN" ? {} : { teachers: { some: { memberId: userId } } };
const searchInput = (value: string | undefined) =>
  value?.trim().slice(0, queryMaxLength) ?? "";
const cohortSearch = (query: string): Prisma.CohortWhereInput =>
  query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};

export const listGestaoCohorts = cache(
  async (input: GestaoCohortListInput = {}) => {
    const actor = await requireGestaoActor();
    const now = new Date();
    const page = Math.max(1, Math.trunc(input.page ?? 1));
    const status = input.status ?? "ACTIVE";
    const query = searchInput(input.query);
    const scope = actorScope(actor.userId, actor.role);
    const where: Prisma.CohortWhereInput = {
      AND: [scope, statusFilter(status, now), cohortSearch(query)],
    };
    const statusCounts = await Promise.all(
      (["ACTIVE", "NOT_STARTED", "ENDED", "ARCHIVED"] as const).map(
        async (tab) => {
          const count = await database.cohort.count({
            where: {
              AND: [scope, statusFilter(tab, now), cohortSearch(query)],
            },
          });
          return [tab, count] as const;
        }
      )
    );
    const [cohorts, totalCount, unassignedMemberCount] = await Promise.all([
      database.cohort.findMany({
        where,
        orderBy: [{ startsAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          slug: true,
          startsAt: true,
          endsAt: true,
          archivedAt: true,
          lateJoinPolicy: true,
          version: true,
          teachers: {
            orderBy: { assignedAt: "asc" },
            take: 2,
            select: { member: { select: { id: true, displayName: true } } },
          },
          _count: {
            select: {
              memberships: { where: { status: "ACTIVE", leftAt: null } },
              courseAccesses: { where: { revokedAt: null } },
              invites: { where: { revokedAt: null, expiresAt: { gt: now } } },
              meetingTargets: {
                where: {
                  revokedAt: null,
                  meeting: {
                    demoKey: null,
                    status: {
                      in: [ContentStatus.DRAFT, ContentStatus.PUBLISHED],
                    },
                  },
                },
              },
            },
          },
        },
      }),
      database.cohort.count({ where }),
      actor.role === MemberRole.ADMIN
        ? database.member.count({
            where: {
              role: MemberRole.MEMBER,
              deactivatedAt: null,
              cohortMemberships: { none: { status: "ACTIVE", leftAt: null } },
            },
          })
        : Promise.resolve(null),
    ]);
    const activeStudentCounts = new Map(
      cohorts.map((cohort) => [cohort.id, cohort._count.memberships])
    );
    const progressByCohort = await cohortLearningProgress(
      cohorts.map(({ id }) => id),
      activeStudentCounts
    );
    return {
      cohorts: cohorts.map((cohort) => ({
        ...cohort,
        status: cohortLifecycleStatusAt(cohort, now),
        activeStudentCount: cohort._count.memberships,
        courseCount: cohort._count.courseAccesses,
        pendingInviteCount: cohort._count.invites,
        meetingCount: cohort._count.meetingTargets,
        averageProgress: progressByCohort.get(cohort.id) ?? 0,
        responsible: cohort.teachers.map(({ member }) => member),
      })),
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      unassignedMemberCount,
      statusCounts: Object.fromEntries(statusCounts) as Record<
        Exclude<GestaoCohortTab, "ALL">,
        number
      >,
    };
  }
);

export const listGestaoAssignableCohorts = cache(
  async (input: { readonly page?: number; readonly query?: string } = {}) => {
    const actor = await requireGestaoActor();
    const now = new Date();
    const page = Math.max(1, Math.trunc(input.page ?? 1));
    const query = searchInput(input.query);
    const where: Prisma.CohortWhereInput = {
      AND: [
        actorScope(actor.userId, actor.role),
        {
          OR: [statusFilter("ACTIVE", now), statusFilter("NOT_STARTED", now)],
        },
        cohortSearch(query),
      ],
    };
    const [cohorts, totalCount] = await Promise.all([
      database.cohort.findMany({
        where,
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          startsAt: true,
          endsAt: true,
          archivedAt: true,
          teachers: {
            orderBy: { assignedAt: "asc" },
            take: 1,
            select: { member: { select: { displayName: true } } },
          },
          _count: {
            select: {
              memberships: { where: { status: "ACTIVE", leftAt: null } },
            },
          },
        },
      }),
      database.cohort.count({ where }),
    ]);
    return {
      cohorts: cohorts.map((cohort) => ({
        id: cohort.id,
        name: cohort.name,
        startsAt: cohort.startsAt,
        endsAt: cohort.endsAt,
        status: cohortLifecycleStatusAt(cohort, now),
        activeStudentCount: cohort._count.memberships,
        responsible: cohort.teachers[0]?.member.displayName ?? null,
      })),
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  }
);

export const getGestaoCohortDetail = async (cohortId: string) => {
  const actor = await requireGestaoActor();
  const cohort = await database.cohort.findFirst({
    where: { AND: [{ id: cohortId }, actorScope(actor.userId, actor.role)] },
    select: {
      id: true,
      name: true,
      slug: true,
      startsAt: true,
      endsAt: true,
      lateJoinPolicy: true,
      readAfterEndDays: true,
      notifyOnNews: true,
      archivedAt: true,
      version: true,
      createdAt: true,
      teachers: {
        orderBy: { assignedAt: "asc" },
        select: {
          member: { select: { id: true, displayName: true, email: true } },
        },
      },
      courseAccesses: {
        where: { revokedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          courseId: true,
          releaseMode: true,
          startsAt: true,
          course: { select: { title: true, slug: true, status: true } },
        },
      },
      _count: {
        select: {
          memberships: { where: { status: "ACTIVE", leftAt: null } },
          invites: {
            where: { revokedAt: null, expiresAt: { gt: new Date() } },
          },
        },
      },
    },
  });
  if (!cohort) {
    forbidden();
  }
  return {
    ...cohort,
    status: cohortLifecycleStatusAt(cohort, new Date()),
    activeStudentCount: cohort._count.memberships,
    pendingInviteCount: cohort._count.invites,
  };
};

export const listGestaoCohortCalendarEvents = async (
  cohortId: string,
  input: {
    readonly end: Date;
    readonly page?: number;
    readonly start: Date;
  }
) => {
  const actor = await requireGestaoActor();
  const cohort = await database.cohort.findFirst({
    where: { AND: [{ id: cohortId }, actorScope(actor.userId, actor.role)] },
    select: { id: true },
  });
  if (!cohort) {
    return null;
  }

  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const where: Prisma.CohortEventWhereInput = {
    cohortId,
    OR: [
      { startsAt: { gte: input.start, lt: input.end } },
      { startsAt: { lt: input.start }, endsAt: { gte: input.start } },
      {
        recurrence: { not: "NONE" },
        OR: [
          { recurrenceUntil: null },
          { recurrenceUntil: { gte: input.start } },
        ],
      },
    ],
  };
  const sourceLimit = cohortCalendarConflictReadLimit + 1;
  const [
    eventRows,
    events,
    totalCount,
    meetingRows,
    activityRows,
    releaseRows,
  ] = await Promise.all([
    database.cohortEvent.findMany({
      where,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: sourceLimit,
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        color: true,
        status: true,
        version: true,
        publishedAt: true,
        updatedAt: true,
        recurrence: true,
        recurrenceUntil: true,
      },
    }),
    database.cohortEvent.findMany({
      where,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * cohortEventPageSize,
      take: cohortEventPageSize,
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        color: true,
        status: true,
        version: true,
        publishedAt: true,
        updatedAt: true,
        recurrence: true,
        recurrenceUntil: true,
      },
    }),
    database.cohortEvent.count({ where }),
    database.meeting.findMany({
      where: {
        demoKey: null,
        cohortTargets: { some: { cohortId, revokedAt: null } },
        OR: [
          { startsAt: { gte: input.start, lt: input.end } },
          { startsAt: { lt: input.start }, endsAt: { gte: input.start } },
          { recurrenceRule: { not: null } },
        ],
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: sourceLimit,
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        status: true,
        recurrenceRule: true,
        recurrenceUntil: true,
        updatedAt: true,
        timezone: true,
        occurrenceExceptions: {
          where: {
            OR: [
              { occurrenceStartsAt: { gte: input.start, lt: input.end } },
              { startsAtOverride: { gte: input.start, lt: input.end } },
            ],
          },
          select: {
            occurrenceStartsAt: true,
            startsAtOverride: true,
            endsAtOverride: true,
            titleOverride: true,
            descriptionOverride: true,
            cancelledAt: true,
            version: true,
          },
        },
      },
    }),
    database.activity.findMany({
      where: {
        status: "PUBLISHED",
        dueAt: { gte: input.start, lt: input.end },
        cohortTargets: {
          some: { cohortId, activeKey: { not: null }, revokedAt: null },
        },
      },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      take: sourceLimit,
      select: { id: true, title: true, slug: true, dueAt: true },
    }),
    database.cohortLessonRelease.findMany({
      where: {
        cohortId,
        releaseAt: { gte: input.start, lt: input.end },
        lesson: {
          is: {
            status: "PUBLISHED",
            module: {
              is: {
                status: "PUBLISHED",
                course: { is: { status: "PUBLISHED" } },
              },
            },
          },
        },
      },
      orderBy: [{ releaseAt: "asc" }, { id: "asc" }],
      take: sourceLimit,
      select: {
        id: true,
        releaseAt: true,
        lesson: {
          select: {
            title: true,
            slug: true,
            module: { select: { course: { select: { slug: true } } } },
          },
        },
      },
    }),
  ]);

  const eventExceptions =
    await database.cohortEventOccurrenceException.findMany({
      where: {
        event: { cohortId },
        OR: [
          { occurrenceStartsAt: { gte: input.start, lt: input.end } },
          { startsAtOverride: { gte: input.start, lt: input.end } },
        ],
      },
      take: sourceLimit,
      select: {
        eventId: true,
        occurrenceStartsAt: true,
        startsAtOverride: true,
        endsAtOverride: true,
        titleOverride: true,
        descriptionOverride: true,
        colorOverride: true,
        cancelledAt: true,
        version: true,
      },
    });
  const exceptionsByEvent = new Map<string, typeof eventExceptions>();
  for (const exception of eventExceptions) {
    const list = exceptionsByEvent.get(exception.eventId) ?? [];
    list.push(exception);
    exceptionsByEvent.set(exception.eventId, list);
  }
  const sources = [
    ...eventRows.map((event) => ({
      id: event.id,
      sourceType: "event" as const,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      color: event.color,
      status: event.status,
      recurrence: event.recurrence,
      recurrenceUntil: event.recurrenceUntil,
      sourceRevision: event.version,
      href: `/gestao/alunos/turmas/${cohortId}/calendario`,
      exceptions: (exceptionsByEvent.get(event.id) ?? []).map((item) => ({
        ...item,
        colorOverride: item.colorOverride,
      })),
    })),
    ...meetingRows.map((meeting) => ({
      id: meeting.id,
      sourceType: "meeting" as const,
      title: meeting.title,
      description: meeting.description,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      status: meeting.status,
      recurrenceRule: meeting.recurrenceRule,
      recurrenceUntil: meeting.recurrenceUntil,
      sourceRevision: meeting.updatedAt.toISOString(),
      timezone: meeting.timezone,
      href: `/encontros/${meeting.id}`,
      exceptions: meeting.occurrenceExceptions.map((item) => ({
        ...item,
        colorOverride: null,
      })),
    })),
    ...activityRows.flatMap((activity) =>
      activity.dueAt
        ? [
            {
              id: activity.id,
              sourceType: "activity" as const,
              title: activity.title,
              description: null,
              startsAt: activity.dueAt,
              endsAt: null,
              status: "PUBLISHED" as const,
              href: `/atividades/${activity.slug}`,
            },
          ]
        : []
    ),
    ...releaseRows.map((release) => ({
      id: release.id,
      sourceType: "lesson-release" as const,
      title: release.lesson.title,
      description: null,
      startsAt: release.releaseAt,
      endsAt: null,
      status: "PUBLISHED" as const,
      href: `/cursos/${release.lesson.module.course.slug}/${release.lesson.slug}`,
    })),
  ];
  const items = resolveCohortCalendarItems(sources, {
    start: input.start,
    end: input.end,
  });
  const conflictsLimited =
    eventRows.length > cohortCalendarConflictReadLimit ||
    meetingRows.length > cohortCalendarConflictReadLimit ||
    activityRows.length > cohortCalendarConflictReadLimit ||
    releaseRows.length > cohortCalendarConflictReadLimit ||
    eventExceptions.length > cohortCalendarConflictReadLimit;
  return {
    events,
    items,
    itemsLimited: conflictsLimited,
    conflicts: conflictsLimited
      ? []
      : resolveCohortCalendarDateConflicts(
          items.filter(
            ({ status, cancelled }) => status === "PUBLISHED" && !cancelled
          ),
          {
            start: input.start,
            end: input.end,
          }
        ),
    conflictsLimited,
    page,
    pageSize: cohortEventPageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / cohortEventPageSize)),
  };
};

export const listGestaoCohortCalendarCopySources = async (
  destinationCohortId: string
) => {
  const actor = await requireGestaoActor();
  const destination = await database.cohort.findFirst({
    where: {
      AND: [
        { id: destinationCohortId, archivedAt: null },
        actorScope(actor.userId, actor.role),
      ],
    },
    select: { id: true },
  });
  if (!destination) {
    return null;
  }
  return database.cohort.findMany({
    where: {
      id: { not: destinationCohortId },
      archivedAt: null,
      ...actorScope(actor.userId, actor.role),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 100,
    select: { id: true, name: true },
  });
};

export const getGestaoCohortRoster = async (
  cohortId: string,
  input: { readonly page?: number; readonly query?: string } = {}
) => {
  const actor = await requireGestaoActor();
  const allowed = await database.cohort.findFirst({
    where: { AND: [{ id: cohortId }, actorScope(actor.userId, actor.role)] },
    select: { id: true },
  });
  if (!allowed) {
    return null;
  }
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const query = searchInput(input.query);
  const where: Prisma.CohortMembershipWhereInput = {
    cohortId,
    status: "ACTIVE",
    leftAt: null,
    ...(query
      ? {
          member: {
            OR: [
              { displayName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
  const now = new Date();
  const [memberships, totalCount, invites, inviteCount] = await Promise.all([
    database.cohortMembership.findMany({
      where,
      orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * rosterPageSize,
      take: rosterPageSize,
      select: {
        id: true,
        joinedAt: true,
        version: true,
        member: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
      },
    }),
    database.cohortMembership.count({ where }),
    database.cohortInvite.findMany({
      where: { cohortId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        expiresAt: true,
        maxUses: true,
        usedCount: true,
        createdAt: true,
      },
    }),
    database.cohortInvite.count({
      where: { cohortId, revokedAt: null, expiresAt: { gt: now } },
    }),
  ]);
  return {
    memberships,
    invites,
    page,
    pageSize: rosterPageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / rosterPageSize)),
    inviteCount,
  };
};

export const getGestaoAddableMembers = async (
  cohortId: string,
  input: {
    readonly page?: number;
    readonly query?: string;
    readonly unassignedOnly?: boolean;
  } = {}
) => {
  const actor = await requireGestaoActor();
  if (input.unassignedOnly && actor.role !== "ADMIN") {
    return null;
  }
  const allowed = await database.cohort.findFirst({
    where: { AND: [{ id: cohortId }, actorScope(actor.userId, actor.role)] },
    select: { id: true },
  });
  if (!allowed) {
    return null;
  }
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const query = searchInput(input.query);
  const where: Prisma.MemberWhereInput = {
    role: MemberRole.MEMBER,
    deactivatedAt: null,
    cohortMemberships: {
      none: {
        ...(input.unassignedOnly ? {} : { cohortId }),
        status: "ACTIVE",
        leftAt: null,
      },
    },
    ...(query
      ? {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [members, totalCount] = await Promise.all([
    database.member.findMany({
      where,
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      skip: (page - 1) * rosterPageSize,
      take: rosterPageSize,
      select: {
        id: true,
        displayName: true,
        email: true,
        _count: {
          select: {
            cohortMemberships: { where: { status: "ACTIVE", leftAt: null } },
          },
        },
      },
    }),
    database.member.count({ where }),
  ]);
  return {
    members: members.map((member) => ({
      ...member,
      otherCohortCount: member._count.cohortMemberships,
    })),
    page,
    pageSize: rosterPageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / rosterPageSize)),
  };
};

export const listPublishedCoursesForCohort = async (cohortId: string) => {
  const actor = await requireGestaoActor();
  const allowed = await database.cohort.findFirst({
    where: { AND: [{ id: cohortId }, actorScope(actor.userId, actor.role)] },
    select: { id: true },
  });
  if (!allowed) {
    return null;
  }
  const courses = await database.course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ title: "asc" }, { id: "asc" }],
    select: { id: true, title: true, slug: true },
  });
  return courses;
};

export const getGestaoTeacherOptions = cache(async () => {
  const actor = await requireGestaoActor();
  if (actor.role !== "ADMIN") {
    return [];
  }
  return database.member.findMany({
    where: {
      role: { in: [MemberRole.TEACHER, MemberRole.ADMIN] },
      deactivatedAt: null,
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: 200,
    select: { id: true, displayName: true, email: true, role: true },
  });
});
export type GestaoCohortDetail = NonNullable<
  Awaited<ReturnType<typeof getGestaoCohortDetail>>
>;

export const getGestaoCohortInvitePreview = async (token: string) => {
  if (!inviteTokenPattern.test(token)) {
    return null;
  }
  const memberId = await requireOnboardedMemberId();
  const member = await database.member.findUnique({
    where: { id: memberId },
    select: { deactivatedAt: true, email: true, role: true },
  });
  if (
    !member ||
    member.deactivatedAt ||
    member.role !== MemberRole.MEMBER ||
    !member.email
  ) {
    return null;
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invite = await database.cohortInvite.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      cohort: { archivedAt: null },
    },
    select: {
      id: true,
      cohortId: true,
      email: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
      cohort: { select: { name: true, startsAt: true, endsAt: true } },
    },
  });
  if (
    !invite ||
    (invite.email &&
      invite.email.toLocaleLowerCase("pt-BR") !==
        member.email.toLocaleLowerCase("pt-BR"))
  ) {
    return null;
  }
  const existing = await database.cohortMembership.findFirst({
    where: {
      cohortId: invite.cohortId,
      memberId,
      status: "ACTIVE",
      leftAt: null,
    },
    select: { id: true },
  });
  if (!existing && invite.usedCount >= invite.maxUses) {
    return null;
  }
  return {
    cohortId: invite.cohortId,
    cohortName: invite.cohort.name,
    startsAt: invite.cohort.startsAt,
    endsAt: invite.cohort.endsAt,
    expiresAt: invite.expiresAt,
    alreadyMember: Boolean(existing),
  };
};
export const listGestaoCohortLessonsForRelease = async (cohortId: string) => {
  const actor = await requireGestaoActor();
  const allowed = await database.cohort.findFirst({
    where: { AND: [{ id: cohortId }, actorScope(actor.userId, actor.role)] },
    select: { id: true },
  });
  if (!allowed) {
    return null;
  }
  return database.lesson.findMany({
    where: {
      status: "PUBLISHED",
      module: {
        is: {
          status: "PUBLISHED",
          course: {
            is: {
              status: "PUBLISHED",
              cohortCourseAccesses: {
                some: { cohortId, revokedAt: null },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { module: { position: "asc" } },
      { position: "asc" },
      { id: "asc" },
    ],
    select: {
      id: true,
      title: true,
      position: true,
      module: {
        select: {
          title: true,
          course: { select: { id: true, title: true } },
        },
      },
      cohortLessonReleases: {
        where: { cohortId },
        select: { releaseAt: true },
      },
    },
  });
};
