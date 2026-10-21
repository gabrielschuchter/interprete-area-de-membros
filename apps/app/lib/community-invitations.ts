import "server-only";

import { createHash } from "node:crypto";
import {
  CommunitySpaceMemberRole,
  ContentStatus,
  database,
  MemberRole,
} from "@repo/database";

const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const inviteTokenPattern = /^[A-Za-z0-9_-]{40,50}$/;

const isStaff = (role: MemberRole) =>
  role === MemberRole.ADMIN || role === MemberRole.TEACHER;

export const getCommunityInviteLinkPreview = async (
  token: string,
  memberId: string
) => {
  if (!inviteTokenPattern.test(token)) {
    return null;
  }
  const invite = await database.communitySpaceInviteLink.findFirst({
    where: {
      tokenHash: tokenHash(token),
      revokedAt: null,
      space: { is: { status: ContentStatus.PUBLISHED } },
    },
    select: {
      id: true,
      spaceId: true,
      space: {
        select: {
          title: true,
          description: true,
          slug: true,
          members: {
            where: { memberId },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!invite) {
    return null;
  }
  return {
    group: {
      title: invite.space.title,
      description: invite.space.description,
      slug: invite.space.slug,
    },
    alreadyMember: invite.space.members.length > 0,
  };
};

export const getCommunityGroupInvitationManagement = async (
  groupId: string,
  actorId: string
) => {
  const [actor, group] = await Promise.all([
    database.member.findUnique({
      where: { id: actorId },
      select: { role: true, deactivatedAt: true },
    }),
    database.communitySpace.findFirst({
      where: { id: groupId, status: ContentStatus.PUBLISHED },
      select: {
        slug: true,
        ownerId: true,
        members: {
          where: { memberId: actorId },
          select: { role: true },
          take: 1,
        },
      },
    }),
  ]);
  if (!actor || actor.deactivatedAt || !group) {
    return null;
  }
  const groupRole = group.members[0]?.role;
  const owner =
    group.ownerId === actorId || groupRole === CommunitySpaceMemberRole.OWNER;
  const moderator = groupRole === CommunitySpaceMemberRole.MODERATOR;
  if (!(owner || moderator || isStaff(actor.role))) {
    return null;
  }
  const [activeLink, invitations] = await Promise.all([
    database.communitySpaceInviteLink.findFirst({
      where: { spaceId: groupId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    database.communitySpaceInvitation.findMany({
      where: { spaceId: groupId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        createdAt: true,
        invitee: {
          select: {
            displayName: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    }),
  ]);
  return {
    activeLinkCreatedAt: activeLink?.createdAt ?? null,
    invitations,
    slug: group.slug,
  };
};
