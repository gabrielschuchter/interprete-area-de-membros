import type { Prisma } from "@repo/database";

export const normalizeCommunitySpaceTitle = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .trim();

export const communitySpaceSlugBase = (value: string) =>
  normalizeCommunitySpaceTitle(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "grupo-de-estudo";

export const communitySpaceAudienceWhere = (
  memberId: string | null,
  canModeratePrivateGroups = false
): Prisma.CommunitySpaceWhereInput => {
  if (canModeratePrivateGroups) {
    return {};
  }
  if (!memberId) {
    return { visibility: "PUBLIC" };
  }
  return {
    OR: [
      { visibility: "PUBLIC" },
      { ownerId: memberId },
      { members: { some: { memberId } } },
    ],
  };
};

export const communitySpaceMemberAudienceWhere = (
  memberId: string,
  canModeratePrivateGroups = false
): Prisma.CommunitySpaceWhereInput =>
  canModeratePrivateGroups
    ? {}
    : {
        OR: [{ ownerId: memberId }, { members: { some: { memberId } } }],
      };

export const communityPostAudienceWhere = (
  memberId: string | null,
  canModeratePrivateGroups = false
): Prisma.CommunityPostWhereInput => ({
  OR: [
    { spaceId: null },
    {
      space: {
        is: {
          status: "PUBLISHED",
          ...communitySpaceAudienceWhere(memberId, canModeratePrivateGroups),
        },
      },
    },
  ],
});

export const communityPostMutationAudienceWhere = (
  memberId: string,
  canModeratePrivateGroups = false
): Prisma.CommunityPostWhereInput => ({
  OR: [
    { spaceId: null },
    {
      space: {
        is: {
          status: "PUBLISHED",
          ...communitySpaceMemberAudienceWhere(
            memberId,
            canModeratePrivateGroups
          ),
        },
      },
    },
  ],
});
