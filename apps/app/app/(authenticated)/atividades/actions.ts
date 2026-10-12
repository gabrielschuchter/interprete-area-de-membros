"use server";

import {
  ActivityDeliveryKind,
  ActivitySubmissionStatus,
  BadgeCriterion,
  ContentStatus,
  database,
  LearningAssignmentTargetType,
  MemberRole,
  Prisma,
} from "@repo/database";
import { shouldPauseStorageUploadDuringRollback } from "@repo/security/write-freeze";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { env } from "@/env";
import { canAccessPublishedActivity } from "@/lib/activities";
import { activitySubmissionInput } from "@/lib/activity-submission-input";
import { requireOnboardedMemberId, requireStaff } from "@/lib/authorization";
import { evaluateMemberBadges } from "@/lib/badges";
import {
  enqueueLearningAssignmentNotifications,
  markLearningAssignmentCompleted,
  reconcileActivityAssignments,
} from "@/lib/learning-assignments";
import {
  createMemberAssetPath,
  deleteMemberAsset,
  uploadMemberAsset,
} from "@/lib/member-storage";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";
import { notifyFeedbackReceived } from "@/lib/notifications";

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry.trim() : "";
};

const memberIdSeparator = /[\n,]/;

const assignmentIds = (formData: FormData) =>
  [
    ...new Set(
      formData
        .getAll("memberIds")
        .flatMap((entry) =>
          typeof entry === "string" ? entry.split(memberIdSeparator) : []
        )
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ].slice(0, 200);

const ensureActivityAssignments = async ({
  assignedByMemberId,
  activityId,
  dueAt,
  memberIds,
  memberWhere,
  notify = false,
}: {
  readonly assignedByMemberId: string;
  readonly activityId: string;
  readonly dueAt: Date | null;
  readonly memberIds: readonly string[];
  readonly memberWhere?: Prisma.MemberWhereInput;
  readonly notify?: boolean;
}) => {
  await database.$transaction((transaction) =>
    reconcileActivityAssignments(transaction, {
      activityId,
      assignedByMemberId,
      dueAt,
      memberIds,
      notify,
      memberWhere,
    })
  );
};

const staffRecipientWhere = (userId: string, role: MemberRole) =>
  role === MemberRole.ADMIN
    ? undefined
    : ({
        role: MemberRole.MEMBER,
        deactivatedAt: null,
        cohortMemberships: {
          some: {
            status: "ACTIVE" as const,
            leftAt: null,
            cohort: {
              is: {
                archivedAt: null,
                teachers: { some: { memberId: userId } },
              },
            },
          },
        },
      } satisfies Prisma.MemberWhereInput);

const areRecipientsInStaffScope = async (
  memberIds: readonly string[],
  userId: string,
  role: MemberRole
) => {
  if (role === MemberRole.ADMIN || memberIds.length === 0) {
    return true;
  }
  const members = await database.member.findMany({
    where: {
      id: { in: [...memberIds] },
      ...staffRecipientWhere(userId, role),
    },
    select: { id: true },
  });
  return members.length === memberIds.length;
};

const attachmentExtensions: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/plain": "txt",
};

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

const validActivityRelations = async (
  courseId: string,
  lessonId: string,
  relatedLibraryItemId: string
) => {
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

  if (relatedLibraryItemId) {
    const libraryItem = await database.libraryItem.findUnique({
      where: { id: relatedLibraryItemId },
      select: { id: true },
    });
    if (!libraryItem) {
      return false;
    }
  }

  return true;
};

export interface ActivitySubmissionState {
  readonly message?: string;
  readonly ok: boolean;
}
export const submitActivity = async (
  _previous: ActivitySubmissionState,
  formData: FormData
): Promise<ActivitySubmissionState> => {
  const userId = await requireOnboardedMemberId();
  const activityId = formData.get("activityId");
  const content = formData.get("content");

  if (typeof activityId !== "string") {
    return {
      ok: false,
      message:
        "Não foi possível enviar. Confira os campos e seu acesso à atividade.",
    };
  }

  await consumeMutationRateLimit({
    action: "activity.submit",
    memberId: userId,
  });

  const input = activitySubmissionInput(content, formData.get("attachment"));
  if (!input.ok) {
    return input;
  }
  const normalizedContent = input.text;
  const validAttachment = input.file;

  if (!(await canAccessPublishedActivity(activityId, userId))) {
    return {
      ok: false,
      message:
        "Não foi possível enviar. Confira os campos e seu acesso à atividade.",
    };
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
    select: { slug: true, deliveryKind: true, rubricVersion: true },
  });

  if (!activity) {
    return {
      ok: false,
      message:
        "Não foi possível enviar. Confira os campos e seu acesso à atividade.",
    };
  }
  const requiresText =
    activity.deliveryKind === ActivityDeliveryKind.TEXT ||
    activity.deliveryKind === ActivityDeliveryKind.TEXT_AND_FILE;
  const requiresFile =
    activity.deliveryKind === ActivityDeliveryKind.FILE ||
    activity.deliveryKind === ActivityDeliveryKind.TEXT_AND_FILE;
  if (
    (requiresText && !normalizedContent) ||
    (requiresFile && !validAttachment)
  ) {
    return {
      ok: false,
      message:
        "Não foi possível enviar. Confira os campos e seu acesso à atividade.",
    };
  }

  if (
    shouldPauseStorageUploadDuringRollback({
      enabled: env.UPLOADS_PAUSED_FOR_ROLLBACK === "true",
      hasFile: Boolean(validAttachment),
    })
  ) {
    redirect(`/atividades/${activity.slug}?uploadsPaused=1`);
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
    return {
      ok: false,
      message:
        "Não foi possível enviar. Confira os campos e seu acesso à atividade.",
    };
  }
  const attachmentPath =
    uploadedAttachment?.attachmentPath ?? previous?.attachmentPath ?? null;
  const submittedAt = new Date();
  await database.$transaction(async (transaction) => {
    await transaction.activitySubmission.upsert({
      where: { activityId_memberId: { activityId, memberId: userId } },
      create: {
        activityId,
        memberId: userId,
        content: normalizedContent || "(entrega em arquivo)",
        status: ActivitySubmissionStatus.SUBMITTED,
        rubricVersion: activity.rubricVersion,
        attachmentPath,
        attachmentName: uploadedAttachment?.attachmentName ?? null,
        attachmentMimeType: uploadedAttachment?.attachmentMimeType ?? null,
        attachmentSizeBytes: uploadedAttachment?.attachmentSizeBytes ?? null,
        submittedAt,
      },
      update: {
        content: normalizedContent || "(entrega em arquivo)",
        status: ActivitySubmissionStatus.SUBMITTED,
        rubricVersion: activity.rubricVersion,
        ...(uploadedAttachment ?? {}),
        submittedAt,
      },
    });
    await markLearningAssignmentCompleted(
      userId,
      LearningAssignmentTargetType.ACTIVITY,
      activityId,
      submittedAt,
      transaction
    );
    await evaluateMemberBadges(transaction, userId, submittedAt, {
      criteria: [BadgeCriterion.ACTIVITIES_COMPLETED],
      force: true,
    });
  });

  await dispatchPendingNotifications();

  if (previous?.attachmentPath && previous.attachmentPath !== attachmentPath) {
    await deleteMemberAsset(previous.attachmentPath);
  }

  revalidatePath("/atividades");
  revalidatePath(`/atividades/${activity.slug}`);
  revalidatePath("/estudar");
  return { ok: true, message: "Resposta enviada e salva." };
};

export const saveFeedback = async (formData: FormData) => {
  const { userId, role } = await requireStaff();
  await consumeMutationRateLimit({
    action: "activity.mutation",
    memberId: userId,
  });
  const submissionId = formData.get("submissionId");
  const content = formData.get("content");

  if (typeof submissionId !== "string" || typeof content !== "string") {
    return;
  }

  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return;
  }

  const recipientScope = staffRecipientWhere(userId, role);
  const submission = await database.$transaction(
    async (transaction) => {
      const authorizedSubmission =
        await transaction.activitySubmission.findFirst({
          where: {
            id: submissionId,
            ...(recipientScope ? { member: { is: recipientScope } } : {}),
          },
          select: {
            memberId: true,
            activity: { select: { id: true, slug: true, title: true } },
          },
        });
      if (!authorizedSubmission) {
        return null;
      }
      await transaction.feedback.upsert({
        where: { submissionId },
        create: { submissionId, teacherId: userId, content: normalizedContent },
        update: { teacherId: userId, content: normalizedContent },
      });
      await transaction.activitySubmission.update({
        where: { id: submissionId },
        data: { status: ActivitySubmissionStatus.REVIEWED },
      });
      return authorizedSubmission;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  if (!submission) {
    return;
  }

  if (submission.memberId !== userId) {
    await notifyFeedbackReceived({
      recipientId: submission.memberId,
      actorId: userId,
      submissionId,
      activityTitle: submission.activity.title,
      href: `/atividades/${submission.activity.slug}`,
    });
  }

  revalidatePath("/admin/activities");
  revalidatePath(`/atividades/${submission.activity.slug}`);
};

export const createActivity = async (formData: FormData) => {
  const { userId, role } = await requireStaff();
  await consumeMutationRateLimit({
    action: "activity.mutation",
    memberId: userId,
  });
  const title = formData.get("title");
  const slug = formData.get("slug");
  const prompt = formData.get("prompt");
  const instructions = formData.get("instructions");
  const deliveryKindValue = value(formData, "deliveryKind");
  const dueAt = formData.get("dueAt");
  const courseId = value(formData, "courseId");
  const lessonId = value(formData, "lessonId");
  const relatedLibraryItemId = value(formData, "relatedLibraryItemId");
  const idempotencyKey = readIdempotencyKey(formData.get("idempotencyKey"));

  if (
    !idempotencyKey ||
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

  if (
    !(await validActivityRelations(courseId, lessonId, relatedLibraryItemId))
  ) {
    return;
  }

  const selectedMemberIds = assignmentIds(formData);
  if (!(await areRecipientsInStaffScope(selectedMemberIds, userId, role))) {
    return;
  }
  const memberWhere = staffRecipientWhere(userId, role);

  const existingActivity = await database.activity.findUnique({
    where: { createdBy_idempotencyKey: { createdBy: userId, idempotencyKey } },
    select: { id: true, status: true },
  });
  if (existingActivity) {
    await ensureActivityAssignments({
      assignedByMemberId: userId,
      activityId: existingActivity.id,
      dueAt: dueDate,
      memberIds: selectedMemberIds,
      notify: existingActivity.status === ContentStatus.PUBLISHED,
      memberWhere,
    });
    revalidatePath("/admin/activities");
    return;
  }

  const deliveryKind = Object.values(ActivityDeliveryKind).includes(
    deliveryKindValue as ActivityDeliveryKind
  )
    ? (deliveryKindValue as ActivityDeliveryKind)
    : ActivityDeliveryKind.TEXT;

  let activity: { id: string };
  try {
    activity = await database.activity.create({
      data: {
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        prompt: prompt.trim(),
        instructions:
          typeof instructions === "string" && instructions.trim()
            ? instructions.trim()
            : null,
        deliveryKind,
        dueAt: dueDate,
        courseId: courseId || null,
        lessonId: lessonId || null,
        relatedLibraryItemId: relatedLibraryItemId || null,
        status: ContentStatus.DRAFT,
        createdBy: userId,
        updatedBy: userId,
        idempotencyKey,
      },
      select: { id: true },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const concurrentActivity = await database.activity.findUnique({
      where: {
        createdBy_idempotencyKey: { createdBy: userId, idempotencyKey },
      },
      select: { id: true },
    });
    if (!concurrentActivity) {
      throw error;
    }
    activity = concurrentActivity;
  }

  await ensureActivityAssignments({
    assignedByMemberId: userId,
    activityId: activity.id,
    dueAt: dueDate,
    memberIds: selectedMemberIds,
    memberWhere,
  });

  revalidatePath("/admin/activities");
};

export const updateActivity = async (formData: FormData) => {
  const { userId, role } = await requireStaff();
  await consumeMutationRateLimit({
    action: "activity.mutation",
    memberId: userId,
  });
  const activityId = value(formData, "activityId");
  const title = value(formData, "title");
  const slug = value(formData, "slug");
  const prompt = value(formData, "prompt");
  const instructions = value(formData, "instructions");
  const deliveryKindValue = value(formData, "deliveryKind");
  const dueAt = value(formData, "dueAt");
  const courseId = value(formData, "courseId");
  const lessonId = value(formData, "lessonId");
  const relatedLibraryItemId = value(formData, "relatedLibraryItemId");

  if (!(activityId && title.trim() && slug.trim() && prompt.trim())) {
    return;
  }

  const dueDate = dueAt.trim() ? new Date(dueAt) : null;

  if (dueDate && Number.isNaN(dueDate.valueOf())) {
    return;
  }

  if (
    !(await validActivityRelations(courseId, lessonId, relatedLibraryItemId))
  ) {
    return;
  }
  const selectedMemberIds = assignmentIds(formData);
  if (
    formData.has("memberIds") &&
    !(await areRecipientsInStaffScope(selectedMemberIds, userId, role))
  ) {
    return;
  }
  const memberWhere = staffRecipientWhere(userId, role);

  const existingActivity = await database.activity.findUnique({
    where: { id: activityId },
    select: { status: true },
  });
  if (!existingActivity) {
    return;
  }

  const deliveryKind = Object.values(ActivityDeliveryKind).includes(
    deliveryKindValue as ActivityDeliveryKind
  )
    ? (deliveryKindValue as ActivityDeliveryKind)
    : ActivityDeliveryKind.TEXT;

  await database.$transaction(async (transaction) => {
    await transaction.activity.update({
      where: { id: activityId },
      data: {
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        prompt: prompt.trim(),
        instructions: instructions.trim() || null,
        deliveryKind,
        dueAt: dueDate,
        courseId: courseId || null,
        lessonId: lessonId || null,
        relatedLibraryItemId: relatedLibraryItemId || null,
        updatedBy: userId,
      },
    });
    if (formData.has("memberIds")) {
      await reconcileActivityAssignments(transaction, {
        activityId,
        assignedByMemberId: userId,
        dueAt: dueDate,
        memberIds: selectedMemberIds,
        notify: existingActivity.status === ContentStatus.PUBLISHED,
        memberWhere,
      });
    }
  });

  revalidatePath("/admin/activities");
  revalidatePath("/atividades");
};

export const setActivityStatus = async (formData: FormData) => {
  const { userId, role } = await requireStaff();
  await consumeMutationRateLimit({
    action: "activity.mutation",
    memberId: userId,
  });
  const activityId = formData.get("activityId");
  const status = formData.get("status");

  if (
    typeof activityId !== "string" ||
    typeof status !== "string" ||
    !Object.values(ContentStatus).includes(status as ContentStatus)
  ) {
    return;
  }

  await database.$transaction(async (transaction) => {
    const activity = await transaction.activity.update({
      where: { id: activityId },
      data: { status: status as ContentStatus, updatedBy: userId },
      select: { id: true, status: true },
    });
    if (activity.status !== ContentStatus.PUBLISHED) {
      return;
    }
    const assignments = await transaction.activityAssignment.findMany({
      where: {
        activityId: activity.id,
        revokedAt: null,
        status: { not: "REVOKED" },
        ...(staffRecipientWhere(userId, role)
          ? { member: { is: staffRecipientWhere(userId, role) } }
          : {}),
      },
      select: { id: true, memberId: true, batchId: true },
    });
    const byBatch = new Map<string, { id: string; memberId: string }[]>();
    for (const assignment of assignments) {
      const batchId = assignment.batchId ?? activity.id;
      const batch = byBatch.get(batchId) ?? [];
      batch.push({ id: assignment.id, memberId: assignment.memberId });
      byBatch.set(batchId, batch);
    }
    for (const [batchId, batchAssignments] of byBatch) {
      await enqueueLearningAssignmentNotifications(transaction, {
        actorId: userId,
        assignments: batchAssignments,
        batchId,
        createdAt: new Date(),
      });
    }
  });

  revalidatePath("/admin/activities");
  revalidatePath("/atividades");
};
