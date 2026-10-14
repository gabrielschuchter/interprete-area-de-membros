import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createUpload: vi.fn(),
  createUploadToken: vi.fn(),
  deleteStorageObject: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  findLesson: vi.fn(),
  findLessonAsset: vi.fn(),
  findUnique: vi.fn(),
  isVideoMimeType: vi.fn(),
  normalizeFileName: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  database: {
    lesson: { findFirst: mocks.findLesson },
    lessonAsset: { findFirst: mocks.findLessonAsset },
    lessonAssetUpload: {
      create: mocks.createUpload,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany,
    },
  },
  LessonAssetKind: { VIDEO: "VIDEO" },
  LessonAssetMediaProvider: { STORAGE: "STORAGE" },
  LessonAssetScope: { GENERAL: "GENERAL" },
  LessonAssetUploadStatus: {
    PENDING: "PENDING",
    READY: "READY",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
    EXPIRED: "EXPIRED",
    FAILED: "FAILED",
  },
}));
vi.mock("./gestao-lesson-video-upload", () => ({
  createGestaoVideoUploadToken: mocks.createUploadToken,
  deleteGestaoVideoStorageObject: mocks.deleteStorageObject,
  gestaoVideoExtension: vi.fn(() => "mp4"),
  gestaoVideoUploadLimit: vi.fn(() => 500_000_000),
  hasValidGestaoVideoStorageSignature: vi.fn(),
  inspectGestaoVideoStorageObject: vi.fn(),
  isGestaoVideoMimeType: mocks.isVideoMimeType,
  normalizeGestaoVideoFileName: mocks.normalizeFileName,
  GESTAO_VIDEO_UPLOAD_SESSION_TTL_MS: 86_400_000,
}));

import {
  cancelGestaoLessonVideoUpload,
  cleanupExpiredGestaoLessonVideoUploads,
  createGestaoLessonVideoUpload,
  resumeGestaoLessonVideoUpload,
} from "./gestao-lesson-video-upload-actions";

const pendingSession = {
  id: "upload-1",
  actorId: "teacher-1",
  storagePath: "lesson-videos/upload-1.mp4",
  status: "PENDING",
};

describe("Gestão lesson video upload cancellation", () => {
  beforeEach(() => {
    mocks.findFirst.mockReset();
    mocks.updateMany.mockReset();
    mocks.deleteStorageObject.mockReset().mockResolvedValue(true);
  });

  it("keeps the object when lesson save wins a concurrent cancel", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(pendingSession)
      .mockResolvedValueOnce({ status: "COMPLETED" });
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      cancelGestaoLessonVideoUpload({
        actorId: "teacher-1",
        uploadId: "upload-1",
      })
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
    expect(mocks.deleteStorageObject).not.toHaveBeenCalled();
  });

  it("deletes the object only after the pending session is cancelled", async () => {
    mocks.findFirst.mockResolvedValueOnce(pendingSession);
    mocks.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      cancelGestaoLessonVideoUpload({
        actorId: "teacher-1",
        uploadId: "upload-1",
      })
    ).resolves.toEqual({ uploadId: "upload-1", status: "CANCELLED" });
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith(
      pendingSession.storagePath
    );
  });
});

describe("Gestão lesson video upload idempotency", () => {
  beforeEach(() => {
    mocks.createUpload.mockReset();
    mocks.createUploadToken.mockReset().mockResolvedValue({
      bucket: "learning-assets",
      endpoint:
        "https://example.storage.supabase.co/storage/v1/upload/resumable/sign",
      publishableKey: "public-key",
      token: "signed-token",
    });
    mocks.findUnique.mockReset();
    mocks.findLesson.mockReset().mockResolvedValue({ id: "lesson-1" });
    mocks.findLessonAsset.mockReset().mockResolvedValue(null);
    mocks.isVideoMimeType.mockReset().mockReturnValue(true);
    mocks.normalizeFileName
      .mockReset()
      .mockImplementation((fileName) => fileName);
  });

  it("returns the concurrently created session for the same intent", async () => {
    const input = {
      assetExpectedUpdatedAt: null,
      assetId: null,
      courseId: "course-1",
      fileName: "lesson.mp4",
      idempotencyKey: "2e617bbc-d043-41c9-a48d-99543524cd4f",
      lessonId: "lesson-1",
      mimeType: "video/mp4",
      sizeBytes: 1024,
    };
    const concurrentSession = {
      ...pendingSession,
      id: "upload-race",
      lessonId: input.lessonId,
      expectedAssetId: null,
      expectedAssetUpdatedAt: null,
      originalFileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: 1024n,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 60_000),
      assetId: null,
    };
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrentSession);
    mocks.createUpload.mockRejectedValueOnce(new Error("unique constraint"));

    const result = await createGestaoLessonVideoUpload({
      actorId: "teacher-1",
      input,
    });

    expect(result).toMatchObject({ id: "upload-race", status: "PENDING" });
    expect(mocks.createUpload).toHaveBeenCalledTimes(1);
    expect(mocks.createUploadToken).toHaveBeenCalledWith(
      concurrentSession.storagePath
    );
  });
});

describe("Gestão lesson video upload expiration", () => {
  beforeEach(() => {
    mocks.findFirst.mockReset();
    mocks.updateMany.mockReset();
    mocks.deleteStorageObject.mockReset().mockResolvedValue(true);
  });

  it("expires a ready session before returning it after its deadline", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      ...pendingSession,
      status: "READY",
      expiresAt: new Date("2026-10-11T00:00:00Z"),
    });
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(
      resumeGestaoLessonVideoUpload({
        actorId: "teacher-1",
        uploadId: "upload-1",
      })
    ).rejects.toMatchObject({ code: "EXPIRED", status: 410 });
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith(
      pendingSession.storagePath
    );
  });

  it("does not delete if completion wins the expiration race", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      ...pendingSession,
      status: "READY",
      expiresAt: new Date("2026-10-11T00:00:00Z"),
    });
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      resumeGestaoLessonVideoUpload({
        actorId: "teacher-1",
        uploadId: "upload-1",
      })
    ).rejects.toMatchObject({ code: "EXPIRED", status: 410 });
    expect(mocks.deleteStorageObject).not.toHaveBeenCalled();
  });
});

describe("Gestão lesson video upload cleanup", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.updateMany.mockReset();
    mocks.deleteStorageObject.mockReset().mockResolvedValue(true);
  });

  it("expires and deletes only after winning the state transition", async () => {
    mocks.findMany.mockResolvedValueOnce([pendingSession]);
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(
      cleanupExpiredGestaoLessonVideoUploads({
        now: new Date("2026-10-12T00:00:00Z"),
      })
    ).resolves.toEqual({ deleted: 1, failed: 0, scanned: 1, skipped: 0 });
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith(
      pendingSession.storagePath
    );
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: { status: "EXPIRED" },
        where: expect.objectContaining({ status: "PENDING" }),
      })
    );
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: { storageDeletedAt: expect.any(Date) },
      })
    );
  });

  it("does not delete when a concurrent lesson save wins", async () => {
    mocks.findMany.mockResolvedValueOnce([pendingSession]);
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      cleanupExpiredGestaoLessonVideoUploads({
        now: new Date("2026-10-12T00:00:00Z"),
      })
    ).resolves.toEqual({ deleted: 0, failed: 0, scanned: 1, skipped: 1 });
    expect(mocks.deleteStorageObject).not.toHaveBeenCalled();
  });

  it("never deletes a completed upload even if a stale query returns it", async () => {
    mocks.findMany.mockResolvedValueOnce([
      { ...pendingSession, status: "COMPLETED" },
    ]);

    await expect(
      cleanupExpiredGestaoLessonVideoUploads({
        now: new Date("2026-10-12T00:00:00Z"),
      })
    ).resolves.toEqual({ deleted: 0, failed: 0, scanned: 1, skipped: 1 });
    expect(mocks.deleteStorageObject).not.toHaveBeenCalled();
  });

  it("leaves storage cleanup retryable when Storage is unavailable", async () => {
    mocks.findMany.mockResolvedValueOnce([pendingSession]);
    mocks.updateMany.mockResolvedValueOnce({ count: 1 });
    mocks.deleteStorageObject.mockResolvedValueOnce(false);

    await expect(
      cleanupExpiredGestaoLessonVideoUploads({
        now: new Date("2026-10-12T00:00:00Z"),
      })
    ).resolves.toEqual({ deleted: 0, failed: 1, scanned: 1, skipped: 0 });
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
  });
});
