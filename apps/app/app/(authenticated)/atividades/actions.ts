"use server";

import { auth } from "@repo/auth/server";
import {
  ActivitySubmissionStatus,
  ContentStatus,
  database,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/authorization";

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
    where: { id: activityId, status: ContentStatus.PUBLISHED },
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

  await database.activity.create({
    data: {
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      prompt: prompt.trim(),
      instructions:
        typeof instructions === "string" && instructions.trim()
          ? instructions.trim()
          : null,
      status: ContentStatus.DRAFT,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  revalidatePath("/admin/activities");
};
