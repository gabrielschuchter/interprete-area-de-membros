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
    importedRecording: { findMany: vi.fn().mockResolvedValue([]) },
  },
  getMemberRole: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  AccessResourceType: {
    COURSE: "COURSE",
    MODULE: "MODULE",
    LESSON: "LESSON",
    ASSET: "ASSET",
    RECORDING: "RECORDING",
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
    RECORDING: "RECORDING",
    LIBRARY_ITEM: "LIBRARY_ITEM",
    EXERCISE_LIST: "EXERCISE_LIST",
  },
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER", MEMBER: "MEMBER" },
  database: databaseMock,
}));

vi.mock("./authorization", () => ({ getMemberRole }));

import {
  activeGrantFilter,
  canReadRecordingAsset,
  getAccessibleAsset,
} from "./content-access";

const lastRecordingWhere = () =>
  databaseMock.importedRecording.findMany.mock.calls.at(-1)?.[0].where;

describe("current recording asset authorization", () => {
  beforeEach(() => {
    databaseMock.lessonAsset.findUnique.mockReset();
    databaseMock.lessonAsset.findMany.mockResolvedValue([]);
    databaseMock.enrollment.findMany.mockResolvedValue([]);
    databaseMock.accessGrant.findMany.mockResolvedValue([]);
    databaseMock.activityAssignment.findMany.mockResolvedValue([]);
    databaseMock.module.findMany.mockResolvedValue([]);
    databaseMock.lesson.findMany.mockResolvedValue([]);
    databaseMock.importedRecording.findMany.mockReset().mockResolvedValue([]);
    getMemberRole.mockReset();
    getMemberRole.mockResolvedValue("MEMBER");
  });

  test("allows the member currently assigned to the recording group", async () => {
    databaseMock.lessonAsset.findUnique.mockResolvedValue({
      importedRecording: { id: "recording-a" },
    });
    databaseMock.importedRecording.findMany.mockResolvedValue([
      { id: "recording-a" },
    ]);

    await expect(canReadRecordingAsset("asset-1", "member-a")).resolves.toBe(
      true
    );
    expect(lastRecordingWhere()?.AND?.[1]?.OR).toContainEqual({
      group: { memberId: "member-a" },
    });
  });

  test("revocation removes access even when an old playlist token exists", async () => {
    databaseMock.lessonAsset.findUnique.mockResolvedValue({
      importedRecording: { id: "recording-a" },
    });

    await expect(canReadRecordingAsset("asset-1", "member-a")).resolves.toBe(
      false
    );
  });

  test("allows an exact recording assignment without granting its group", async () => {
    databaseMock.lessonAsset.findUnique.mockResolvedValue({
      importedRecording: {
        id: "recording-a",
        group: { memberId: null },
      },
    });
    databaseMock.activityAssignment.findMany.mockResolvedValue([
      { targetType: "RECORDING", targetId: "recording-a" },
    ]);
    databaseMock.importedRecording.findMany.mockResolvedValue([
      { id: "recording-a" },
    ]);

    await expect(canReadRecordingAsset("asset-1", "member-a")).resolves.toBe(
      true
    );
    expect(lastRecordingWhere()?.AND?.[1]?.OR).toContainEqual({
      id: "recording-a",
    });
  });

  test("does not let a recording assignment expose a sibling recording", async () => {
    databaseMock.lessonAsset.findUnique.mockResolvedValue({
      importedRecording: {
        id: "recording-b",
        group: { memberId: null },
      },
    });
    databaseMock.activityAssignment.findMany.mockResolvedValue([
      { targetType: "RECORDING", targetId: "recording-a" },
    ]);

    await expect(canReadRecordingAsset("asset-1", "member-a")).resolves.toBe(
      false
    );
    expect(lastRecordingWhere()?.AND?.[0]).toEqual({
      id: { in: ["recording-b"] },
    });
    expect(lastRecordingWhere()?.AND?.[1]?.OR).toContainEqual({
      id: "recording-a",
    });
  });

  test("staff can inspect an imported recording without changing ownership", async () => {
    getMemberRole.mockResolvedValue("ADMIN");
    databaseMock.lessonAsset.findUnique.mockResolvedValue({
      importedRecording: { id: "recording-a" },
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

  test("keeps course-assigned recordings accessible through the asset path", async () => {
    databaseMock.lessonAsset.findUnique.mockResolvedValue({
      importedRecording: { id: "recording-a" },
    });
    databaseMock.activityAssignment.findMany.mockResolvedValue([
      { targetType: "COURSE", targetId: "course-a" },
    ]);
    databaseMock.importedRecording.findMany.mockResolvedValue([
      { id: "recording-a" },
    ]);

    await expect(canReadRecordingAsset("asset-1", "member-a")).resolves.toBe(
      true
    );
    expect(lastRecordingWhere()?.AND?.[1]?.OR).toContainEqual({
      legacyLesson: { module: { courseId: "course-a" } },
    });
  });

  test("uses the same assignment scope when resolving a playable asset", async () => {
    const asset = {
      id: "asset-1",
      title: "Aula gravada",
      kind: "VIDEO",
      scope: "GENERAL",
      storagePath: null,
      externalUrl: null,
      mediaProvider: "YOUTUBE",
      mediaExternalId: "video-a",
      mimeType: null,
      durationSeconds: 600,
      ownerMemberId: null,
      importedRecording: { id: "recording-a" },
      lesson: {
        id: "lesson-a",
        moduleId: "module-a",
        module: { courseId: "course-a" },
      },
    };
    databaseMock.lessonAsset.findUnique.mockResolvedValue(asset);
    databaseMock.activityAssignment.findMany.mockResolvedValue([
      { targetType: "COURSE", targetId: "course-a" },
    ]);
    databaseMock.importedRecording.findMany.mockResolvedValue([
      { id: "recording-a" },
    ]);

    await expect(getAccessibleAsset("asset-1", "member-a")).resolves.toBe(
      asset
    );
  });

  test("builds active-grant expiry at the current request time", () => {
    const requestTime = new Date("2026-10-05T22:30:00.000Z");

    expect(activeGrantFilter(requestTime)).toEqual({
      OR: [{ expiresAt: null }, { expiresAt: { gt: requestTime } }],
    });
  });
});
