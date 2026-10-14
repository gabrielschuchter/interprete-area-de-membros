import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  CollectionItemType: {
    LESSON: "LESSON",
    COURSE: "COURSE",
    EXERCISE_LIST: "EXERCISE_LIST",
    RECORDING: "RECORDING",
    LIBRARY_ITEM: "LIBRARY_ITEM",
  },
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  CourseExperience: { ASYNC: "ASYNC" },
  LearningAssignmentStatus: {
    NEW: "NEW",
    VIEWED: "VIEWED",
    STARTED: "STARTED",
  },
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER" },
  database: {},
}));
vi.mock("./authorization", () => ({ getMemberRole: vi.fn() }));
vi.mock("./content-access", () => ({
  getLearningAccessScope: vi.fn(),
  hasCourseAccess: (value: { courseIds: Set<string> }, id: string) =>
    value.courseIds.has(id),
  hasLessonAccess: (
    value: {
      courseIds: Set<string>;
      fullCourseIds: Set<string>;
      lessonIds: Set<string>;
      moduleIds: Set<string>;
    },
    courseId: string,
    moduleId: string,
    lessonId: string
  ) =>
    value.courseIds.has(courseId) ||
    value.fullCourseIds.has(courseId) ||
    value.moduleIds.has(moduleId) ||
    value.lessonIds.has(lessonId),
}));

import {
  canReadCollectionItem,
  collectionItemHref,
  collectionItemLabel,
} from "./content-collections";

const scope = {
  assetIds: new Set<string>(),
  courseIds: new Set<string>(),
  fullAccess: false,
  fullCourseIds: new Set<string>(),
  libraryItemIds: new Set<string>(),
  lessonIds: new Set<string>(),
  moduleIds: new Set<string>(),
  recordingIds: new Set<string>(),
};

const collectionItem = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "item-1",
    itemType: "RECORDING",
    position: 0,
    lesson: null,
    course: null,
    exerciseList: null,
    recording: null,
    asset: null,
    libraryItem: null,
    ...overrides,
  }) as Parameters<typeof canReadCollectionItem>[0];

const linkedLibraryItem = (id: string, parentCourseStatus = "PUBLISHED") =>
  collectionItem({
    itemType: "LIBRARY_ITEM",
    libraryItem: {
      id,
      title: `Material ${id}`,
      description: null,
      kind: "ARTICLE",
      status: "PUBLISHED",
      url: null,
      lesson: {
        id: "lesson-1",
        status: "PUBLISHED",
        moduleId: "module-1",
        module: {
          status: "PUBLISHED",
          courseId: "course-1",
          course: { status: parentCourseStatus },
        },
      },
    },
  });

describe("published collection authorization", () => {
  test("labels member-visible recordings without exposing a legacy student's name", () => {
    const item = collectionItem({
      recording: {
        id: "recording-1",
        originalTitle: "Aula de epidemiologia",
        meetingDate: null,
        group: {
          id: "group-1",
          memberId: "member-1",
          legacyStudentName: "Nome privado do aluno legado",
        },
        asset: {
          id: "asset-1",
          title: "Aula importada",
          kind: "VIDEO",
          mimeType: "video/mp4",
          durationSeconds: 60,
        },
        legacyLesson: { id: "lesson-1", title: "Aula de epidemiologia" },
      },
    });

    expect(collectionItemLabel(item)).toBe("VIDEO · Aula de epidemiologia");
  });

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

  test("requires lesson access for linked library items unless the exact item is assigned", () => {
    const assigned = linkedLibraryItem("assigned-item");
    const sibling = linkedLibraryItem("sibling-item");
    const exactItemScope = {
      ...scope,
      libraryItemIds: new Set(["assigned-item"]),
    };

    expect(canReadCollectionItem(assigned, "member-1", false, scope)).toBe(
      false
    );
    expect(
      canReadCollectionItem(assigned, "member-1", false, exactItemScope)
    ).toBe(true);
    expect(
      canReadCollectionItem(sibling, "member-1", false, exactItemScope)
    ).toBe(false);
    expect(canReadCollectionItem(assigned, "admin-1", true, scope)).toBe(true);
  });

  test("does not let an item assignment bypass an unpublished parent", () => {
    const item = linkedLibraryItem("assigned-item", "DRAFT");

    expect(
      canReadCollectionItem(item, "member-1", false, {
        ...scope,
        libraryItemIds: new Set(["assigned-item"]),
      })
    ).toBe(false);
  });

  test("only exposes a published async course when the member has access", () => {
    const item = collectionItem({
      itemType: "COURSE",
      course: {
        id: "course-1",
        title: "Curso",
        slug: "curso",
        coverUrl: null,
        description: null,
        status: "PUBLISHED",
        experience: "ASYNC",
        learningPath: null,
      },
    });

    expect(canReadCollectionItem(item, "member-1", false, scope)).toBe(false);
    expect(
      canReadCollectionItem(item, "member-1", false, {
        ...scope,
        courseIds: new Set(["course-1"]),
      })
    ).toBe(true);
    expect(canReadCollectionItem(item, "admin-1", true, scope)).toBe(true);
  });

  test("exposes a published exercise list as an editorial resource", () => {
    const item = collectionItem({
      itemType: "EXERCISE_LIST",
      exerciseList: {
        id: "list-1",
        title: "Questões",
        slug: "questoes",
        description: null,
        coverUrl: null,
        status: "PUBLISHED",
        bank: { status: "PUBLISHED", title: "Banco" },
      },
    });

    expect(canReadCollectionItem(item, "member-1", false, scope)).toBe(true);
    expect(collectionItemHref(item)).toBe("/exercicios/listas/questoes");
  });

  test("routes editorial course cards to the course experience", () => {
    const item = collectionItem({
      itemType: "COURSE",
      course: {
        id: "course-1",
        title: "Curso",
        slug: "curso",
        coverUrl: null,
        description: null,
        status: "PUBLISHED",
        experience: "ASYNC",
        learningPath: null,
      },
    });

    expect(collectionItemHref(item)).toBe("/aprender/cursos/curso");
  });
});
