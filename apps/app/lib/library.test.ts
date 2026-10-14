import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  database,
  getLearningAccessScope,
  hasLessonAccess,
  markLearningAssignmentStarted,
} = vi.hoisted(() => ({
  database: {
    libraryItem: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    libraryItemView: { groupBy: vi.fn() },
  },
  getLearningAccessScope: vi.fn(),
  hasLessonAccess: vi.fn(),
  markLearningAssignmentStarted: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  LibraryBookmarkTargetType: {
    ASSET: "ASSET",
    COURSE: "COURSE",
    LESSON: "LESSON",
    LIBRARY_ITEM: "LIBRARY_ITEM",
    MODULE: "MODULE",
  },
  LibraryItemDifficulty: { ADVANCED: "ADVANCED", BEGINNER: "BEGINNER" },
  LibraryItemKind: { ARTICLE: "ARTICLE", GUIDE: "GUIDE", PDF: "PDF" },
  LearningAssignmentTargetType: { LIBRARY_ITEM: "LIBRARY_ITEM" },
  database,
}));
vi.mock("./content-access", () => ({
  getLearningAccessScope,
  hasCourseAccess: vi.fn(),
  hasLessonAccess,
  hasModuleAccess: vi.fn(),
}));
vi.mock("./learning-assignments", () => ({ markLearningAssignmentStarted }));

import {
  getLibraryItems,
  getPublishedLibraryItem,
  getStaffLibraryItems,
} from "./library";

describe("library lesson access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.libraryItem.count.mockResolvedValue(1);
    getLearningAccessScope.mockResolvedValue({
      assetIds: new Set(),
      courseIds: new Set(),
      fullAccess: true,
      fullCourseIds: new Set(),
      libraryItemIds: new Set(),
      lessonIds: new Set(),
      moduleIds: new Set(),
      recordingIds: new Set(),
    });
    database.libraryItem.findMany.mockResolvedValue([
      {
        id: "curated-item",
        title: "Referência aprovada",
        description: null,
        coverUrl: null,
        kind: "ARTICLE",
        category: "Fundamentos",
        tags: [],
        url: "https://example.com/reference",
        authors: null,
        year: null,
        language: "pt",
        difficulty: null,
        accessType: null,
        accessNote: null,
        version: null,
        linkCheckedAt: null,
        doi: null,
        pmid: null,
        storagePath: null,
        mimeType: null,
        createdAt: new Date("2026-10-05T00:00:00.000Z"),
        lesson: null,
        _count: { views: 0, bookmarks: 0 },
        bookmarks: [],
      },
    ]);
  });

  test("includes standalone published catalog items for staff", async () => {
    const result = await getLibraryItems({ memberId: "staff-member" });

    expect(result.items.map(({ id }) => id)).toEqual(["curated-item"]);
    expect(result.totalCount).toBe(1);
    const query = database.libraryItem.findMany.mock.calls[0]?.[0];
    expect(database.libraryItem.count.mock.calls[0]?.[0].where).toEqual(
      query.where
    );
    expect(query.where.AND[1]).toMatchObject({
      OR: [
        { lessonId: null },
        {
          lesson: {
            is: {
              status: "PUBLISHED",
              module: {
                is: {
                  status: "PUBLISHED",
                  course: { is: { status: "PUBLISHED" } },
                },
              },
            },
          },
        },
      ],
    });
  });

  test("paginates the staff catalog without gaps between pages", async () => {
    const firstPageRows = Array.from({ length: 25 }, (_, index) => ({
      id: `item-${index + 1}`,
    }));
    const secondPageRows = Array.from({ length: 10 }, (_, index) => ({
      id: `item-${index + 25}`,
    }));
    database.libraryItem.findMany
      .mockResolvedValueOnce(firstPageRows)
      .mockResolvedValueOnce(secondPageRows);

    const firstPage = await getStaffLibraryItems(1);
    const secondPage = await getStaffLibraryItems(2);

    expect(firstPage.items.map(({ id }) => id)).toEqual(
      Array.from({ length: 24 }, (_, index) => `item-${index + 1}`)
    );
    expect(firstPage.hasMore).toBe(true);
    expect(secondPage.items.map(({ id }) => id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `item-${index + 25}`)
    );
    expect(secondPage.hasMore).toBe(false);
    expect(database.libraryItem.findMany.mock.calls[0]?.[0]).toMatchObject({
      skip: 0,
      take: 25,
    });
    expect(database.libraryItem.findMany.mock.calls[1]?.[0]).toMatchObject({
      skip: 24,
      take: 25,
    });
  });

  test("filters directly assigned catalog items and counts by published parent", async () => {
    getLearningAccessScope.mockResolvedValue({
      assetIds: new Set(),
      courseIds: new Set(),
      fullAccess: false,
      fullCourseIds: new Set(),
      libraryItemIds: new Set(["assigned-library-item"]),
      lessonIds: new Set(),
      moduleIds: new Set(),
      recordingIds: new Set(),
    });

    await getLibraryItems({ memberId: "member-1" });

    const listWhere = database.libraryItem.findMany.mock.calls[0]?.[0].where;
    const countWhere = database.libraryItem.count.mock.calls[0]?.[0].where;
    const itemGrant = listWhere.AND[1].OR.find(
      (condition: { id?: { in?: string[] } }) => condition.id?.in
    );

    expect(itemGrant).toEqual({
      id: { in: ["assigned-library-item"] },
      lesson: {
        is: {
          status: "PUBLISHED",
          module: {
            is: {
              status: "PUBLISHED",
              course: { is: { status: "PUBLISHED" } },
            },
          },
        },
      },
    });
    expect(countWhere).toEqual(listWhere);
  });

  test("starts a library assignment only after linked-lesson access succeeds", async () => {
    const item = {
      id: "assigned-library-item",
      lesson: {
        id: "lesson-1",
        status: "PUBLISHED",
        moduleId: "module-1",
        module: {
          status: "PUBLISHED",
          courseId: "course-1",
          course: { status: "PUBLISHED" },
        },
      },
    };
    getLearningAccessScope.mockResolvedValue({
      assetIds: new Set(),
      courseIds: new Set(["course-1"]),
      fullAccess: false,
      fullCourseIds: new Set(),
      libraryItemIds: new Set(),
      lessonIds: new Set(["lesson-1"]),
      moduleIds: new Set(),
      recordingIds: new Set(),
    });
    database.libraryItem.findFirst.mockResolvedValue(item);
    hasLessonAccess.mockReturnValue(true);

    await expect(getPublishedLibraryItem(item.id, "member-1")).resolves.toBe(
      item
    );
    expect(markLearningAssignmentStarted).toHaveBeenCalledWith(
      "member-1",
      "LIBRARY_ITEM",
      item.id
    );

    hasLessonAccess.mockReturnValue(false);
    markLearningAssignmentStarted.mockClear();
    await expect(
      getPublishedLibraryItem(item.id, "member-1")
    ).resolves.toBeNull();
    expect(markLearningAssignmentStarted).not.toHaveBeenCalled();
  });

  test("opens the assigned library item without granting its lesson", async () => {
    const item = {
      id: "assigned-library-item",
      lesson: {
        id: "lesson-1",
        status: "PUBLISHED",
        moduleId: "module-1",
        module: {
          status: "PUBLISHED",
          courseId: "course-1",
          course: { status: "PUBLISHED" },
        },
      },
    };
    getLearningAccessScope.mockResolvedValue({
      assetIds: new Set(),
      courseIds: new Set(),
      fullAccess: false,
      fullCourseIds: new Set(),
      libraryItemIds: new Set([item.id]),
      lessonIds: new Set(),
      moduleIds: new Set(),
      recordingIds: new Set(),
    });
    database.libraryItem.findFirst.mockResolvedValue(item);
    hasLessonAccess.mockReturnValue(false);

    await expect(getPublishedLibraryItem(item.id, "member-1")).resolves.toBe(
      item
    );
    expect(markLearningAssignmentStarted).toHaveBeenCalledWith(
      "member-1",
      "LIBRARY_ITEM",
      item.id
    );

    const sibling = { ...item, id: "sibling-library-item" };
    database.libraryItem.findFirst.mockResolvedValue(sibling);
    markLearningAssignmentStarted.mockClear();
    await expect(
      getPublishedLibraryItem(sibling.id, "member-1")
    ).resolves.toBeNull();
    expect(markLearningAssignmentStarted).not.toHaveBeenCalled();
  });
});
