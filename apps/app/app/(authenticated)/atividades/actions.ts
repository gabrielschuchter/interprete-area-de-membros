"use server";

import { auth } from "@repo/auth/server";
import {
  ActivitySubmissionStatus,
  ContentStatus,
  database,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { canAccessPublishedActivity } from "@/lib/activities";
import { requireStaff } from "@/lib/authorization";
import {
  createMemberAssetPath,
  deleteMemberAsset,
  uploadMemberAsset,
} from "@/lib/member-storage";
import { createNotification } from "@/lib/notifications";

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry.trim() : "";
};

const memberIdSeparator = /[\n,]/;

const assignmentIds = (formData: FormData) =>
  [
    ...new Set(
      value(formData, "memberIds")
        .split(memberIdSeparator)
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ].slice(0, 200);

const allowedAttachmentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);
const attachmentExtensions: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/plain": "txt",
};

const getSubmissionAttachment = (entry: FormDataEntryValue | null) =>
  entry instanceof File && entry.size > 0 ? entry : null;

const uploadSubmissionAttachment = async ({
  activityId,
  file,
  memberId,
}: {
  activityId: string;
  file: File;
  memberId: string;
}) => {
  const extension = attachmentExtensions[file.type];
  const path = createMemberAssetPath({
    kind: "submission",
    memberId,
    entityId: activityId,
    mimeType: file.type,
  });
  if (!(path && extension)) {
    return null;
  }

  const attachmentPath = await uploadMemberAsset({
    storagePath: path,
    body: await file.arrayBuffer(),
    mimeType: file.type,
  });

  return {
    attachmentMimeType: file.type,
    attachmentName: file.name.slice(0, 180),
    attachmentPath,
    attachmentSizeBytes: file.size,
  };
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: submission handling intentionally keeps validation, ownership, file checks, persistence, and cleanup in one server-side boundary.
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
  const validAttachment = getSubmissionAttachment(formData.get("attachment"));

  if (
    ((!normalizedContent || normalizedContent.length > 40_000) &&
      !validAttachment) ||
    (validAttachment &&
      (!allowedAttachmentTypes.has(validAttachment.type) ||
        validAttachment.size > 10 * 1024 * 1024))
  ) {
    return;
  }

  if (!(await canAccessPublishedActivity(activityId, userId))) {
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

  const previous = await database.activitySubmission.findUnique({
    where: { activityId_memberId: { activityId, memberId: userId } },
    select: { attachmentPath: true },
  });
  const uploadedAttachment = validAttachment
    ? await uploadSubmissionAttachment({
        activityId,
        file: validAttachment,
        memberId: userId,
      })
    : null;
  if (validAttachment && !uploadedAttachment) {
    return;
  }
  const attachmentPath =
    uploadedAttachment?.attachmentPath ?? previous?.attachmentPath ?? null;

  await database.activitySubmission.upsert({
    where: { activityId_memberId: { activityId, memberId: userId } },
    create: {
      activityId,
      memberId: userId,
      content: normalizedContent || "(entrega em arquivo)",
      status: ActivitySubmissionStatus.SUBMITTED,
      attachmentPath,
      attachmentName: uploadedAttachment?.attachmentName ?? null,
      attachmentMimeType: uploadedAttachment?.attachmentMimeType ?? null,
      attachmentSizeBytes: uploadedAttachment?.attachmentSizeBytes ?? null,
      submittedAt: new Date(),
    },
    update: {
      content: normalizedContent || "(entrega em arquivo)",
      status: ActivitySubmissionStatus.SUBMITTED,
      ...(uploadedAttachment ?? {}),
      submittedAt: new Date(),
    },
  });

  if (previous?.attachmentPath && previous.attachmentPath !== attachmentPath) {
    await deleteMemberAsset(previous.attachmentPath);
  }

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
    select: {
      memberId: true,
      activity: { select: { slug: true, title: true } },
    },
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

  if (submission.memberId !== userId) {
    await createNotification({
      memberId: submission.memberId,
      type: "ACTIVITY_FEEDBACK",
      title: "Novo feedback disponível",
      body: submission.activity.title,
      href: `/atividades/${submission.activity.slug}`,
    });
  }

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

  const activity = await database.activity.create({
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

  const memberIds = assignmentIds(formData);
  if (memberIds.length > 0) {
    const members = await database.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    });
    await database.activityAssignment.createMany({
      data: members.map((member) => ({
        activityId: activity.id,
        memberId: member.id,
        dueAt: dueDate,
      })),
      skipDuplicates: true,
    });
  }

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

  await database.$transaction(async (transaction) => {
    await transaction.activity.update({
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
    if (formData.has("memberIds")) {
      const memberIds = assignmentIds(formData);
      const members = await transaction.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true },
      });
      await transaction.activityAssignment.deleteMany({
        where: { activityId },
      });
      await transaction.activityAssignment.createMany({
        data: members.map((member) => ({
          activityId,
          memberId: member.id,
          dueAt: dueDate,
        })),
        skipDuplicates: true,
      });
    }
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
