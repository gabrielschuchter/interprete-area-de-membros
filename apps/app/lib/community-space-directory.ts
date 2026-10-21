import type { Prisma } from "@repo/database";
import { communitySpaceAudienceWhere } from "@/lib/community-space-rules";

export type CommunitySpaceDirectorySection = "mine" | "discover";

interface CommunitySpaceDirectoryWhereOptions {
  readonly canModeratePrivateGroups: boolean;
  readonly memberId: string;
  readonly query?: string;
  readonly section: CommunitySpaceDirectorySection;
}

export const communitySpaceDirectoryWhere = ({
  canModeratePrivateGroups,
  memberId,
  query,
  section,
}: CommunitySpaceDirectoryWhereOptions): Prisma.CommunitySpaceWhereInput => {
  const conditions: Prisma.CommunitySpaceWhereInput[] = [
    communitySpaceAudienceWhere(memberId, canModeratePrivateGroups),
  ];

  if (section === "mine") {
    conditions.push({
      OR: [
        {
          status: "PUBLISHED",
          OR: [{ ownerId: memberId }, { members: { some: { memberId } } }],
        },
        { status: "ARCHIVED", ownerId: memberId },
      ],
    });
  } else {
    conditions.push({
      status: "PUBLISHED",
      visibility: "PUBLIC",
      NOT: {
        OR: [{ ownerId: memberId }, { members: { some: { memberId } } }],
      },
    });
  }

  const normalizedQuery = query?.trim().slice(0, 100);
  if (normalizedQuery) {
    conditions.push({
      OR: [
        { title: { contains: normalizedQuery, mode: "insensitive" } },
        { description: { contains: normalizedQuery, mode: "insensitive" } },
      ],
    });
  }

  return { AND: conditions };
};
