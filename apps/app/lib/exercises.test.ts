import { beforeEach, describe, expect, test, vi } from "vitest";

const { database } = vi.hoisted(() => ({
  database: {
    exerciseSession: { findMany: vi.fn() },
    exerciseQuestionBookmark: { findMany: vi.fn(), count: vi.fn() },
    exerciseList: { findMany: vi.fn() },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  ExerciseSessionStatus: {
    COMPLETED: "COMPLETED",
    IN_PROGRESS: "IN_PROGRESS",
  },
  ExerciseSessionKind: { FAVORITE: "FAVORITE", LIST: "LIST" },
  database,
}));

import {
  getMemberExerciseFavorites,
  getMemberExerciseHistory,
  getMemberExerciseHistoryPage,
  getMemberInProgressExerciseSessions,
  getPublishedExerciseLists,
} from "./exercises";

describe("member exercise session queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.exerciseSession.findMany.mockResolvedValue([]);
    database.exerciseQuestionBookmark.findMany.mockResolvedValue([]);
    database.exerciseQuestionBookmark.count.mockResolvedValue(0);
    database.exerciseList.findMany.mockResolvedValue([]);
  });

  test("searches published question categories and topic tags", async () => {
    await getPublishedExerciseLists(" Bioestatística ");

    expect(database.exerciseList.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              items: {
                some: {
                  question: {
                    is: {
                      status: "PUBLISHED",
                      OR: [
                        {
                          category: {
                            is: {
                              title: {
                                contains: "Bioestatística",
                                mode: "insensitive",
                              },
                            },
                          },
                        },
                        { tags: { has: "bioestatística" } },
                      ],
                    },
                  },
                },
              },
            },
          ]),
        }),
      })
    );
  });

  test("loads every in-progress session owned by the member for published lists", async () => {
    await getMemberInProgressExerciseSessions("member-1");

    expect(database.exerciseSession.findMany).toHaveBeenCalledWith({
      where: {
        memberId: "member-1",
        kind: "LIST",
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
        kind: true,
        list: { select: { title: true, slug: true } },
        questions: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            position: true,
            answer: { select: { isCorrect: true } },
          },
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
        },
        take: 6,
      })
    );
  });

  test("uses a member-scoped database keyset for completed history pages", async () => {
    const anchor = {
      completedAt: new Date("2026-10-08T15:30:00.000Z"),
      id: "session-cursor",
    };
    const { encodeExerciseHistoryCursor } = await import(
      "./exercise-history-cursor"
    );
    await getMemberExerciseHistoryPage(
      "member-1",
      encodeExerciseHistoryCursor(anchor),
      "after"
    );

    expect(database.exerciseSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberId: "member-1",
          status: "COMPLETED",
          completedAt: { not: null },
          OR: [
            { completedAt: { lt: anchor.completedAt } },
            { completedAt: anchor.completedAt, id: { lt: anchor.id } },
          ],
        },
        orderBy: [{ completedAt: "desc" }, { id: "desc" }],
        take: 7,
      })
    );
  });

  test("does not offer a newer page when returning to the first history page", async () => {
    const { encodeExerciseHistoryCursor, decodeExerciseHistoryCursor } =
      await import("./exercise-history-cursor");
    const anchor = {
      completedAt: new Date("2026-10-08T15:30:00.000Z"),
      id: "session-7",
    };
    const ascendingRecentRows = [6, 5, 4, 3, 2, 1].map((number) => ({
      completedAt: new Date(`2026-10-0${number}T15:30:00.000Z`),
      id: `session-${number}`,
    }));
    database.exerciseSession.findMany.mockResolvedValueOnce(
      ascendingRecentRows
    );

    const page = await getMemberExerciseHistoryPage(
      "member-1",
      encodeExerciseHistoryCursor(anchor),
      "before"
    );

    expect(page.items.map(({ id }) => id)).toEqual(
      [1, 2, 3, 4, 5, 6].map((number) => `session-${number}`)
    );
    expect(page.hasPrevious).toBe(false);
    expect(page.previousCursor).toBeNull();
    expect(page.hasNext).toBe(true);
    expect(decodeExerciseHistoryCursor(page.nextCursor ?? undefined)?.id).toBe(
      "session-6"
    );
  });

  test("loads a member-scoped keyset page of published favorites", async () => {
    await getMemberExerciseFavorites("member-1");

    expect(database.exerciseQuestionBookmark.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberId: "member-1",
          question: {
            is: {
              status: "PUBLISHED",
              bank: { is: { status: "PUBLISHED" } },
              listItems: {
                some: {
                  list: {
                    is: {
                      status: "PUBLISHED",
                      bank: { is: { status: "PUBLISHED" } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 21,
        select: expect.objectContaining({
          id: true,
          createdAt: true,
          question: expect.any(Object),
        }),
      })
    );
    expect(database.exerciseQuestionBookmark.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ memberId: "member-1" }),
    });
  });

  test("keeps favorite pagination keyset-bound and exposes both directions", async () => {
    const { decodeExerciseFavoriteCursor, encodeExerciseFavoriteCursor } =
      await import("./exercise-favorite-cursor");
    const anchor = {
      createdAt: new Date("2026-10-08T15:30:00.000Z"),
      id: "favorite-anchor",
    };
    database.exerciseQuestionBookmark.findMany.mockResolvedValueOnce([
      {
        id: "favorite-2",
        createdAt: new Date("2026-10-07T15:30:00.000Z"),
      },
      {
        id: "favorite-3",
        createdAt: new Date("2026-10-06T15:30:00.000Z"),
      },
      {
        id: "favorite-4",
        createdAt: new Date("2026-10-05T15:30:00.000Z"),
      },
    ]);

    const page = await getMemberExerciseFavorites(
      "member-1",
      encodeExerciseFavoriteCursor(anchor),
      "after",
      2
    );

    expect(database.exerciseQuestionBookmark.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberId: "member-1",
          OR: [
            { createdAt: { lt: anchor.createdAt } },
            { createdAt: anchor.createdAt, id: { lt: anchor.id } },
          ],
        }),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 3,
      })
    );
    expect(page.items.map(({ id }) => id)).toEqual([
      "favorite-2",
      "favorite-3",
    ]);
    expect(page.hasPrevious).toBe(true);
    expect(
      decodeExerciseFavoriteCursor(page.previousCursor ?? undefined)?.id
    ).toBe("favorite-2");
    expect(page.hasNext).toBe(true);
    expect(decodeExerciseFavoriteCursor(page.nextCursor ?? undefined)?.id).toBe(
      "favorite-3"
    );
  });

  test("returns the nearest newer favorites in reverse-page order", async () => {
    const { decodeExerciseFavoriteCursor, encodeExerciseFavoriteCursor } =
      await import("./exercise-favorite-cursor");
    const anchor = {
      createdAt: new Date("2026-10-06T15:30:00.000Z"),
      id: "favorite-3",
    };
    database.exerciseQuestionBookmark.findMany.mockResolvedValueOnce([
      {
        id: "favorite-2",
        createdAt: new Date("2026-10-07T15:30:00.000Z"),
      },
      {
        id: "favorite-1",
        createdAt: new Date("2026-10-08T15:30:00.000Z"),
      },
    ]);

    const page = await getMemberExerciseFavorites(
      "member-1",
      encodeExerciseFavoriteCursor(anchor),
      "before",
      1
    );

    expect(database.exerciseQuestionBookmark.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { createdAt: { gt: anchor.createdAt } },
            { createdAt: anchor.createdAt, id: { gt: anchor.id } },
          ],
        }),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 2,
      })
    );
    expect(page.items.map(({ id }) => id)).toEqual(["favorite-2"]);
    expect(page.hasPrevious).toBe(true);
    expect(page.hasNext).toBe(true);
    expect(decodeExerciseFavoriteCursor(page.nextCursor ?? undefined)?.id).toBe(
      "favorite-2"
    );
  });
});
