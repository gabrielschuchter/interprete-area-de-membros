import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { databaseMock, getMemberRole } = vi.hoisted(() => ({
  databaseMock: { lessonAsset: { findUnique: vi.fn() } },
  getMemberRole: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER" },
  database: databaseMock,
}));

vi.mock("./authorization", () => ({ getMemberRole }));

import { canReadRecordingAsset } from "./content-access";

describe("current recording asset authorization", () => {
  beforeEach(() => {
    databaseMock.lessonAsset.findUnique.mockReset();
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
