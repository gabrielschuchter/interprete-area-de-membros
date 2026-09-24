import "server-only";

import { ContentStatus, database } from "@repo/database";

export const getPublishedActivities = async (memberId: string) =>
  database.activity.findMany({
    where: { status: ContentStatus.PUBLISHED },
    orderBy: [{ dueAt: "asc" }, { position: "asc" }, { title: "asc" }],
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
    where: { slug, status: ContentStatus.PUBLISHED },
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
      status: true,
      dueAt: true,
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
    },
  });
