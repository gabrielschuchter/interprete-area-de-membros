"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  CommunitySpaceInvitationStatus,
  CommunitySpaceMemberRole,
  ContentStatus,
  database,
  MemberRole,
  Prisma,
} from "@repo/database";
import { enqueueNotificationBatch } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { canManageStudyGroupParticipants } from "@/lib/community-group-permissions";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";

const inviteTokenPattern = /^[A-Za-z0-9_-]{40,50}$/;

const textValue = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const getActor = async () => {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }
  const member = await database.member.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      deactivatedAt: true,
      onboardingStatus: true,
    },
  });
  if (
    !member ||
    member.deactivatedAt ||
    member.onboardingStatus !== "COMPLETED"
  ) {
    return null;
  }
  return member;
};

const isStaff = (role: MemberRole) =>
  role === MemberRole.ADMIN || role === MemberRole.TEACHER;

const invitationActorRole = (
  isOwner: boolean,
  isModerator: boolean,
  actorRole: MemberRole
) => {
  if (isOwner) {
    return "OWNER";
  }
  if (isModerator) {
    return "MODERATOR";
  }
  return actorRole;
};

const loadInvitationAuthority = async (
  transaction: Prisma.TransactionClient,
  actorId: string,
  groupId: string
) => {
  const [actor, group] = await Promise.all([
    transaction.member.findFirst({
      where: { id: actorId, deactivatedAt: null },
      select: { role: true },
    }),
    transaction.communitySpace.findFirst({
      where: { id: groupId, status: ContentStatus.PUBLISHED },
      select: {
        id: true,
        slug: true,
        visibility: true,
        ownerId: true,
        members: {
          where: { memberId: actorId },
          select: { role: true },
          take: 1,
        },
      },
    }),
  ]);
  if (!(actor && group)) {
    return null;
  }
  const groupRole = group.members[0]?.role;
  const owner =
    group.ownerId === actorId || groupRole === CommunitySpaceMemberRole.OWNER;
  const moderator = groupRole === CommunitySpaceMemberRole.MODERATOR;
  const staff = isStaff(actor.role);
  return {
    ...group,
    actorRole: actor.role,
    owner,
    moderator,
    staff,
    allowed: canManageStudyGroupParticipants({
      isOwner: owner,
      isModerator: moderator,
      isStaff: staff,
    }),
  };
};

const auditStaffPrivateAccess = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly actorRole: MemberRole;
    readonly groupId: string;
    readonly visibility: "PRIVATE" | "PUBLIC";
  }
) => {
  if (
    !input.visibility ||
    input.visibility !== "PRIVATE" ||
    !isStaff(input.actorRole)
  ) {
    return;
  }
  await transaction.domainEvent.create({
    data: {
      eventType: "community.group.private_accessed",
      actorId: input.actorId,
      aggregateType: "CommunitySpace",
      aggregateId: input.groupId,
      idempotencyKey: `community.group.private_accessed:${input.groupId}:${randomUUID()}`,
      payload: { actorRole: input.actorRole },
      occurredAt: new Date(),
    },
  });
};

const inviteeIdsFrom = (formData: FormData) =>
  [...new Set(formData.getAll("inviteeIds"))]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

export interface CommunityInviteRecipientResult {
  readonly inviteeId: string;
  readonly status:
    | "created"
    | "duplicate_pending"
    | "already_member"
    | "unavailable";
}

export interface CommunityInviteBatchResult {
  readonly results: readonly CommunityInviteRecipientResult[];
  readonly status:
    | "sent"
    | "partial"
    | "forbidden"
    | "invalid"
    | "unauthenticated";
}

export const inviteStudyGroupMembers = async (
  formData: FormData
): Promise<CommunityInviteBatchResult> => {
  const actor = await getActor();
  const groupId = textValue(formData.get("groupId"));
  const inviteeIds = inviteeIdsFrom(formData);
  if (!actor) {
    return { status: "unauthenticated", results: [] };
  }
  if (!groupId || inviteeIds.length === 0 || inviteeIds.length > 50) {
    return { status: "invalid", results: [] };
  }
  await consumeMutationRateLimit({
    action: "community.group.invite",
    memberId: actor.id,
  });

  const result = await database.$transaction(async (transaction) => {
    if (!(await lockPublishedGroup(transaction, groupId))) {
      return { status: "invalid" as const, results: [] };
    }
    const authority = await loadInvitationAuthority(
      transaction,
      actor.id,
      groupId
    );
    if (!authority) {
      return { status: "invalid" as const, results: [] };
    }
    if (!authority.allowed) {
      return {
        status: "forbidden" as const,
        results: inviteeIds.map((inviteeId) => ({
          inviteeId,
          status: "unavailable" as const,
        })),
      };
    }
    await auditStaffPrivateAccess(transaction, {
      actorId: actor.id,
      actorRole: authority.actorRole,
      groupId,
      visibility: authority.visibility,
    });

    const activePeople = await transaction.member.findMany({
      where: {
        id: { in: inviteeIds },
        deactivatedAt: null,
        NOT: { id: actor.id },
      },
      select: { id: true },
    });
    const activeIds = activePeople.map(({ id }) => id);
    const [memberships, pending] = await Promise.all([
      transaction.communitySpaceMember.findMany({
        where: { spaceId: groupId, memberId: { in: activeIds } },
        select: { memberId: true },
      }),
      transaction.communitySpaceInvitation.findMany({
        where: {
          spaceId: groupId,
          inviteeId: { in: activeIds },
          status: CommunitySpaceInvitationStatus.PENDING,
        },
        select: { inviteeId: true },
      }),
    ]);
    const memberIds = new Set(memberships.map(({ memberId }) => memberId));
    const pendingIds = new Set(pending.map(({ inviteeId }) => inviteeId));
    const createIds = activeIds.filter(
      (id) => !(memberIds.has(id) || pendingIds.has(id))
    );
    const createdAt = new Date();
    const created = createIds.length
      ? await transaction.communitySpaceInvitation.createManyAndReturn({
          data: createIds.map((inviteeId) => ({
            id: randomUUID(),
            spaceId: groupId,
            inviteeId,
            inviterId: actor.id,
          })),
          skipDuplicates: true,
          select: { id: true, inviteeId: true },
        })
      : [];
    if (created.length) {
      await enqueueNotificationBatch(transaction, {
        actorId: actor.id,
        aggregateType: "CommunitySpaceInvitationBatch",
        aggregateId: groupId,
        idempotencyKey: `community-space-invitations:${groupId}:${createdAt.getTime()}:${randomUUID()}`,
        occurredAt: createdAt,
        notifications: created.map(({ id, inviteeId }) => ({
          recipientId: inviteeId,
          type: "GROUP_INVITATION",
          entityType: "COMMUNITY_INVITATION",
          entityId: id,
          communitySpaceId: groupId,
          dedupeKey: `community-space-invitation:${id}`,
          groupKey: groupId,
          href: "/perfil#convites",
        })),
      });
    }

    const createdIds = new Set(created.map(({ inviteeId }) => inviteeId));
    const [currentPending, currentMemberships] = await Promise.all([
      transaction.communitySpaceInvitation.findMany({
        where: {
          spaceId: groupId,
          inviteeId: { in: activeIds },
          status: CommunitySpaceInvitationStatus.PENDING,
        },
        select: { inviteeId: true },
      }),
      transaction.communitySpaceMember.findMany({
        where: { spaceId: groupId, memberId: { in: activeIds } },
        select: { memberId: true },
      }),
    ]);
    const allPendingIds = new Set(
      currentPending.map(({ inviteeId }) => inviteeId)
    );
    const allMemberIds = new Set(
      currentMemberships.map(({ memberId }) => memberId)
    );
    const activeIdSet = new Set(activeIds);
    const results = inviteeIds.map((inviteeId) => {
      let status: CommunityInviteRecipientResult["status"] = "unavailable";
      if (activeIdSet.has(inviteeId)) {
        if (memberIds.has(inviteeId) || allMemberIds.has(inviteeId)) {
          status = "already_member";
        } else if (createdIds.has(inviteeId)) {
          status = "created";
        } else if (allPendingIds.has(inviteeId)) {
          status = "duplicate_pending";
        }
      }
      return { inviteeId, status };
    });
    const allCreated = results.every(({ status }) => status === "created");
    return {
      status: allCreated ? ("sent" as const) : ("partial" as const),
      results,
      slug: authority.slug,
      createdCount: created.length,
    };
  });

  if (result.status === "sent" || result.status === "partial") {
    if (result.createdCount > 0) {
      await dispatchPendingNotifications();
      revalidatePath("/perfil");
    }
    revalidatePath(`/comunidade/grupos/${result.slug}`);
    revalidatePath(`/comunidade/grupos/${result.slug}?view=members`);
  }
  return { status: result.status, results: result.results };
};

export const revokeStudyGroupInvitation = async (formData: FormData) => {
  const actor = await getActor();
  const invitationId = textValue(formData.get("invitationId"));
  if (!actor) {
    return { status: "unauthenticated" as const };
  }
  if (!invitationId) {
    return { status: "invalid" as const };
  }
  await consumeMutationRateLimit({
    action: "community.group.invite",
    memberId: actor.id,
  });
  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.communitySpaceInvitation.findUnique({
      where: { id: invitationId },
      select: { id: true, spaceId: true, space: { select: { slug: true } } },
    });
    if (!invitation) {
      return { status: "unavailable" as const };
    }
    const authority = await loadInvitationAuthority(
      transaction,
      actor.id,
      invitation.spaceId
    );
    if (!authority) {
      return { status: "unavailable" as const };
    }
    if (!authority.allowed) {
      return { status: "forbidden" as const };
    }
    await auditStaffPrivateAccess(transaction, {
      actorId: actor.id,
      actorRole: authority.actorRole,
      groupId: invitation.spaceId,
      visibility: authority.visibility,
    });
    const changed = await transaction.communitySpaceInvitation.updateMany({
      where: {
        id: invitation.id,
        status: CommunitySpaceInvitationStatus.PENDING,
      },
      data: {
        status: CommunitySpaceInvitationStatus.REVOKED,
        respondedAt: new Date(),
      },
    });
    return { slug: authority.slug, changed: changed.count };
  });
  if (
    "slug" in result &&
    typeof result.changed === "number" &&
    result.changed > 0
  ) {
    revalidatePath("/perfil");
    revalidatePath(`/comunidade/grupos/${result.slug}`);
    revalidatePath(`/comunidade/grupos/${result.slug}?view=members`);
    return { status: "revoked" as const };
  }
  return "status" in result ? result : { status: "unavailable" as const };
};

const hashInviteToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const invitationLinkPath = (token: string) => `/comunidade/convite/${token}`;

const linkUrl = (token: string) => {
  return new URL(invitationLinkPath(token), env.NEXT_PUBLIC_APP_URL).toString();
};

const lockPublishedGroup = async (
  transaction: Prisma.TransactionClient,
  groupId: string
) => {
  const [group] = await transaction.$queryRaw<Array<{ readonly id: string }>>(
    Prisma.sql`
      SELECT "id" FROM "CommunitySpace"
      WHERE "id" = ${groupId} AND "status" = 'PUBLISHED'
      FOR UPDATE
    `
  );
  return Boolean(group);
};

export const regenerateCommunityGroupInviteLink = async (
  formData: FormData
) => {
  const actor = await getActor();
  const groupId = textValue(formData.get("groupId"));
  if (!(actor && groupId)) {
    return { status: "invalid" as const };
  }
  await consumeMutationRateLimit({
    action: "community.group.invite",
    memberId: actor.id,
  });
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInviteToken(token);
  const result = await database.$transaction(async (transaction) => {
    if (!(await lockPublishedGroup(transaction, groupId))) {
      return null;
    }
    const authority = await loadInvitationAuthority(
      transaction,
      actor.id,
      groupId
    );
    if (!authority?.allowed) {
      return null;
    }
    await auditStaffPrivateAccess(transaction, {
      actorId: actor.id,
      actorRole: authority.actorRole,
      groupId,
      visibility: authority.visibility,
    });
    const now = new Date();
    await transaction.communitySpaceInviteLink.updateMany({
      where: { spaceId: groupId, revokedAt: null },
      data: { revokedAt: now },
    });
    await transaction.communitySpaceInviteLink.create({
      data: {
        id: randomUUID(),
        spaceId: groupId,
        tokenHash,
        createdById: actor.id,
      },
      select: { id: true },
    });
    await transaction.domainEvent.create({
      data: {
        eventType: "community.group.invite_link.regenerated",
        actorId: actor.id,
        aggregateType: "CommunitySpace",
        aggregateId: groupId,
        idempotencyKey: `community.group.invite_link.regenerated:${groupId}:${randomUUID()}`,
        payload: {
          actorRole: invitationActorRole(
            authority.owner,
            authority.moderator,
            authority.actorRole
          ),
        },
        occurredAt: now,
      },
    });
    return { slug: authority.slug };
  });
  if (!result) {
    return { status: "forbidden" as const };
  }
  revalidatePath(`/comunidade/grupos/${result.slug}`);
  revalidatePath(`/comunidade/grupos/${result.slug}?view=members`);
  return { status: "created" as const, url: linkUrl(token) };
};

export const revokeCommunityGroupInviteLink = async (formData: FormData) => {
  const actor = await getActor();
  const groupId = textValue(formData.get("groupId"));
  if (!(actor && groupId)) {
    return { status: "invalid" as const };
  }
  await consumeMutationRateLimit({
    action: "community.group.invite",
    memberId: actor.id,
  });
  const result = await database.$transaction(async (transaction) => {
    if (!(await lockPublishedGroup(transaction, groupId))) {
      return null;
    }
    const authority = await loadInvitationAuthority(
      transaction,
      actor.id,
      groupId
    );
    if (!authority?.allowed) {
      return null;
    }
    await auditStaffPrivateAccess(transaction, {
      actorId: actor.id,
      actorRole: authority.actorRole,
      groupId,
      visibility: authority.visibility,
    });
    const changed = await transaction.communitySpaceInviteLink.updateMany({
      where: { spaceId: groupId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await transaction.domainEvent.create({
      data: {
        eventType: "community.group.invite_link.revoked",
        actorId: actor.id,
        aggregateType: "CommunitySpace",
        aggregateId: groupId,
        idempotencyKey: `community.group.invite_link.revoked:${groupId}:${randomUUID()}`,
        payload: { changedCount: changed.count },
        occurredAt: new Date(),
      },
    });
    return { slug: authority.slug, changed: changed.count };
  });
  if (!result) {
    return { status: "forbidden" as const };
  }
  revalidatePath(`/comunidade/grupos/${result.slug}`);
  revalidatePath(`/comunidade/grupos/${result.slug}?view=members`);
  return {
    status: result.changed
      ? ("revoked" as const)
      : ("already_revoked" as const),
  };
};

export const acceptCommunityGroupInviteLink = async (formData: FormData) => {
  const actor = await getActor();
  const token = textValue(formData.get("token"));
  if (!actor) {
    return { status: "unauthenticated" as const };
  }
  if (!inviteTokenPattern.test(token)) {
    return { status: "invalid" as const };
  }
  await consumeMutationRateLimit({
    action: "community.group.invitation.respond",
    memberId: actor.id,
  });
  const tokenHash = hashInviteToken(token);
  const result = await database.$transaction(async (transaction) => {
    const [activeLink] = await transaction.$queryRaw<
      Array<{ id: string; spaceId: string; createdById: string | null }>
    >(Prisma.sql`
      UPDATE "CommunitySpaceInviteLink" AS invite_link
      SET "revokedAt" = NULL
      WHERE invite_link."tokenHash" = ${tokenHash}
        AND invite_link."revokedAt" IS NULL
        AND EXISTS (
          SELECT 1 FROM "CommunitySpace" AS space
          WHERE space."id" = invite_link."spaceId"
            AND space."status" = 'PUBLISHED'
        )
      RETURNING invite_link."id", invite_link."spaceId", invite_link."createdById"
    `);
    if (!activeLink) {
      return null;
    }
    const group = await transaction.communitySpace.findUnique({
      where: { id: activeLink.spaceId },
      select: { slug: true },
    });
    if (!group) {
      return null;
    }
    const existing = await transaction.communitySpaceMember.findUnique({
      where: {
        spaceId_memberId: { spaceId: activeLink.spaceId, memberId: actor.id },
      },
      select: { id: true },
    });
    if (existing) {
      return { slug: group.slug, status: "already_member" as const };
    }
    const membership = await transaction.communitySpaceMember.createMany({
      data: [
        {
          spaceId: activeLink.spaceId,
          memberId: actor.id,
          role: CommunitySpaceMemberRole.MEMBER,
        },
      ],
      skipDuplicates: true,
    });
    if (membership.count === 0) {
      return { slug: group.slug, status: "already_member" as const };
    }
    const pendingInvitation =
      await transaction.communitySpaceInvitation.findFirst({
        where: {
          spaceId: activeLink.spaceId,
          inviteeId: actor.id,
          status: CommunitySpaceInvitationStatus.PENDING,
        },
        select: { id: true },
      });
    let acceptedInvitationId: string;
    if (pendingInvitation) {
      const changed = await transaction.communitySpaceInvitation.updateMany({
        where: {
          id: pendingInvitation.id,
          status: CommunitySpaceInvitationStatus.PENDING,
        },
        data: {
          status: CommunitySpaceInvitationStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });
      acceptedInvitationId =
        changed.count === 1 ? pendingInvitation.id : randomUUID();
      if (changed.count !== 1) {
        await transaction.communitySpaceInvitation.create({
          data: {
            id: acceptedInvitationId,
            spaceId: activeLink.spaceId,
            inviteeId: actor.id,
            inviterId: activeLink.createdById,
            status: CommunitySpaceInvitationStatus.ACCEPTED,
            respondedAt: new Date(),
          },
        });
      }
    } else {
      acceptedInvitationId = randomUUID();
      await transaction.communitySpaceInvitation.create({
        data: {
          id: acceptedInvitationId,
          spaceId: activeLink.spaceId,
          inviteeId: actor.id,
          inviterId: activeLink.createdById,
          status: CommunitySpaceInvitationStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });
    }
    await transaction.domainEvent.create({
      data: {
        eventType: "community.group.invite_link.accepted",
        actorId: actor.id,
        aggregateType: "CommunitySpaceInviteLink",
        aggregateId: activeLink.id,
        idempotencyKey: `community.group.invite_link.accepted:${acceptedInvitationId}`,
        payload: {
          spaceId: activeLink.spaceId,
          invitationId: acceptedInvitationId,
        },
        occurredAt: new Date(),
      },
    });
    return { slug: group.slug, status: "accepted" as const };
  });
  if (!result) {
    return { status: "unavailable" as const };
  }
  revalidatePath("/comunidade");
  revalidatePath("/perfil");
  revalidatePath(`/comunidade/grupos/${result.slug}`);
  return result;
};
