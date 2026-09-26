import "server-only";

import { database } from "@repo/database";

export const getAdminLearningOverview = async () =>
  database.learningPath.findMany({
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      status: true,
      courses: {
        orderBy: [{ position: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          modules: {
            orderBy: [{ position: "asc" }, { title: "asc" }],
            select: {
              id: true,
              title: true,
              description: true,
              objectives: true,
              status: true,
              lessons: { select: { id: true, status: true } },
            },
          },
        },
      },
    },
  });

export const getAdminCourse = async (id: string) =>
  database.course.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      subtitle: true,
      format: true,
      category: true,
      level: true,
      durationMinutes: true,
      tags: true,
      teacherId: true,
      status: true,
      learningPath: { select: { id: true, title: true, slug: true } },
      modules: {
        orderBy: [{ position: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          objectives: true,
          position: true,
          status: true,
          lessons: {
            orderBy: [{ position: "asc" }, { title: "asc" }],
            select: {
              id: true,
              title: true,
              slug: true,
              description: true,
              objectives: true,
              content: true,
              kind: true,
              position: true,
              status: true,
              resources: {
                orderBy: { position: "asc" },
                select: { id: true, title: true, kind: true, url: true },
              },
            },
          },
        },
      },
    },
  });

export const getCourseOptions = async () =>
  database.course.findMany({
    orderBy: [{ status: "asc" }, { position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      status: true,
      modules: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          lessons: {
            orderBy: { position: "asc" },
            select: { id: true, title: true },
          },
        },
      },
    },
  });
