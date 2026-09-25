"use server";

import { auth } from "@repo/auth/server";
import {
  ActivitySubmissionStatus,
  ContentStatus,
  database,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/authorization";

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry.trim() : "";
};

const validActivityRelations = async (courseId: string, lessonId: string) => {
  if (courseId) {
    const course = await database.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      return false;
    }
  }

  if (lessonId) {
    const lesson = await database.lesson.findUnique({
      where: { id: lessonId },
      select: { module: { select: { courseId: true } } },
    });

    if (!lesson || (courseId && lesson.module.courseId !== courseId)) {
      return false;
    }
  }

  return true;
};

export const submitActivity = async (formData: FormData) => {
  const { userId } = await auth();
  const activityId = formData.get("activityId");
  const content = formData.get("content");

  if (
    !userId ||
    typeof activityId !== "string" ||
    typeof content !== "string"
  ) {
    return;
  }

  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return;
  }

  const activity = await database.activity.findFirst({
    where: {
      id: activityId,
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
                      is: { status: ContentStatus.PUBLISHED },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
    select: { slug: true },
  });

  if (!activity) {
    return;
  }

  await database.activitySubmission.upsert({
    where: { activityId_memberId: { activityId, memberId: userId } },
    create: {
      activityId,
      memberId: userId,
      content: normalizedContent,
      status: ActivitySubmissionStatus.SUBMITTED,
      submittedAt: new Date(),
    },
    update: {
      content: normalizedContent,
      status: ActivitySubmissionStatus.SUBMITTED,
      submittedAt: new Date(),
    },
  });

  revalidatePath("/atividades");
  revalidatePath(`/atividades/${activity.slug}`);
};

export const saveFeedback = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const submissionId = formData.get("submissionId");
  const content = formData.get("content");

  if (typeof submissionId !== "string" || typeof content !== "string") {
    return;
  }

  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return;
  }

  const submission = await database.activitySubmission.findUnique({
    where: { id: submissionId },
    select: { activity: { select: { slug: true } } },
  });

  if (!submission) {
    return;
  }

  await database.$transaction([
    database.feedback.upsert({
      where: { submissionId },
      create: { submissionId, teacherId: userId, content: normalizedContent },
      update: { teacherId: userId, content: normalizedContent },
    }),
    database.activitySubmission.update({
      where: { id: submissionId },
      data: { status: ActivitySubmissionStatus.REVIEWED },
    }),
  ]);

  revalidatePath("/admin/activities");
  revalidatePath(`/atividades/${submission.activity.slug}`);
};

export const createActivity = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const title = formData.get("title");
  const slug = formData.get("slug");
  const prompt = formData.get("prompt");
  const instructions = formData.get("instructions");
  const dueAt = formData.get("dueAt");
  const courseId = value(formData, "courseId");
  const lessonId = value(formData, "lessonId");

  if (
    typeof title !== "string" ||
    typeof slug !== "string" ||
    typeof prompt !== "string" ||
    !title.trim() ||
    !slug.trim() ||
    !prompt.trim()
  ) {
    return;
  }

  const dueDate =
    typeof dueAt === "string" && dueAt.trim() ? new Date(dueAt) : null;

  if (dueDate && Number.isNaN(dueDate.valueOf())) {
    return;
  }

  if (!(await validActivityRelations(courseId, lessonId))) {
    return;
  }

  await database.activity.create({
    data: {
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      prompt: prompt.trim(),
      instructions:
        typeof instructions === "string" && instructions.trim()
          ? instructions.trim()
          : null,
      dueAt: dueDate,
      courseId: courseId || null,
      lessonId: lessonId || null,
      status: ContentStatus.DRAFT,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  revalidatePath("/admin/activities");
};

export const updateActivity = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const activityId = value(formData, "activityId");
  const title = value(formData, "title");
  const slug = value(formData, "slug");
  const prompt = value(formData, "prompt");
  const instructions = value(formData, "instructions");
  const dueAt = value(formData, "dueAt");
  const courseId = value(formData, "courseId");
  const lessonId = value(formData, "lessonId");

  if (!(activityId && title.trim() && slug.trim() && prompt.trim())) {
    return;
  }

  const dueDate = dueAt.trim() ? new Date(dueAt) : null;

  if (dueDate && Number.isNaN(dueDate.valueOf())) {
    return;
  }

  if (!(await validActivityRelations(courseId, lessonId))) {
    return;
  }

  await database.activity.update({
    where: { id: activityId },
    data: {
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      prompt: prompt.trim(),
      instructions: instructions.trim() || null,
      dueAt: dueDate,
      courseId: courseId || null,
      lessonId: lessonId || null,
      updatedBy: userId,
    },
  });

  revalidatePath("/admin/activities");
  revalidatePath("/atividades");
};

export const setActivityStatus = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const activityId = formData.get("activityId");
  const status = formData.get("status");

  if (
    typeof activityId !== "string" ||
    typeof status !== "string" ||
    !Object.values(ContentStatus).includes(status as ContentStatus)
  ) {
    return;
  }

  await database.activity.update({
    where: { id: activityId },
    data: { status: status as ContentStatus, updatedBy: userId },
  });

  revalidatePath("/admin/activities");
  revalidatePath("/atividades");
};
