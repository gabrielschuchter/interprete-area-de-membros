import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  AccessGrantOrigin: {},
  AccessResourceType: {},
  LearningAssignmentTargetType: {},
  MemberRole: {},
  database: {},
}));
vi.mock("@repo/observability/performance", () => ({
  tracePerformance: (_name: string, operation: () => unknown) => operation(),
}));
vi.mock("./authorization", () => ({ getMemberRole: vi.fn() }));
vi.mock("./learning-assignments", () => ({ activeAssignmentStatuses: [] }));
vi.mock("./recordings", () => ({ getAccessibleRecordingIds: vi.fn() }));

import type { LearningAccessScope } from "./content-access";
import { classifyRoomLessonAccess } from "./room-access";

const scope = (
  overrides: Partial<LearningAccessScope> = {}
): LearningAccessScope => ({
  assetIds: new Set(),
  courseIds: new Set(["course"]),
  fullAccess: false,
  fullCourseIds: new Set(["course"]),
  lessonIds: new Set(),
  libraryItemIds: new Set(),
  moduleIds: new Set(),
  recordingIds: new Set(),
  unavailableLessonIds: new Set(),
  ...overrides,
});
const ref = { courseId: "course", lessonId: "lesson", moduleId: "module" };

describe("classifyRoomLessonAccess", () => {
  test("opens a granted, released lesson", () => {
    expect(classifyRoomLessonAccess(scope(), ref)).toBe("open");
  });

  test("locks a granted lesson whose cohort release is in the future", () => {
    expect(
      classifyRoomLessonAccess(
        scope({ unavailableLessonIds: new Set(["lesson"]) }),
        ref
      )
    ).toBe("locked");
  });

  test("forbids members outside the course", () => {
    expect(
      classifyRoomLessonAccess(
        scope({ courseIds: new Set(), fullCourseIds: new Set() }),
        ref
      )
    ).toBe("forbidden");
  });

  test("forbids a lesson outside a module-only grant, even if scheduled", () => {
    expect(
      classifyRoomLessonAccess(
        scope({
          fullCourseIds: new Set(),
          moduleIds: new Set(["other-module"]),
          unavailableLessonIds: new Set(["lesson"]),
        }),
        ref
      )
    ).toBe("forbidden");
  });

  test("staff with full access always open", () => {
    expect(
      classifyRoomLessonAccess(
        scope({
          courseIds: new Set(),
          fullAccess: true,
          fullCourseIds: new Set(),
        }),
        ref
      )
    ).toBe("open");
  });
});
