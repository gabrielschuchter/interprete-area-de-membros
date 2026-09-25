import "server-only";

import { ContentStatus, database } from "@repo/database";

export const getPublishedActivities = async (memberId: string) =>
  database.activity.findMany({
    where: {
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
                    course: {
                      is: {
                        status: ContentStatus.PUBLISHED,
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
    orderBy: [
      { dueAt: { sort: "asc", nulls: "last" } },
      { position: "asc" },
      { title: "asc" },
    ],
    select: {
      id: true,
      title: true,
      slug: true,
      prompt: true,
      instructions: true,
      dueAt: true,
      course: { select: { title: true, slug: true } },
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

export const getPublishedActivity = async (slug: string, memberId: string) =>
  database.activity.findFirst({
    where: {
      slug,
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
                    course: {
                      is: {
                        status: ContentStatus.PUBLISHED,
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      prompt: true,
      instructions: true,
      dueAt: true,
      course: { select: { title: true, slug: true } },
      lesson: { select: { title: true, slug: true } },
      submissions: {
        where: { memberId },
        select: {
          id: true,
          content: true,
          status: true,
          submittedAt: true,
          feedback: {
            select: { content: true, updatedAt: true, teacherId: true },
          },
        },
      },
    },
  });

export const getStaffActivities = async () =>
  database.activity.findMany({
    orderBy: [{ status: "asc" }, { position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      prompt: true,
      instructions: true,
      status: true,
      dueAt: true,
      courseId: true,
      lessonId: true,
      submissions: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          memberId: true,
          content: true,
          status: true,
          submittedAt: true,
          feedback: { select: { content: true, teacherId: true } },
        },
      },
      course: { select: { title: true, slug: true } },
      lesson: { select: { title: true, slug: true } },
    },
  });
