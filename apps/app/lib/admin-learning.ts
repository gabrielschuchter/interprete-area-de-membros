import "server-only";

import { CourseExperience, database } from "@repo/database";

export const getAdminLearningOverview = async () =>
  database.learningPath.findMany({
    where: { courses: { some: { experience: CourseExperience.ASYNC } } },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      status: true,
      courses: {
        where: { experience: CourseExperience.ASYNC },
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
      experience: true,
      coverUrl: true,
      updatedAt: true,
      _count: { select: { activities: true } },
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
              updatedAt: true,
              assets: {
                where: { kind: "VIDEO" },
                orderBy: { position: "asc" },
                select: {
                  id: true,
                  title: true,
                  mediaProvider: true,
                  mediaExternalId: true,
                  youtubeSourceUrl: true,
                  youtubeVideoTitle: true,
                  youtubeThumbnailUrl: true,
                  youtubePrivacyStatus: true,
                  youtubeEmbeddable: true,
                  youtubeCaptionsAvailable: true,
                  youtubeVerificationStatus: true,
                  youtubeCheckedAt: true,
                  youtubeStartAtSeconds: true,
                  youtubeEndAtSeconds: true,
                  externalUrl: true,
                  storagePath: true,
                  durationSeconds: true,
                  updatedAt: true,
                },
              },
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
    where: { experience: CourseExperience.ASYNC },
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
