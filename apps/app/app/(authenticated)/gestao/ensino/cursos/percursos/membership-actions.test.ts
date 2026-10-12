import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  databaseMock,
  transactionMock,
  enqueueDomainEvent,
  requireGestaoAction,
  redirectMock,
} = vi.hoisted(() => {
  const transactionMock = {
    course: { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    domainEvent: { findUnique: vi.fn() },
    learningPath: { findUnique: vi.fn(), updateMany: vi.fn() },
  };
  return {
    databaseMock: { $transaction: vi.fn() },
    enqueueDomainEvent: vi.fn(),
    redirectMock: vi.fn(),
    requireGestaoAction: vi.fn(),
    transactionMock,
  };
});

vi.mock("@repo/database", () => ({
  ContentStatus: {
    ARCHIVED: "ARCHIVED",
    DRAFT: "DRAFT",
    PUBLISHED: "PUBLISHED",
  },
  CourseExperience: { ASYNC: "ASYNC", LIVE: "LIVE" },
  database: databaseMock,
}));
vi.mock("@repo/member-domain", () => ({ enqueueDomainEvent }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/gestao-authorization", () => ({ requireGestaoAction }));
vi.mock("@/lib/mutation-contract", () => ({
  readIdempotencyKey: (value: unknown) =>
    typeof value === "string" ? value : null,
}));
vi.mock("@/lib/mutation-reliability", () => ({
  consumeMutationRateLimit: vi.fn(),
  isUniqueConstraintError: (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002",
}));

import {
  addGestaoLearningPathCourse,
  removeGestaoLearningPathCourse,
} from "./actions";

const pathUpdatedAt = new Date("2026-10-12T12:00:00.000Z");
const courseUpdatedAt = new Date("2026-10-12T12:01:00.000Z");
const key = "9fd5f0f7-88fb-4ac5-9f2e-c875c04b993d";

const membershipForm = (values: Record<string, string> = {}) => {
  const formData = new FormData();
  for (const [name, value] of Object.entries({
    courseId: "course-a",
    expectedCourseUpdatedAt: courseUpdatedAt.toISOString(),
    expectedPathUpdatedAt: pathUpdatedAt.toISOString(),
    idempotencyKey: key,
    page: "1",
    pathId: "path-a",
    ...values,
  })) {
    formData.set(name, value);
  }
  return formData;
};

describe("learning path course association actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGestaoAction.mockResolvedValue({
      actor: { role: "TEACHER", userId: "teacher-a" },
    });
    transactionMock.domainEvent.findUnique.mockResolvedValue(null);
    transactionMock.learningPath.findUnique.mockResolvedValue({
      status: "DRAFT",
      updatedAt: pathUpdatedAt,
    });
    transactionMock.learningPath.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.course.findUnique.mockResolvedValue({
      experience: "ASYNC",
      learningPathId: null,
      updatedAt: courseUpdatedAt,
    });
    transactionMock.course.findFirst.mockResolvedValue({ position: 2 });
    transactionMock.course.updateMany.mockResolvedValue({ count: 1 });
    databaseMock.$transaction.mockImplementation(
      async (operation: (transaction: typeof transactionMock) => unknown) =>
        operation(transactionMock)
    );
    redirectMock.mockImplementation((href: string) => {
      throw new Error(`REDIRECT:${href}`);
    });
  });

  it("adds an unattached async course at the end and records the same transaction", async () => {
    await expect(addGestaoLearningPathCourse(membershipForm())).rejects.toThrow(
      "REDIRECT:/gestao/ensino/cursos/percursos/path-a"
    );

    expect(requireGestaoAction).toHaveBeenCalledWith("content.manage", {
      contentId: "path-a",
    });
    expect(transactionMock.course.updateMany).toHaveBeenCalledWith({
      where: {
        id: "course-a",
        updatedAt: courseUpdatedAt,
        experience: "ASYNC",
        learningPathId: null,
      },
      data: { learningPathId: "path-a", position: 3 },
    });
    expect(transactionMock.learningPath.updateMany).toHaveBeenCalledWith({
      where: { id: "path-a", updatedAt: pathUpdatedAt },
      data: { updatedAt: expect.any(Date) },
    });
    expect(enqueueDomainEvent).toHaveBeenCalledWith(
      transactionMock,
      expect.objectContaining({
        actorId: "teacher-a",
        aggregateId: "path-a",
        eventType: "gestao.learning-path.course-added",
      })
    );
    expect(databaseMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" }
    );
  });

  it("requires explicit confirmation before changing a published path", async () => {
    transactionMock.learningPath.findUnique.mockResolvedValueOnce({
      status: "PUBLISHED",
      updatedAt: pathUpdatedAt,
    });

    await expect(
      removeGestaoLearningPathCourse(membershipForm())
    ).rejects.toThrow("estado=associacao-nao-confirmada");
    expect(transactionMock.learningPath.updateMany).not.toHaveBeenCalled();
    expect(transactionMock.course.updateMany).not.toHaveBeenCalled();
    expect(enqueueDomainEvent).not.toHaveBeenCalled();
  });

  it("removes only a course still attached to this path after confirmation", async () => {
    transactionMock.learningPath.findUnique.mockResolvedValueOnce({
      status: "PUBLISHED",
      updatedAt: pathUpdatedAt,
    });
    transactionMock.course.findUnique.mockResolvedValueOnce({
      experience: "ASYNC",
      learningPathId: "path-a",
      updatedAt: courseUpdatedAt,
    });

    await expect(
      removeGestaoLearningPathCourse(
        membershipForm({ confirmPublishedChange: "on" })
      )
    ).rejects.toThrow("REDIRECT:/gestao/ensino/cursos/percursos/path-a");

    expect(transactionMock.course.updateMany).toHaveBeenCalledWith({
      where: {
        id: "course-a",
        updatedAt: courseUpdatedAt,
        experience: "ASYNC",
        learningPathId: "path-a",
      },
      data: { learningPathId: null },
    });
    expect(enqueueDomainEvent).toHaveBeenCalledWith(
      transactionMock,
      expect.objectContaining({
        eventType: "gestao.learning-path.course-removed",
        payload: expect.objectContaining({ courseId: "course-a" }),
      })
    );
  });

  it("rejects stale path versions before reassigning the course", async () => {
    transactionMock.learningPath.findUnique.mockResolvedValueOnce({
      status: "DRAFT",
      updatedAt: new Date("2026-10-12T12:02:00.000Z"),
    });

    await expect(addGestaoLearningPathCourse(membershipForm())).rejects.toThrow(
      "estado=associacao-conflito"
    );
    expect(transactionMock.learningPath.updateMany).not.toHaveBeenCalled();
    expect(transactionMock.course.updateMany).not.toHaveBeenCalled();
  });
});
