import "server-only";

import { randomUUID } from "node:crypto";
import {
  ContentStatus,
  CourseExperience,
  database,
  LearningAssignmentAudienceType,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
  MemberRole,
  type Prisma,
} from "@repo/database";
import { enqueueNotificationBatch } from "@repo/member-domain";
import { isAppWriteFreezeEnabled } from "@repo/security/write-freeze";

type AssignmentClient = typeof database | Prisma.TransactionClient;

export interface LearningAssignmentTarget {
  readonly href: string;
  readonly id: string;
  readonly title: string;
  readonly type: LearningAssignmentTargetType;
}

export const shouldMarkAssignmentViewed = (
  status: LearningAssignmentStatus,
  writeFreezeEnabled: boolean
) => status === LearningAssignmentStatus.NEW && !writeFreezeEnabled;

export interface CreateLearningAssignmentInput {
  readonly assignedByMemberId: string;
  readonly audienceSpaceId?: string | null;
  readonly audienceType: LearningAssignmentAudienceType;
  readonly availableAt: Date | null;
  readonly createdAt: Date;
  readonly dueAt: Date | null;
  readonly expiresAt: Date | null;
  readonly idempotencyKey: string;
  readonly memberIds: readonly string[];
  readonly message: string | null;
  readonly targetId: string;
  readonly targetType: LearningAssignmentTargetType;
}

const publishedLessonWhere = {
  status: ContentStatus.PUBLISHED,
  module: {
    is: {
      status: ContentStatus.PUBLISHED,
      course: {
        is: {
          status: ContentStatus.PUBLISHED,
          experience: CourseExperience.ASYNC,
          OR: [
            { learningPathId: null },
            { learningPath: { is: { status: ContentStatus.PUBLISHED } } },
          ],
        },
      },
    },
  },
} satisfies Prisma.LessonWhereInput;

const targetKey = (type: LearningAssignmentTargetType, id: string) =>
  `${type}:${id}`;

export const resolveLearningAssignmentTargets = async (
  client: AssignmentClient,
  targets: readonly {
    readonly id: string;
    readonly type: LearningAssignmentTargetType;
  }[]
) => {
  const idsByType = new Map<LearningAssignmentTargetType, string[]>();
  for (const target of targets) {
    const ids = idsByType.get(target.type) ?? [];
    ids.push(target.id);
    idsByType.set(target.type, ids);
  }
  const ids = (type: LearningAssignmentTargetType) => [
    ...new Set(idsByType.get(type) ?? []),
  ];
  const [
    activities,
    courses,
    modules,
    lessons,
    assets,
    libraryItems,
    exerciseLists,
  ] = await Promise.all([
    ids(LearningAssignmentTargetType.ACTIVITY).length
      ? client.activity.findMany({
          where: {
            id: { in: ids(LearningAssignmentTargetType.ACTIVITY) },
            status: ContentStatus.PUBLISHED,
            AND: [
              {
                OR: [
                  { courseId: null },
                  {
                    course: {
                      is: {
                        status: ContentStatus.PUBLISHED,
                        experience: CourseExperience.ASYNC,
                      },
                    },
                  },
                ],
              },
              {
                OR: [
                  { lessonId: null },
                  { lesson: { is: publishedLessonWhere } },
                ],
              },
            ],
          },
          select: { id: true, title: true, slug: true },
        })
      : [],
    ids(LearningAssignmentTargetType.COURSE).length
      ? client.course.findMany({
          where: {
            id: { in: ids(LearningAssignmentTargetType.COURSE) },
            status: ContentStatus.PUBLISHED,
            experience: CourseExperience.ASYNC,
            OR: [
              { learningPathId: null },
              { learningPath: { is: { status: ContentStatus.PUBLISHED } } },
            ],
          },
          select: { id: true, title: true, slug: true },
        })
      : [],
    ids(LearningAssignmentTargetType.MODULE).length
      ? client.module.findMany({
          where: {
            id: { in: ids(LearningAssignmentTargetType.MODULE) },
            status: ContentStatus.PUBLISHED,
            course: {
              is: {
                status: ContentStatus.PUBLISHED,
                experience: CourseExperience.ASYNC,
                OR: [
                  { learningPathId: null },
                  {
                    learningPath: { is: { status: ContentStatus.PUBLISHED } },
                  },
                ],
              },
            },
          },
          select: {
            id: true,
            title: true,
            course: { select: { slug: true } },
          },
        })
      : [],
    ids(LearningAssignmentTargetType.LESSON).length
      ? client.lesson.findMany({
          where: {
            id: { in: ids(LearningAssignmentTargetType.LESSON) },
            ...publishedLessonWhere,
          },
          select: {
            id: true,
            title: true,
            slug: true,
            module: { select: { course: { select: { slug: true } } } },
          },
        })
      : [],
    ids(LearningAssignmentTargetType.ASSET).length
      ? client.lessonAsset.findMany({
          where: {
            id: { in: ids(LearningAssignmentTargetType.ASSET) },
            lesson: { is: publishedLessonWhere },
          },
          select: {
            id: true,
            title: true,
            lesson: {
              select: {
                slug: true,
                module: { select: { course: { select: { slug: true } } } },
              },
            },
          },
        })
      : [],
    ids(LearningAssignmentTargetType.LIBRARY_ITEM).length
      ? client.libraryItem.findMany({
          where: {
            id: { in: ids(LearningAssignmentTargetType.LIBRARY_ITEM) },
            status: ContentStatus.PUBLISHED,
          },
          select: { id: true, title: true },
        })
      : [],
    ids(LearningAssignmentTargetType.EXERCISE_LIST).length
      ? client.exerciseList.findMany({
          where: {
            id: { in: ids(LearningAssignmentTargetType.EXERCISE_LIST) },
            status: ContentStatus.PUBLISHED,
            bank: { is: { status: ContentStatus.PUBLISHED } },
          },
          select: { id: true, title: true, slug: true },
        })
      : [],
  ]);
  const resolved = new Map<string, LearningAssignmentTarget>();
  const add = (
    type: LearningAssignmentTargetType,
    id: string,
    title: string,
    href: string
  ) => resolved.set(targetKey(type, id), { href, id, title, type });
  for (const item of activities) {
    add(
      LearningAssignmentTargetType.ACTIVITY,
      item.id,
      item.title,
      `/atividades/${item.slug}`
    );
  }
  for (const item of courses) {
    add(
      LearningAssignmentTargetType.COURSE,
      item.id,
      item.title,
      `/aprender/cursos/${item.slug}`
    );
  }
  for (const item of modules) {
    add(
      LearningAssignmentTargetType.MODULE,
      item.id,
      item.title,
      `/aprender/cursos/${item.course.slug}`
    );
  }
  for (const item of lessons) {
    add(
      LearningAssignmentTargetType.LESSON,
      item.id,
      item.title,
      `/aprender/cursos/${item.module.course.slug}/${item.slug}`
    );
  }
  for (const item of assets) {
    add(
      LearningAssignmentTargetType.ASSET,
      item.id,
      item.title,
      `/aprender/cursos/${item.lesson.module.course.slug}/${item.lesson.slug}#materiais`
    );
  }
  for (const item of libraryItems) {
    add(
      LearningAssignmentTargetType.LIBRARY_ITEM,
      item.id,
      item.title,
      `/biblioteca/${item.id}`
    );
  }
  for (const item of exerciseLists) {
    add(
      LearningAssignmentTargetType.EXERCISE_LIST,
      item.id,
      item.title,
      `/exercicios/listas/${item.slug}`
    );
  }
  return resolved;
};

export const resolveLearningAssignmentTarget = async (
  client: AssignmentClient,
  type: LearningAssignmentTargetType,
  id: string
): Promise<LearningAssignmentTarget | null> => {
  const resolved = await resolveLearningAssignmentTargets(client, [
    { type, id },
  ]);
  return resolved.get(targetKey(type, id)) ?? null;
};

const resolveAssignmentMemberIds = async (
  transaction: Prisma.TransactionClient,
  input: CreateLearningAssignmentInput
) => {
  if (input.audienceType === LearningAssignmentAudienceType.GROUP) {
    if (!input.audienceSpaceId) {
      return [];
    }
    const group = await transaction.communitySpace.findFirst({
      where: {
        id: input.audienceSpaceId,
        status: ContentStatus.PUBLISHED,
      },
      select: {
        id: true,
        ownerId: true,
        members: { select: { memberId: true } },
      },
    });
    if (!group) {
      return [];
    }
    const candidates = [
      ...(group.ownerId ? [group.ownerId] : []),
      ...group.members.map(({ memberId }) => memberId),
    ];
    const members = await transaction.member.findMany({
      where: {
        id: { in: [...new Set(candidates)] },
        role: MemberRole.MEMBER,
        deactivatedAt: null,
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    return members.map(({ id }) => id);
  }

  const selectedIds = [...new Set(input.memberIds)];
  const members = await transaction.member.findMany({
    where: {
      role: MemberRole.MEMBER,
      deactivatedAt: null,
      ...(input.audienceType === LearningAssignmentAudienceType.ALL_MEMBERS
        ? {}
        : { id: { in: selectedIds } }),
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return members.map(({ id }) => id);
};

const createManyInChunks = async <T>(
  values: readonly T[],
  create: (chunk: T[]) => Promise<unknown>,
  chunkSize = 500
) => {
  for (let offset = 0; offset < values.length; offset += chunkSize) {
    await create(values.slice(offset, offset + chunkSize) as T[]);
  }
};

export const createLearningAssignmentBatch = async (
  transaction: Prisma.TransactionClient,
  input: CreateLearningAssignmentInput
) => {
  const existingBatch = await transaction.learningAssignmentBatch.findFirst({
    where: {
      createdByMemberId: input.assignedByMemberId,
      idempotencyKey: input.idempotencyKey,
    },
    select: {
      id: true,
      _count: { select: { assignments: true } },
    },
  });
  if (existingBatch) {
    return {
      batchId: existingBatch.id,
      created: false,
      recipientCount: existingBatch._count.assignments,
    };
  }

  const target = await resolveLearningAssignmentTarget(
    transaction,
    input.targetType,
    input.targetId
  );
  if (!target) {
    return null;
  }
  const recipientIds = await resolveAssignmentMemberIds(transaction, input);
  if (recipientIds.length === 0) {
    return null;
  }

  const batchId = randomUUID();
  await transaction.learningAssignmentBatch.create({
    data: {
      id: batchId,
      idempotencyKey: input.idempotencyKey,
      targetType: input.targetType,
      targetId: input.targetId,
      audienceType: input.audienceType,
      audienceSpaceId:
        input.audienceType === LearningAssignmentAudienceType.GROUP
          ? input.audienceSpaceId
          : null,
      createdByMemberId: input.assignedByMemberId,
      message: input.message,
      availableAt: input.availableAt,
      dueAt: input.dueAt,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
    },
  });

  const assignments = recipientIds.map((memberId) => ({
    id: randomUUID(),
    activityId:
      input.targetType === LearningAssignmentTargetType.ACTIVITY
        ? input.targetId
        : null,
    targetType: input.targetType,
    targetId: input.targetId,
    batchId,
    memberId,
    assignedByMemberId: input.assignedByMemberId,
    message: input.message,
    availableAt: input.availableAt,
    dueAt: input.dueAt,
    expiresAt: input.expiresAt,
    status: LearningAssignmentStatus.NEW,
    assignedAt: input.createdAt,
  }));
  await createManyInChunks(assignments, (chunk) =>
    transaction.activityAssignment.createMany({ data: chunk })
  );

  await enqueueLearningAssignmentNotifications(transaction, {
    actorId: input.assignedByMemberId,
    assignments,
    batchId,
    createdAt: input.createdAt,
  });

  return {
    batchId,
    created: true,
    recipientCount: recipientIds.length,
    target,
  };
};

export const enqueueLearningAssignmentNotifications = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly assignments: readonly {
      readonly id: string;
      readonly memberId: string;
    }[];
    readonly batchId: string;
    readonly createdAt: Date;
  }
) => {
  if (input.assignments.length === 0) {
    return;
  }
  await enqueueNotificationBatch(transaction, {
    actorId: input.actorId,
    aggregateType: "learning_assignment_batch",
    aggregateId: input.batchId,
    idempotencyKey: `learning-assignment-batch:${input.batchId}`,
    occurredAt: input.createdAt,
    notifications: input.assignments.map((assignment) => ({
      recipientId: assignment.memberId,
      type: "LEARNING_CONTENT_ASSIGNED",
      entityType: "LEARNING_ASSIGNMENT",
      entityId: assignment.id,
      dedupeKey: `learning-assignment:${assignment.id}`,
      href: `/aprender/atribuicoes/${assignment.id}`,
    })),
  });
};

export const createActivityAssignments = async (input: {
  readonly activityId: string;
  readonly assignedByMemberId: string;
  readonly dueAt: Date | null;
  readonly memberIds: readonly string[];
}) => {
  const memberIds = [...new Set(input.memberIds)].slice(0, 200);
  if (memberIds.length === 0) {
    return null;
  }
  const createdAt = new Date();
  const members = await database.member.findMany({
    where: {
      id: { in: memberIds },
      role: MemberRole.MEMBER,
      deactivatedAt: null,
    },
    select: { id: true },
  });
  if (members.length === 0) {
    return null;
  }

  return database.$transaction(async (transaction) => {
    const batchId = randomUUID();
    await transaction.learningAssignmentBatch.create({
      data: {
        id: batchId,
        targetType: LearningAssignmentTargetType.ACTIVITY,
        targetId: input.activityId,
        audienceType:
          members.length === 1
            ? LearningAssignmentAudienceType.INDIVIDUAL
            : LearningAssignmentAudienceType.SELECTED_MEMBERS,
        createdByMemberId: input.assignedByMemberId,
        dueAt: input.dueAt,
        createdAt,
      },
    });
    const assignments = members.map(({ id }) => ({
      id: randomUUID(),
      activityId: input.activityId,
      targetType: LearningAssignmentTargetType.ACTIVITY,
      targetId: input.activityId,
      batchId,
      memberId: id,
      assignedByMemberId: input.assignedByMemberId,
      dueAt: input.dueAt,
      status: LearningAssignmentStatus.NEW,
      assignedAt: createdAt,
    }));
    await createManyInChunks(assignments, (chunk) =>
      transaction.activityAssignment.createMany({ data: chunk })
    );
    const activity = await transaction.activity.findFirst({
      where: { id: input.activityId, status: ContentStatus.PUBLISHED },
      select: { id: true, title: true, slug: true },
    });
    if (activity) {
      await enqueueLearningAssignmentNotifications(transaction, {
        actorId: input.assignedByMemberId,
        assignments,
        batchId,
        createdAt,
      });
    }
    return { batchId, recipientCount: members.length };
  });
};

export const reconcileActivityAssignments = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly activityId: string;
    readonly assignedByMemberId: string;
    readonly dueAt: Date | null;
    readonly memberIds: readonly string[];
    readonly notify: boolean;
  }
) => {
  const selectedIds = [...new Set(input.memberIds)].slice(0, 200);
  const members = selectedIds.length
    ? await transaction.member.findMany({
        where: {
          id: { in: selectedIds },
          role: MemberRole.MEMBER,
          deactivatedAt: null,
        },
        select: { id: true },
      })
    : [];
  const selectedMemberIds = new Set(members.map(({ id }) => id));
  const currentAssignments = await transaction.activityAssignment.findMany({
    where: {
      activityId: input.activityId,
      revokedAt: null,
      status: { not: LearningAssignmentStatus.REVOKED },
    },
    select: { id: true, memberId: true },
  });
  const newlySelectedIds = members
    .map(({ id }) => id)
    .filter(
      (memberId) =>
        !currentAssignments.some(
          (assignment) => assignment.memberId === memberId
        )
    );
  const removedAssignmentIds = currentAssignments
    .filter((assignment) => !selectedMemberIds.has(assignment.memberId))
    .map(({ id }) => id);
  const now = new Date();

  if (removedAssignmentIds.length > 0) {
    await transaction.activityAssignment.updateMany({
      where: { id: { in: removedAssignmentIds } },
      data: {
        status: LearningAssignmentStatus.REVOKED,
        revokedAt: now,
      },
    });
  }
  if (selectedMemberIds.size > 0) {
    await transaction.activityAssignment.updateMany({
      where: {
        activityId: input.activityId,
        memberId: { in: [...selectedMemberIds] },
        revokedAt: null,
        status: { not: LearningAssignmentStatus.REVOKED },
      },
      data: { dueAt: input.dueAt },
    });
  }
  if (newlySelectedIds.length === 0) {
    return { added: 0, revoked: removedAssignmentIds.length };
  }

  const batchId = randomUUID();
  const assignedAt = now;
  await transaction.learningAssignmentBatch.create({
    data: {
      id: batchId,
      idempotencyKey: `activity-recipients:${input.activityId}:${batchId}`,
      targetType: LearningAssignmentTargetType.ACTIVITY,
      targetId: input.activityId,
      audienceType:
        newlySelectedIds.length === 1
          ? LearningAssignmentAudienceType.INDIVIDUAL
          : LearningAssignmentAudienceType.SELECTED_MEMBERS,
      createdByMemberId: input.assignedByMemberId,
      dueAt: input.dueAt,
      createdAt: assignedAt,
    },
  });
  const assignments = newlySelectedIds.map((memberId) => ({
    id: randomUUID(),
    activityId: input.activityId,
    targetType: LearningAssignmentTargetType.ACTIVITY,
    targetId: input.activityId,
    batchId,
    memberId,
    assignedByMemberId: input.assignedByMemberId,
    dueAt: input.dueAt,
    status: LearningAssignmentStatus.NEW,
    assignedAt,
  }));
  await createManyInChunks(assignments, (chunk) =>
    transaction.activityAssignment.createMany({ data: chunk })
  );
  if (input.notify) {
    await enqueueLearningAssignmentNotifications(transaction, {
      actorId: input.assignedByMemberId,
      assignments,
      batchId,
      createdAt: assignedAt,
    });
  }
  return { added: assignments.length, revoked: removedAssignmentIds.length };
};

export const markLearningAssignmentViewed = async (
  assignmentId: string,
  memberId: string,
  at = new Date()
) =>
  isAppWriteFreezeEnabled()
    ? { count: 0 }
    : database.activityAssignment.updateMany({
        where: {
          id: assignmentId,
          memberId,
          status: LearningAssignmentStatus.NEW,
          revokedAt: null,
          AND: [
            { OR: [{ availableAt: null }, { availableAt: { lte: at } }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: at } }] },
          ],
        },
        data: { status: LearningAssignmentStatus.VIEWED, viewedAt: at },
      });

export const markLearningAssignmentStarted = async (
  memberId: string,
  targetType: LearningAssignmentTargetType,
  targetId: string,
  at = new Date()
) =>
  isAppWriteFreezeEnabled()
    ? { count: 0 }
    : database.activityAssignment.updateMany({
        where: {
          memberId,
          targetType,
          targetId,
          status: {
            in: [LearningAssignmentStatus.NEW, LearningAssignmentStatus.VIEWED],
          },
          revokedAt: null,
          AND: [
            { OR: [{ availableAt: null }, { availableAt: { lte: at } }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: at } }] },
          ],
        },
        data: {
          status: LearningAssignmentStatus.STARTED,
          startedAt: at,
        },
      });

export const markLearningAssignmentCompleted = async (
  memberId: string,
  targetType: LearningAssignmentTargetType,
  targetId: string,
  at = new Date(),
  client: AssignmentClient = database
) =>
  client.activityAssignment.updateMany({
    where: {
      memberId,
      targetType,
      targetId,
      status: {
        in: [
          LearningAssignmentStatus.NEW,
          LearningAssignmentStatus.VIEWED,
          LearningAssignmentStatus.STARTED,
        ],
      },
      revokedAt: null,
    },
    data: {
      status: LearningAssignmentStatus.COMPLETED,
      completedAt: at,
    },
  });

export const revokeLearningAssignment = async (
  assignmentId: string,
  at = new Date()
) =>
  database.activityAssignment.updateMany({
    where: { id: assignmentId, revokedAt: null },
    data: {
      status: LearningAssignmentStatus.REVOKED,
      revokedAt: at,
    },
  });

export const getReceivedLearningAssignments = async (memberId: string) => {
  const now = new Date();
  const assignments = await database.activityAssignment.findMany({
    where: {
      memberId,
      revokedAt: null,
      status: { not: LearningAssignmentStatus.REVOKED },
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    orderBy: [{ availableAt: "asc" }, { assignedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      targetId: true,
      targetType: true,
      status: true,
      message: true,
      availableAt: true,
      dueAt: true,
      expiresAt: true,
      assignedAt: true,
    },
  });
  const targets = await resolveLearningAssignmentTargets(
    database,
    assignments.map(({ targetId, targetType }) => ({
      id: targetId,
      type: targetType,
    }))
  );
  return assignments.flatMap((assignment) => {
    const target = targets.get(
      targetKey(assignment.targetType, assignment.targetId)
    );
    return target ? [{ ...assignment, target }] : [];
  });
};

export const activeAssignmentStatuses = [
  LearningAssignmentStatus.NEW,
  LearningAssignmentStatus.VIEWED,
  LearningAssignmentStatus.STARTED,
  LearningAssignmentStatus.COMPLETED,
] as const;
