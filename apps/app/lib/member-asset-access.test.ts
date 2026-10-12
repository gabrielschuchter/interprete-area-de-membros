import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { databaseMock } = vi.hoisted(() => ({
  databaseMock: {
    $queryRaw: vi.fn(),
    activitySubmission: { findFirst: vi.fn() },
    contentCollection: { findFirst: vi.fn() },
    learningPath: { findFirst: vi.fn() },
    libraryItem: { findFirst: vi.fn() },
    member: { findUnique: vi.fn() },
    profile: { findUnique: vi.fn() },
  },
}));

vi.mock("@repo/database", () => ({
  MemberRole: { ADMIN: "ADMIN", MEMBER: "MEMBER", TEACHER: "TEACHER" },
  database: databaseMock,
}));

import { canReadMemberAssetPath } from "./member-asset-access";

const profilePath = "profile-assets/avatars/member-owner/avatar.webp";
const communityPath = "community-assets/inline/member-owner/inline.webp";
const communityAttachmentPath =
  "community-assets/attachments/member-owner/reference.pdf";
const collectionCoverPath =
  "community-assets/covers/member-owner/collection-cover.webp";
const learningPathCoverPath =
  "community-assets/covers/member-owner/learning-path-cover.webp";
const libraryLearningPathCoverPath =
  "library-assets/library-owner/learning-path-cover.webp";

describe("member asset read authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    databaseMock.member.findUnique.mockResolvedValue({ role: "MEMBER" });
    databaseMock.profile.findUnique.mockResolvedValue({ avatarUrl: null });
    databaseMock.$queryRaw.mockResolvedValue([]);
    databaseMock.activitySubmission.findFirst.mockResolvedValue(null);
    databaseMock.contentCollection.findFirst.mockResolvedValue(null);
    databaseMock.learningPath.findFirst.mockResolvedValue(null);
    databaseMock.libraryItem.findFirst.mockResolvedValue(null);
  });

  test("allows a member to read another member's current avatar", async () => {
    databaseMock.member.findUnique
      .mockResolvedValueOnce({ role: "MEMBER" })
      .mockResolvedValueOnce({
        avatarUrl: `/api/member-assets?path=${encodeURIComponent(profilePath)}`,
      });

    await expect(
      canReadMemberAssetPath(profilePath, "member-reader")
    ).resolves.toBe(true);
  });

  test("does not expose an unreferenced avatar by guessed path", async () => {
    await expect(
      canReadMemberAssetPath(profilePath, "member-reader")
    ).resolves.toBe(false);
  });

  test("allows a member to read an image referenced by published community content", async () => {
    databaseMock.$queryRaw.mockResolvedValueOnce([{ id: "post-1" }]);

    await expect(
      canReadMemberAssetPath(communityPath, "member-reader")
    ).resolves.toBe(true);
  });

  test("allows a member to read an attachment referenced by published community content", async () => {
    databaseMock.$queryRaw.mockResolvedValueOnce([{ id: "post-attachment" }]);

    await expect(
      canReadMemberAssetPath(communityAttachmentPath, "member-reader")
    ).resolves.toBe(true);
  });

  test("allows a member of the collection audience to read its published cover", async () => {
    databaseMock.contentCollection.findFirst.mockResolvedValueOnce({
      id: "collection-1",
    });

    await expect(
      canReadMemberAssetPath(collectionCoverPath, "member-reader")
    ).resolves.toBe(true);
  });

  test("allows members to read a published learning path cover", async () => {
    databaseMock.learningPath.findFirst.mockResolvedValueOnce({ id: "path-1" });

    await expect(
      canReadMemberAssetPath(learningPathCoverPath, "member-reader")
    ).resolves.toBe(true);
    expect(databaseMock.learningPath.findFirst).toHaveBeenCalledWith({
      where: {
        coverUrl: `/api/member-assets?path=${encodeURIComponent(learningPathCoverPath)}`,
        status: "PUBLISHED",
      },
      select: { id: true },
    });
  });

  test("does not expose an unreferenced learning path cover", async () => {
    await expect(
      canReadMemberAssetPath(learningPathCoverPath, "member-reader")
    ).resolves.toBe(false);
    expect(databaseMock.learningPath.findFirst).toHaveBeenCalledWith({
      where: {
        coverUrl: `/api/member-assets?path=${encodeURIComponent(learningPathCoverPath)}`,
        status: "PUBLISHED",
      },
      select: { id: true },
    });
  });

  test("keeps a library image readable when a published path uses it as a cover", async () => {
    databaseMock.libraryItem.findFirst.mockResolvedValueOnce({
      createdBy: "another-member",
      status: "ARCHIVED",
    });
    databaseMock.learningPath.findFirst.mockResolvedValueOnce({ id: "path-1" });

    await expect(
      canReadMemberAssetPath(libraryLearningPathCoverPath, "member-reader")
    ).resolves.toBe(true);
  });

  test("does not expose an unreferenced community attachment", async () => {
    await expect(
      canReadMemberAssetPath(communityAttachmentPath, "member-reader")
    ).resolves.toBe(false);
  });

  test("staff can read assets for moderation without making the bucket public", async () => {
    databaseMock.member.findUnique.mockResolvedValue({ role: "ADMIN" });

    await expect(
      canReadMemberAssetPath(profilePath, "staff-member")
    ).resolves.toBe(true);
  });

  test("rejects paths outside the controlled asset prefixes", async () => {
    await expect(
      canReadMemberAssetPath("random/file.webp", "member-reader")
    ).resolves.toBe(false);
    expect(databaseMock.member.findUnique).not.toHaveBeenCalled();
  });
});
