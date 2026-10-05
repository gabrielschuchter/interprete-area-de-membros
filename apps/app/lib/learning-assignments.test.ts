import { beforeEach, expect, test, vi } from "vitest";

const { enqueueNotificationBatchMock } = vi.hoisted(() => ({
  enqueueNotificationBatchMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  CourseExperience: { ASYNC: "ASYNC" },
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
    LIBRARY_ITEM: "LIBRARY_ITEM",
    EXERCISE_LIST: "EXERCISE_LIST",
  },
  MemberRole: { MEMBER: "MEMBER" },
  database: {},
}));
vi.mock("@repo/member-domain", () => ({
  enqueueNotificationBatch: enqueueNotificationBatchMock,
}));

const assignmentRoutePattern = /^\/aprender\/atribuicoes\//;

import {
  LearningAssignmentAudienceType,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
  type Prisma,
} from "@repo/database";
import {
  createLearningAssignmentBatch,
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
  memberIds: ["student_1", "student_2", "student_1", "teacher_1"],
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
    activityAssignment: { createMany },
    learningAssignmentBatch: {
      create: createBatch,
      findFirst: findExistingBatch,
    },
    member: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "student_1" }, { id: "student_2" }]),
    },
  } as unknown as Prisma.TransactionClient;
  return { createBatch, createMany, findExistingBatch, tx };
};

beforeEach(() => {
  enqueueNotificationBatchMock.mockReset().mockResolvedValue([]);
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
