import "server-only";

import { ContentStatus, database, MemberRole } from "@repo/database";
import { communityPostMutationAudienceWhere } from "@/lib/community-space-rules";
import {
  filterPrivateCommunityRecipients,
  resolveMentionedMemberIds,
} from "@/lib/notifications";

export interface CommunityMentionCandidate {
  readonly avatarUrl: string | null;
  readonly context: "DISCUSSION" | "COMMUNITY";
  readonly displayName: string | null;
  readonly id: string;
  readonly kind: "USER" | "GROUP";
  readonly notificationEligible?: boolean;
  readonly notificationNote?: string;
  readonly recipientCount?: number;
  readonly role: MemberRole;
  readonly username: string;
}

const mentionDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "mention",
          attrs: { id: "group:ALL", kind: "GROUP", username: "todos" },
        },
      ],
    },
  ],
};

const normalizedSearch = (query: string) => query.trim().slice(0, 80);

const profileSearchWhere = (query: string) => {
  const normalized = normalizedSearch(query);
  return {
    showInDirectory: true,
    member: { is: { deactivatedAt: null } },
    ...(normalized
      ? {
          OR: [
            {
              username: {
                contains: normalized.toLowerCase(),
                mode: "insensitive" as const,
              },
            },
            {
              displayName: {
                contains: normalized,
                mode: "insensitive" as const,
              },
            },
            {
              headline: {
                contains: normalized,
                mode: "insensitive" as const,
              },
            },
            { interests: { has: normalized.toLowerCase() } },
          ],
        }
      : {}),
  };
};

const matchingGroup = (query: string) => {
  const normalized = normalizedSearch(query).toLowerCase();
  return (
    !normalized ||
    "todos".includes(normalized) ||
    "todos os membros".includes(normalized)
  );
};

export const getCommunityMentionCandidates = async (input: {
  readonly actorId: string;
  readonly postId: string;
  readonly query: string;
  readonly scope: "discussion" | "community";
}) => {
  const actor = await database.member.findUnique({
    where: { id: input.actorId },
    select: { deactivatedAt: true, role: true },
  });
  if (!actor || actor.deactivatedAt) {
    return null;
  }
  const canModerate =
    actor.role === MemberRole.ADMIN || actor.role === MemberRole.TEACHER;
  const post = await database.communityPost.findFirst({
    where: {
      id: input.postId,
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      ...communityPostMutationAudienceWhere(input.actorId, canModerate),
    },
    select: {
      id: true,
      authorId: true,
      space: {
        select: { id: true, ownerId: true, visibility: true },
      },
    },
  });
  if (!post) {
    return null;
  }

  const [recentComments, recentFollows, directoryProfiles] = await Promise.all([
    database.communityComment.findMany({
      where: { postId: post.id, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 120,
      select: { authorId: true },
    }),
    database.topicFollow.findMany({
      where: {
        topicId: post.id,
        mutedAt: null,
        user: { deactivatedAt: null },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 120,
      select: { userId: true },
    }),
    database.profile.findMany({
      where: profileSearchWhere(input.query),
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
      take: 48,
      select: {
        clerkUserId: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        member: { select: { role: true } },
      },
    }),
  ]);

  const contextIds = new Set([
    post.authorId,
    ...recentComments.map(({ authorId }) => authorId),
    ...recentFollows.map(({ userId }) => userId),
  ]);
  contextIds.delete(input.actorId);

  const [contextProfiles, privateGroupMembers] = await Promise.all([
    contextIds.size === 0
      ? Promise.resolve([])
      : database.profile.findMany({
          where: {
            ...profileSearchWhere(input.query),
            clerkUserId: { in: [...contextIds] },
          },
          orderBy: [{ displayName: "asc" }, { username: "asc" }],
          take: 120,
          select: {
            clerkUserId: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            member: { select: { role: true } },
          },
        }),
    post.space?.visibility === "PRIVATE"
      ? database.communitySpaceMember.findMany({
          where: {
            spaceId: post.space.id,
            memberId: {
              in: [
                ...contextIds,
                ...directoryProfiles.map((profile) => profile.clerkUserId),
              ],
            },
            member: { deactivatedAt: null },
          },
          select: { memberId: true },
        })
      : Promise.resolve([]),
  ]);

  const privateMemberIds = new Set(
    privateGroupMembers.map(({ memberId }) => memberId)
  );
  if (post.space?.ownerId) {
    privateMemberIds.add(post.space.ownerId);
  }
  const isPrivate = post.space?.visibility === "PRIVATE";
  const toCandidate = (
    profile: (typeof directoryProfiles)[number],
    context: CommunityMentionCandidate["context"]
  ): CommunityMentionCandidate => {
    const notificationEligible =
      !isPrivate || privateMemberIds.has(profile.clerkUserId);
    return {
      id: profile.clerkUserId,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      role: profile.member.role,
      kind: "USER",
      context,
      notificationEligible,
      ...(notificationEligible
        ? {}
        : {
            notificationNote:
              "Não é membro deste grupo e não receberá a menção.",
          }),
    };
  };

  const discussionItems = contextProfiles
    .map((profile) => toCandidate(profile, "DISCUSSION"))
    .slice(0, 8);
  const communityItems =
    input.scope === "community"
      ? directoryProfiles
          .filter((profile) => !contextIds.has(profile.clerkUserId))
          .map((profile) => toCandidate(profile, "COMMUNITY"))
          .slice(0, 8)
      : [];

  const groups: CommunityMentionCandidate[] = [];
  if (
    (actor.role === MemberRole.ADMIN || actor.role === MemberRole.TEACHER) &&
    matchingGroup(input.query)
  ) {
    const unmutedFollows = await database.topicFollow.findMany({
      where: { topicId: post.id, mutedAt: null },
      select: { userId: true },
    });
    const recipientIds = await resolveMentionedMemberIds({
      actorId: input.actorId,
      document: mentionDocument,
      postId: post.id,
      postAuthorId: post.authorId,
      unmutedFollowerIds: unmutedFollows.map(({ userId }) => userId),
    });
    const allowedRecipientIds = await filterPrivateCommunityRecipients(
      post.id,
      recipientIds
    );
    groups.push({
      id: "group:ALL",
      username: "todos",
      displayName: "Todos nesta discussão",
      avatarUrl: null,
      role: MemberRole.MEMBER,
      kind: "GROUP",
      context: "DISCUSSION",
      recipientCount: allowedRecipientIds.length,
    });
  }

  return {
    discussionItems,
    communityItems,
    groups,
  };
};
