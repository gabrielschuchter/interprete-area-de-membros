"use server";

import { randomUUID } from "node:crypto";
import {
  CommunitySpaceMemberRole,
  CommunitySpaceVisibility,
  ContentStatus,
  database,
  MemberRole,
  type Prisma,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  canArchiveStudyGroup,
  canChangeStudyGroupMemberRole,
  canChangeStudyGroupPrivacy,
  canEditStudyGroup,
  canRemoveStudyGroupMember,
} from "@/lib/community-group-permissions";
import { normalizeCommunitySpaceTitle } from "@/lib/community-space-rules";
import {
  isOwnedMemberAssetPath,
  memberAssetPathFromUrl,
} from "@/lib/member-storage";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

const textValue = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const requireActor = async () => {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const member = await database.member.findUnique({
    where: { id: userId },
    select: { role: true, deactivatedAt: true },
  });
  if (!member || member.deactivatedAt) {
    redirect("/conta-desativada");
  }
  return { memberId: userId, role: member.role };
};

const isStaff = (role: MemberRole) =>
  role === MemberRole.ADMIN || role === MemberRole.TEACHER;

const writeGroupAudit = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly groupId: string;
    readonly eventType: string;
    readonly payload: Prisma.InputJsonObject;
  }
) => {
  const occurredAt = new Date();
  await transaction.domainEvent.create({
    data: {
      eventType: input.eventType,
      actorId: input.actorId,
      aggregateType: "CommunitySpace",
      aggregateId: input.groupId,
      idempotencyKey: `${input.eventType}:${input.groupId}:${randomUUID()}`,
      payload: input.payload,
      occurredAt,
    },
  });
};

const groupPage = (slug: string, view = "settings") =>
  `/comunidade/grupos/${slug}?view=${view}`;

const groupEditSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500),
  details: z.string().trim().max(2400),
  coverUrl: z.string().trim().max(2000),
  commentsClosed: z.enum(["on", "off"]),
  visibility: z.nativeEnum(CommunitySpaceVisibility).optional(),
});
type GroupEditInput = z.infer<typeof groupEditSchema>;
const editableGroupSelect = {
  id: true,
  slug: true,
  ownerId: true,
  title: true,
  normalizedTitle: true,
  description: true,
  details: true,
  coverUrl: true,
  visibility: true,
  commentsClosed: true,
  status: true,
  members: {
    where: { memberId: "" },
    select: { role: true },
    take: 1,
  },
} as const;
type EditableGroup = Prisma.CommunitySpaceGetPayload<{
  select: typeof editableGroupSelect;
}>;

const groupIdFrom = (formData: FormData) => textValue(formData.get("groupId"));

const loadEditableGroup = async (
  transaction: Prisma.TransactionClient,
  groupId: string,
  actor: Awaited<ReturnType<typeof requireActor>>
) => {
  const group = await transaction.communitySpace.findUnique({
    where: { id: groupId },
    select: {
      ...editableGroupSelect,
      members: {
        ...editableGroupSelect.members,
        where: { memberId: actor.memberId },
      },
    },
  });
  if (!group || group.status !== ContentStatus.PUBLISHED) {
    return null;
  }
  const groupRole = group.members[0]?.role;
  const isOwner =
    group.ownerId === actor.memberId ||
    groupRole === CommunitySpaceMemberRole.OWNER;
  const isModerator = groupRole === CommunitySpaceMemberRole.MODERATOR;
  if (
    !canEditStudyGroup({
      isOwner,
      isModerator,
      isStaff: isStaff(actor.role),
    })
  ) {
    return null;
  }
  return { ...group, isOwner, isModerator };
};

const resolveGroupCoverUrl = (
  nextUrl: string,
  currentUrl: string | null,
  actorId: string
) => {
  if (!nextUrl) {
    return null;
  }
  if (nextUrl === currentUrl) {
    return nextUrl;
  }
  const path = memberAssetPathFromUrl(nextUrl);
  if (
    path?.startsWith("community-assets/covers/") &&
    isOwnedMemberAssetPath(path, actorId)
  ) {
    return nextUrl;
  }
  return undefined;
};

const hasDuplicateGroupTitle = async (
  transaction: Prisma.TransactionClient,
  group: Pick<EditableGroup, "id" | "ownerId" | "normalizedTitle">,
  normalizedTitle: string
) => {
  if (!group.ownerId || normalizedTitle === group.normalizedTitle) {
    return false;
  }
  const duplicate = await transaction.communitySpace.findFirst({
    where: {
      ownerId: group.ownerId,
      normalizedTitle,
      NOT: { id: group.id },
    },
    select: { id: true },
  });
  return Boolean(duplicate);
};

const changedGroupFields = (
  group: EditableGroup,
  input: GroupEditInput,
  coverUrl: string | null,
  visibility: CommunitySpaceVisibility
) => [
  ...(input.title !== group.title ? ["title"] : []),
  ...(input.description !== (group.description ?? "") ? ["description"] : []),
  ...(input.details !== (group.details ?? "") ? ["details"] : []),
  ...(coverUrl !== group.coverUrl ? ["cover"] : []),
  ...((input.commentsClosed === "on") !== group.commentsClosed
    ? ["commentsClosed"]
    : []),
  ...(visibility !== group.visibility ? ["visibility"] : []),
];

const auditRoleForGroupEdit = (
  isOwner: boolean,
  isModerator: boolean,
  identityRole: MemberRole
) => {
  if (isOwner) {
    return "OWNER";
  }
  if (isModerator) {
    return "MODERATOR";
  }
  return identityRole;
};

export const updateStudyGroup = async (formData: FormData) => {
  const actor = await requireActor();
  const groupId = groupIdFrom(formData);
  if (!groupId || textValue(formData.get("coverUploadPending")) === "true") {
    return;
  }
  const parsed = groupEditSchema.safeParse({
    title: textValue(formData.get("title")),
    description: textValue(formData.get("description")),
    details: textValue(formData.get("details")),
    coverUrl: textValue(formData.get("coverUrl")),
    commentsClosed:
      textValue(formData.get("commentsOpen")) === "on" ? "off" : "on",
    visibility: textValue(formData.get("visibility")) || undefined,
  });
  if (!parsed.success) {
    return;
  }
  const normalizedTitle = normalizeCommunitySpaceTitle(parsed.data.title);
  if (!normalizedTitle) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.group.manage",
    memberId: actor.memberId,
  });

  const result = await database.$transaction(async (transaction) => {
    const group = await loadEditableGroup(transaction, groupId, actor);
    if (!group) {
      return null;
    }
    const coverUrl = resolveGroupCoverUrl(
      parsed.data.coverUrl,
      group.coverUrl,
      actor.memberId
    );
    if (
      coverUrl === undefined ||
      (await hasDuplicateGroupTitle(transaction, group, normalizedTitle))
    ) {
      return null;
    }
    const visibility =
      canChangeStudyGroupPrivacy(group.isOwner) && parsed.data.visibility
        ? parsed.data.visibility
        : group.visibility;
    const changedFields = changedGroupFields(
      group,
      parsed.data,
      coverUrl,
      visibility
    );
    await transaction.communitySpace.update({
      where: { id: group.id },
      data: {
        title: parsed.data.title,
        normalizedTitle,
        description: parsed.data.description || null,
        details: parsed.data.details || null,
        coverUrl,
        commentsClosed: parsed.data.commentsClosed === "on",
        visibility,
      },
    });
    await writeGroupAudit(transaction, {
      actorId: actor.memberId,
      groupId: group.id,
      eventType: "community.group.updated",
      payload: {
        actorRole: auditRoleForGroupEdit(
          group.isOwner,
          group.isModerator,
          actor.role
        ),
        changedFields,
      },
    });
    return { slug: group.slug };
  });

  if (result) {
    revalidatePath("/comunidade/grupos");
    revalidatePath(`/comunidade/grupos/${result.slug}`);
    redirect(groupPage(result.slug));
  }
};

export const setStudyGroupMemberRole = async (formData: FormData) => {
  const actor = await requireActor();
  const groupId = groupIdFrom(formData);
  const memberId = textValue(formData.get("memberId"));
  const role = textValue(formData.get("role"));
  if (!(groupId && memberId && ["MEMBER", "MODERATOR"].includes(role))) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.group.manage",
    memberId: actor.memberId,
  });
  const result = await database.$transaction(async (transaction) => {
    const group = await transaction.communitySpace.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        slug: true,
        ownerId: true,
        status: true,
        members: {
          where: { memberId: actor.memberId },
          select: { role: true },
          take: 1,
        },
      },
    });
    if (
      !group ||
      group.status !== ContentStatus.PUBLISHED ||
      (group.ownerId !== actor.memberId &&
        group.members[0]?.role !== CommunitySpaceMemberRole.OWNER)
    ) {
      return null;
    }
    const target = await transaction.communitySpaceMember.findUnique({
      where: { spaceId_memberId: { spaceId: group.id, memberId } },
      select: { id: true, role: true, member: { select: { role: true } } },
    });
    if (
      !(
        target &&
        canChangeStudyGroupMemberRole({
          isOwner:
            group.ownerId === actor.memberId ||
            group.members[0]?.role === CommunitySpaceMemberRole.OWNER,
          targetGroupRole: target.role,
          targetIdentityRole: target.member.role,
          nextGroupRole: role,
        })
      )
    ) {
      return null;
    }
    const nextRole = role as CommunitySpaceMemberRole;
    if (target.role === nextRole) {
      return { slug: group.slug };
    }
    await transaction.communitySpaceMember.update({
      where: { id: target.id },
      data: { role: nextRole },
    });
    await writeGroupAudit(transaction, {
      actorId: actor.memberId,
      groupId: group.id,
      eventType: "community.group.member_role_changed",
      payload: { targetMemberId: memberId, from: target.role, to: nextRole },
    });
    return { slug: group.slug };
  });
  if (result) {
    revalidatePath(groupPage(result.slug, "members"));
    revalidatePath(`/comunidade/grupos/${result.slug}`);
    redirect(groupPage(result.slug, "members"));
  }
};

export const removeStudyGroupMember = async (formData: FormData) => {
  const actor = await requireActor();
  const groupId = groupIdFrom(formData);
  const memberId = textValue(formData.get("memberId"));
  if (!(groupId && memberId && memberId !== actor.memberId)) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.group.manage",
    memberId: actor.memberId,
  });
  const result = await database.$transaction(async (transaction) => {
    const group = await transaction.communitySpace.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        slug: true,
        ownerId: true,
        status: true,
        members: {
          where: { memberId: actor.memberId },
          select: { role: true },
          take: 1,
        },
      },
    });
    const owner =
      group?.ownerId === actor.memberId ||
      group?.members[0]?.role === CommunitySpaceMemberRole.OWNER;
    if (!group || group.status !== ContentStatus.PUBLISHED || !owner) {
      return null;
    }
    const target = await transaction.communitySpaceMember.findUnique({
      where: { spaceId_memberId: { spaceId: group.id, memberId } },
      select: { id: true, role: true },
    });
    if (
      !(
        target &&
        canRemoveStudyGroupMember({
          isOwner: owner,
          targetGroupRole: target.role,
        })
      )
    ) {
      return null;
    }
    await transaction.communitySpaceMember.delete({ where: { id: target.id } });
    await writeGroupAudit(transaction, {
      actorId: actor.memberId,
      groupId: group.id,
      eventType: "community.group.member_removed",
      payload: { targetMemberId: memberId, previousRole: target.role },
    });
    return { slug: group.slug };
  });
  if (result) {
    revalidatePath(groupPage(result.slug, "members"));
    revalidatePath(`/comunidade/grupos/${result.slug}`);
    revalidatePath("/comunidade/grupos");
    redirect(groupPage(result.slug, "members"));
  }
};

export const setStudyGroupArchived = async (formData: FormData) => {
  const actor = await requireActor();
  const groupId = groupIdFrom(formData);
  const status = textValue(formData.get("status"));
  if (
    !(
      groupId &&
      (status === ContentStatus.ARCHIVED || status === ContentStatus.PUBLISHED)
    )
  ) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.group.manage",
    memberId: actor.memberId,
  });
  const result = await database.$transaction(async (transaction) => {
    const group = await transaction.communitySpace.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        slug: true,
        ownerId: true,
        status: true,
        members: {
          where: { memberId: actor.memberId },
          select: { role: true },
          take: 1,
        },
      },
    });
    const owner =
      group?.ownerId === actor.memberId ||
      group?.members[0]?.role === CommunitySpaceMemberRole.OWNER;
    const desired = status as ContentStatus;
    if (
      !(group && canArchiveStudyGroup(owner)) ||
      (group.status !== ContentStatus.PUBLISHED &&
        group.status !== ContentStatus.ARCHIVED) ||
      group.status === desired
    ) {
      return null;
    }
    await transaction.communitySpace.update({
      where: { id: group.id },
      data: { status: desired },
    });
    await writeGroupAudit(transaction, {
      actorId: actor.memberId,
      groupId: group.id,
      eventType:
        desired === ContentStatus.ARCHIVED
          ? "community.group.archived"
          : "community.group.restored",
      payload: { previousStatus: group.status, status: desired },
    });
    return { slug: group.slug, status: desired };
  });
  if (result) {
    revalidatePath("/comunidade/grupos");
    revalidatePath(`/comunidade/grupos/${result.slug}`);
    redirect(
      `/comunidade/grupos/${result.slug}${result.status === ContentStatus.ARCHIVED ? "?view=settings&archived=1" : "?view=settings&restored=1"}`
    );
  }
};
