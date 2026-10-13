import "server-only";

import {
  ContentStatus,
  database,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
  MemberRole,
  type Prisma,
} from "@repo/database";
import { markLearningAssignmentStarted } from "@/lib/learning-assignments";
import {
  type ActivityCohortTargetForMember,
  hasActivityCohortAccess,
} from "./activity-cohort-access";
import {
  getLearningAccessScope,
  hasLessonAccess,
  type LearningAccessScope,
} from "./content-access";

const publishedActivityWhere = {
  status: ContentStatus.PUBLISHED,
  AND: [
    {
      OR: [
        { courseId: null },
        { course: { is: { status: ContentStatus.PUBLISHED } } },
      ],
    },
    {
      OR: [
        { lessonId: null },
        {
          lesson: {
            is: {
              status: ContentStatus.PUBLISHED,
              module: {
                status: ContentStatus.PUBLISHED,
                course: { status: ContentStatus.PUBLISHED },
              },
            },
          },
        },
      ],
    },
  ],
} satisfies Prisma.ActivityWhereInput;

const currentMemberAssignmentWhere = (memberId: string, now = new Date()) => ({
  memberId,
  revokedAt: null,
  status: { not: LearningAssignmentStatus.REVOKED },
  AND: [
    { OR: [{ availableAt: null }, { availableAt: { lte: now } }] },
    { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  ],
});

const currentMemberCohortTargets = (memberId: string) => ({
  where: {
    activeKey: { not: null },
    revokedAt: null,
    cohort: {
      is: {
        memberships: {
          some: { memberId, status: "ACTIVE" as const, leftAt: null },
        },
      },
    },
  },
  select: {
    assignedAt: true,
    cohort: {
      select: {
        archivedAt: true,
        endsAt: true,
        lateJoinPolicy: true,
        readAfterEndDays: true,
        startsAt: true,
        memberships: {
          where: { memberId, status: "ACTIVE" as const, leftAt: null },
          select: { joinedAt: true },
          take: 1,
        },
      },
    },
  },
});

interface ActivityAccessContext {
  readonly _count: {
    readonly assignments: number;
    readonly cohortTargets: number;
  };
  readonly assignments: readonly { readonly dueAt: Date | null }[];
  readonly cohortTargets: readonly ActivityCohortTargetForMember[];
  readonly courseId: string | null;
  readonly lesson: {
    readonly id: string;
    readonly module: { readonly courseId: string; readonly id: string };
  } | null;
}

const canReadActivity = (
  activity: ActivityAccessContext,
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>
) => {
  if (
    scope.fullAccess ||
    activity.assignments.length > 0 ||
    hasActivityCohortAccess(activity.cohortTargets)
  ) {
    return true;
  }

  if (activity.lesson) {
    return hasLessonAccess(
      scope,
      activity.lesson.module.courseId,
      activity.lesson.module.id,
      activity.lesson.id
    );
  }

  // Course-level practices require course-level entitlement. A module-only
  // grant must not expose every practice attached to its parent course.
  if (activity.courseId) {
    return scope.fullCourseIds.has(activity.courseId);
  }
  // Only legacy activities that have never had recipients are global. An
  // absent, expired or revoked grant must not widen a targeted activity.
  return (
    activity._count.assignments === 0 && activity._count.cohortTargets === 0
  );
};

export const canAccessPublishedActivity = async (
  activityId: string,
  memberId: string
) => {
  const [activity, scope] = await Promise.all([
    database.activity.findFirst({
      where: { id: activityId, ...publishedActivityWhere },
      select: {
        courseId: true,
        _count: { select: { assignments: true, cohortTargets: true } },
        assignments: {
          where: currentMemberAssignmentWhere(memberId),
          select: { dueAt: true },
          take: 1,
        },
        cohortTargets: currentMemberCohortTargets(memberId),
        lesson: {
          select: {
            id: true,
            module: { select: { id: true, courseId: true } },
          },
        },
      },
    }),
    getLearningAccessScope(memberId),
  ]);

  return Boolean(activity && canReadActivity(activity, scope));
};

export const getPublishedActivities = async (
  memberId: string,
  accessScope?: LearningAccessScope | Promise<LearningAccessScope>
) => {
  const scopePromise = accessScope
    ? Promise.resolve(accessScope)
    : getLearningAccessScope(memberId);
  const activitiesPromise = database.activity.findMany({
    where: publishedActivityWhere,
    orderBy: [
      { dueAt: { sort: "asc", nulls: "last" } },
      { position: "asc" },
      { title: "asc" },
    ],
    select: {
      id: true,
      courseId: true,
      _count: { select: { assignments: true, cohortTargets: true } },
      title: true,
      slug: true,
      prompt: true,
      deliveryKind: true,
      dueAt: true,
      assignments: {
        where: currentMemberAssignmentWhere(memberId),
        orderBy: { assignedAt: "desc" },
        select: { dueAt: true },
        take: 1,
      },
      cohortTargets: currentMemberCohortTargets(memberId),
      course: { select: { id: true, title: true, slug: true } },
      lesson: {
        select: {
          id: true,
          title: true,
          slug: true,
          module: { select: { id: true, courseId: true } },
        },
      },
      relatedLibraryItem: { select: { id: true, title: true } },
      submissions: {
        where: { memberId },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
          feedback: { select: { content: true, updatedAt: true } },
        },
      },
    },
  });
  const [scope, activities] = await Promise.all([
    scopePromise,
    activitiesPromise,
  ]);

  return activities.filter((activity) => canReadActivity(activity, scope));
};

export const getPublishedActivity = async (slug: string, memberId: string) => {
  const [scope, activity] = await Promise.all([
    getLearningAccessScope(memberId),
    database.activity.findFirst({
      where: { slug, ...publishedActivityWhere },
      select: {
        id: true,
        courseId: true,
        _count: { select: { assignments: true, cohortTargets: true } },
        title: true,
        slug: true,
        prompt: true,
        instructions: true,
        deliveryKind: true,
        dueAt: true,
        assignments: {
          where: currentMemberAssignmentWhere(memberId),
          orderBy: { assignedAt: "desc" },
          select: { dueAt: true },
          take: 1,
        },
        cohortTargets: currentMemberCohortTargets(memberId),
        course: { select: { id: true, title: true, slug: true } },
        lesson: {
          select: {
            id: true,
            title: true,
            slug: true,
            module: { select: { id: true, courseId: true } },
          },
        },
        relatedLibraryItem: { select: { id: true, title: true } },
        submissions: {
          where: { memberId },
          select: {
            id: true,
            content: true,
            status: true,
            submittedAt: true,
            rubricVersion: true,
            attachmentPath: true,
            attachmentName: true,
            attachmentMimeType: true,
            attachmentSizeBytes: true,
            feedback: {
              select: {
                content: true,
                updatedAt: true,
                teacherId: true,
                rubricVersion: true,
                criteriaScores: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!(activity && canReadActivity(activity, scope))) {
    return null;
  }
  await markLearningAssignmentStarted(
    memberId,
    LearningAssignmentTargetType.ACTIVITY,
    activity.id
  );
  const rubricVersion = activity.submissions[0]?.feedback?.rubricVersion ?? 0;
  const feedbackRubricCriteria = rubricVersion
    ? await database.activityRubricCriterion.findMany({
        where: { activityId: activity.id, version: rubricVersion },
        orderBy: { position: "asc" },
        select: { id: true, title: true, weight: true, position: true },
      })
    : [];
  return { ...activity, feedbackRubricCriteria };
};

export const getStaffActivities = async (input: {
  readonly userId: string;
  readonly role: MemberRole;
}) => {
  const cohortIds =
    input.role === MemberRole.ADMIN
      ? []
      : (
          await database.cohort.findMany({
            where: {
              archivedAt: null,
              teachers: { some: { memberId: input.userId } },
            },
            select: { id: true },
          })
        ).map(({ id }) => id);
  let memberScope: Prisma.MemberWhereInput;
  if (input.role === MemberRole.ADMIN) {
    memberScope = { deactivatedAt: null };
  } else if (cohortIds.length) {
    memberScope = {
      deactivatedAt: null,
      cohortMemberships: {
        some: {
          cohortId: { in: cohortIds },
          status: "ACTIVE",
          leftAt: null,
        },
      },
    };
  } else {
    memberScope = { id: "__no_managed_cohorts__" };
  }

  return database.activity.findMany({
    orderBy: [{ status: "asc" }, { position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      prompt: true,
      instructions: true,
      deliveryKind: true,
      status: true,
      dueAt: true,
      assignments: {
        where: { member: { is: memberScope } },
        take: 200,
        select: {
          memberId: true,
          dueAt: true,
          member: { select: { displayName: true, email: true } },
        },
      },
      courseId: true,
      lessonId: true,
      relatedLibraryItem: { select: { id: true, title: true } },
      submissions: {
        where: { member: { is: memberScope } },
        orderBy: { updatedAt: "desc" },
        take: 25,
        select: {
          id: true,
          memberId: true,
          content: true,
          status: true,
          submittedAt: true,
          attachmentPath: true,
          attachmentName: true,
          attachmentMimeType: true,
          attachmentSizeBytes: true,
          feedback: { select: { content: true, teacherId: true } },
          member: { select: { displayName: true, email: true } },
        },
      },
      course: { select: { title: true, slug: true } },
      lesson: { select: { title: true, slug: true } },
    },
  });
};
