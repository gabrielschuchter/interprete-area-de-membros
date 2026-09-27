import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  CollectionItemType: {
    LESSON: "LESSON",
    RECORDING: "RECORDING",
    LIBRARY_ITEM: "LIBRARY_ITEM",
  },
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  CourseExperience: { ASYNC: "ASYNC" },
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER" },
  database: {},
}));
vi.mock("./authorization", () => ({ getMemberRole: vi.fn() }));
vi.mock("./content-access", () => ({
  getLearningAccessScope: vi.fn(),
  hasLessonAccess: vi.fn(),
}));

import { canReadCollectionItem } from "./content-collections";

const scope = {
  assetIds: new Set<string>(),
  courseIds: new Set<string>(),
  fullAccess: false,
  fullCourseIds: new Set<string>(),
  lessonIds: new Set<string>(),
  moduleIds: new Set<string>(),
};

const collectionItem = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "item-1",
    itemType: "RECORDING",
    position: 0,
    lesson: null,
    recording: null,
    asset: null,
    libraryItem: null,
    ...overrides,
  }) as Parameters<typeof canReadCollectionItem>[0];

describe("published collection authorization", () => {
  test("does not expose an unlinked historical recording to a member", () => {
    const item = collectionItem({
      recording: {
        id: "recording-1",
        originalTitle: "Encontro",
        meetingDate: null,
        group: {
          id: "group-1",
          memberId: null,
          legacyStudentName: "Aluno legado",
        },
        asset: {
          id: "asset-1",
          title: "Encontro",
          kind: "VIDEO",
          mimeType: "video/mp4",
          durationSeconds: 60,
        },
        legacyLesson: { id: "lesson-1", title: "Encontro" },
      },
    });

    expect(canReadCollectionItem(item, "member-1", false, scope)).toBe(false);
  });

  test("exposes a recording only to its linked member or staff", () => {
    const item = collectionItem({
      recording: {
        id: "recording-1",
        originalTitle: "Encontro",
        meetingDate: null,
        group: {
          id: "group-1",
          memberId: "member-1",
          legacyStudentName: "Aluno legado",
        },
        asset: {
          id: "asset-1",
          title: "Encontro",
          kind: "VIDEO",
          mimeType: "video/mp4",
          durationSeconds: 60,
        },
        legacyLesson: { id: "lesson-1", title: "Encontro" },
      },
    });

    expect(canReadCollectionItem(item, "member-1", false, scope)).toBe(true);
    expect(canReadCollectionItem(item, "member-2", false, scope)).toBe(false);
    expect(canReadCollectionItem(item, "admin-1", true, scope)).toBe(true);
  });

  test("keeps unpublished library items out of published collections", () => {
    const item = collectionItem({
      itemType: "LIBRARY_ITEM",
      libraryItem: {
        id: "library-1",
        title: "Material",
        description: null,
        kind: "ARTICLE",
        status: "DRAFT",
        url: null,
      },
    });

    expect(canReadCollectionItem(item, "member-1", false, scope)).toBe(false);
  });
});
