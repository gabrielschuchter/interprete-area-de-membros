import "server-only";

import { database, MemberRole } from "@repo/database";
import {
  isMemberAssetPath,
  memberAssetPathFromUrl,
  memberAssetUrl,
} from "./member-storage";

const profileAvatarPrefix = "profile-assets/avatars/";
const communityCoverPrefix = "community-assets/covers/";
const communityInlinePrefix = "community-assets/inline/";
const activitySubmissionPrefix = "activity-assets/submissions/";
const libraryPrefix = "library-assets/";

const ownerIdFromPath = (path: string, prefix: string) => {
  if (!path.startsWith(prefix)) {
    return null;
  }

  const remainder = path.slice(prefix.length);
  const separator = remainder.indexOf("/");
  if (separator <= 0) {
    return null;
  }

  return remainder.slice(0, separator);
};

const isStaffRole = (role: MemberRole | null | undefined) =>
  role === MemberRole.ADMIN || role === MemberRole.TEACHER;

const hasPublishedCommunityReference = async (
  path: string,
  memberId: string
) => {
  const url = memberAssetUrl(path);

  // The JSON document stores the same canonical, same-origin asset URL as the
  // cover field. `position` keeps this parameterized and avoids treating `%`
  // or `_` in a path as LIKE wildcards.
  const references = await database.$queryRaw<Array<{ id: string }>>`
    SELECT p."id"
    FROM "CommunityPost" p
    LEFT JOIN "CommunitySpace" s ON s."id" = p."spaceId"
    WHERE p."deletedAt" IS NULL
      AND (
        p."coverUrl" = ${url}
        OR position(${url} in COALESCE(p."contentJson"::text, '')) > 0
      )
      AND (
        p."authorId" = ${memberId}
        OR (
          p."status" = 'PUBLISHED'
          AND (p."spaceId" IS NULL OR s."status" = 'PUBLISHED')
        )
      )
    LIMIT 1
  `;

  if (references.length > 0) {
    return true;
  }

  const commentReferences = await database.$queryRaw<Array<{ id: string }>>`
    SELECT c."id"
    FROM "CommunityComment" c
    INNER JOIN "CommunityPost" p ON p."id" = c."postId"
    LEFT JOIN "CommunitySpace" s ON s."id" = p."spaceId"
    WHERE c."deletedAt" IS NULL
      AND position(${url} in COALESCE(c."contentJson"::text, '')) > 0
      AND (
        c."authorId" = ${memberId}
        OR p."authorId" = ${memberId}
        OR (
          p."status" = 'PUBLISHED'
          AND (p."spaceId" IS NULL OR s."status" = 'PUBLISHED')
        )
      )
    LIMIT 1
  `;

  return commentReferences.length > 0;
};

const canReadProfileAvatar = async (path: string, memberId: string) => {
  const ownerId = ownerIdFromPath(path, profileAvatarPrefix);
  if (!ownerId) {
    return false;
  }

  // A member may read an asset from their own prefix immediately after upload,
  // before the profile form has committed the reference. Other members may
  // only read the currently referenced avatar, never an orphaned object guessed
  // from a storage path.
  if (ownerId === memberId) {
    return true;
  }

  const [profile, member] = await Promise.all([
    database.profile.findUnique({
      where: { clerkUserId: ownerId },
      select: { avatarUrl: true },
    }),
    database.member.findUnique({
      where: { id: ownerId },
      select: { avatarUrl: true },
    }),
  ]);

  return (
    memberAssetPathFromUrl(profile?.avatarUrl) === path ||
    memberAssetPathFromUrl(member?.avatarUrl) === path
  );
};

const canReadActivitySubmission = async (path: string, memberId: string) => {
  const submission = await database.activitySubmission.findFirst({
    where: { attachmentPath: path },
    select: { memberId: true },
  });

  return submission?.memberId === memberId;
};

const canReadLibraryAsset = async (path: string, memberId: string) => {
  const item = await database.libraryItem.findFirst({
    where: { storagePath: path },
    select: { status: true, createdBy: true },
  });

  return item?.status === "PUBLISHED" || item?.createdBy === memberId;
};

/**
 * Central read authorization for the private member-assets bucket.
 *
 * Upload/delete authorization remains path-owner based in the route. Read
 * authorization is deliberately different: an avatar or community asset is
 * readable by the audience of the referenced application resource, not only
 * by the member who originally uploaded the bytes.
 */
export const canReadMemberAssetPath = async (
  path: string,
  memberId: string
) => {
  if (!isMemberAssetPath(path)) {
    return false;
  }

  const member = await database.member.findUnique({
    where: { id: memberId },
    select: { role: true },
  });

  if (!member) {
    return false;
  }

  if (isStaffRole(member.role)) {
    return true;
  }

  if (path.startsWith(profileAvatarPrefix)) {
    return canReadProfileAvatar(path, memberId);
  }

  if (
    path.startsWith(communityCoverPrefix) ||
    path.startsWith(communityInlinePrefix)
  ) {
    const ownerId = ownerIdFromPath(
      path,
      path.startsWith(communityCoverPrefix)
        ? communityCoverPrefix
        : communityInlinePrefix
    );

    // Keep the upload-to-save experience working for the author while a draft
    // is still being persisted. Other members need a real visible reference.
    return (
      ownerId === memberId || hasPublishedCommunityReference(path, memberId)
    );
  }

  if (path.startsWith(activitySubmissionPrefix)) {
    return canReadActivitySubmission(path, memberId);
  }

  if (path.startsWith(libraryPrefix)) {
    return canReadLibraryAsset(path, memberId);
  }

  return false;
};
