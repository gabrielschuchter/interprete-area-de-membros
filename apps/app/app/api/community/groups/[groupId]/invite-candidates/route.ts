import {
  CommunitySpaceInvitationStatus,
  CommunitySpaceMemberRole,
  ContentStatus,
  database,
  MemberRole,
} from "@repo/database";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageStudyGroupParticipants } from "@/lib/community-group-permissions";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
} from "@/lib/mutation-reliability";

const leadingAt = /^@/;

const noStore = { "Cache-Control": "private, no-store" };

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const { groupId } = await params;
  const query = (new URL(request.url).searchParams.get("q") ?? "")
    .trim()
    .replace(leadingAt, "")
    .slice(0, 80);
  if (query.length < 2) {
    return NextResponse.json({ items: [] }, { headers: noStore });
  }

  try {
    await consumeMutationRateLimit({
      action: "member.search",
      memberId: userId,
    });
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return NextResponse.json(
        { error: "Muitas buscas em sequência. Aguarde alguns segundos." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        }
      );
    }
    throw error;
  }

  const [actor, group] = await Promise.all([
    database.member.findFirst({
      where: { id: userId, deactivatedAt: null },
      select: { role: true },
    }),
    database.communitySpace.findFirst({
      where: { id: groupId, status: ContentStatus.PUBLISHED },
      select: {
        ownerId: true,
        members: {
          where: { memberId: userId },
          select: { role: true },
          take: 1,
        },
      },
    }),
  ]);
  if (!(actor && group)) {
    return NextResponse.json(
      { error: "Grupo não encontrado." },
      { status: 404 }
    );
  }
  const groupRole = group.members[0]?.role;
  const allowed = canManageStudyGroupParticipants({
    isOwner:
      group.ownerId === userId || groupRole === CommunitySpaceMemberRole.OWNER,
    isModerator: groupRole === CommunitySpaceMemberRole.MODERATOR,
    isStaff:
      actor.role === MemberRole.ADMIN || actor.role === MemberRole.TEACHER,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Você não pode convidar para este grupo." },
      { status: 403 }
    );
  }

  const exactUsername = query.toLowerCase();
  // Perfis ocultos da listagem só aparecem quando o @username é exato.
  const profiles = await database.profile.findMany({
    where: {
      clerkUserId: { not: userId },
      member: { is: { deactivatedAt: null } },
      OR: [
        {
          showInDirectory: true,
          username: { contains: exactUsername, mode: "insensitive" },
        },
        {
          showInDirectory: true,
          displayName: { contains: query, mode: "insensitive" },
        },
        { username: { equals: exactUsername, mode: "insensitive" } },
      ],
    },
    orderBy: [{ displayName: "asc" }, { username: "asc" }],
    take: 12,
    select: {
      clerkUserId: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      member: { select: { role: true } },
    },
  });
  const ids = profiles.map((profile) => profile.clerkUserId);
  const [members, pending] = await Promise.all([
    database.communitySpaceMember.findMany({
      where: { spaceId: groupId, memberId: { in: ids } },
      select: { memberId: true },
    }),
    database.communitySpaceInvitation.findMany({
      where: {
        spaceId: groupId,
        inviteeId: { in: ids },
        status: CommunitySpaceInvitationStatus.PENDING,
      },
      select: { inviteeId: true },
    }),
  ]);
  const memberIds = new Set(members.map(({ memberId }) => memberId));
  const pendingIds = new Set(pending.map(({ inviteeId }) => inviteeId));
  return NextResponse.json(
    {
      items: profiles.map((profile) => {
        let state: "available" | "member" | "pending" = "available";
        if (memberIds.has(profile.clerkUserId)) {
          state = "member";
        } else if (pendingIds.has(profile.clerkUserId)) {
          state = "pending";
        }
        return {
          id: profile.clerkUserId,
          username: profile.username,
          displayName: profile.displayName ?? profile.username,
          avatarUrl: profile.avatarUrl,
          kind: "USER" as const,
          role: profile.member.role,
          state,
        };
      }),
    },
    { headers: noStore }
  );
};
