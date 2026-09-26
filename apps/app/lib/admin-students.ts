import "server-only";

import { database } from "@repo/database";

const resourceTypeLabel: Record<string, string> = {
  COURSE: "Curso",
  MODULE: "Módulo",
  LESSON: "Aula",
  ASSET: "Material",
};

export const getAdminMemberDetail = async (memberId: string) => {
  const [member, progress, assignments, submissions, posts, meetings] =
    await Promise.all([
      database.member.findUnique({
        where: { id: memberId },
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          profile: {
            select: {
              username: true,
              headline: true,
              bio: true,
              occupation: true,
              institution: true,
            },
          },
          accessGrants: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              resourceType: true,
              resourceId: true,
              permission: true,
              expiresAt: true,
              createdAt: true,
            },
          },
        },
      }),
      database.lessonProgress.findMany({
        where: { memberId },
        orderBy: { updatedAt: "desc" },
        take: 24,
        select: {
          status: true,
          updatedAt: true,
          completedAt: true,
          lesson: {
            select: {
              title: true,
              slug: true,
              module: {
                select: {
                  title: true,
                  course: { select: { title: true, slug: true } },
                },
              },
            },
          },
        },
      }),
      database.activityAssignment.findMany({
        where: { memberId },
        orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
        take: 24,
        select: {
          dueAt: true,
          assignedAt: true,
          activity: {
            select: { id: true, title: true, slug: true, status: true },
          },
        },
      }),
      database.activitySubmission.findMany({
        where: { memberId },
        orderBy: { updatedAt: "desc" },
        take: 24,
        select: {
          id: true,
          content: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
          activity: { select: { title: true, slug: true } },
          feedback: { select: { content: true, updatedAt: true } },
        },
      }),
      database.communityPost.findMany({
        where: { authorId: memberId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          kind: true,
          updatedAt: true,
          publishedAt: true,
          space: { select: { title: true, slug: true } },
        },
      }),
      database.meetingParticipant.findMany({
        where: { memberId },
        orderBy: { meeting: { startsAt: "asc" } },
        take: 24,
        select: {
          meeting: {
            select: {
              id: true,
              title: true,
              startsAt: true,
              endsAt: true,
              status: true,
              kind: true,
              timezone: true,
            },
          },
        },
      }),
    ]);

  if (!member) {
    return null;
  }

  const grants = member.accessGrants;
  const [courses, modules, lessons, assets] = await Promise.all([
    database.course.findMany({
      where: {
        id: {
          in: grants
            .filter((grant) => grant.resourceType === "COURSE")
            .map((grant) => grant.resourceId),
        },
      },
      select: { id: true, title: true },
    }),
    database.module.findMany({
      where: {
        id: {
          in: grants
            .filter((grant) => grant.resourceType === "MODULE")
            .map((grant) => grant.resourceId),
        },
      },
      select: { id: true, title: true, course: { select: { title: true } } },
    }),
    database.lesson.findMany({
      where: {
        id: {
          in: grants
            .filter((grant) => grant.resourceType === "LESSON")
            .map((grant) => grant.resourceId),
        },
      },
      select: {
        id: true,
        title: true,
        module: { select: { course: { select: { title: true } } } },
      },
    }),
    database.lessonAsset.findMany({
      where: {
        id: {
          in: grants
            .filter((grant) => grant.resourceType === "ASSET")
            .map((grant) => grant.resourceId),
        },
      },
      select: { id: true, title: true, lesson: { select: { title: true } } },
    }),
  ]);

  const labels = new Map<string, string>([
    ...courses.map((item) => [`COURSE:${item.id}`, item.title] as const),
    ...modules.map(
      (item) =>
        [`MODULE:${item.id}`, `${item.course.title} · ${item.title}`] as const
    ),
    ...lessons.map(
      (item) =>
        [
          `LESSON:${item.id}`,
          `${item.module.course.title} · ${item.title}`,
        ] as const
    ),
    ...assets.map(
      (item) =>
        [`ASSET:${item.id}`, `${item.lesson.title} · ${item.title}`] as const
    ),
  ]);

  return {
    ...member,
    accessGrants: grants.map((grant) => ({
      ...grant,
      label:
        labels.get(`${grant.resourceType}:${grant.resourceId}`) ??
        `${resourceTypeLabel[grant.resourceType] ?? grant.resourceType} · recurso removido`,
    })),
    progress,
    assignments,
    submissions,
    posts,
    meetings: meetings.map(({ meeting }) => meeting),
  };
};
