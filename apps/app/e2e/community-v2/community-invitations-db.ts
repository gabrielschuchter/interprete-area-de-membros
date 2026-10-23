import { readFileSync } from "node:fs";
import { CommunitySpaceMemberRole, database } from "@repo/database";

interface Request {
  readonly input: Record<string, unknown>;
  readonly operation: string;
}

const query = async ({ operation, input }: Request) => {
  switch (operation) {
    case "group-by-slug":
      return database.communitySpace.findUnique({
        where: { slug: input.slug as string },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          details: true,
          ownerId: true,
          visibility: true,
          status: true,
          members: { select: { memberId: true, role: true } },
        },
      });
    case "prepare-invitation-fixture": {
      const fixture = await database.communitySpace.findFirst({
        where: {
          ownerId: input.ownerId as string,
          title: { startsWith: "Convites privados " },
          visibility: "PRIVATE",
          status: "PUBLISHED",
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          details: true,
          ownerId: true,
          visibility: true,
          status: true,
        },
      });
      if (!fixture) {
        return null;
      }
      const now = new Date();
      const qaMemberIds = input.memberIds as string[];
      await database.$transaction([
        database.communitySpaceInvitation.updateMany({
          where: { spaceId: fixture.id, status: "PENDING" },
          data: { status: "REVOKED", respondedAt: now },
        }),
        database.communitySpaceMember.deleteMany({
          where: {
            spaceId: fixture.id,
            memberId: {
              in: qaMemberIds.filter((id) => id !== fixture.ownerId),
            },
          },
        }),
        database.communitySpaceInviteLink.updateMany({
          where: { spaceId: fixture.id, revokedAt: null },
          data: { revokedAt: now },
        }),
      ]);
      return fixture;
    }
    case "set-memberships": {
      const entries = input.members as Array<{
        memberId: string;
        role: "OWNER" | "MODERATOR" | "MEMBER";
      }>;
      return database.$transaction(
        entries.map(({ memberId, role }) =>
          database.communitySpaceMember.upsert({
            where: {
              spaceId_memberId: {
                spaceId: input.spaceId as string,
                memberId,
              },
            },
            create: {
              spaceId: input.spaceId as string,
              memberId,
              role: CommunitySpaceMemberRole[role],
            },
            update: { role: CommunitySpaceMemberRole[role] },
          })
        )
      );
    }
    case "membership":
      return database.communitySpaceMember.findUnique({
        where: {
          spaceId_memberId: {
            spaceId: input.spaceId as string,
            memberId: input.memberId as string,
          },
        },
        select: { id: true, role: true },
      });
    case "remove-membership":
      return database.communitySpaceMember.deleteMany({
        where: {
          spaceId: input.spaceId as string,
          memberId: input.memberId as string,
        },
      });
    case "invitation-states":
      return database.communitySpaceInvitation.findMany({
        where: {
          spaceId: input.spaceId as string,
          inviteeId: { in: input.memberIds as string[] },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          inviteeId: true,
          status: true,
          createdAt: true,
        },
      });
    case "invitation-by-id":
      return database.communitySpaceInvitation.findUnique({
        where: { id: input.invitationId as string },
        select: {
          id: true,
          inviteeId: true,
          inviterId: true,
          spaceId: true,
          status: true,
          respondedAt: true,
        },
      });
    case "active-links":
      return database.communitySpaceInviteLink.findMany({
        where: { spaceId: input.spaceId as string, revokedAt: null },
        select: { id: true, tokenHash: true, createdAt: true, revokedAt: true },
      });
    case "all-links":
      return database.communitySpaceInviteLink.findMany({
        where: { spaceId: input.spaceId as string },
        orderBy: { createdAt: "desc" },
        select: { id: true, tokenHash: true, createdAt: true, revokedAt: true },
      });
    case "member-search-details":
      return database.member.findMany({
        where: { id: { in: input.memberIds as string[] }, deactivatedAt: null },
        select: {
          id: true,
          role: true,
          displayName: true,
          profile: { select: { displayName: true, username: true } },
        },
      });
    case "outbox-notification-evidence": {
      const invitation = await database.communitySpaceInvitation.findUnique({
        where: { id: input.invitationId as string },
        select: { id: true, spaceId: true, inviteeId: true },
      });
      if (!invitation) {
        return null;
      }
      const [events, notificationCount] = await Promise.all([
        database.domainEvent.findMany({
          where: {
            eventType: "notifications.batch_requested",
            aggregateType: "CommunitySpaceInvitationBatch",
            aggregateId: invitation.spaceId,
          },
          select: {
            id: true,
            payload: true,
            jobs: {
              select: { consumerKey: true, status: true, attemptCount: true },
            },
          },
        }),
        database.notification.count({
          where: {
            memberId: invitation.inviteeId,
            entityType: "COMMUNITY_INVITATION",
            entityId: invitation.id,
            type: "GROUP_INVITATION",
          },
        }),
      ]);
      const producerEvent = events.find(({ payload }) =>
        JSON.stringify(payload).includes(invitation.id)
      );
      return {
        invitationId: invitation.id,
        notificationCount,
        producerEvent: producerEvent
          ? {
              id: producerEvent.id,
              jobs: producerEvent.jobs,
            }
          : null,
      };
    }
    case "seed-private-comment-notification":
      return database.notification.create({
        data: {
          memberId: input.memberId as string,
          actorId: input.actorId as string,
          type: "MENTION",
          entityType: "COMMENT",
          entityId: input.commentId as string,
          parentEntityType: "TOPIC",
          parentEntityId: input.postId as string,
          communitySpaceId: input.spaceId as string,
          dedupeKey: input.dedupeKey as string,
          title: "Você foi mencionado",
          body: input.body as string,
          href: input.href as string,
        },
        select: { id: true },
      });
    case "delete-review-notification":
      return database.notification.deleteMany({
        where: { dedupeKey: input.dedupeKey as string },
      });
    case "review-notification-evidence":
      return database.notification.findUnique({
        where: { id: input.notificationId as string },
        select: {
          id: true,
          body: true,
          href: true,
          communitySpaceId: true,
        },
      });
    case "private-access-audit-count":
      return database.domainEvent.count({
        where: {
          actorId: input.actorId as string,
          aggregateId: input.spaceId as string,
          eventType: "community.group.private_accessed",
        },
      });
    default:
      throw new Error(
        `Unsupported community invitations QA query: ${operation}`
      );
  }
};

const databaseUrl = new URL(process.env.DATABASE_URL ?? "http://invalid.local");
if (
  process.env.COMMUNITY_QA_ISOLATED !== "true" ||
  databaseUrl.hostname !== "127.0.0.1" ||
  databaseUrl.port !== "54325" ||
  databaseUrl.pathname.slice(1) !== "interprete_community_v2_qa" ||
  databaseUrl.username !== "community_qa"
) {
  throw new Error("Invitation QA is restricted to the guarded local database.");
}

try {
  const request = JSON.parse(readFileSync(0, "utf8")) as Request;
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
