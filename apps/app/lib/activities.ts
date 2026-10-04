import "server-only";

import {
  ContentStatus,
  database,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
  type Prisma,
} from "@repo/database";
import { markLearningAssignmentStarted } from "@/lib/learning-assignments";
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

interface ActivityAccessContext {
  readonly assignments: readonly { readonly dueAt: Date | null }[];
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
  if (scope.fullAccess || activity.assignments.length > 0) {
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
  return activity.courseId ? scope.fullCourseIds.has(activity.courseId) : true;
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
        assignments: {
          where: currentMemberAssignmentWhere(memberId),
          select: { dueAt: true },
          take: 1,
        },
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
            attachmentPath: true,
            attachmentName: true,
            attachmentMimeType: true,
            attachmentSizeBytes: true,
            feedback: {
              select: { content: true, updatedAt: true, teacherId: true },
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
  return activity;
};

export const getStaffActivities = async () =>
  database.activity.findMany({
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
        orderBy: { updatedAt: "desc" },
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
