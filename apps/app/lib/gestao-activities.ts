import "server-only";

import {
  ActivitySubmissionStatus,
  ContentStatus,
  database,
  MemberRole,
  type Prisma,
} from "@repo/database";
import { type GestaoActor, requireGestaoAction } from "./gestao-authorization";

const pageSize = 20;

export type GestaoActivityStatus = "ALL" | ContentStatus;

const normalizeStatus = (value: string | undefined): GestaoActivityStatus =>
  value === ContentStatus.DRAFT ||
  value === ContentStatus.PUBLISHED ||
  value === ContentStatus.ARCHIVED
    ? value
    : "ALL";

const activeMembership = {
  status: "ACTIVE" as const,
  leftAt: null,
};

const managedCohortWhere = (actor: GestaoActor): Prisma.CohortWhereInput => ({
  archivedAt: null,
  ...(actor.role === MemberRole.ADMIN
    ? {}
    : { teachers: { some: { memberId: actor.userId } } }),
});

const staffMemberScope = (
  actor: GestaoActor,
  cohortIds: readonly string[]
): Prisma.ActivitySubmissionWhereInput["member"] => {
  if (actor.role === MemberRole.ADMIN) {
    return { is: { deactivatedAt: null } };
  }
  if (cohortIds.length === 0) {
    return { is: { id: "__no_managed_cohorts__" } };
  }
  return {
    is: {
      deactivatedAt: null,
      cohortMemberships: {
        some: {
          ...activeMembership,
          cohortId: { in: [...cohortIds] },
        },
      },
    },
  };
};

const dueDateScope = (
  due: string | undefined,
  now: Date
): Prisma.ActivityWhereInput => {
  if (due === "UPCOMING") {
    return { dueAt: { gt: now } };
  }
  if (due === "OVERDUE") {
    return { dueAt: { lt: now } };
  }
  if (due === "NONE") {
    return { dueAt: null };
  }
  return {};
};

export const listGestaoActivities = async (input: {
  readonly page?: number;
  readonly query?: string;
  readonly status?: string;
  readonly courseId?: string;
  readonly due?: string;
}) => {
  const { actor } = await requireGestaoAction("content.manage");
  const query = (input.query ?? "").trim().slice(0, 120);
  const status = normalizeStatus(input.status);
  const requestedPage = Math.max(1, Math.trunc(Number(input.page) || 1));
  const now = new Date();
  const cohortIds =
    actor.role === MemberRole.ADMIN
      ? []
      : (
          await database.cohort.findMany({
            where: managedCohortWhere(actor),
            select: { id: true },
          })
        ).map(({ id }) => id);
  const where: Prisma.ActivityWhereInput = {
    ...(status === "ALL" ? {} : { status }),
    ...(input.courseId ? { courseId: input.courseId } : {}),
    ...dueDateScope(input.due, now),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { prompt: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [totalCount, courses] = await Promise.all([
    database.activity.count({ where }),
    database.course.findMany({
      where: { experience: "ASYNC" },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 200,
      select: { id: true, title: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const activities = await database.activity.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      deliveryKind: true,
      dueAt: true,
      updatedAt: true,
      version: true,
      course: { select: { id: true, title: true } },
      cohortTargets: {
        where: {
          activeKey: { not: null },
          revokedAt: null,
          cohort: { is: managedCohortWhere(actor) },
        },
        orderBy: [{ assignedAt: "desc" }, { id: "asc" }],
        take: 4,
        select: { cohort: { select: { id: true, name: true } } },
      },
      _count: {
        select: {
          cohortTargets: {
            where: {
              activeKey: { not: null },
              revokedAt: null,
              cohort: { is: managedCohortWhere(actor) },
            },
          },
        },
      },
    },
  });
  const activityIds = activities.map(({ id }) => id);
  const [submissionStats, assignmentStats] = activityIds.length
    ? await Promise.all([
        database.activitySubmission.groupBy({
          by: ["activityId", "status"],
          where: {
            activityId: { in: activityIds },
            member: staffMemberScope(actor, cohortIds),
          },
          _count: { _all: true },
        }),
        database.activityAssignment.groupBy({
          by: ["activityId"],
          where: {
            activityId: { in: activityIds },
            revokedAt: null,
            status: { not: "REVOKED" },
            member: staffMemberScope(actor, cohortIds),
          },
          _count: { _all: true },
        }),
      ])
    : [[], []];
  const countsByActivity = new Map<
    string,
    { submitted: number; toReview: number; reviewed: number; all: number }
  >();
  for (const row of submissionStats) {
    const counts = countsByActivity.get(row.activityId) ?? {
      all: 0,
      reviewed: 0,
      submitted: 0,
      toReview: 0,
    };
    counts.all += row._count._all;
    if (row.status === ActivitySubmissionStatus.SUBMITTED) {
      counts.submitted += row._count._all;
      counts.toReview += row._count._all;
    } else if (row.status === ActivitySubmissionStatus.REVIEWED) {
      counts.reviewed += row._count._all;
    }
    countsByActivity.set(row.activityId, counts);
  }
  const assignmentCounts = new Map(
    assignmentStats.map((row) => [row.activityId ?? "", row._count._all])
  );

  return {
    activities: activities.map((activity) => ({
      ...activity,
      counts: countsByActivity.get(activity.id) ?? {
        all: 0,
        reviewed: 0,
        submitted: 0,
        toReview: 0,
      },
      directRecipientCount: assignmentCounts.get(activity.id) ?? 0,
      cohortCount: activity._count.cohortTargets,
    })),
    courses,
    page,
    pageSize,
    query,
    status,
    totalCount,
    totalPages,
  };
};

export const listGestaoActivityMemberOptions = async (input: {
  readonly query: string;
  readonly page: number;
}) => {
  const { actor } = await requireGestaoAction("content.manage");
  const query = input.query.trim().slice(0, 120);
  const cohortIds =
    actor.role === MemberRole.ADMIN
      ? []
      : (
          await database.cohort.findMany({
            where: managedCohortWhere(actor),
            select: { id: true },
          })
        ).map(({ id }) => id);
  let memberScope: Prisma.MemberWhereInput;
  if (actor.role === MemberRole.ADMIN) {
    memberScope = { role: MemberRole.MEMBER, deactivatedAt: null };
  } else if (cohortIds.length) {
    memberScope = {
      role: MemberRole.MEMBER,
      deactivatedAt: null,
      cohortMemberships: {
        some: {
          ...activeMembership,
          cohortId: { in: cohortIds },
        },
      },
    };
  } else {
    memberScope = {
      role: MemberRole.MEMBER,
      deactivatedAt: null,
      id: "__no_managed_cohorts__",
    };
  }
  const where: Prisma.MemberWhereInput = {
    ...memberScope,
    ...(query
      ? {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const page = Math.max(1, Math.trunc(input.page || 1));
  const [totalCount, members] = await Promise.all([
    database.member.count({ where }),
    database.member.findMany({
      where,
      orderBy: [{ displayName: "asc" }, { email: "asc" }, { id: "asc" }],
      skip: (page - 1) * 20,
      take: 20,
      select: { id: true, displayName: true, email: true },
    }),
  ]);
  return {
    members: members.map((member) => ({
      id: member.id,
      label:
        [member.displayName, member.email].filter(Boolean).join(" · ") ||
        "Membro",
    })),
    page,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / 20)),
  };
};

export const getGestaoActivityEditorData = async (activityId?: string) => {
  const { actor } = await requireGestaoAction("content.manage");
  const cohortWhere = managedCohortWhere(actor);
  const cohorts = await database.cohort.findMany({
    where: cohortWhere,
    orderBy: [{ startsAt: "desc" }, { name: "asc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      lateJoinPolicy: true,
      _count: {
        select: {
          memberships: {
            where: activeMembership,
          },
        },
      },
    },
  });
  const [courses, libraryItems, activity] = await Promise.all([
    database.course.findMany({
      where: { experience: "ASYNC" },
      orderBy: [{ status: "asc" }, { position: "asc" }, { title: "asc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        modules: {
          orderBy: [{ position: "asc" }, { title: "asc" }],
          take: 100,
          select: {
            id: true,
            title: true,
            lessons: {
              orderBy: [{ position: "asc" }, { title: "asc" }],
              take: 100,
              select: { id: true, title: true },
            },
          },
        },
      },
    }),
    database.libraryItem.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 200,
      select: { id: true, title: true },
    }),
    activityId
      ? database.activity.findUnique({
          where: { id: activityId },
          select: {
            id: true,
            title: true,
            slug: true,
            prompt: true,
            instructions: true,
            deliveryKind: true,
            status: true,
            dueAt: true,
            courseId: true,
            lessonId: true,
            relatedLibraryItemId: true,
            createdAt: true,
            version: true,
            rubricVersion: true,
            cohortTargets: {
              where: {
                activeKey: { not: null },
                revokedAt: null,
                cohort: { is: cohortWhere },
              },
              select: { cohortId: true },
            },
            assignments: {
              where: {
                targetType: "ACTIVITY",
                revokedAt: null,
                status: { not: "REVOKED" },
                member: {
                  is: {
                    role: MemberRole.MEMBER,
                    deactivatedAt: null,
                    ...(actor.role === MemberRole.ADMIN
                      ? {}
                      : {
                          cohortMemberships: {
                            some: {
                              ...activeMembership,
                              cohortId: { in: cohorts.map(({ id }) => id) },
                            },
                          },
                        }),
                  },
                },
              },
              orderBy: [{ assignedAt: "desc" }, { id: "asc" }],
              take: 200,
              select: {
                memberId: true,
                member: { select: { displayName: true, email: true } },
              },
            },
          },
        })
      : null,
  ]);
  const activeRubric = activity
    ? await database.activityRubricCriterion.findMany({
        where: { activityId: activity.id, version: activity.rubricVersion },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true, title: true, weight: true, position: true },
      })
    : [];
  const selectedMembers = activity?.assignments.map((assignment) => ({
    id: assignment.memberId,
    label:
      [assignment.member.displayName, assignment.member.email]
        .filter(Boolean)
        .join(" · ") || "Membro",
  }));

  return {
    actor,
    activity: activity ? { ...activity, rubricCriteria: activeRubric } : null,
    cohorts: cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      lateJoinPolicy: cohort.lateJoinPolicy,
      activeMemberCount: cohort._count.memberships,
    })),
    courses,
    libraryItems,
    selectedMembers: [
      ...new Map(
        (selectedMembers ?? []).map((item) => [item.id, item])
      ).values(),
    ],
  };
};

export const getGestaoActivityPreviewData = async (activityId: string) => {
  await requireGestaoAction("content.manage");
  const activity = await database.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      title: true,
      prompt: true,
      instructions: true,
      deliveryKind: true,
      dueAt: true,
      rubricVersion: true,
      course: { select: { title: true } },
      lesson: { select: { title: true } },
      relatedLibraryItem: { select: { title: true } },
    },
  });
  if (!activity) {
    return null;
  }
  const criteria = await database.activityRubricCriterion.findMany({
    where: { activityId, version: activity.rubricVersion },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: { id: true, title: true, weight: true },
  });
  return { ...activity, criteria };
};
