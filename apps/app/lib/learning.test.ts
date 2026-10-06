import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  database,
  getLearningAccessScope,
  hasCourseAccess,
  hasFullCourseAccess,
  hasLessonAccess,
  hasModuleAccess,
} = vi.hoisted(() => ({
  database: { course: { findMany: vi.fn() } },
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
vi.mock("./learning-assignments", () => ({
  markLearningAssignmentStarted: vi.fn(),
}));

import { getMemberCourseProgress } from "./learning";

const makeScope = (overrides: Record<string, unknown> = {}) => ({
  assetIds: new Set<string>(),
  courseIds: new Set<string>(),
  fullAccess: false,
  fullCourseIds: new Set<string>(),
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
});
