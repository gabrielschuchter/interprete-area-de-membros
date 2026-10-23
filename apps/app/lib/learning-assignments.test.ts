import { beforeEach, expect, test, vi } from "vitest";

const { databaseAssignmentUpdateManyMock, enqueueNotificationBatchMock } =
  vi.hoisted(() => ({
    databaseAssignmentUpdateManyMock: vi.fn(),
    enqueueNotificationBatchMock: vi.fn(),
  }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  CourseExperience: { ASYNC: "ASYNC", RECORDING_ARCHIVE: "RECORDING_ARCHIVE" },
  LessonAssetMediaProvider: { YOUTUBE: "YOUTUBE" },
  LearningAssignmentAudienceType: {
    INDIVIDUAL: "INDIVIDUAL",
    SELECTED_MEMBERS: "SELECTED_MEMBERS",
    GROUP: "GROUP",
    ALL_MEMBERS: "ALL_MEMBERS",
  },
  LearningAssignmentStatus: {
    NEW: "NEW",
    VIEWED: "VIEWED",
    STARTED: "STARTED",
    COMPLETED: "COMPLETED",
    REVOKED: "REVOKED",
  },
  LearningAssignmentTargetType: {
    ACTIVITY: "ACTIVITY",
    COURSE: "COURSE",
    MODULE: "MODULE",
    LESSON: "LESSON",
    ASSET: "ASSET",
    RECORDING: "RECORDING",
    LIBRARY_ITEM: "LIBRARY_ITEM",
    EXERCISE_LIST: "EXERCISE_LIST",
  },
  MemberRole: { ADMIN: "ADMIN", MEMBER: "MEMBER", TEACHER: "TEACHER" },
  database: {
    activityAssignment: { updateMany: databaseAssignmentUpdateManyMock },
  },
}));
vi.mock("@repo/security/write-freeze", () => ({
  isAppWriteFreezeEnabled: () => false,
}));
vi.mock("@repo/member-domain", () => ({
  enqueueNotificationBatch: enqueueNotificationBatchMock,
}));

const assignmentRoutePattern = /^\/cursos\/atribuicoes\//;

import {
  LearningAssignmentAudienceType,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
  type Prisma,
} from "@repo/database";
import {
  createLearningAssignmentBatch,
  markLearningAssignmentStarted,
  resolveLearningAssignmentTarget,
  shouldMarkAssignmentViewed,
} from "./learning-assignments";

const makeInput = (overrides: Record<string, unknown> = {}) => ({
  assignedByMemberId: "teacher_1",
  audienceType: LearningAssignmentAudienceType.SELECTED_MEMBERS,
  availableAt: null,
  createdAt: new Date("2026-10-03T15:00:00.000Z"),
  dueAt: null,
  expiresAt: null,
  idempotencyKey: "assignment-key-1",
  memberIds: ["student_1", "student_2", "student_1"],
  message: "Leia antes do próximo encontro.",
  targetId: "activity_1",
  targetType: LearningAssignmentTargetType.ACTIVITY,
  ...overrides,
});

test("GET assignment view side effect pauses during the cutover freeze", () => {
  expect(shouldMarkAssignmentViewed(LearningAssignmentStatus.NEW, false)).toBe(
    true
  );
  expect(shouldMarkAssignmentViewed(LearningAssignmentStatus.NEW, true)).toBe(
    false
  );
  expect(
    shouldMarkAssignmentViewed(LearningAssignmentStatus.VIEWED, false)
  ).toBe(false);
});

const makeTransaction = () => {
  const createMany = vi.fn().mockResolvedValue({ count: 2 });
  const createBatch = vi.fn().mockResolvedValue({ id: "batch_1" });
  const findExistingBatch = vi.fn().mockResolvedValue(null);
  const findActor = vi
    .fn()
    .mockResolvedValue({ id: "teacher_1", role: "TEACHER" });
  const findGroup = vi.fn().mockResolvedValue(null);
  const findMembers = vi
    .fn()
    .mockResolvedValue([{ id: "student_1" }, { id: "student_2" }]);
  const tx = {
    activity: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "activity_1",
          title: "Leitura crítica",
          slug: "leitura-critica",
        },
      ]),
    },
    exerciseList: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "exercise_list_1",
          title: "Fundamentos de interpretação",
          slug: "fundamentos-interpretacao",
          status: "PUBLISHED",
          bank: { status: "PUBLISHED" },
        },
      ]),
    },
    importedRecording: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "recording_1",
          originalTitle: "Aula gravada",
          asset: { id: "asset_1", title: "Aula gravada" },
        },
      ]),
    },
    libraryItem: { findMany: vi.fn().mockResolvedValue([]) },
    module: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "module_1",
          title: "Módulo 1",
          course: { slug: "curso" },
        },
      ]),
    },
    communitySpace: { findFirst: findGroup },
    activityAssignment: { createMany },
    learningAssignmentBatch: {
      create: createBatch,
      findFirst: findExistingBatch,
    },
    member: {
      findFirst: findActor,
      findMany: findMembers,
    },
  } as unknown as Prisma.TransactionClient;
  return {
    createBatch,
    createMany,
    findActor,
    findExistingBatch,
    findMembers,
    tx,
  };
};

beforeEach(() => {
  enqueueNotificationBatchMock.mockReset().mockResolvedValue([]);
  databaseAssignmentUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
});

test("marks an assigned exercise list as started through the caller transaction", async () => {
  const transactionUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
  const transaction = {
    activityAssignment: { updateMany: transactionUpdateMany },
  } as unknown as Prisma.TransactionClient;
  const at = new Date("2026-10-06T12:00:00.000Z");

  await markLearningAssignmentStarted(
    "student_1",
    LearningAssignmentTargetType.EXERCISE_LIST,
    "exercise_list_1",
    at,
    transaction
  );

  expect(transactionUpdateMany).toHaveBeenCalledWith({
    where: expect.objectContaining({
      memberId: "student_1",
      targetId: "exercise_list_1",
      targetType: LearningAssignmentTargetType.EXERCISE_LIST,
    }),
    data: {
      status: LearningAssignmentStatus.STARTED,
      startedAt: at,
    },
  });
  expect(databaseAssignmentUpdateManyMock).not.toHaveBeenCalled();
});

test("creates an idempotent target-specific batch and durable notices together", async () => {
  const { createBatch, createMany, tx } = makeTransaction();
  const result = await createLearningAssignmentBatch(tx, makeInput());
  if (!result) {
    throw new Error("Expected the published activity to be assignable.");
  }

  expect(result).toMatchObject({
    batchId: expect.any(String),
    created: true,
    recipientCount: 2,
    target: {
      href: "/atividades/leitura-critica",
      id: "activity_1",
      title: "Leitura crítica",
    },
  });
  expect(createBatch).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        idempotencyKey: "assignment-key-1",
        id: result.batchId,
        targetId: "activity_1",
        targetType: LearningAssignmentTargetType.ACTIVITY,
      }),
    })
  );
  expect(createMany).toHaveBeenCalledWith({
    data: expect.arrayContaining([
      expect.objectContaining({
        memberId: "student_1",
        batchId: result.batchId,
      }),
      expect.objectContaining({
        memberId: "student_2",
        batchId: result.batchId,
      }),
    ]),
  });
  expect(tx.member.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        role: "MEMBER",
        deactivatedAt: null,
        cohortMemberships: {
          some: {
            status: "ACTIVE",
            leftAt: null,
            cohort: {
              is: {
                archivedAt: null,
                teachers: { some: { memberId: "teacher_1" } },
              },
            },
          },
        },
      }),
    })
  );
  expect(enqueueNotificationBatchMock).toHaveBeenCalledWith(
    tx,
    expect.objectContaining({
      aggregateId: result.batchId,
      notifications: expect.arrayContaining([
        expect.objectContaining({
          recipientId: "student_1",
          type: "LEARNING_CONTENT_ASSIGNED",
          href: expect.stringMatching(assignmentRoutePattern),
        }),
        expect.objectContaining({
          recipientId: "student_2",
          type: "LEARNING_CONTENT_ASSIGNED",
        }),
      ]),
    })
  );
});

test("rejects an assignment after the actor loses staff access", async () => {
  const { createBatch, createMany, findActor, tx } = makeTransaction();
  findActor.mockResolvedValue(null);

  await expect(createLearningAssignmentBatch(tx, makeInput())).resolves.toBe(
    null
  );
  expect(createBatch).not.toHaveBeenCalled();
  expect(createMany).not.toHaveBeenCalled();
});

test("teachers cannot assign to every student across the platform", async () => {
  const { createBatch, createMany, tx } = makeTransaction();

  await expect(
    createLearningAssignmentBatch(
      tx,
      makeInput({
        audienceType: LearningAssignmentAudienceType.ALL_MEMBERS,
        memberIds: [],
      })
    )
  ).resolves.toBe(null);
  expect(createBatch).not.toHaveBeenCalled();
  expect(createMany).not.toHaveBeenCalled();
});

test("admins can assign to all active students", async () => {
  const { createMany, findActor, tx } = makeTransaction();
  findActor.mockResolvedValue({ id: "admin_1", role: "ADMIN" });

  const result = await createLearningAssignmentBatch(
    tx,
    makeInput({
      assignedByMemberId: "admin_1",
      audienceType: LearningAssignmentAudienceType.ALL_MEMBERS,
      memberIds: [],
    })
  );

  expect(result).toMatchObject({ created: true, recipientCount: 2 });
  expect(tx.member.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { role: "MEMBER", deactivatedAt: null },
    })
  );
  expect(createMany).toHaveBeenCalled();
});

test("rejects the full teacher selection if a recipient is outside current cohorts", async () => {
  const { createBatch, createMany, findMembers, tx } = makeTransaction();
  findMembers.mockResolvedValueOnce([{ id: "student_1" }]);

  await expect(createLearningAssignmentBatch(tx, makeInput())).resolves.toBe(
    null
  );
  expect(createBatch).not.toHaveBeenCalled();
  expect(createMany).not.toHaveBeenCalled();
});

test("replaying a batch key returns the saved count without writing twice", async () => {
  const { createBatch, createMany, findExistingBatch, tx } = makeTransaction();
  findExistingBatch.mockResolvedValue({
    id: "batch_existing",
    _count: { assignments: 2 },
  });

  await expect(createLearningAssignmentBatch(tx, makeInput())).resolves.toEqual(
    {
      batchId: "batch_existing",
      created: false,
      recipientCount: 2,
    }
  );
  expect(createBatch).not.toHaveBeenCalled();
  expect(createMany).not.toHaveBeenCalled();
  expect(enqueueNotificationBatchMock).not.toHaveBeenCalled();
});

test("exercise-list assignments resolve only to published exercise lists", async () => {
  const { tx } = makeTransaction();
  const resolved = await resolveLearningAssignmentTarget(
    tx,
    LearningAssignmentTargetType.EXERCISE_LIST,
    "exercise_list_1"
  );

  expect(resolved).toEqual({
    href: "/exercicios/listas/fundamentos-interpretacao",
    id: "exercise_list_1",
    title: "Fundamentos de interpretação",
    type: "EXERCISE_LIST",
  });
  expect(tx.exerciseList.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ["exercise_list_1"] },
        status: "PUBLISHED",
        bank: { is: { status: "PUBLISHED" } },
      }),
    })
  );
});

test("module assignments open and identify the assigned module", async () => {
  const { tx } = makeTransaction();
  const resolved = await resolveLearningAssignmentTarget(
    tx,
    LearningAssignmentTargetType.MODULE,
    "module_1"
  );

  expect(resolved).toEqual({
    href: "/cursos/curso?module=module_1#module-module_1",
    id: "module_1",
    title: "Módulo 1",
    type: "MODULE",
  });
});

test("recording assignments resolve to one playable recording asset", async () => {
  const { tx } = makeTransaction();
  const resolved = await resolveLearningAssignmentTarget(
    tx,
    LearningAssignmentTargetType.RECORDING,
    "recording_1"
  );

  expect(resolved).toEqual({
    href: "/encontros/gravacoes?asset=asset_1",
    id: "recording_1",
    title: "Aula gravada",
    type: "RECORDING",
  });
  expect(tx.importedRecording.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ["recording_1"] },
        asset: {
          is: {
            mediaProvider: "YOUTUBE",
            mediaExternalId: { not: null },
          },
        },
      }),
    })
  );
});

test("library-item assignments resolve only when the linked learning path is published", async () => {
  const { tx } = makeTransaction();
  vi.mocked(tx.libraryItem.findMany).mockResolvedValue([
    { id: "library_item_1", title: "Material complementar" },
  ] as never);

  const resolved = await resolveLearningAssignmentTarget(
    tx,
    LearningAssignmentTargetType.LIBRARY_ITEM,
    "library_item_1"
  );

  expect(resolved).toEqual({
    href: "/biblioteca/library_item_1",
    id: "library_item_1",
    title: "Material complementar",
    type: "LIBRARY_ITEM",
  });
  expect(tx.libraryItem.findMany).toHaveBeenCalledWith({
    where: {
      id: { in: ["library_item_1"] },
      status: "PUBLISHED",
      OR: [
        { lessonId: null },
        {
          lesson: {
            is: {
              status: "PUBLISHED",
              module: {
                is: {
                  status: "PUBLISHED",
                  course: {
                    is: {
                      status: "PUBLISHED",
                      experience: "ASYNC",
                      OR: [
                        { learningPathId: null },
                        { learningPath: { is: { status: "PUBLISHED" } } },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true, title: true },
  });
});
