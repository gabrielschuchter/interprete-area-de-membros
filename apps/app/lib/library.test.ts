import { beforeEach, describe, expect, test, vi } from "vitest";

const { database, getLearningAccessScope } = vi.hoisted(() => ({
  database: {
    libraryItem: { findMany: vi.fn() },
    libraryItemView: { groupBy: vi.fn() },
  },
  getLearningAccessScope: vi.fn(),
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
  database,
}));
vi.mock("./content-access", () => ({
  getLearningAccessScope,
  hasCourseAccess: vi.fn(),
  hasLessonAccess: vi.fn(),
  hasModuleAccess: vi.fn(),
}));

import { getLibraryItems } from "./library";

describe("library lesson access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLearningAccessScope.mockResolvedValue({
      assetIds: new Set(),
      courseIds: new Set(),
      fullAccess: true,
      fullCourseIds: new Set(),
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
    const query = database.libraryItem.findMany.mock.calls[0]?.[0];
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
});
