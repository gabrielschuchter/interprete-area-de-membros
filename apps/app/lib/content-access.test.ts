import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { databaseMock, getMemberRole } = vi.hoisted(() => ({
  databaseMock: {
    accessGrant: { findMany: vi.fn().mockResolvedValue([]) },
    activityAssignment: { findMany: vi.fn().mockResolvedValue([]) },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
    lesson: { findMany: vi.fn().mockResolvedValue([]) },
    lessonAsset: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
    },
    module: { findMany: vi.fn().mockResolvedValue([]) },
  },
  getMemberRole: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  AccessResourceType: {
    COURSE: "COURSE",
    MODULE: "MODULE",
    LESSON: "LESSON",
    ASSET: "ASSET",
  },
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  CourseExperience: { ASYNC: "ASYNC" },
  LearningAssignmentStatus: {
    NEW: "NEW",
    VIEWED: "VIEWED",
    STARTED: "STARTED",
    COMPLETED: "COMPLETED",
    REVOKED: "REVOKED",
  },
  LearningAssignmentTargetType: {
    ACTIVITY: "ACTIVITY",
    COURSE: "COURSE",
    MODULE: "MODULE",
    LESSON: "LESSON",
    ASSET: "ASSET",
    LIBRARY_ITEM: "LIBRARY_ITEM",
    EXERCISE_LIST: "EXERCISE_LIST",
  },
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER", MEMBER: "MEMBER" },
  database: databaseMock,
}));

vi.mock("./authorization", () => ({ getMemberRole }));

import { canReadRecordingAsset } from "./content-access";

describe("current recording asset authorization", () => {
  beforeEach(() => {
    databaseMock.lessonAsset.findUnique.mockReset();
    databaseMock.lessonAsset.findMany.mockResolvedValue([]);
    databaseMock.enrollment.findMany.mockResolvedValue([]);
    databaseMock.accessGrant.findMany.mockResolvedValue([]);
    databaseMock.activityAssignment.findMany.mockResolvedValue([]);
    databaseMock.module.findMany.mockResolvedValue([]);
    databaseMock.lesson.findMany.mockResolvedValue([]);
    getMemberRole.mockReset();
    getMemberRole.mockResolvedValue("MEMBER");
  });

  test("allows the member currently assigned to the recording group", async () => {
    databaseMock.lessonAsset.findUnique.mockResolvedValue({
      importedRecording: { group: { memberId: "member-a" } },
    });

    await expect(canReadRecordingAsset("asset-1", "member-a")).resolves.toBe(
      true
    );
  });

  test("revocation removes access even when an old playlist token exists", async () => {
    databaseMock.lessonAsset.findUnique.mockResolvedValue({
      importedRecording: { group: { memberId: null } },
    });

    await expect(canReadRecordingAsset("asset-1", "member-a")).resolves.toBe(
      false
    );
  });

  test("staff can inspect an imported recording without changing ownership", async () => {
    getMemberRole.mockResolvedValue("ADMIN");
    databaseMock.lessonAsset.findUnique.mockResolvedValue({
      importedRecording: { group: { memberId: null } },
    });

    await expect(canReadRecordingAsset("asset-1", "admin-a")).resolves.toBe(
      true
    );
  });

  test("does not turn a normal lesson asset into a recording", async () => {
    databaseMock.lessonAsset.findUnique.mockResolvedValue({
      importedRecording: null,
    });

    await expect(canReadRecordingAsset("asset-1", "member-a")).resolves.toBe(
      false
    );
  });
});
