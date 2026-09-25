import "server-only";

import { database } from "@repo/database";

export const getAccessAdminOverview = async () => {
  const [members, courses] = await Promise.all([
    database.member.findMany({
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        profile: { select: { username: true } },
        accessGrants: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            resourceType: true,
            resourceId: true,
            permission: true,
            createdAt: true,
          },
        },
      },
    }),
    database.course.findMany({
      orderBy: [{ position: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        modules: {
          orderBy: [{ position: "asc" }, { title: "asc" }],
          select: {
            id: true,
            title: true,
            lessons: {
              orderBy: [{ position: "asc" }, { title: "asc" }],
              select: {
                id: true,
                title: true,
                assets: {
                  orderBy: [{ position: "asc" }, { title: "asc" }],
                  select: { id: true, title: true, kind: true, scope: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const resources = courses.flatMap((course) => [
    {
      id: course.id,
      type: "COURSE" as const,
      label: `Curso · ${course.title}`,
    },
    ...course.modules.flatMap((module) => [
      {
        id: module.id,
        type: "MODULE" as const,
        label: `${course.title} · módulo · ${module.title}`,
      },
      ...module.lessons.flatMap((lesson) => [
        {
          id: lesson.id,
          type: "LESSON" as const,
          label: `${course.title} · aula · ${lesson.title}`,
        },
        ...lesson.assets.map((asset) => ({
          id: asset.id,
          type: "ASSET" as const,
          label: `${course.title} · material · ${asset.title}`,
        })),
      ]),
    ]),
  ]);

  return { members, resources };
};
