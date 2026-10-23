import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    activityAssignment: { updateMany: vi.fn() },
    lesson: { count: vi.fn() },
    lessonProgress: { count: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  };

  return {
    database: {
      $transaction: vi.fn(),
      lesson: { findFirst: vi.fn() },
      lessonProgress: { findUnique: vi.fn(), updateMany: vi.fn() },
      playbackProgress: { updateMany: vi.fn() },
    },
    dispatchPendingNotifications: vi.fn(),
    evaluateMemberBadges: vi.fn(),
    getLearningAccessScope: vi.fn(),
    hasLessonAccess: vi.fn(),
    revalidatePath: vi.fn(),
    transaction,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  BadgeCriterion: {
    LEARNING_PATHS_COMPLETED: "LEARNING_PATHS_COMPLETED",
    LESSONS_COMPLETED: "LESSONS_COMPLETED",
  },
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  LearningAssignmentStatus: {
    COMPLETED: "COMPLETED",
    NEW: "NEW",
    STARTED: "STARTED",
    VIEWED: "VIEWED",
  },
  LearningAssignmentTargetType: {
    COURSE: "COURSE",
    LESSON: "LESSON",
    MODULE: "MODULE",
  },
  ProgressStatus: { COMPLETED: "COMPLETED", IN_PROGRESS: "IN_PROGRESS" },
  database: mocks.database,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./badges", () => ({
  evaluateMemberBadges: mocks.evaluateMemberBadges,
}));
vi.mock("./content-access", () => ({
  getLearningAccessScope: mocks.getLearningAccessScope,
  hasLessonAccess: mocks.hasLessonAccess,
}));
vi.mock("./notification-outbox-dispatch", () => ({
  dispatchPendingNotifications: mocks.dispatchPendingNotifications,
}));

import {
  completeLessonForMember,
  markLessonCompletedByMember,
  reopenLessonForMember,
} from "./lesson-completion";

describe("completeLessonForMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.database.$transaction.mockImplementation(
      async (callback: (transaction: typeof mocks.transaction) => unknown) =>
        callback(mocks.transaction)
    );
    mocks.database.lesson.findFirst.mockResolvedValue({
      slug: "lesson-one",
      module: {
        id: "module-one",
        course: { id: "course-one", slug: "course-one" },
      },
    });
    mocks.database.lessonProgress.findUnique.mockResolvedValue(null);
    mocks.getLearningAccessScope.mockResolvedValue({});
    mocks.hasLessonAccess.mockReturnValue(true);
    mocks.transaction.activityAssignment.updateMany.mockResolvedValue({
      count: 1,
    });
    mocks.transaction.lesson.count.mockResolvedValue(1);
    mocks.transaction.lessonProgress.count.mockResolvedValue(1);
    mocks.transaction.lessonProgress.findUnique.mockResolvedValue(null);
    mocks.transaction.lessonProgress.upsert.mockResolvedValue({});
    mocks.evaluateMemberBadges.mockResolvedValue([]);
    mocks.dispatchPendingNotifications.mockResolvedValue(undefined);
  });

  test("persists completion and completes matching lesson, module, and course assignments", async () => {
    await expect(
      completeLessonForMember("member-one", "lesson-one")
    ).resolves.toEqual({ message: "Aula concluída.", ok: true });

    expect(mocks.transaction.lessonProgress.upsert).toHaveBeenCalledWith({
      where: {
        memberId_lessonId: { memberId: "member-one", lessonId: "lesson-one" },
      },
      create: expect.objectContaining({
        memberId: "member-one",
        lessonId: "lesson-one",
        status: "COMPLETED",
        completedAt: expect.any(Date),
      }),
      update: expect.objectContaining({
        status: "COMPLETED",
        completedAt: expect.any(Date),
      }),
    });

    const updatedTargetIds =
      mocks.transaction.activityAssignment.updateMany.mock.calls.map(
        ([input]) => input.where.targetId
      );
    expect(updatedTargetIds).toEqual(
      expect.arrayContaining(["lesson-one", "module-one", "course-one"])
    );
    expect(
      mocks.transaction.activityAssignment.updateMany
    ).toHaveBeenCalledTimes(3);
    expect(mocks.dispatchPendingNotifications).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/cursos", "page");
  });

  test("does not persist progress for a member without lesson access", async () => {
    mocks.hasLessonAccess.mockReturnValue(false);

    await expect(
      completeLessonForMember("member-one", "lesson-one")
    ).resolves.toEqual({
      message: "Você não tem acesso a esta aula.",
      ok: false,
    });

    expect(mocks.database.$transaction).not.toHaveBeenCalled();
    expect(mocks.transaction.lessonProgress.upsert).not.toHaveBeenCalled();
    expect(mocks.dispatchPendingNotifications).not.toHaveBeenCalled();
  });

  test("keeps completion idempotent", async () => {
    mocks.database.lessonProgress.findUnique.mockResolvedValue({
      status: "COMPLETED",
    });

    await expect(
      completeLessonForMember("member-one", "lesson-one")
    ).resolves.toEqual({ message: "Aula concluída.", ok: true });

    expect(mocks.database.$transaction).not.toHaveBeenCalled();
    expect(mocks.dispatchPendingNotifications).not.toHaveBeenCalled();
  });
});

describe("reopening a lesson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.database.lesson.findFirst.mockResolvedValue({
      slug: "lesson-one",
      module: {
        id: "module-one",
        course: { id: "course-one", slug: "course-one" },
      },
    });
    mocks.getLearningAccessScope.mockResolvedValue({});
    mocks.hasLessonAccess.mockReturnValue(true);
    mocks.database.lessonProgress.updateMany.mockResolvedValue({ count: 1 });
    mocks.database.playbackProgress.updateMany.mockResolvedValue({ count: 1 });
  });

  test("reopens the lesson and tells the playback route to leave it open", async () => {
    await expect(
      reopenLessonForMember("member-one", "lesson-one")
    ).resolves.toMatchObject({ ok: true });

    expect(mocks.database.lessonProgress.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { completedAt: null, status: "IN_PROGRESS" },
      })
    );
    expect(mocks.database.playbackProgress.updateMany).toHaveBeenCalledWith({
      data: { manualCompletion: false },
      where: { asset: { lessonId: "lesson-one" }, memberId: "member-one" },
    });
  });

  test("changes nothing for a lesson the member cannot open", async () => {
    mocks.hasLessonAccess.mockReturnValue(false);
    await expect(
      reopenLessonForMember("member-one", "lesson-one")
    ).resolves.toMatchObject({ ok: false });
    expect(mocks.database.playbackProgress.updateMany).not.toHaveBeenCalled();
  });

  test("a manual mark lifts an earlier reopen", async () => {
    mocks.database.$transaction.mockImplementation(
      async (callback: (transaction: typeof mocks.transaction) => unknown) =>
        callback(mocks.transaction)
    );
    mocks.database.lessonProgress.findUnique.mockResolvedValue(null);
    mocks.transaction.lessonProgress.findUnique.mockResolvedValue(null);
    mocks.transaction.lessonProgress.upsert.mockResolvedValue({});
    mocks.transaction.activityAssignment.updateMany.mockResolvedValue({
      count: 0,
    });
    mocks.transaction.lesson.count.mockResolvedValue(1);
    mocks.transaction.lessonProgress.count.mockResolvedValue(0);
    mocks.evaluateMemberBadges.mockResolvedValue([]);
    mocks.dispatchPendingNotifications.mockResolvedValue(undefined);

    await expect(
      markLessonCompletedByMember("member-one", "lesson-one")
    ).resolves.toMatchObject({ ok: true });
    expect(mocks.database.playbackProgress.updateMany).toHaveBeenCalledWith({
      data: { manualCompletion: null },
      where: {
        asset: { lessonId: "lesson-one" },
        manualCompletion: false,
        memberId: "member-one",
      },
    });
  });
});
