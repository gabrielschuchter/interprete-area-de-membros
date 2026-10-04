"use server";

import {
  database,
  LearningAssignmentAudienceType,
  LearningAssignmentTargetType,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/authorization";
import { createLearningAssignmentBatch } from "@/lib/learning-assignments";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";

const memberIdSeparator = /[\n,]/;

import { readIdempotencyKeyFromForm } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const dateAtSaoPaulo = (value: string) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parseTarget = (value: string) => {
  const [type, ...parts] = value.split(":");
  const id = parts.join(":");
  if (
    !(
      id &&
      Object.values(LearningAssignmentTargetType).includes(
        type as LearningAssignmentTargetType
      )
    )
  ) {
    return null;
  }
  return { id, type: type as LearningAssignmentTargetType };
};

const parseAudience = (value: string) =>
  Object.values(LearningAssignmentAudienceType).includes(
    value as LearningAssignmentAudienceType
  )
    ? (value as LearningAssignmentAudienceType)
    : null;

interface ParsedAssignmentInput {
  readonly audienceSpaceId: string | null;
  readonly audienceType: LearningAssignmentAudienceType;
  readonly availableAt: Date | null;
  readonly dueAt: Date | null;
  readonly expiresAt: Date | null;
  readonly idempotencyKey: string;
  readonly memberIds: string[];
  readonly message: string | null;
  readonly target: {
    readonly id: string;
    readonly type: LearningAssignmentTargetType;
  };
}

const isValidAudience = (
  type: LearningAssignmentAudienceType,
  memberIds: readonly string[],
  audienceSpaceId: string | null
) => {
  switch (type) {
    case LearningAssignmentAudienceType.INDIVIDUAL:
      return memberIds.length === 1;
    case LearningAssignmentAudienceType.SELECTED_MEMBERS:
      return memberIds.length > 0 && memberIds.length <= 200;
    case LearningAssignmentAudienceType.GROUP:
      return Boolean(audienceSpaceId);
    case LearningAssignmentAudienceType.ALL_MEMBERS:
      return true;
    default:
      return false;
  }
};

const parseAssignmentInput = (
  formData: FormData
): ParsedAssignmentInput | null => {
  const target = parseTarget(text(formData, "target"));
  const audienceType = parseAudience(text(formData, "audienceType"));
  const idempotencyKey = readIdempotencyKeyFromForm(formData);
  const memberIds = [
    ...new Set(
      formData
        .getAll("memberIds")
        .flatMap((value) =>
          typeof value === "string" ? value.split(memberIdSeparator) : []
        )
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
  const audienceSpaceId = text(formData, "audienceSpaceId") || null;
  const availableAt = dateAtSaoPaulo(text(formData, "availableAt"));
  const dueAt = dateAtSaoPaulo(text(formData, "dueAt"));
  const expiresAt = dateAtSaoPaulo(text(formData, "expiresAt"));
  const message = text(formData, "message");

  if (!(target && audienceType && idempotencyKey)) {
    return null;
  }
  if (!isValidAudience(audienceType, memberIds, audienceSpaceId)) {
    return null;
  }
  if (memberIds.length > 200 || message.length > 1000) {
    return null;
  }
  if (
    availableAt === undefined ||
    dueAt === undefined ||
    expiresAt === undefined
  ) {
    return null;
  }
  if (
    (availableAt && expiresAt && expiresAt <= availableAt) ||
    (dueAt && expiresAt && dueAt > expiresAt)
  ) {
    return null;
  }
  return {
    audienceSpaceId,
    audienceType,
    availableAt,
    dueAt,
    expiresAt,
    idempotencyKey,
    memberIds,
    message: message || null,
    target,
  };
};

const redirectWithResult = (
  result: "created" | "invalid" | "replayed"
): never => {
  revalidatePath("/admin/atribuicoes");
  revalidatePath("/aprender");
  redirect(`/admin/atribuicoes?resultado=${result}`);
};

export const createLearningAssignment = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const input = parseAssignmentInput(formData);
  if (!input) {
    return redirectWithResult("invalid");
  }

  const createdAt = new Date();
  let result: Awaited<ReturnType<typeof createLearningAssignmentBatch>>;
  try {
    result = await database.$transaction((transaction) =>
      createLearningAssignmentBatch(transaction, {
        assignedByMemberId: userId,
        audienceSpaceId: input.audienceSpaceId,
        audienceType: input.audienceType,
        availableAt: input.availableAt,
        createdAt,
        dueAt: input.dueAt,
        expiresAt: input.expiresAt,
        idempotencyKey: input.idempotencyKey,
        memberIds: input.memberIds,
        message: input.message,
        targetId: input.target.id,
        targetType: input.target.type,
      })
    );
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const priorBatch = await database.learningAssignmentBatch.findFirst({
      where: {
        createdByMemberId: userId,
        idempotencyKey: input.idempotencyKey,
      },
      select: { id: true },
    });
    if (priorBatch) {
      redirectWithResult("replayed");
    }
    throw error;
  }
  if (result === null) {
    return redirectWithResult("invalid");
  }
  if (result.created) {
    await dispatchPendingNotifications();
  }
  redirectWithResult(result.created ? "created" : "replayed");
};

export const revokeLearningAssignmentBatch = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const batchId = text(formData, "batchId");
  if (!batchId) {
    redirectWithResult("invalid");
  }
  const revokedAt = new Date();
  await database.$transaction(async (transaction) => {
    const batch = await transaction.learningAssignmentBatch.findUnique({
      where: { id: batchId },
      select: { id: true },
    });
    if (!batch) {
      return;
    }
    await transaction.activityAssignment.updateMany({
      where: {
        batchId,
        revokedAt: null,
        status: { not: "REVOKED" },
      },
      data: { status: "REVOKED", revokedAt },
    });
  });
  redirectWithResult("created");
};
