import { beforeEach, describe, expect, test, vi } from "vitest";

const { database } = vi.hoisted(() => ({
  database: { exerciseSession: { findMany: vi.fn() } },
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  ExerciseSessionStatus: {
    COMPLETED: "COMPLETED",
    IN_PROGRESS: "IN_PROGRESS",
  },
  database,
}));

import {
  getMemberExerciseHistory,
  getMemberInProgressExerciseSessions,
} from "./exercises";

describe("member exercise session queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.exerciseSession.findMany.mockResolvedValue([]);
  });

  test("loads every in-progress session owned by the member for published lists", async () => {
    await getMemberInProgressExerciseSessions("member-1");

    expect(database.exerciseSession.findMany).toHaveBeenCalledWith({
      where: {
        memberId: "member-1",
        status: "IN_PROGRESS",
        list: {
          is: {
            status: "PUBLISHED",
            bank: { is: { status: "PUBLISHED" } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        list: { select: { title: true, slug: true } },
        questions: {
          select: { answer: { select: { isCorrect: true } } },
        },
      },
    });
  });

  test("keeps completed history separate from resumable sessions", async () => {
    await getMemberExerciseHistory("member-1");

    expect(database.exerciseSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberId: "member-1",
          status: "COMPLETED",
          list: {
            is: {
              status: "PUBLISHED",
              bank: { is: { status: "PUBLISHED" } },
            },
          },
        },
        take: 6,
      })
    );
  });
});
