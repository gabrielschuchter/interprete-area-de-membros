import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  database,
  filterAccessibleLessonActivities,
  lessonActivitySelect,
  getLearningAccessScope,
  hasCourseAccess,
  hasFullCourseAccess,
  hasLessonAccess,
  hasModuleAccess,
} = vi.hoisted(() => ({
  database: { course: { findMany: vi.fn() }, lesson: { findFirst: vi.fn() } },
  filterAccessibleLessonActivities: vi.fn(),
  lessonActivitySelect: vi.fn(() => ({
    id: true,
    title: true,
    slug: true,
    dueAt: true,
  })),
  getLearningAccessScope: vi.fn(),
  hasCourseAccess: vi.fn(),
  hasFullCourseAccess: vi.fn(),
  hasLessonAccess: vi.fn(),
  hasModuleAccess: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  CourseExperience: { ASYNC: "ASYNC" },
  LearningAssignmentTargetType: {
    COURSE: "COURSE",
    LESSON: "LESSON",
    MODULE: "MODULE",
  },
  ProgressStatus: { COMPLETED: "COMPLETED" },
  database,
}));
vi.mock("./authorization", () => ({ requireSession: vi.fn() }));
vi.mock("./content-access", () => ({
  filterAccessibleAssets: vi.fn(),
  getLearningAccessScope,
  hasCourseAccess,
  hasFullCourseAccess,
  hasLessonAccess,
  hasModuleAccess,
}));
vi.mock("./activities", () => ({
  filterAccessibleLessonActivities,
  lessonActivitySelect,
}));
vi.mock("./learning-assignments", () => ({
  markLearningAssignmentStarted: vi.fn(),
}));

import {
  getHomeLearningSummary,
  getMemberCourseProgress,
  getPublishedLesson,
  getPublishedStandaloneCourses,
} from "./learning";

const makeScope = (overrides: Record<string, unknown> = {}) => ({
  assetIds: new Set<string>(),
  courseIds: new Set<string>(),
  fullAccess: false,
  fullCourseIds: new Set<string>(),
  libraryItemIds: new Set<string>(),
  lessonIds: new Set<string>(),
  moduleIds: new Set<string>(),
  recordingIds: new Set<string>(),
  ...overrides,
});

describe("member course progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const scope = makeScope({
      courseIds: new Set(["course-1"]),
      fullCourseIds: new Set(["course-1"]),
    });
    getLearningAccessScope.mockResolvedValue(scope);
    hasCourseAccess.mockImplementation(
      (value, courseId) => value.fullAccess || value.courseIds.has(courseId)
    );
    hasFullCourseAccess.mockImplementation(
      (value, courseId) => value.fullAccess || value.fullCourseIds.has(courseId)
    );
    hasModuleAccess.mockImplementation(
      (value, _courseId, moduleId) =>
        value.fullAccess ||
        value.fullCourseIds.has(_courseId) ||
        value.moduleIds.has(moduleId)
    );
    hasLessonAccess.mockImplementation(
      (value, courseId, moduleId, lessonId) =>
        value.fullAccess ||
        value.fullCourseIds.has(courseId) ||
        value.moduleIds.has(moduleId) ||
        value.lessonIds.has(lessonId)
    );
  });

  test("deduplicates course IDs and counts only accessible published lessons", async () => {
    database.course.findMany.mockResolvedValue([
      {
        id: "course-1",
        modules: [
          {
            id: "module-1",
            lessons: [
              { id: "lesson-1", progress: [{ status: "COMPLETED" }] },
              { id: "lesson-2", progress: [] },
            ],
          },
          {
            id: "module-2",
            lessons: [{ id: "lesson-3", progress: [] }],
          },
        ],
      },
      {
        id: "course-2",
        modules: [
          {
            id: "module-3",
            lessons: [{ id: "lesson-4", progress: [{ status: "COMPLETED" }] }],
          },
        ],
      },
    ]);

    const progress = await getMemberCourseProgress("member-1", [
      "course-1",
      "course-1",
      "course-2",
    ]);

    expect(database.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["course-1", "course-2"] },
          status: "PUBLISHED",
          experience: "ASYNC",
          OR: [
            { learningPathId: null },
            { learningPath: { is: { status: "PUBLISHED" } } },
          ],
        },
      })
    );
    expect(progress.get("course-1")).toEqual({
      completedLessons: 1,
      percentage: 33,
      totalLessons: 3,
    });
    expect(progress.has("course-2")).toBe(false);
  });

  test("returns no records and avoids a query when no course is requested", async () => {
    const progress = await getMemberCourseProgress("member-1", []);

    expect(progress.size).toBe(0);
    expect(database.course.findMany).not.toHaveBeenCalled();
    expect(getLearningAccessScope).not.toHaveBeenCalled();
  });

  test("lists only authorized published courses without a learning path", async () => {
    const scope = makeScope({
      courseIds: new Set(["standalone-course"]),
      fullCourseIds: new Set(["standalone-course"]),
    });
    getLearningAccessScope.mockResolvedValue(scope);
    database.course.findMany.mockResolvedValue([
      {
        id: "standalone-course",
        title: "Curso independente",
        slug: "curso-independente",
        coverUrl: null,
        description: "Acesso individual autorizado",
        modules: [
          {
            id: "module-1",
            title: "Módulo",
            slug: "modulo",
            lessons: [
              {
                id: "lesson-1",
                title: "Aula",
                slug: "aula",
                description: null,
                progress: [{ status: "COMPLETED" }],
              },
            ],
          },
        ],
      },
      {
        id: "unassigned-course",
        title: "Outro curso",
        slug: "outro-curso",
        coverUrl: null,
        description: null,
        modules: [],
      },
    ]);

    const courses = await getPublishedStandaloneCourses("member-1");

    expect(database.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          learningPathId: null,
          status: "PUBLISHED",
          experience: "ASYNC",
        }),
      })
    );
    expect(courses).toEqual([
      expect.objectContaining({
        id: "standalone-course",
        title: "Curso independente",
        progress: { completedLessons: 1, percentage: 100, totalLessons: 1 },
      }),
    ]);
  });

  test("includes authorized standalone courses in the home study overview", async () => {
    database.course.findMany.mockResolvedValue([
      {
        id: "course-1",
        title: "Curso independente",
        slug: "curso-independente",
        experience: "ASYNC",
        description: null,
        modules: [
          {
            id: "module-1",
            lessons: [
              {
                id: "lesson-1",
                title: "Aula",
                slug: "aula",
                description: null,
                progress: [],
              },
            ],
          },
        ],
      },
    ]);

    const courses = await getHomeLearningSummary("member-1");

    expect(database.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "PUBLISHED",
          experience: "ASYNC",
          OR: [
            { learningPathId: null },
            { learningPath: { is: { status: "PUBLISHED" } } },
          ],
        },
      })
    );
    expect(courses.map(({ id }) => id)).toEqual(["course-1"]);
    expect(courses[0]?.progress).toEqual({
      completedLessons: 0,
      percentage: 0,
      totalLessons: 1,
    });
  });

  test("returns only activities filtered by the member access resolver", async () => {
    const visibleActivity = {
      id: "activity-authorized",
      title: "Prática autorizada",
      slug: "pratica-autorizada",
      dueAt: null,
    };
    const lesson = {
      id: "lesson-1",
      title: "Aula",
      slug: "aula",
      description: null,
      content: null,
      kind: "LESSON",
      resources: [],
      assets: [],
      progress: [],
      activities: [
        {
          id: "activity-raw",
          title: "Prática",
          slug: "pratica",
          dueAt: null,
        },
      ],
      module: {
        id: "module-1",
        title: "Módulo",
        slug: "modulo",
        course: {
          id: "course-1",
          title: "Curso",
          slug: "curso",
          modules: [
            {
              id: "module-1",
              title: "Módulo",
              slug: "modulo",
              lessons: [
                {
                  id: "lesson-1",
                  title: "Aula",
                  slug: "aula",
                  position: 0,
                  progress: [],
                },
              ],
            },
          ],
        },
      },
    };
    database.lesson.findFirst.mockResolvedValue(lesson);
    filterAccessibleLessonActivities.mockReturnValue([visibleActivity]);
    const result = await getPublishedLesson("curso", "aula", "member-1");

    expect(lessonActivitySelect).toHaveBeenCalledWith("member-1");
    expect(filterAccessibleLessonActivities).toHaveBeenCalledWith(
      lesson.activities,
      expect.any(Object)
    );
    expect(result?.activities).toEqual([visibleActivity]);
    expect(
      database.lesson.findFirst.mock.calls[0]?.[0].select.activities
    ).toEqual(
      expect.objectContaining({
        where: { status: "PUBLISHED" },
        select: { id: true, title: true, slug: true, dueAt: true },
      })
    );
  });
});
