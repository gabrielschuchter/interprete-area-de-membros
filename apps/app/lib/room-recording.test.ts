import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accessible: vi.fn(),
  assignmentDone: vi.fn(),
  findRecording: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  LearningAssignmentTargetType: { ASSET: "ASSET", RECORDING: "RECORDING" },
  LessonAssetKind: { VIDEO: "VIDEO" },
  database: {
    importedRecording: { findFirst: mocks.findRecording },
    playbackProgress: { upsert: mocks.upsert },
  },
}));
vi.mock("./learning-assignments", () => ({
  markLearningAssignmentCompleted: mocks.assignmentDone,
}));
vi.mock("./recordings", () => ({
  getAccessibleRecordingIds: mocks.accessible,
  getRecordingAccessContext: vi.fn(),
}));
vi.mock("./room", () => ({ toRoomVideo: vi.fn(), videoAssetSelect: {} }));

import { setRecordingCompletion } from "./room-recording";

describe("setRecordingCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findRecording.mockResolvedValue({ id: "rec_1" });
    mocks.accessible.mockResolvedValue(new Set(["rec_1"]));
    mocks.upsert.mockResolvedValue({ id: "progress_1" });
  });

  test("answers not available for an unknown or non-video asset", async () => {
    mocks.findRecording.mockResolvedValue(null);
    const result = await setRecordingCompletion("member_1", "asset_1", true);
    expect(result.ok).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  test("writes nothing for a recording the member cannot see", async () => {
    mocks.accessible.mockResolvedValue(new Set());
    const result = await setRecordingCompletion("member_1", "asset_1", true);
    expect(result).toEqual({
      message: "Você não tem acesso a esta gravação.",
      ok: false,
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  test("stores the choice as an absolute value and closes the assignments", async () => {
    const result = await setRecordingCompletion("member_1", "asset_1", true);
    expect(result).toEqual({ ok: true });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          assetId: "asset_1",
          manualCompletion: true,
          memberId: "member_1",
        },
        update: { manualCompletion: true },
        where: {
          memberId_assetId: { assetId: "asset_1", memberId: "member_1" },
        },
      })
    );
    expect(mocks.assignmentDone).toHaveBeenCalledTimes(2);
  });

  test("reopening keeps the assignments as they are", async () => {
    const result = await setRecordingCompletion("member_1", "asset_1", false);
    expect(result.ok).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { manualCompletion: false } })
    );
    expect(mocks.assignmentDone).not.toHaveBeenCalled();
  });
});
