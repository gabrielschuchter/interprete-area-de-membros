"use server";

import { createHash } from "node:crypto";
import {
  ActivityDeliveryKind,
  ActivitySubmissionStatus,
  ContentStatus,
  database,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
  MemberRole,
  Prisma,
} from "@repo/database";
import { enqueueNotificationBatch } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { selectActivityCohortRecipientIds } from "@/lib/activity-cohort-access";
import { listGestaoActivityMemberOptions } from "@/lib/gestao-activities";
import type { ActivityRubricInput } from "@/lib/gestao-activity-domain";
import {
  normalizeActivitySlug,
  parseActivityRubric,
  validateActivityPublication,
} from "@/lib/gestao-activity-domain";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  enqueueLearningAssignmentNotifications,
  reconcileActivityAssignments,
} from "@/lib/learning-assignments";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry.trim() : "";
};

const splitValuesPattern = /[\n,]/;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const values = (formData: FormData, name: string, limit = 200) =>
  [
    ...new Set(
      formData
        .getAll(name)
        .flatMap((entry) =>
          typeof entry === "string" ? entry.split(splitValuesPattern) : []
        )
        .map((entry) => entry.trim())
        .filter(Boolean)
    ),
  ].slice(0, limit);

const parseDeadline = (raw: string) => {
  if (!raw) {
    return null;
  }
  if (!localDateTimePattern.test(raw)) {
    return undefined;
  }
  const date = new Date(`${raw}:00-03:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseDeliveryKind = (raw: string) =>
  Object.values(ActivityDeliveryKind).includes(raw as ActivityDeliveryKind)
    ? (raw as ActivityDeliveryKind)
    : null;

const activityPath = (id: string) => `/gestao/ensino/atividades/${id}`;
const resultPath = (id: string | null, result: string) => {
  const path = id ? activityPath(id) : "/gestao/ensino/atividades/nova";
  return `${path}?resultado=${encodeURIComponent(result)}`;
};

const cohortScope = (actor: {
  readonly role: string;
  readonly userId: string;
}) => ({
  archivedAt: null,
  ...(actor.role === MemberRole.ADMIN
    ? {}
    : { teachers: { some: { memberId: actor.userId } } }),
});

const managedMemberScope = (actor: {
  readonly role: string;
  readonly userId: string;
}): Prisma.MemberWhereInput => ({
  role: MemberRole.MEMBER,
  deactivatedAt: null,
  ...(actor.role === MemberRole.ADMIN
    ? {}
    : {
        cohortMemberships: {
          some: {
            status: "ACTIVE",
            leftAt: null,
            cohort: { is: cohortScope(actor) },
          },
        },
      }),
});

const validateTargets = async (
  actor: { readonly role: string; readonly userId: string },
  cohortIds: readonly string[],
  memberIds: readonly string[]
) => {
  const cohorts = cohortIds.length
    ? await database.cohort.findMany({
        where: { id: { in: [...cohortIds] }, ...cohortScope(actor) },
        select: { id: true },
      })
    : [];
  if (cohorts.length !== cohortIds.length) {
    return "cohorts" as const;
  }
  const members = memberIds.length
    ? await database.member.findMany({
        where: {
          id: { in: [...memberIds] },
          ...managedMemberScope(actor),
        },
        select: { id: true },
      })
    : [];
  if (members.length !== memberIds.length) {
    return "members" as const;
  }
  return null;
};

const validateRelations = async (
  input: {
    readonly courseId: string;
    readonly lessonId: string;
    readonly relatedLibraryItemId: string;
  },
  requirePublished = false
) => {
  if (input.courseId) {
    const course = await database.course.findFirst({
      where: { id: input.courseId, experience: "ASYNC" },
      select: { id: true, status: true },
    });
    if (
      !course ||
      (requirePublished && course.status !== ContentStatus.PUBLISHED)
    ) {
      return false;
    }
  }
  if (input.lessonId) {
    const lesson = await database.lesson.findUnique({
      where: { id: input.lessonId },
      select: {
        status: true,
        module: {
          select: {
            status: true,
            courseId: true,
            course: { select: { status: true } },
          },
        },
      },
    });
    if (
      !lesson ||
      (input.courseId && lesson.module.courseId !== input.courseId) ||
      (requirePublished &&
        (lesson.status !== ContentStatus.PUBLISHED ||
          lesson.module.status !== ContentStatus.PUBLISHED ||
          lesson.module.course.status !== ContentStatus.PUBLISHED))
    ) {
      return false;
    }
  }
  if (input.relatedLibraryItemId) {
    const item = await database.libraryItem.findUnique({
      where: { id: input.relatedLibraryItemId },
      select: { id: true, status: true },
    });
    if (
      !item ||
      (requirePublished && item.status !== ContentStatus.PUBLISHED)
    ) {
      return false;
    }
  }
  return true;
};

const syncCohortTargets = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly activityId: string;
    readonly actorId: string;
    readonly actor: { readonly role: string; readonly userId: string };
    readonly cohortIds: readonly string[];
    readonly assignedAt: Date;
  }
) => {
  if (input.cohortIds.length) {
    const validCohorts = await transaction.cohort.findMany({
      where: {
        id: { in: [...input.cohortIds] },
        ...cohortScope(input.actor),
      },
      select: { id: true },
    });
    if (validCohorts.length !== input.cohortIds.length) {
      throw new Error("GESTAO_ACTIVITY_TARGET_CONFLICT");
    }
  }
  const current = await transaction.activityCohortTarget.findMany({
    where: {
      activityId: input.activityId,
      activeKey: { not: null },
      revokedAt: null,
      cohort: { is: cohortScope(input.actor) },
    },
    select: { id: true, cohortId: true },
  });
  const selected = new Set(input.cohortIds);
  const currentByCohort = new Map(
    current.map((target) => [target.cohortId, target])
  );
  const removed = current.filter((target) => !selected.has(target.cohortId));
  const added = input.cohortIds.filter(
    (cohortId) => !currentByCohort.has(cohortId)
  );
  if (removed.length) {
    await transaction.activityCohortTarget.updateMany({
      where: { id: { in: removed.map(({ id }) => id) } },
      data: { activeKey: null, revokedAt: input.assignedAt },
    });
  }
  if (added.length) {
    await transaction.activityCohortTarget.createMany({
      data: added.map((cohortId) => ({
        activityId: input.activityId,
        cohortId,
        activeKey: `${input.activityId}:${cohortId}`,
        assignedAt: input.assignedAt,
        createdByMemberId: input.actorId,
      })),
    });
  }
  const newTargets = added.length
    ? await transaction.activityCohortTarget.findMany({
        where: {
          activityId: input.activityId,
          cohortId: { in: added },
          activeKey: { not: null },
          revokedAt: null,
        },
        select: { id: true },
      })
    : [];
  return newTargets.map(({ id }) => id);
};

const sameRubric = (
  left: readonly { readonly title: string; readonly weight: number }[],
  right: readonly { readonly title: string; readonly weight: number }[]
) =>
  left.length === right.length &&
  left.every(
    (criterion, index) =>
      criterion.title === right[index]?.title &&
      criterion.weight === right[index]?.weight
  );

const saveRubricVersion = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly activityId: string;
    readonly currentVersion: number;
    readonly criteria: readonly ActivityRubricInput[];
  }
) => {
  const current = await transaction.activityRubricCriterion.findMany({
    where: { activityId: input.activityId, version: input.currentVersion },
    orderBy: { position: "asc" },
    select: { title: true, weight: true },
  });
  if (sameRubric(current, input.criteria)) {
    return input.currentVersion;
  }
  const nextVersion = input.currentVersion + 1;
  if (input.criteria.length) {
    await transaction.activityRubricCriterion.createMany({
      data: input.criteria.map((criterion) => ({
        activityId: input.activityId,
        version: nextVersion,
        title: criterion.title,
        weight: criterion.weight,
        position: criterion.position,
      })),
    });
  }
  return nextVersion;
};

const enqueuePublishedActivityNotifications = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly activityId: string;
    readonly actor: { readonly role: string; readonly userId: string };
    readonly activitySlug: string;
    readonly activityTitle: string;
    readonly publishedAt: Date;
    readonly cohortTargetIds?: readonly string[];
  }
) => {
  const assignments = await transaction.activityAssignment.findMany({
    where: {
      activityId: input.activityId,
      targetType: LearningAssignmentTargetType.ACTIVITY,
      revokedAt: null,
      status: { not: LearningAssignmentStatus.REVOKED },
      member: { is: managedMemberScope(input.actor) },
    },
    select: { id: true, memberId: true, batchId: true },
  });
  const byBatch = new Map<string, { id: string; memberId: string }[]>();
  for (const assignment of assignments) {
    const batchId = assignment.batchId ?? input.activityId;
    const batch = byBatch.get(batchId) ?? [];
    batch.push({ id: assignment.id, memberId: assignment.memberId });
    byBatch.set(batchId, batch);
  }
  for (const [batchId, batchAssignments] of byBatch) {
    await enqueueLearningAssignmentNotifications(transaction, {
      actorId: input.actor.userId,
      assignments: batchAssignments,
      batchId,
      createdAt: input.publishedAt,
    });
  }

  const targets = await transaction.activityCohortTarget.findMany({
    where: {
      activityId: input.activityId,
      activeKey: { not: null },
      revokedAt: null,
      ...(input.cohortTargetIds
        ? { id: { in: [...input.cohortTargetIds] } }
        : {}),
      cohort: { is: cohortScope(input.actor) },
    },
    select: {
      id: true,
      cohortId: true,
      assignedAt: true,
      cohort: {
        select: {
          archivedAt: true,
          endsAt: true,
          lateJoinPolicy: true,
          readAfterEndDays: true,
          startsAt: true,
        },
      },
    },
  });
  if (!targets.length) {
    return;
  }
  const memberships = await transaction.cohortMembership.findMany({
    where: {
      cohortId: { in: targets.map(({ cohortId }) => cohortId) },
      status: "ACTIVE",
      leftAt: null,
      member: { is: managedMemberScope(input.actor) },
    },
    select: { memberId: true, cohortId: true, joinedAt: true },
  });
  const eligibleIds = selectActivityCohortRecipientIds(
    targets,
    memberships,
    input.publishedAt
  );
  for (const assignment of assignments) {
    eligibleIds.delete(assignment.memberId);
  }
  if (eligibleIds.size) {
    const targetSetHash = createHash("sha256")
      .update(
        targets
          .map(({ id }) => id)
          .sort()
          .join(",")
      )
      .digest("hex");
    await enqueueNotificationBatch(transaction, {
      actorId: input.actor.userId,
      aggregateType: "ACTIVITY_COHORT_ASSIGNMENT",
      aggregateId: input.activityId,
      idempotencyKey: `activity-cohorts:${input.activityId}:${targetSetHash}`,
      occurredAt: input.publishedAt,
      notifications: [...eligibleIds].map((memberId) => ({
        recipientId: memberId,
        type: "ACTIVITY_ASSIGNED",
        entityType: "ACTIVITY",
        entityId: input.activityId,
        dedupeKey: `activity-cohort:${input.activityId}:${memberId}`,
        title: "Nova atividade para você",
        body: input.activityTitle,
        href: `/atividades/${input.activitySlug}`,
      })),
    });
  }
};

interface ActivityWriteInput {
  readonly activityId: string | null;
  readonly assignedAt: Date;
  readonly cohortIds: readonly string[];
  readonly courseId: string;
  readonly criteria: readonly ActivityRubricInput[];
  readonly deliveryKind: ActivityDeliveryKind;
  readonly dueAt: Date | null;
  readonly expectedVersion: number;
  readonly idempotencyKey: string | null;
  readonly instructions: string;
  readonly lessonId: string;
  readonly memberIds: readonly string[];
  readonly prompt: string;
  readonly relatedLibraryItemId: string;
  readonly shouldPublish: boolean;
  readonly slug: string;
  readonly title: string;
}

interface ActivityActor {
  readonly role: string;
  readonly userId: string;
}

const createActivityAndAudience = async (
  transaction: Prisma.TransactionClient,
  actor: ActivityActor,
  input: ActivityWriteInput
) => {
  const activity = await transaction.activity.create({
    data: {
      idempotencyKey: input.idempotencyKey,
      title: input.title,
      slug: input.slug,
      prompt: input.prompt,
      instructions: input.instructions || null,
      deliveryKind: input.deliveryKind,
      status: input.shouldPublish
        ? ContentStatus.PUBLISHED
        : ContentStatus.DRAFT,
      dueAt: input.dueAt,
      courseId: input.courseId || null,
      lessonId: input.lessonId || null,
      relatedLibraryItemId: input.relatedLibraryItemId || null,
      rubricVersion: input.criteria.length ? 1 : 0,
      version: 1,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    },
    select: { id: true, slug: true, title: true },
  });
  if (input.criteria.length) {
    await transaction.activityRubricCriterion.createMany({
      data: input.criteria.map((criterion) => ({
        activityId: activity.id,
        version: 1,
        title: criterion.title,
        weight: criterion.weight,
        position: criterion.position,
      })),
    });
  }
  const targetIds = await syncCohortTargets(transaction, {
    activityId: activity.id,
    actorId: actor.userId,
    actor,
    cohortIds: input.cohortIds,
    assignedAt: input.assignedAt,
  });
  await reconcileActivityAssignments(transaction, {
    activityId: activity.id,
    assignedByMemberId: actor.userId,
    dueAt: input.dueAt,
    memberIds: input.memberIds,
    notify: input.shouldPublish,
    memberWhere: managedMemberScope(actor),
  });
  if (input.shouldPublish) {
    await enqueuePublishedActivityNotifications(transaction, {
      activityId: activity.id,
      actor,
      activitySlug: activity.slug,
      activityTitle: activity.title,
      publishedAt: input.assignedAt,
      cohortTargetIds: targetIds,
    });
  }
  return activity.id;
};

const updateActivityAndAudience = async (
  transaction: Prisma.TransactionClient,
  actor: ActivityActor,
  input: ActivityWriteInput
) => {
  if (!input.activityId) {
    throw new Error("GESTAO_ACTIVITY_CONFLICT");
  }
  const current = await transaction.activity.findUnique({
    where: { id: input.activityId },
    select: { status: true, rubricVersion: true, version: true },
  });
  if (!current || current.version !== input.expectedVersion) {
    throw new Error("GESTAO_ACTIVITY_CONFLICT");
  }
  const nextStatus = input.shouldPublish
    ? ContentStatus.PUBLISHED
    : current.status;
  const update = await transaction.activity.updateMany({
    where: { id: input.activityId, version: input.expectedVersion },
    data: {
      title: input.title,
      slug: input.slug,
      prompt: input.prompt,
      instructions: input.instructions || null,
      deliveryKind: input.deliveryKind,
      dueAt: input.dueAt,
      courseId: input.courseId || null,
      lessonId: input.lessonId || null,
      relatedLibraryItemId: input.relatedLibraryItemId || null,
      status: nextStatus,
      updatedBy: actor.userId,
      version: { increment: 1 },
    },
  });
  if (update.count !== 1) {
    throw new Error("GESTAO_ACTIVITY_CONFLICT");
  }
  const rubricVersion = await saveRubricVersion(transaction, {
    activityId: input.activityId,
    currentVersion: current.rubricVersion,
    criteria: input.criteria,
  });
  if (rubricVersion !== current.rubricVersion) {
    await transaction.activity.update({
      where: { id: input.activityId },
      data: { rubricVersion },
    });
  }
  const addedTargetIds = await syncCohortTargets(transaction, {
    activityId: input.activityId,
    actorId: actor.userId,
    actor,
    cohortIds: input.cohortIds,
    assignedAt: input.assignedAt,
  });
  await reconcileActivityAssignments(transaction, {
    activityId: input.activityId,
    assignedByMemberId: actor.userId,
    dueAt: input.dueAt,
    memberIds: input.memberIds,
    notify: nextStatus === ContentStatus.PUBLISHED,
    memberWhere: managedMemberScope(actor),
  });
  if (nextStatus === ContentStatus.PUBLISHED) {
    await enqueuePublishedActivityNotifications(transaction, {
      activityId: input.activityId,
      actor,
      activitySlug: input.slug,
      activityTitle: input.title,
      publishedAt: input.assignedAt,
      ...(current.status === ContentStatus.PUBLISHED
        ? { cohortTargetIds: addedTargetIds }
        : {}),
    });
  }
  return input.activityId;
};

const parseActivityWriteInput = (
  formData: FormData,
  activityId: string | null
): Omit<ActivityWriteInput, "assignedAt"> | null => {
  const intent = value(formData, "intent");
  const idempotencyKey = readIdempotencyKey(formData.get("idempotencyKey"));
  const expectedVersion = Number.parseInt(value(formData, "version"), 10);
  const title = value(formData, "title").slice(0, 180);
  const slug = normalizeActivitySlug(value(formData, "slug") || title);
  const prompt = value(formData, "prompt").slice(0, 20_000);
  const instructions = value(formData, "instructions").slice(0, 20_000);
  const deliveryKind = parseDeliveryKind(value(formData, "deliveryKind"));
  const dueAt = parseDeadline(value(formData, "dueAt"));
  const cohortIds = values(formData, "cohortIds", 201);
  const memberIds = values(formData, "memberIds", 201);
  const rubric = parseActivityRubric(formData);
  if (
    !(title && slug && prompt && deliveryKind) ||
    dueAt === undefined ||
    !(activityId || idempotencyKey) ||
    (activityId &&
      (!Number.isInteger(expectedVersion) || expectedVersion < 1)) ||
    cohortIds.length > 200 ||
    memberIds.length > 200 ||
    !rubric.ok
  ) {
    return null;
  }
  return {
    activityId,
    idempotencyKey,
    expectedVersion,
    title,
    slug,
    prompt,
    instructions,
    deliveryKind,
    dueAt,
    courseId: value(formData, "courseId"),
    lessonId: value(formData, "lessonId"),
    relatedLibraryItemId: value(formData, "relatedLibraryItemId"),
    cohortIds,
    memberIds,
    criteria: rubric.criteria,
    shouldPublish: intent === "publish",
  };
};

const validateActivityWriteInput = async (
  actor: ActivityActor,
  input: Omit<ActivityWriteInput, "assignedAt">
) => {
  if (input.shouldPublish) {
    const publicationError = validateActivityPublication(
      input.criteria,
      input.dueAt,
      new Date()
    );
    if (publicationError) {
      return publicationError;
    }
    if (
      input.cohortIds.length === 0 &&
      input.memberIds.length === 0 &&
      !input.courseId &&
      !input.lessonId
    ) {
      return "destinatarios-invalidos";
    }
  }
  const relationsAreValid = await validateRelations(
    {
      courseId: input.courseId,
      lessonId: input.lessonId,
      relatedLibraryItemId: input.relatedLibraryItemId,
    },
    input.shouldPublish
  );
  if (!relationsAreValid) {
    return "referencias-invalidas";
  }
  const invalidTarget = await validateTargets(
    actor,
    input.cohortIds,
    input.memberIds
  );
  if (invalidTarget === "cohorts") {
    return "turmas-invalidas";
  }
  if (invalidTarget === "members") {
    return "alunos-invalidos";
  }
  return null;
};

const handleActivityWriteError = async (
  error: unknown,
  actorId: string,
  activityId: string | null,
  idempotencyKey: string | null
): Promise<never> => {
  if (isUniqueConstraintError(error)) {
    if (!activityId && idempotencyKey) {
      const existing = await database.activity.findUnique({
        where: {
          createdBy_idempotencyKey: {
            createdBy: actorId,
            idempotencyKey,
          },
        },
        select: { id: true },
      });
      if (existing) {
        redirect(resultPath(existing.id, "duplicada"));
      }
    }
    redirect(resultPath(activityId, "slug-existente"));
  }
  if (error instanceof Error && error.message === "GESTAO_ACTIVITY_CONFLICT") {
    redirect(resultPath(activityId, "conflito"));
  }
  if (
    error instanceof Error &&
    error.message === "GESTAO_ACTIVITY_TARGET_CONFLICT"
  ) {
    redirect(resultPath(activityId, "turmas-invalidas"));
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    redirect(resultPath(activityId, "conflito"));
  }
  throw error;
};

export const saveGestaoActivity = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "activity.mutation",
    memberId: actor.userId,
  });
  const activityId = value(formData, "activityId") || null;
  const parsed = parseActivityWriteInput(formData, activityId);
  if (!parsed) {
    redirect(resultPath(activityId, "dados-invalidos"));
  }
  const invalidResult = await validateActivityWriteInput(actor, parsed);
  if (invalidResult) {
    redirect(resultPath(activityId, invalidResult));
  }
  const input: ActivityWriteInput = { ...parsed, assignedAt: new Date() };
  let savedActivityId: string;
  try {
    savedActivityId = await database.$transaction(
      (transaction) =>
        input.activityId
          ? updateActivityAndAudience(transaction, actor, input)
          : createActivityAndAudience(transaction, actor, input),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    return handleActivityWriteError(
      error,
      actor.userId,
      activityId,
      input.idempotencyKey
    );
  }

  await dispatchPendingNotifications();
  revalidatePath("/gestao/ensino/atividades");
  revalidatePath("/admin/activities");
  revalidatePath("/atividades");
  revalidatePath("/estudar");
  redirect(
    resultPath(savedActivityId, input.shouldPublish ? "publicada" : "salva")
  );
};

export const setGestaoActivityStatus = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "activity.mutation",
    memberId: actor.userId,
  });
  const activityId = value(formData, "activityId");
  const expectedVersion = Number.parseInt(value(formData, "version"), 10);
  const status = value(formData, "status");
  if (
    !(activityId && Number.isInteger(expectedVersion)) ||
    (status !== ContentStatus.ARCHIVED && status !== ContentStatus.PUBLISHED)
  ) {
    redirect("/gestao/ensino/atividades?resultado=dados-invalidos");
  }
  const current = await database.activity.findUnique({
    where: { id: activityId },
    select: {
      status: true,
      dueAt: true,
      rubricVersion: true,
      courseId: true,
      lessonId: true,
      relatedLibraryItemId: true,
    },
  });
  if (!current) {
    redirect("/gestao/ensino/atividades?resultado=nao-encontrada");
  }
  if (status === ContentStatus.PUBLISHED) {
    const relationsAreValid = await validateRelations(
      {
        courseId: current.courseId ?? "",
        lessonId: current.lessonId ?? "",
        relatedLibraryItemId: current.relatedLibraryItemId ?? "",
      },
      true
    );
    if (!relationsAreValid) {
      redirect(
        `/gestao/ensino/atividades/${activityId}?resultado=referencias-invalidas`
      );
    }
    const [cohortTargetCount, directAssignmentCount] = await Promise.all([
      database.activityCohortTarget.count({
        where: {
          activityId,
          activeKey: { not: null },
          revokedAt: null,
          cohort: { is: cohortScope(actor) },
        },
      }),
      database.activityAssignment.count({
        where: {
          activityId,
          targetType: LearningAssignmentTargetType.ACTIVITY,
          revokedAt: null,
          status: { not: LearningAssignmentStatus.REVOKED },
          member: { is: managedMemberScope(actor) },
        },
      }),
    ]);
    if (
      !(
        current.courseId ||
        current.lessonId ||
        cohortTargetCount ||
        directAssignmentCount
      )
    ) {
      redirect(
        `/gestao/ensino/atividades/${activityId}?resultado=destinatarios-invalidos`
      );
    }
    const criteria = await database.activityRubricCriterion.findMany({
      where: { activityId, version: current.rubricVersion },
      select: { title: true, weight: true, position: true },
    });
    const publicationError = validateActivityPublication(
      criteria,
      current.dueAt
    );
    if (publicationError) {
      redirect(
        `/gestao/ensino/atividades/${activityId}?resultado=${publicationError}`
      );
    }
  }
  const updated = await database.$transaction(async (transaction) => {
    const result = await transaction.activity.updateMany({
      where: { id: activityId, version: expectedVersion },
      data: { status, updatedBy: actor.userId, version: { increment: 1 } },
    });
    if (result.count !== 1) {
      return null;
    }
    const activity = await transaction.activity.findUniqueOrThrow({
      where: { id: activityId },
      select: { id: true, slug: true, title: true },
    });
    if (status === ContentStatus.PUBLISHED) {
      await enqueuePublishedActivityNotifications(transaction, {
        activityId,
        actor,
        activitySlug: activity.slug,
        activityTitle: activity.title,
        publishedAt: new Date(),
      });
    }
    return activity;
  });
  if (!updated) {
    redirect("/gestao/ensino/atividades?resultado=conflito");
  }
  if (status === ContentStatus.PUBLISHED) {
    await dispatchPendingNotifications();
  }
  revalidatePath("/gestao/ensino/atividades");
  revalidatePath(`/gestao/ensino/atividades/${activityId}`);
  revalidatePath("/atividades");
  revalidatePath(`/atividades/${updated.slug}`);
  revalidatePath("/estudar");
  redirect("/gestao/ensino/atividades?resultado=estado-atualizado");
};

export const remindGestaoActivityCohort = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("assignments.manage");
  await consumeMutationRateLimit({
    action: "activity.mutation",
    memberId: actor.userId,
  });

  const activityId = value(formData, "activityId");
  const cohortId = value(formData, "cohortId");
  const idempotencyKey = readIdempotencyKey(formData.get("idempotencyKey"));
  if (!(activityId && cohortId && idempotencyKey)) {
    redirect(resultPath(activityId || null, "dados-invalidos"));
  }

  let result: "sent" | "all-submitted" | "no-eligible" | "missing" | "limit";
  try {
    result = await database.$transaction(
      async (transaction) => {
        const target = await transaction.activityCohortTarget.findFirst({
          where: {
            activityId,
            cohortId,
            activeKey: { not: null },
            revokedAt: null,
            activity: { is: { status: ContentStatus.PUBLISHED } },
            cohort: { is: cohortScope(actor) },
          },
          select: {
            assignedAt: true,
            cohortId: true,
            cohort: {
              select: {
                archivedAt: true,
                endsAt: true,
                lateJoinPolicy: true,
                readAfterEndDays: true,
                startsAt: true,
              },
            },
            activity: { select: { id: true, slug: true, title: true } },
          },
        });
        if (!target) {
          return "missing";
        }

        const memberships = await transaction.cohortMembership.findMany({
          where: {
            cohortId,
            status: "ACTIVE",
            leftAt: null,
            member: { is: managedMemberScope(actor) },
          },
          orderBy: { memberId: "asc" },
          take: 10_001,
          select: { cohortId: true, joinedAt: true, memberId: true },
        });
        if (memberships.length > 10_000) {
          return "limit";
        }

        const eligibleIds = selectActivityCohortRecipientIds(
          [target],
          memberships
        );
        if (eligibleIds.size === 0) {
          return "no-eligible";
        }

        const submittedMembers = await transaction.activitySubmission.findMany({
          where: {
            activityId,
            memberId: { in: [...eligibleIds] },
            status: {
              in: [
                ActivitySubmissionStatus.SUBMITTED,
                ActivitySubmissionStatus.REVIEWED,
              ],
            },
            submittedAt: { not: null },
          },
          select: { memberId: true },
        });
        const submittedIds = new Set(
          submittedMembers.map(({ memberId }) => memberId)
        );
        const recipientIds = [...eligibleIds].filter(
          (memberId) => !submittedIds.has(memberId)
        );
        if (recipientIds.length === 0) {
          return "all-submitted";
        }

        const occurredAt = new Date();
        await enqueueNotificationBatch(transaction, {
          actorId: actor.userId,
          aggregateType: "activity.reminder",
          aggregateId: activityId,
          idempotencyKey: `activity-reminder:${cohortId}:${idempotencyKey}`,
          occurredAt,
          notifications: recipientIds.map((recipientId) => ({
            recipientId,
            type: "ACTIVITY_DEADLINE",
            entityType: "ACTIVITY",
            entityId: target.activity.id,
            dedupeKey: `activity-reminder:${idempotencyKey}:${cohortId}:${recipientId}`,
            title: "Lembrete: atividade ainda não enviada",
            body: target.activity.title,
            href: `/atividades/${target.activity.slug}`,
          })),
        });
        return "sent";
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      result = "sent";
    } else if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      redirect(resultPath(activityId, "conflito"));
    } else {
      throw error;
    }
  }

  if (result === "missing") {
    notFound();
  }
  if (result === "limit") {
    redirect(resultPath(activityId, "limite-lembrete"));
  }
  if (result === "no-eligible") {
    redirect(resultPath(activityId, "sem-elegiveis"));
  }
  if (result === "all-submitted") {
    redirect(resultPath(activityId, "sem-pendentes"));
  }

  await dispatchPendingNotifications();
  revalidatePath(activityPath(activityId));
  redirect(resultPath(activityId, "lembretes-enviados"));
};

export const searchGestaoActivityMembers = async (
  query: string,
  page: number
) => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "member.search",
    memberId: actor.userId,
  });
  return listGestaoActivityMemberOptions({ query, page });
};
