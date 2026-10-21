import { readFileSync } from "node:fs";
import { database } from "@repo/database";

interface GroupDatabaseRequest {
  readonly input: Record<string, string | string[]>;
  readonly operation: string;
}

const query = ({ operation, input }: GroupDatabaseRequest) => {
  switch (operation) {
    case "active-members":
      return database.member.findMany({
        where: { id: { in: input.ids as string[] }, deactivatedAt: null },
        select: { id: true },
      });
    case "initial-group":
      return database.communitySpace.findUnique({
        where: { slug: input.groupSlug as string },
        select: {
          id: true,
          ownerId: true,
          visibility: true,
          status: true,
          coverUrl: true,
          members: { select: { memberId: true, role: true } },
        },
      });
    case "membership-role":
      return database.communitySpaceMember.findUnique({
        where: {
          spaceId_memberId: {
            spaceId: input.spaceId as string,
            memberId: input.memberId as string,
          },
        },
        select: { role: true },
      });
    case "updated-group":
      return database.communitySpace.findUnique({
        where: { id: input.groupId as string },
        select: {
          title: true,
          description: true,
          details: true,
          coverUrl: true,
          visibility: true,
          ownerId: true,
          commentsClosed: true,
          status: true,
        },
      });
    case "audit-count":
      return database.domainEvent.count({
        where: {
          actorId: input.actorId as string,
          aggregateId: input.groupId as string,
          eventType: "community.group.private_accessed",
          payload: { path: ["actorRole"], equals: input.role as string },
        },
      });
    case "published-post":
      return database.communityPost.findFirst({
        where: {
          spaceId: input.groupId as string,
          title: input.postTitle as string,
          status: "PUBLISHED",
          deletedAt: null,
        },
        select: { id: true },
      });
    case "archived-group":
      return database.communitySpace.findUnique({
        where: { id: input.groupId as string },
        select: {
          status: true,
          visibility: true,
          ownerId: true,
          coverUrl: true,
          members: { select: { memberId: true, role: true } },
          posts: {
            where: { status: "PUBLISHED", deletedAt: null },
            select: { id: true },
          },
        },
      });
    case "restored-group":
      return database.communitySpace.findUnique({
        where: { id: input.groupId as string },
        select: {
          status: true,
          visibility: true,
          members: { select: { memberId: true } },
          posts: {
            where: { id: input.postId as string },
            select: { id: true },
          },
        },
      });
    case "membership-exists":
      return database.communitySpaceMember.findUnique({
        where: {
          spaceId_memberId: {
            spaceId: input.spaceId as string,
            memberId: input.memberId as string,
          },
        },
        select: { id: true },
      });
    default:
      throw new Error(`Unsupported community groups QA query: ${operation}`);
  }
};

try {
  const request = JSON.parse(readFileSync(0, "utf8")) as GroupDatabaseRequest;
  const result = await query(request);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`
  );
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
