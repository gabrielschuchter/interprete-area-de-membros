"use server";

import { randomUUID } from "node:crypto";
import {
  BadgeCriterion,
  CommunitySpaceMemberRole,
  CommunitySpaceVisibility,
  CommunityVoteKind,
  ContentStatus,
  database,
  type Prisma,
} from "@repo/database";
import { enqueueNotificationBatch } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getMemberRole, requireStaff } from "@/lib/authorization";
import { evaluateMemberBadges } from "@/lib/badges";
import { enrichCommunityArticleMetadata } from "@/lib/community-article-metadata";
import {
  plainTextFromDocument,
  sanitizeRichDocument,
} from "@/lib/community-content";
import {
  communityCoverAltEnabled,
  communityCoverAltSelect,
  communityCoverAltValue,
} from "@/lib/community-cover-alt";
import {
  type CommunityDraftSnapshot,
  communityDraftSnapshotsEqual,
  hasCommunityDraftContent,
  nextCommunityPostVersion,
} from "@/lib/community-draft-contract";
import { createCommunityComment } from "@/lib/community-mutations";
import { safeCommunityReturnPath } from "@/lib/community-return-path";
import {
  communityPostMutationAudienceWhere,
  communitySpaceMemberAudienceWhere,
  communitySpaceSlugBase,
  normalizeCommunitySpaceTitle,
} from "@/lib/community-space-rules";
import {
  deleteMemberAsset,
  isOwnedMemberAssetPath,
  memberAssetPathFromUrl,
} from "@/lib/member-storage";
import { readIdempotencyKeyFromForm } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";
import {
  documentHasGroupMention,
  extractMentionIdsFromDocument,
  extractMentionUsernames,
  notifyCommunityComment,
  notifyCommunityPost,
} from "@/lib/notifications";
import { getOrCreateProfile } from "@/lib/profile";
import { inviteStudyGroupMembers as inviteStudyGroupMembersV2 } from "./invitation-actions";

const draftTitle = "Rascunho sem título";
const tagSeparatorPattern = /[\n,]/;
const tagPrefixPattern = /^#/;
const tagCharactersPattern = /[^a-z0-9áàâãéêíóôõúçü -]/gi;

const emptyDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;

const textValue = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const currentUserId = async () => {
  const { userId } = await auth();
  return userId;
};

const postInput = z.object({
  title: z.string().trim().min(4).max(180),
  content: z.string().trim().min(1).max(40_000),
});

const parseTags = (value: FormDataEntryValue | null) =>
  [
    ...new Set(
      textValue(value)
        .split(tagSeparatorPattern)
        .map((tag) =>
          tag
            .trim()
            .replace(tagPrefixPattern, "")
            .toLowerCase()
            .replace(tagCharactersPattern, "")
        )
        .filter(Boolean)
        .map((tag) => tag.slice(0, 32))
    ),
  ].slice(0, 5);

const slugFromTitle = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "publicacao";

const uniquePostSlug = async (title: string, postId?: string) => {
  const base = slugFromTitle(title);
  let slug = base;
  let suffix = 2;
  while (true) {
    const existing = await database.communityPost.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || existing.id === postId) {
      return slug;
    }
    slug = `${base}-${suffix}`.slice(0, 80);
    suffix += 1;
  }
};

const safeImageUrl = (value: string, memberId: string) => {
  if (!value) {
    return null;
  }

  const assetPath = memberAssetPathFromUrl(value);
  if (
    assetPath?.startsWith("community-assets/covers/") &&
    isOwnedMemberAssetPath(assetPath, memberId)
  ) {
    return value.slice(0, 2000);
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
};

const contentFromForm = (formData: FormData) => {
  const rawJson =
    textValue(formData.get("contentJson")) ||
    textValue(formData.get("contentDocument"));
  const rawContent = textValue(formData.get("content"));
  let document: ReturnType<typeof sanitizeRichDocument> = null;
  if (rawJson) {
    try {
      document = sanitizeRichDocument(JSON.parse(rawJson));
    } catch {
      document = null;
    }
  }
  const plainText = document ? plainTextFromDocument(document) : rawContent;
  return { document, plainText };
};

const publishRequestIsValid = (
  post: {
    readonly content: string;
    readonly contentJson: unknown;
    readonly title: string;
  },
  formData: FormData
) =>
  postInput.safeParse({ title: post.title, content: post.content }).success &&
  (!documentHasGroupMention(post.contentJson) ||
    textValue(formData.get("confirmGroupMention")) === "1");

const publishStatusError = (
  post: { readonly contentJson: unknown },
  formData: FormData
) =>
  documentHasGroupMention(post.contentJson) &&
  textValue(formData.get("confirmGroupMention")) !== "1"
    ? "Abra o editor para revisar e confirmar as notificações do grupo."
    : "Abra o editor, adicione um título e algum conteúdo antes de publicar.";

const documentAssetPaths = (value: unknown, result = new Set<string>()) => {
  if (!value || typeof value !== "object") {
    return result;
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      documentAssetPaths(child, result);
    }
    return result;
  }
  const record = value as Record<string, unknown>;
  if (record.attrs && typeof record.attrs === "object") {
    const src = (record.attrs as Record<string, unknown>).src;
    const path = memberAssetPathFromUrl(typeof src === "string" ? src : null);
    if (
      path?.startsWith("community-assets/inline/") ||
      path?.startsWith("community-assets/attachments/")
    ) {
      result.add(path);
    }
  }
  for (const child of Object.values(record)) {
    documentAssetPaths(child, result);
  }
  return result;
};

const cleanupRemovedAssets = async ({
  memberId,
  previousCoverUrl,
  previousContentJson,
  nextCoverUrl,
  nextContentJson,
}: {
  readonly memberId: string;
  readonly previousCoverUrl: string | null;
  readonly previousContentJson: unknown;
  readonly nextCoverUrl: string | null;
  readonly nextContentJson: unknown;
}) => {
  const previousPaths = documentAssetPaths(previousContentJson);
  const previousCoverPath = memberAssetPathFromUrl(previousCoverUrl);
  if (previousCoverPath?.startsWith("community-assets/covers/")) {
    previousPaths.add(previousCoverPath);
  }
  const nextPaths = documentAssetPaths(nextContentJson);
  const nextCoverPath = memberAssetPathFromUrl(nextCoverUrl);
  if (nextCoverPath) {
    nextPaths.add(nextCoverPath);
  }
  await Promise.all(
    [...previousPaths]
      .filter(
        (path) => !nextPaths.has(path) && isOwnedMemberAssetPath(path, memberId)
      )
      .map((path) => deleteMemberAsset(path))
  );
};

const excerptFrom = (content: string) => {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 360 ? `${normalized.slice(0, 357)}…` : normalized;
};

const publishedPostWhere = async (
  postId: string,
  memberId: string,
  spaceSlug?: string,
  transaction?: Prisma.TransactionClient
) => {
  const member = await (transaction ?? database).member.findUnique({
    where: { id: memberId },
    select: { deactivatedAt: true, role: true },
  });
  if (!member || member.deactivatedAt) {
    return { id: `inactive-member:${memberId}` };
  }
  const canModeratePrivateGroups = canModerate(member.role);
  return {
    id: postId,
    status: ContentStatus.PUBLISHED,
    deletedAt: null,
    ...(spaceSlug
      ? {
          space: {
            is: {
              slug: spaceSlug,
              status: ContentStatus.PUBLISHED,
              ...communitySpaceMemberAudienceWhere(
                memberId,
                canModeratePrivateGroups
              ),
            },
          },
        }
      : communityPostMutationAudienceWhere(memberId, canModeratePrivateGroups)),
  };
};

const publishedSpace = async (
  spaceId: string,
  memberId: string,
  spaceSlug?: string
) => {
  if (!spaceId) {
    return null;
  }
  const role = await getMemberRole(memberId);
  return database.communitySpace.findFirst({
    where: {
      id: spaceId,
      status: ContentStatus.PUBLISHED,
      ...communitySpaceMemberAudienceWhere(memberId, canModerate(role)),
      ...(spaceSlug ? { slug: spaceSlug } : {}),
    },
    select: { id: true, slug: true, visibility: true, ownerId: true },
  });
};

const spaceData = async (formData: FormData, memberId: string) => {
  const spaceId = textValue(formData.get("spaceId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const space = await publishedSpace(spaceId, memberId, spaceSlug || undefined);
  if ((spaceId || spaceSlug) && !space) {
    redirect("/comunidade");
  }
  return { spaceId: space?.id ?? null, space };
};

const communityHref = (post: {
  readonly id: string;
  readonly slug: string | null;
  readonly space: { readonly slug: string } | null;
}) => {
  if (post.slug) {
    return `/comunidade/publicacoes/${post.slug}`;
  }
  if (post.space) {
    return `/comunidade/${post.space.slug}/${post.id}`;
  }
  return `/comunidade/publicacoes/${post.id}`;
};

const revalidateCommunity = (
  spaceSlug?: string,
  postId?: string,
  slug?: string
) => {
  revalidatePath("/comunidade");
  revalidatePath("/comunidade/meus-topicos");
  revalidatePath("/comunidade/minhas-publicacoes");
  revalidatePath("/comunidade/salvos");
  revalidatePath("/membros");
  if (spaceSlug) {
    revalidatePath(`/comunidade/${spaceSlug}`);
    revalidatePath(`/comunidade/grupos/${spaceSlug}`);
  }
  if (spaceSlug && postId) {
    revalidatePath(`/comunidade/${spaceSlug}/${postId}`);
  }
  if (postId) {
    revalidatePath(`/comunidade/editor/${postId}`);
  }
  if (slug) {
    revalidatePath(`/comunidade/publicacoes/${slug}`);
  }
};

const canModerate = (role: string) => role === "TEACHER" || role === "ADMIN";

const canManagePost = (authorId: string, userId: string, role: string) =>
  authorId === userId || canModerate(role);

const ensureTopicFollow = (userId: string, topicId: string) =>
  database.topicFollow.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: { userId, topicId },
    // A reply should follow a discussion automatically, but it must not
    // silently undo a deliberate mute chosen by the member.
    update: {},
    select: { id: true },
  });

export const startDraft = async (formData: FormData) => {
  const userId = await currentUserId();
  const idempotencyKey = readIdempotencyKeyFromForm(formData);
  if (!(userId && idempotencyKey)) {
    redirect("/comunidade");
  }
  const { spaceId } = await spaceData(formData, userId);
  const returnTo = safeCommunityReturnPath(textValue(formData.get("returnTo")));
  const existing = await database.communityPost.findUnique({
    where: {
      authorId_idempotencyKey: { authorId: userId, idempotencyKey },
    },
    select: { id: true, deletedAt: true, slug: true, status: true },
  });
  if (existing) {
    if (existing.deletedAt) {
      redirect("/comunidade/minhas-publicacoes");
    }
    if (existing.status === ContentStatus.PUBLISHED && existing.slug) {
      redirect(`/comunidade/publicacoes/${existing.slug}`);
    }
    const editorQuery = returnTo
      ? `?${new URLSearchParams({ from: returnTo }).toString()}`
      : "";
    redirect(`/comunidade/editor/${existing.id}${editorQuery}`);
  }
  const search = new URLSearchParams({ idempotencyKey });
  if (spaceId) {
    search.set("spaceId", spaceId);
  }
  if (returnTo) {
    search.set("returnTo", returnTo);
  }
  redirect(`/comunidade/novo?${search.toString()}`);
};

export const createPost = async (formData: FormData) => {
  const userId = await currentUserId();
  const idempotencyKey = readIdempotencyKeyFromForm(formData);
  if (!(userId && idempotencyKey)) {
    return;
  }
  const { space } = await spaceData(formData, userId);
  const { document, plainText } = contentFromForm(formData);
  if (
    documentHasGroupMention(document) &&
    textValue(formData.get("confirmGroupMention")) !== "1"
  ) {
    return;
  }
  const parsed = postInput.safeParse({
    title: textValue(formData.get("title")),
    content: plainText,
  });
  if (!parsed.success) {
    return;
  }
  const existing = await database.communityPost.findUnique({
    where: {
      authorId_idempotencyKey: { authorId: userId, idempotencyKey },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      contentJson: true,
      space: { select: { slug: true } },
    },
  });
  if (existing) {
    await ensureTopicFollow(userId, existing.id);
    await notifyCommunityPost({
      actorId: userId,
      postId: existing.id,
      postTitle: existing.title,
      commentContent: existing.content,
      document: existing.contentJson,
      href: communityHref(existing),
    });
    redirect(communityHref(existing));
  }
  await consumeMutationRateLimit({
    action: "community.post.create",
    memberId: userId,
  });
  await getOrCreateProfile(userId);
  const persistedDocument = await enrichCommunityArticleMetadata(document);
  const slug = await uniquePostSlug(parsed.data.title);
  const publishedAt = new Date();
  let post: {
    id: string;
    slug: string | null;
    space: { slug: string } | null;
  };
  try {
    post = await database.$transaction(async (transaction) => {
      const created = await transaction.communityPost.create({
        data: {
          spaceId: space?.id ?? null,
          authorId: userId,
          idempotencyKey,
          kind: "DISCUSSION",
          title: parsed.data.title,
          subtitle: textValue(formData.get("subtitle")) || null,
          coverUrl: safeImageUrl(textValue(formData.get("coverUrl")), userId),
          content: parsed.data.content,
          excerpt: excerptFrom(parsed.data.content),
          contentJson: persistedDocument as Prisma.InputJsonValue | undefined,
          tags: parseTags(formData.get("tags")),
          slug,
          status: ContentStatus.PUBLISHED,
          publishedAt,
        },
        select: { id: true, slug: true, space: { select: { slug: true } } },
      });
      if (space) {
        await enqueueCommunityGroupPostNotifications(transaction, {
          actorId: userId,
          groupId: space.id,
          occurredAt: publishedAt,
          postId: created.id,
          href: communityHref(created),
        });
      }
      await evaluateMemberBadges(transaction, userId, publishedAt, {
        criteria: [BadgeCriterion.COMMUNITY_PUBLICATIONS],
        force: true,
      });
      return created;
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const canonical = await database.communityPost.findUnique({
      where: {
        authorId_idempotencyKey: { authorId: userId, idempotencyKey },
      },
      select: { id: true, slug: true, space: { select: { slug: true } } },
    });
    if (!canonical) {
      throw error;
    }
    redirect(communityHref(canonical));
  }
  await dispatchPendingNotifications();
  await ensureTopicFollow(userId, post.id);
  await notifyCommunityPost({
    actorId: userId,
    postId: post.id,
    postTitle: parsed.data.title,
    commentContent: parsed.data.content,
    document: persistedDocument,
    href: communityHref(post),
  });
  revalidateCommunity(space?.slug, post.id, post.slug ?? undefined);
  redirect(communityHref(post));
};

interface CommunityWriteError {
  readonly code: "conflict" | "unavailable";
  readonly currentPostId?: string;
  readonly currentUpdatedAt?: string;
  readonly error: string;
  readonly ok: false;
}

type CommunityDraftSaveResult =
  | {
      readonly ok: true;
      readonly postId: string | null;
      readonly saved: boolean;
      readonly spaceSlug: string;
      readonly updatedAt: string | null;
    }
  | CommunityWriteError;

const draftSaveConflict = (
  updatedAt?: Date,
  postId?: string
): CommunityWriteError => ({
  code: "conflict",
  ...(updatedAt ? { currentUpdatedAt: updatedAt.toISOString() } : {}),
  ...(postId ? { currentPostId: postId } : {}),
  error:
    "Este rascunho mudou em outra aba. Recarregue a versão salva ou escolha manter esta versão.",
  ok: false,
});

const communityDraftSnapshotFromPost = (post: {
  content: string;
  contentJson: unknown;
  coverAltText?: string | null;
  coverUrl: string | null;
  spaceId: string | null;
  subtitle: string | null;
  tags: string[];
  title: string;
}): CommunityDraftSnapshot => ({
  content: post.content,
  contentJson: post.contentJson,
  coverAltText: post.coverAltText ?? "",
  coverUrl: post.coverUrl,
  spaceId: post.spaceId,
  subtitle: post.subtitle,
  tags: post.tags,
  title: post.title,
});

const communityDraftRecordSelect = {
  id: true,
  authorId: true,
  content: true,
  contentJson: true,
  ...communityCoverAltSelect,
  coverUrl: true,
  deletedAt: true,
  spaceId: true,
  status: true,
  subtitle: true,
  tags: true,
  title: true,
  updatedAt: true,
  space: { select: { slug: true } },
} satisfies Prisma.CommunityPostSelect;

type CommunityDraftRecord = Prisma.CommunityPostGetPayload<{
  select: typeof communityDraftRecordSelect;
}>;

const findDraftByIdempotencyKey = (authorId: string, idempotencyKey: string) =>
  database.communityPost.findUnique({
    where: { authorId_idempotencyKey: { authorId, idempotencyKey } },
    select: communityDraftRecordSelect,
  });

const unavailableDraft = (error: string): CommunityWriteError => ({
  code: "unavailable",
  error,
  ok: false,
});

const existingDraftSaveResult = async (
  userId: string,
  snapshot: CommunityDraftSnapshot,
  post: CommunityDraftRecord,
  spaceSlug: string
): Promise<CommunityDraftSaveResult> => {
  if (
    post.authorId !== userId ||
    post.deletedAt ||
    post.status !== ContentStatus.DRAFT
  ) {
    return unavailableDraft(
      "Este rascunho não está mais disponível para edição."
    );
  }
  if (
    !communityDraftSnapshotsEqual(
      snapshot,
      communityDraftSnapshotFromPost(post)
    )
  ) {
    return draftSaveConflict(post.updatedAt, post.id);
  }
  await ensureTopicFollow(userId, post.id);
  return {
    ok: true,
    postId: post.id,
    saved: true,
    spaceSlug: spaceSlug || post.space?.slug || "",
    updatedAt: post.updatedAt.toISOString(),
  };
};

const saveNewCommunityDraft = async ({
  idempotencyKey,
  snapshot,
  spaceSlug,
  userId,
}: {
  readonly idempotencyKey: string;
  readonly snapshot: CommunityDraftSnapshot;
  readonly spaceSlug: string;
  readonly userId: string;
}): Promise<CommunityDraftSaveResult> => {
  const existing = await findDraftByIdempotencyKey(userId, idempotencyKey);
  if (existing) {
    return existingDraftSaveResult(userId, snapshot, existing, spaceSlug);
  }

  await getOrCreateProfile(userId);
  try {
    const post = await database.communityPost.create({
      data: {
        spaceId: snapshot.spaceId,
        authorId: userId,
        idempotencyKey,
        kind: "DISCUSSION",
        title: snapshot.title,
        subtitle: snapshot.subtitle,
        ...(communityCoverAltEnabled
          ? { coverAltText: snapshot.coverAltText }
          : {}),
        coverUrl: snapshot.coverUrl,
        content: snapshot.content,
        excerpt: excerptFrom(snapshot.content),
        contentJson: snapshot.contentJson as Prisma.InputJsonValue,
        tags: [...snapshot.tags],
        status: ContentStatus.DRAFT,
      },
      select: {
        id: true,
        updatedAt: true,
        space: { select: { slug: true } },
      },
    });
    await ensureTopicFollow(userId, post.id);
    revalidateCommunity(spaceSlug, post.id);
    return {
      ok: true,
      postId: post.id,
      saved: true,
      spaceSlug: spaceSlug || post.space?.slug || "",
      updatedAt: post.updatedAt.toISOString(),
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const racedPost = await findDraftByIdempotencyKey(userId, idempotencyKey);
    if (!racedPost) {
      return draftSaveConflict();
    }
    return existingDraftSaveResult(userId, snapshot, racedPost, spaceSlug);
  }
};

const savedExistingDraftResult = (
  postId: string,
  updatedAt: Date,
  spaceSlug: string
): CommunityDraftSaveResult => ({
  ok: true,
  postId,
  saved: true,
  spaceSlug,
  updatedAt: updatedAt.toISOString(),
});

const updateExistingCommunityDraft = async ({
  expectedUpdatedAtText,
  postId,
  snapshot,
  spaceSlug,
  userId,
}: {
  readonly expectedUpdatedAtText: string;
  readonly postId: string;
  readonly snapshot: CommunityDraftSnapshot;
  readonly spaceSlug: string;
  readonly userId: string;
}): Promise<CommunityDraftSaveResult> => {
  const post = await database.communityPost.findFirst({
    where: {
      id: postId,
      authorId: userId,
      status: ContentStatus.DRAFT,
      deletedAt: null,
    },
    select: communityDraftRecordSelect,
  });
  if (!post) {
    return unavailableDraft("Você não pode editar este rascunho.");
  }

  const expectedUpdatedAt = new Date(expectedUpdatedAtText);
  if (
    !(expectedUpdatedAtText && Number.isFinite(expectedUpdatedAt.getTime()))
  ) {
    return draftSaveConflict(post.updatedAt, post.id);
  }
  if (post.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return communityDraftSnapshotsEqual(
      snapshot,
      communityDraftSnapshotFromPost(post)
    )
      ? savedExistingDraftResult(post.id, post.updatedAt, spaceSlug)
      : draftSaveConflict(post.updatedAt, post.id);
  }

  const updatedAt = nextCommunityPostVersion(expectedUpdatedAt);
  const result = await database.communityPost.updateMany({
    where: {
      id: post.id,
      authorId: userId,
      status: ContentStatus.DRAFT,
      deletedAt: null,
      updatedAt: expectedUpdatedAt,
    },
    data: {
      content: snapshot.content,
      contentJson: snapshot.contentJson as Prisma.InputJsonValue,
      excerpt: excerptFrom(snapshot.content),
      ...(communityCoverAltEnabled
        ? { coverAltText: snapshot.coverAltText }
        : {}),
      coverUrl: snapshot.coverUrl,
      spaceId: snapshot.spaceId,
      subtitle: snapshot.subtitle,
      title: snapshot.title,
      tags: [...snapshot.tags],
      updatedAt,
    },
  });
  if (result.count !== 1) {
    const latest = await database.communityPost.findFirst({
      where: { id: post.id, authorId: userId, deletedAt: null },
      select: communityDraftRecordSelect,
    });
    if (
      latest?.status === ContentStatus.DRAFT &&
      communityDraftSnapshotsEqual(
        snapshot,
        communityDraftSnapshotFromPost(latest)
      )
    ) {
      return savedExistingDraftResult(latest.id, latest.updatedAt, spaceSlug);
    }
    return draftSaveConflict(latest?.updatedAt, latest?.id);
  }

  await cleanupRemovedAssets({
    memberId: userId,
    previousCoverUrl: post.coverUrl,
    previousContentJson: post.contentJson,
    nextCoverUrl: snapshot.coverUrl,
    nextContentJson: snapshot.contentJson,
  });
  revalidateCommunity(post.space?.slug, post.id);
  revalidateCommunity(spaceSlug, post.id);
  return savedExistingDraftResult(post.id, updatedAt, spaceSlug);
};

const communityDraftSnapshotFromForm = async (
  formData: FormData,
  userId: string
): Promise<
  | {
      readonly ok: true;
      readonly snapshot: CommunityDraftSnapshot;
      readonly spaceSlug: string;
    }
  | CommunityWriteError
> => {
  const { spaceId, space } = await spaceData(formData, userId);
  const { document, plainText } = contentFromForm(formData);
  const rawDocument =
    textValue(formData.get("contentJson")) ||
    textValue(formData.get("contentDocument"));
  if (rawDocument && !document) {
    return unavailableDraft(
      "O conteúdo do editor não pôde ser lido. Tente novamente."
    );
  }
  return {
    ok: true,
    snapshot: {
      content: plainText.slice(0, 40_000),
      contentJson: (document ?? emptyDocument) as Prisma.InputJsonValue,
      coverAltText: communityCoverAltValue(
        textValue(formData.get("coverAltText"))
      ),
      coverUrl: safeImageUrl(textValue(formData.get("coverUrl")), userId),
      spaceId,
      subtitle: textValue(formData.get("subtitle")).slice(0, 1000) || null,
      tags: parseTags(formData.get("tags")),
      title: (textValue(formData.get("title")) || draftTitle).slice(0, 180),
    },
    spaceSlug: space?.slug ?? "",
  };
};

export const updateDraft = async (
  formData: FormData
): Promise<CommunityDraftSaveResult> => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const idempotencyKey = readIdempotencyKeyFromForm(formData);
  if (!(userId && (postId || idempotencyKey))) {
    return unavailableDraft("Rascunho indisponível.");
  }
  const prepared = await communityDraftSnapshotFromForm(formData, userId);
  if (!prepared.ok) {
    return prepared;
  }
  const { snapshot, spaceSlug } = prepared;
  if (!(postId || hasCommunityDraftContent(snapshot, draftTitle))) {
    return {
      ok: true,
      postId: null,
      saved: false,
      spaceSlug,
      updatedAt: null,
    };
  }
  if (!(postId || idempotencyKey)) {
    return unavailableDraft(
      "A chave de criação expirou. Abra uma nova publicação."
    );
  }
  await consumeMutationRateLimit({
    action: postId ? "community.mutation" : "community.post.create",
    memberId: userId,
  });
  if (postId) {
    return updateExistingCommunityDraft({
      expectedUpdatedAtText: textValue(formData.get("expectedUpdatedAt")),
      postId,
      snapshot,
      spaceSlug,
      userId,
    });
  }
  return saveNewCommunityDraft({
    idempotencyKey: idempotencyKey as string,
    snapshot,
    spaceSlug,
    userId,
  });
};

export const createDraft = async (formData: FormData) => updateDraft(formData);

export const publishPost = async (
  formData: FormData
): Promise<
  { readonly ok: true; readonly href: string } | CommunityWriteError
> => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  if (!(userId && postId)) {
    return {
      code: "unavailable",
      error: "Não foi possível publicar agora.",
      ok: false,
    };
  }
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  const { spaceId, space } = await spaceData(formData, userId);
  const { document, plainText } = contentFromForm(formData);
  if (
    documentHasGroupMention(document) &&
    textValue(formData.get("confirmGroupMention")) !== "1"
  ) {
    return {
      code: "unavailable",
      error: "Confirme que deseja notificar o grupo antes de publicar.",
      ok: false,
    };
  }
  const parsed = postInput.safeParse({
    title: textValue(formData.get("title")),
    content: plainText,
  });
  if (!parsed.success) {
    return {
      code: "unavailable",
      error: "Adicione um título e algum conteúdo antes de publicar.",
      ok: false,
    };
  }
  const post = await database.communityPost.findFirst({
    where: {
      id: postId,
      authorId: userId,
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
      slug: true,
      title: true,
      content: true,
      subtitle: true,
      tags: true,
      spaceId: true,
      publishedAt: true,
      updatedAt: true,
      coverUrl: true,
      ...communityCoverAltSelect,
      contentJson: true,
      space: { select: { slug: true } },
    },
  });
  if (!post) {
    return {
      code: "unavailable",
      error: "Você não pode publicar este rascunho.",
      ok: false,
    };
  }
  if (post.status === ContentStatus.PUBLISHED && post.slug) {
    return { ok: true, href: communityHref(post) };
  }
  if (
    post.status !== ContentStatus.DRAFT &&
    post.status !== ContentStatus.ARCHIVED
  ) {
    return {
      code: "unavailable",
      error: "Você não pode publicar este conteúdo agora.",
      ok: false,
    };
  }
  const expectedUpdatedAtText = textValue(formData.get("expectedUpdatedAt"));
  const expectedUpdatedAt = new Date(expectedUpdatedAtText);
  if (
    !(expectedUpdatedAtText && Number.isFinite(expectedUpdatedAt.getTime())) ||
    post.updatedAt.getTime() !== expectedUpdatedAt.getTime()
  ) {
    return draftSaveConflict(post.updatedAt, post.id);
  }
  const persistedDocument = await enrichCommunityArticleMetadata(document);
  const slug = post.slug ?? (await uniquePostSlug(parsed.data.title, post.id));
  const publishedAt = post.publishedAt ?? new Date();
  const role = await getMemberRole(userId);
  const updatedPost = await database.$transaction(async (transaction) => {
    if (
      spaceId &&
      !(await transaction.communitySpace.findFirst({
        where: {
          id: spaceId,
          status: ContentStatus.PUBLISHED,
          ...communitySpaceMemberAudienceWhere(userId, canModerate(role)),
        },
        select: { id: true },
      }))
    ) {
      return { conflict: false as const, inaccessible: true as const };
    }
    const updatedAt = nextCommunityPostVersion(expectedUpdatedAt);
    const published = await transaction.communityPost.updateMany({
      where: {
        id: post.id,
        authorId: userId,
        deletedAt: null,
        status: post.status,
        updatedAt: expectedUpdatedAt,
      },
      data: {
        spaceId,
        title: parsed.data.title,
        subtitle: textValue(formData.get("subtitle")).slice(0, 1000) || null,
        ...(communityCoverAltEnabled
          ? {
              coverAltText: communityCoverAltValue(
                textValue(formData.get("coverAltText"))
              ),
            }
          : {}),
        coverUrl: safeImageUrl(textValue(formData.get("coverUrl")), userId),
        content: parsed.data.content,
        excerpt: excerptFrom(parsed.data.content),
        contentJson: persistedDocument as Prisma.InputJsonValue | undefined,
        tags: parseTags(formData.get("tags")),
        slug,
        status: ContentStatus.PUBLISHED,
        publishedAt,
        updatedAt,
      },
    });
    if (published.count !== 1) {
      return { conflict: true as const, inaccessible: false as const };
    }
    if (space) {
      await enqueueCommunityGroupPostNotifications(transaction, {
        actorId: userId,
        groupId: space.id,
        occurredAt: publishedAt,
        postId: post.id,
        href: `/comunidade/publicacoes/${slug}`,
      });
    }
    await evaluateMemberBadges(transaction, userId, publishedAt, {
      criteria: [BadgeCriterion.COMMUNITY_PUBLICATIONS],
      force: true,
    });
    return { conflict: false as const, inaccessible: false as const };
  });
  if (updatedPost.inaccessible) {
    return {
      code: "unavailable",
      error: "Você não pode publicar neste grupo.",
      ok: false,
    };
  }
  if (updatedPost.conflict) {
    const latest = await database.communityPost.findFirst({
      where: { id: post.id, authorId: userId, deletedAt: null },
      select: { id: true, updatedAt: true },
    });
    return draftSaveConflict(latest?.updatedAt, latest?.id);
  }
  await dispatchPendingNotifications();
  await ensureTopicFollow(userId, post.id);
  await notifyCommunityPost({
    actorId: userId,
    postId: post.id,
    postTitle: parsed.data.title,
    commentContent: parsed.data.content,
    document: persistedDocument,
    href: `/comunidade/publicacoes/${slug}`,
  });
  const nextCoverUrl = safeImageUrl(
    textValue(formData.get("coverUrl")),
    userId
  );
  await cleanupRemovedAssets({
    memberId: userId,
    previousCoverUrl: post.coverUrl,
    previousContentJson: post.contentJson,
    nextCoverUrl,
    nextContentJson: document,
  });
  revalidateCommunity(post.space?.slug, post.id, slug);
  revalidateCommunity(space?.slug, post.id, slug);
  return { ok: true, href: `/comunidade/publicacoes/${slug}` };
};

const editableCommunityPostSelect = {
  id: true,
  authorId: true,
  slug: true,
  status: true,
  coverUrl: true,
  ...communityCoverAltSelect,
  contentJson: true,
  spaceId: true,
  title: true,
  subtitle: true,
  tags: true,
  content: true,
  updatedAt: true,
  space: { select: { slug: true } },
} satisfies Prisma.CommunityPostSelect;

type EditableCommunityPost = Prisma.CommunityPostGetPayload<{
  select: typeof editableCommunityPostSelect;
}>;

const persistCommunityPostUpdate = async ({
  expectedUpdatedAt,
  post,
  snapshot,
  spaceSlug,
  userId,
}: {
  readonly expectedUpdatedAt: Date;
  readonly post: EditableCommunityPost;
  readonly snapshot: CommunityDraftSnapshot;
  readonly spaceSlug: string;
  readonly userId: string;
}): Promise<
  { readonly ok: true; readonly updatedAt: string } | CommunityWriteError
> => {
  const savedSnapshot = communityDraftSnapshotFromPost(post);
  if (post.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return communityDraftSnapshotsEqual(snapshot, savedSnapshot)
      ? { ok: true, updatedAt: post.updatedAt.toISOString() }
      : draftSaveConflict(post.updatedAt, post.id);
  }

  const slug =
    post.status === ContentStatus.PUBLISHED
      ? (post.slug ?? (await uniquePostSlug(snapshot.title, post.id)))
      : post.slug;
  const updatedAt = nextCommunityPostVersion(expectedUpdatedAt);
  const result = await database.communityPost.updateMany({
    where: {
      id: post.id,
      updatedAt: expectedUpdatedAt,
      deletedAt: null,
      status: post.status,
    },
    data: {
      content: snapshot.content,
      ...(communityCoverAltEnabled
        ? { coverAltText: snapshot.coverAltText }
        : {}),
      coverUrl: snapshot.coverUrl,
      spaceId: snapshot.spaceId,
      subtitle: snapshot.subtitle,
      title: snapshot.title,
      contentJson: snapshot.contentJson as Prisma.InputJsonValue,
      tags: [...snapshot.tags],
      excerpt: excerptFrom(snapshot.content),
      slug,
      updatedAt,
      editedAt: new Date(),
    },
  });
  if (result.count !== 1) {
    const latest = await database.communityPost.findFirst({
      where: { id: post.id, authorId: post.authorId, deletedAt: null },
      select: editableCommunityPostSelect,
    });
    if (
      latest &&
      communityDraftSnapshotsEqual(
        snapshot,
        communityDraftSnapshotFromPost(latest)
      )
    ) {
      return { ok: true, updatedAt: latest.updatedAt.toISOString() };
    }
    return draftSaveConflict(latest?.updatedAt, latest?.id);
  }

  if (post.status === ContentStatus.PUBLISHED) {
    await notifyCommunityPost({
      actorId: userId,
      postId: post.id,
      postTitle: snapshot.title,
      commentContent: snapshot.content,
      document: snapshot.contentJson,
      href: slug
        ? `/comunidade/publicacoes/${slug}`
        : `/comunidade/publicacoes/${post.id}`,
    });
  }
  await cleanupRemovedAssets({
    memberId: userId,
    previousCoverUrl: post.coverUrl,
    previousContentJson: post.contentJson,
    nextCoverUrl: snapshot.coverUrl,
    nextContentJson: snapshot.contentJson,
  });
  revalidateCommunity(post.space?.slug, post.id, slug ?? undefined);
  revalidateCommunity(spaceSlug, post.id, slug ?? undefined);
  return { ok: true, updatedAt: updatedAt.toISOString() };
};

export const updatePost = async (
  formData: FormData
): Promise<
  { readonly ok: true; readonly updatedAt: string } | CommunityWriteError
> => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  if (!(userId && postId)) {
    return {
      code: "unavailable",
      error: "Esta publicação não está disponível para edição.",
      ok: false,
    };
  }
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  const { spaceId, space } = await spaceData(formData, userId);
  const { document, plainText } = contentFromForm(formData);
  if (
    documentHasGroupMention(document) &&
    textValue(formData.get("confirmGroupMention")) !== "1"
  ) {
    return {
      code: "unavailable",
      error: "Confirme que deseja notificar o grupo antes de salvar.",
      ok: false,
    };
  }
  const parsed = postInput.safeParse({
    title: textValue(formData.get("title")),
    content: plainText,
  });
  if (!parsed.success) {
    return {
      code: "unavailable",
      error: "Adicione um título e algum conteúdo antes de salvar.",
      ok: false,
    };
  }
  const role = await getMemberRole(userId);
  const post = await database.communityPost.findFirst({
    where: { id: postId, deletedAt: null },
    select: editableCommunityPostSelect,
  });
  if (
    !post ||
    (post.authorId !== userId &&
      !(post.status === ContentStatus.PUBLISHED && canModerate(role)))
  ) {
    return {
      code: "unavailable",
      error: "Você não pode editar esta publicação.",
      ok: false,
    };
  }
  const expectedUpdatedAtText = textValue(formData.get("expectedUpdatedAt"));
  const expectedUpdatedAt = new Date(expectedUpdatedAtText);
  if (
    !(expectedUpdatedAtText && Number.isFinite(expectedUpdatedAt.getTime()))
  ) {
    return draftSaveConflict(post.updatedAt, post.id);
  }
  const persistedDocument = await enrichCommunityArticleMetadata(document);
  const snapshot: CommunityDraftSnapshot = {
    content: parsed.data.content,
    contentJson: persistedDocument,
    coverAltText: communityCoverAltValue(
      textValue(formData.get("coverAltText"))
    ),
    coverUrl: safeImageUrl(textValue(formData.get("coverUrl")), userId),
    spaceId,
    subtitle: textValue(formData.get("subtitle")).slice(0, 1000) || null,
    tags: parseTags(formData.get("tags")),
    title: parsed.data.title,
  };
  return persistCommunityPostUpdate({
    expectedUpdatedAt,
    post,
    snapshot,
    spaceSlug: space?.slug ?? "",
    userId,
  });
};

interface CommunityPostStatusTarget {
  readonly authorId: string;
  readonly content: string;
  readonly contentJson: Prisma.JsonValue;
  readonly publishedAt: Date | null;
  readonly slug: string | null;
  readonly space: { readonly id: string; readonly slug: string } | null;
  readonly status: ContentStatus;
  readonly title: string;
}

const canChangePostStatus = (
  post: CommunityPostStatusTarget | null,
  userId: string,
  role: string,
  requestedStatus: ContentStatus
): post is CommunityPostStatusTarget =>
  Boolean(
    post &&
      (post.authorId === userId ||
        (requestedStatus === ContentStatus.ARCHIVED && canModerate(role)))
  );

const redirectAfterPostStatusChange = (
  status: ContentStatus,
  slug: string | null,
  postId: string
): never => {
  if (status === ContentStatus.ARCHIVED) {
    redirect("/comunidade/minhas-publicacoes?status=archived");
  }
  if (status === ContentStatus.DRAFT) {
    redirect("/comunidade/minhas-publicacoes?status=drafts");
  }
  redirect(`/comunidade/publicacoes/${slug ?? postId}`);
};

const persistCommunityPostStatus = async ({
  post,
  postId,
  requestedStatus,
  userId,
}: {
  readonly post: CommunityPostStatusTarget;
  readonly postId: string;
  readonly requestedStatus: ContentStatus;
  readonly userId: string;
}) => {
  const slug =
    requestedStatus === ContentStatus.PUBLISHED
      ? (post.slug ?? (await uniquePostSlug(post.title, postId)))
      : post.slug;
  const publishedAt = post.publishedAt ?? new Date();
  await database.$transaction(async (transaction) => {
    await transaction.communityPost.update({
      where: { id: postId },
      data: {
        status: requestedStatus,
        ...(requestedStatus === ContentStatus.ARCHIVED
          ? { isPinned: false }
          : {}),
        ...(requestedStatus === ContentStatus.PUBLISHED
          ? { publishedAt, slug }
          : {}),
      },
    });
    if (
      requestedStatus === ContentStatus.PUBLISHED &&
      post.space &&
      post.publishedAt === null
    ) {
      await enqueueCommunityGroupPostNotifications(transaction, {
        actorId: userId,
        groupId: post.space.id,
        occurredAt: publishedAt,
        postId,
        href: slug
          ? `/comunidade/publicacoes/${slug}`
          : `/comunidade/${post.space.slug}/${postId}`,
      });
    }
    if (
      requestedStatus === ContentStatus.PUBLISHED &&
      post.status !== ContentStatus.PUBLISHED
    ) {
      await evaluateMemberBadges(transaction, post.authorId, publishedAt, {
        criteria: [BadgeCriterion.COMMUNITY_PUBLICATIONS],
        force: true,
      });
    }
  });
  if (requestedStatus === ContentStatus.PUBLISHED) {
    await dispatchPendingNotifications();
    await ensureTopicFollow(post.authorId, postId);
    await notifyCommunityPost({
      actorId: userId,
      postId,
      postTitle: post.title,
      commentContent: post.content,
      document: post.contentJson,
      href: `/comunidade/publicacoes/${slug ?? postId}`,
    });
  }
  return slug;
};

export const setPostStatus = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const requestedStatus = textValue(formData.get("status"));
  if (
    !(
      userId &&
      postId &&
      Object.values(ContentStatus).includes(requestedStatus as ContentStatus)
    )
  ) {
    return {
      ok: false as const,
      error: "Não foi possível atualizar esta publicação.",
    };
  }
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  const nextStatus = requestedStatus as ContentStatus;
  const post = await database.communityPost.findFirst({
    where: {
      id: postId,
      deletedAt: null,
      ...(spaceSlug ? { space: { is: { slug: spaceSlug } } } : {}),
    },
    select: {
      authorId: true,
      status: true,
      title: true,
      content: true,
      contentJson: true,
      slug: true,
      publishedAt: true,
      space: { select: { id: true, slug: true } },
    },
  });
  const role = await getMemberRole(userId);
  if (!canChangePostStatus(post, userId, role, nextStatus)) {
    return {
      ok: false as const,
      error: "Você não pode alterar esta publicação.",
    };
  }
  if (post.status === nextStatus) {
    redirectAfterPostStatusChange(nextStatus, post.slug, postId);
  }
  if (
    nextStatus === ContentStatus.PUBLISHED &&
    !publishRequestIsValid(post, formData)
  ) {
    return {
      ok: false as const,
      error: publishStatusError(post, formData),
    };
  }
  const slug = await persistCommunityPostStatus({
    post,
    postId,
    requestedStatus: nextStatus,
    userId,
  });
  revalidateCommunity(post.space?.slug, postId, slug ?? undefined);
  redirectAfterPostStatusChange(nextStatus, slug, postId);
};

export const toggleBookmark = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const desired = textValue(formData.get("desired"));
  if (!(userId && postId && (desired === "on" || desired === "off"))) {
    return { ok: false as const, error: "Não foi possível salvar agora." };
  }
  await consumeMutationRateLimit({
    action: "community.bookmark",
    memberId: userId,
  });
  const post = await database.communityPost.findFirst({
    where: await publishedPostWhere(postId, userId, spaceSlug || undefined),
    select: { id: true, slug: true, space: { select: { slug: true } } },
  });
  if (!post) {
    return {
      ok: false as const,
      error: "Esta publicação não está disponível.",
    };
  }
  if (desired === "on") {
    await database.communityBookmark.upsert({
      where: { postId_memberId: { postId, memberId: userId } },
      create: { postId, memberId: userId },
      update: {},
    });
  } else {
    await database.communityBookmark.deleteMany({
      where: { postId, memberId: userId },
    });
  }
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
  revalidatePath("/salvos");
  return { ok: true as const };
};

export const toggleTopicFollow = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const desired = textValue(formData.get("desired"));
  if (!(userId && postId && (desired === "on" || desired === "off"))) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.follow",
    memberId: userId,
  });
  const post = await database.$transaction(async (transaction) => {
    const visiblePost = await transaction.communityPost.findFirst({
      where: await publishedPostWhere(
        postId,
        userId,
        spaceSlug || undefined,
        transaction
      ),
      select: { id: true, slug: true, space: { select: { slug: true } } },
    });
    if (!visiblePost) {
      return null;
    }
    if (desired === "on") {
      await transaction.topicFollow.upsert({
        where: { userId_topicId: { userId, topicId: postId } },
        create: { userId, topicId: postId },
        update: {},
      });
    } else {
      await transaction.topicFollow.deleteMany({
        where: { userId, topicId: postId },
      });
    }
    return visiblePost;
  });
  if (!post) {
    return;
  }
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
};

export const toggleTopicMute = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const desired = textValue(formData.get("desired"));
  if (!(userId && postId && (desired === "on" || desired === "off"))) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.follow",
    memberId: userId,
  });
  const post = await database.$transaction(async (transaction) => {
    const visiblePost = await transaction.communityPost.findFirst({
      where: await publishedPostWhere(
        postId,
        userId,
        spaceSlug || undefined,
        transaction
      ),
      select: { id: true, slug: true, space: { select: { slug: true } } },
    });
    if (!visiblePost) {
      return null;
    }
    if (desired === "on") {
      const mutedAt = new Date();
      await transaction.topicFollow.upsert({
        where: { userId_topicId: { userId, topicId: postId } },
        create: { userId, topicId: postId, mutedAt },
        update: { mutedAt },
      });
    } else {
      await transaction.topicFollow.updateMany({
        where: { userId, topicId: postId },
        data: { mutedAt: null },
      });
    }
    return visiblePost;
  });
  if (!post) {
    return;
  }
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
};

export const createComment = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const content = textValue(formData.get("content"));
  const { document } = contentFromForm(formData);
  const parentId = textValue(formData.get("parentId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const idempotencyKey = readIdempotencyKeyFromForm(formData);

  if (!userId) {
    return { ok: false as const, error: "Você precisa entrar para comentar." };
  }
  if (!idempotencyKey) {
    return {
      ok: false as const,
      error: "Não foi possível identificar esta tentativa. Tente novamente.",
    };
  }
  if (!(postId && content) || content.length > 10_000) {
    return {
      ok: false as const,
      error: "Escreva um comentário de até 10.000 caracteres.",
    };
  }

  try {
    const result = await createCommunityComment({
      actorId: userId,
      content,
      document: document as Prisma.InputJsonValue | undefined,
      groupMentionConfirmed:
        textValue(formData.get("confirmGroupMention")) === "1",
      idempotencyKey,
      parentId: parentId || null,
      postId,
      spaceSlug: spaceSlug || undefined,
    });
    revalidateCommunity(spaceSlug || undefined, postId);
    return { ok: true as const, ...result };
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return {
        ok: false as const,
        code: "RATE_LIMITED" as const,
        retryAfterSeconds: error.retryAfterSeconds,
        error:
          "Você está fazendo muitas ações em sequência. Tente novamente em alguns segundos.",
      };
    }
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível publicar o comentário.",
    };
  }
};

export const updateComment = async (formData: FormData) => {
  const userId = await currentUserId();
  const commentId = textValue(formData.get("commentId"));
  const postId = textValue(formData.get("postId"));
  const content = textValue(formData.get("content"));
  const { document } = contentFromForm(formData);
  if (
    documentHasGroupMention(document) &&
    textValue(formData.get("confirmGroupMention")) !== "1"
  ) {
    return;
  }
  const spaceSlug = textValue(formData.get("spaceSlug"));
  if (!(userId && commentId && postId && content) || content.length > 10_000) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  const updated = await database.$transaction(async (transaction) => {
    const comment = await transaction.communityComment.findFirst({
      where: {
        id: commentId,
        postId,
        authorId: userId,
        deletedAt: null,
        post: {
          is: await publishedPostWhere(
            postId,
            userId,
            spaceSlug || undefined,
            transaction
          ),
        },
      },
      select: {
        id: true,
        parentId: true,
        content: true,
        contentJson: true,
        createdAt: true,
        updatedAt: true,
        post: {
          select: {
            authorId: true,
            id: true,
            slug: true,
            space: { select: { slug: true } },
            title: true,
          },
        },
      },
    });
    if (!comment) {
      return false;
    }
    if (
      comment.content === content &&
      JSON.stringify(comment.contentJson ?? null) ===
        JSON.stringify(document ?? null)
    ) {
      return false;
    }

    const editedAt = new Date();
    const write = await transaction.communityComment.updateMany({
      where: {
        id: commentId,
        postId,
        authorId: userId,
        deletedAt: null,
        updatedAt: comment.updatedAt,
      },
      data: {
        content,
        contentJson: document as Prisma.InputJsonValue | undefined,
        editedAt,
      },
    });
    if (write.count !== 1) {
      return false;
    }
    if (
      extractMentionIdsFromDocument(document).length > 0 ||
      extractMentionUsernames(content).length > 0
    ) {
      let parentAuthorId: string | null = null;
      if (comment.parentId) {
        const parent = await transaction.communityComment.findUnique({
          where: { id: comment.parentId },
          select: { authorId: true },
        });
        parentAuthorId = parent?.authorId ?? null;
      }
      await notifyCommunityComment({
        actorId: userId,
        postId: comment.post.id,
        commentId: comment.id,
        commentContent: content,
        postAuthorId: comment.post.authorId,
        postTitle: comment.post.title,
        parentCommentId: comment.parentId,
        parentAuthorId,
        href: communityHref(comment.post),
        document,
        occurredAt: editedAt,
        idempotencyKey: `community-comment:${comment.id}:edit:${randomUUID()}`,
        transaction,
      });
    }
    return true;
  });
  if (!updated) {
    return;
  }
  await dispatchPendingNotifications();
  revalidateCommunity(spaceSlug || undefined, postId);
};

export const togglePostVote = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const desired = textValue(formData.get("desired"));
  if (!(userId && postId && (desired === "on" || desired === "off"))) {
    return { ok: false as const, error: "Não foi possível interagir agora." };
  }
  await consumeMutationRateLimit({
    action: "community.vote",
    memberId: userId,
  });
  const post = await database.communityPost.findFirst({
    where: await publishedPostWhere(postId, userId, spaceSlug || undefined),
    select: { id: true, slug: true, space: { select: { slug: true } } },
  });
  if (!post) {
    return {
      ok: false as const,
      error: "Esta publicação não está disponível.",
    };
  }
  if (desired === "on") {
    await database.postVote.upsert({
      where: { postId_memberId: { postId, memberId: userId } },
      create: { postId, memberId: userId, kind: CommunityVoteKind.UP },
      update: {},
    });
  } else {
    await database.postVote.deleteMany({
      where: { postId, memberId: userId },
    });
  }
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
  return { ok: true as const };
};

export const toggleCommentVote = async (formData: FormData) => {
  const userId = await currentUserId();
  const commentId = textValue(formData.get("commentId"));
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const desired = textValue(formData.get("desired"));
  if (
    !(userId && commentId && postId && (desired === "on" || desired === "off"))
  ) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.vote",
    memberId: userId,
  });
  const updated = await database.$transaction(async (transaction) => {
    const comment = await transaction.communityComment.findFirst({
      where: {
        id: commentId,
        postId,
        deletedAt: null,
        post: {
          is: await publishedPostWhere(
            postId,
            userId,
            spaceSlug || undefined,
            transaction
          ),
        },
      },
      select: { id: true },
    });
    if (!comment) {
      return false;
    }
    if (desired === "on") {
      await transaction.commentVote.upsert({
        where: { commentId_memberId: { commentId, memberId: userId } },
        create: { commentId, memberId: userId, kind: CommunityVoteKind.UP },
        update: {},
      });
    } else {
      await transaction.commentVote.deleteMany({
        where: { commentId, memberId: userId },
      });
    }
    return true;
  });
  if (!updated) {
    return;
  }
  revalidateCommunity(spaceSlug || undefined, postId);
};

export const discardCommunityDraft = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  if (!(userId && postId)) {
    return { ok: false as const };
  }
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  const post = await database.communityPost.findFirst({
    where: {
      id: postId,
      authorId: userId,
      status: ContentStatus.DRAFT,
      deletedAt: null,
    },
    select: {
      id: true,
      slug: true,
      updatedAt: true,
      space: { select: { slug: true } },
    },
  });
  if (!post) {
    return { ok: false as const };
  }
  const deletedAt = new Date();
  const deleted = await database.communityPost.updateMany({
    where: {
      id: post.id,
      authorId: userId,
      status: ContentStatus.DRAFT,
      deletedAt: null,
      updatedAt: post.updatedAt,
    },
    data: { deletedAt, isPinned: false },
  });
  if (deleted.count !== 1) {
    return { ok: false as const };
  }
  revalidateCommunity(post.space?.slug, post.id, post.slug ?? undefined);
  revalidatePath("/comunidade/minhas-publicacoes");
  revalidatePath("/admin/community");
  return { deletedAt: deletedAt.toISOString(), ok: true as const };
};

export const softDeletePost = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const returnTo = textValue(formData.get("returnTo"));
  if (!(userId && postId)) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  const post = await database.communityPost.findFirst({
    where: {
      id: postId,
      deletedAt: null,
      ...(spaceSlug ? { space: { is: { slug: spaceSlug } } } : {}),
    },
    select: { authorId: true, slug: true, space: { select: { slug: true } } },
  });
  const role = await getMemberRole(userId);
  if (!(post && canManagePost(post.authorId, userId, role))) {
    return;
  }
  const deletedAt = new Date();
  const deleted = await database.communityPost.updateMany({
    where: { id: postId, deletedAt: null },
    data: { deletedAt, isPinned: false },
  });
  if (deleted.count !== 1) {
    return;
  }
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
  revalidatePath("/comunidade/minhas-publicacoes");
  revalidatePath("/admin/community");
  const adminReturn = returnTo === "/admin/community" && canModerate(role);
  const communityReturn = safeCommunityReturnPath(returnTo);
  if (adminReturn) {
    redirect("/admin/community");
  }
  if (communityReturn?.startsWith("/comunidade/minhas-publicacoes")) {
    const separator = communityReturn.includes("?") ? "&" : "?";
    const undoState = new URLSearchParams({
      undoPost: postId,
      undoUntil: String(deletedAt.getTime() + 8000),
    });
    redirect(`${communityReturn}${separator}${undoState.toString()}`);
  }
  if (communityReturn) {
    redirect(communityReturn);
  }
  if (post.space) {
    redirect(`/comunidade/grupos/${post.space.slug}`);
  }
  redirect("/comunidade");
};

export const undoSoftDeletedPost = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const deletedAtText = textValue(formData.get("deletedAt"));
  const deletedAt = new Date(deletedAtText);
  const now = new Date();
  if (
    !(userId && postId && Number.isFinite(deletedAt.getTime())) ||
    now.getTime() - deletedAt.getTime() > 8000 ||
    deletedAt.getTime() > now.getTime()
  ) {
    return { ok: false as const };
  }
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  const post = await database.communityPost.findFirst({
    where: { id: postId, authorId: userId, deletedAt },
    select: {
      id: true,
      slug: true,
      space: { select: { slug: true } },
    },
  });
  if (!post) {
    return { ok: false as const };
  }
  const restored = await database.communityPost.updateMany({
    where: { id: post.id, authorId: userId, deletedAt },
    data: { deletedAt: null },
  });
  if (restored.count !== 1) {
    return { ok: false as const };
  }
  revalidateCommunity(post.space?.slug, post.id, post.slug ?? undefined);
  revalidatePath("/comunidade/minhas-publicacoes");
  revalidatePath("/admin/community");
  return { ok: true as const };
};

export const restoreCommunityPost = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const postId = textValue(formData.get("postId"));
  if (!postId) {
    return {
      ok: false as const,
      error: "Esta publicação não pode ser recuperada.",
    };
  }
  await consumeMutationRateLimit({
    action: "community.moderation",
    memberId: userId,
  });
  const now = new Date();
  const recoverableSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const post = await database.communityPost.findFirst({
    where: {
      id: postId,
      deletedAt: { gte: recoverableSince, lte: now },
    },
    select: {
      id: true,
      slug: true,
      space: { select: { slug: true } },
    },
  });
  if (!post) {
    return {
      ok: false as const,
      error: "O prazo de recuperação terminou ou a publicação já voltou.",
    };
  }
  const restored = await database.communityPost.updateMany({
    where: {
      id: postId,
      deletedAt: { gte: recoverableSince, lte: now },
    },
    data: { deletedAt: null, isPinned: false },
  });
  if (restored.count !== 1) {
    return {
      ok: false as const,
      error: "A publicação foi alterada por outra pessoa. Atualize a lista.",
    };
  }
  revalidateCommunity(post.space?.slug, post.id, post.slug ?? undefined);
  revalidatePath("/comunidade/minhas-publicacoes");
  revalidatePath("/admin/community");
  redirect("/admin/community");
};

export const softDeleteComment = async (formData: FormData) => {
  const userId = await currentUserId();
  const commentId = textValue(formData.get("commentId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const postId = textValue(formData.get("postId"));
  if (!(userId && commentId && postId)) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  const deleted = await database.$transaction(async (transaction) => {
    const member = await transaction.member.findUnique({
      where: { id: userId },
      select: { deactivatedAt: true, role: true },
    });
    if (!member || member.deactivatedAt) {
      return false;
    }
    const visiblePostWhere = await publishedPostWhere(
      postId,
      userId,
      spaceSlug || undefined,
      transaction
    );
    const comment = await transaction.communityComment.findFirst({
      where: {
        id: commentId,
        postId,
        deletedAt: null,
        post: { is: visiblePostWhere },
      },
      select: { authorId: true },
    });
    if (!(comment && canManagePost(comment.authorId, userId, member.role))) {
      return false;
    }
    const result = await transaction.communityComment.updateMany({
      where: {
        id: commentId,
        postId,
        deletedAt: null,
        post: { is: visiblePostWhere },
        ...(comment.authorId === userId ? { authorId: userId } : {}),
      },
      data: { deletedAt: new Date() },
    });
    return result.count === 1;
  });
  if (!deleted) {
    return;
  }
  revalidateCommunity(spaceSlug || undefined, postId);
};

export const togglePostPin = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const desired = textValue(formData.get("desired"));
  if (!(postId && (desired === "on" || desired === "off"))) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.moderation",
    memberId: userId,
  });
  const post = await database.communityPost.findFirst({
    where: {
      ...(await publishedPostWhere(postId, userId, spaceSlug || undefined)),
    },
    select: {
      id: true,
      slug: true,
      space: { select: { id: true, slug: true } },
    },
  });
  if (!post) {
    return;
  }
  try {
    const pinned = await database.$transaction(async (transaction) => {
      const scopeKey = post.space?.id ?? "global-feed";
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtext('community-post-pin'),
          hashtext(${scopeKey})
        )::text AS lock_acquired
      `;
      if (desired === "on") {
        await transaction.communityPost.updateMany({
          where: {
            id: { not: postId },
            spaceId: post.space?.id ?? null,
            status: ContentStatus.PUBLISHED,
            deletedAt: null,
            isPinned: true,
          },
          data: { isPinned: false },
        });
      }
      const target = await transaction.communityPost.updateMany({
        where: {
          id: postId,
          spaceId: post.space?.id ?? null,
          status: ContentStatus.PUBLISHED,
          deletedAt: null,
        },
        data: { isPinned: desired === "on" },
      });
      return target.count === 1;
    });
    if (!pinned) {
      return {
        ok: false as const,
        error: "Esta publicação não pode mais ser fixada. Atualize a lista.",
      };
    }
  } catch {
    return {
      ok: false as const,
      error:
        "A fixação foi alterada ao mesmo tempo. Atualize e tente novamente.",
    };
  }
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
  return { ok: true as const };
};

export const togglePostFeatured = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const desired = textValue(formData.get("desired"));
  if (!(postId && (desired === "on" || desired === "off"))) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.moderation",
    memberId: userId,
  });
  const post = await database.communityPost.findFirst({
    where: {
      ...(await publishedPostWhere(postId, userId, spaceSlug || undefined)),
    },
    select: {
      id: true,
      slug: true,
      space: { select: { slug: true } },
    },
  });
  if (!post) {
    return;
  }
  await database.communityPost.update({
    where: { id: postId },
    data: {
      isFeatured: desired === "on",
      featuredAt: desired === "on" ? new Date() : null,
    },
  });
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
  revalidatePath("/admin/community");
};

const groupCreateSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500),
  details: z.string().trim().max(2400),
  coverUrl: z.string().trim().max(2000),
  visibility: z.nativeEnum(CommunitySpaceVisibility),
});

const formInviteeIds = (formData: FormData) =>
  [...new Set(formData.getAll("inviteeIds"))]
    .filter((value): value is string => typeof value === "string")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

const enqueueGroupInvitationNotifications = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly createdAt: Date;
    readonly groupId: string;
    readonly invitations: readonly {
      readonly id: string;
      readonly inviteeId: string;
    }[];
  }
) => {
  if (input.invitations.length === 0) {
    return;
  }
  await enqueueNotificationBatch(transaction, {
    actorId: input.actorId,
    aggregateType: "CommunitySpaceInvitationBatch",
    aggregateId: input.groupId,
    idempotencyKey: `community-space-invitations:${input.groupId}:${input.createdAt.getTime()}`,
    occurredAt: input.createdAt,
    notifications: input.invitations.map((invitation) => ({
      recipientId: invitation.inviteeId,
      type: "GROUP_INVITATION",
      entityType: "COMMUNITY_INVITATION",
      entityId: invitation.id,
      communitySpaceId: input.groupId,
      dedupeKey: `community-space-invitation:${invitation.id}`,
      groupKey: input.groupId,
      href: "/perfil#convites",
    })),
  });
};

const requireActiveGroupCreator = async (memberId: string) => {
  const member = await database.member.findUnique({
    where: { id: memberId },
    select: { deactivatedAt: true },
  });
  if (!member || member.deactivatedAt) {
    redirect("/onboarding");
  }
};

const uploadedGroupCoverUrl = (value: string, memberId: string) => {
  if (!value) {
    return null;
  }
  const path = memberAssetPathFromUrl(value);
  if (
    path?.startsWith("community-assets/covers/") &&
    isOwnedMemberAssetPath(path, memberId)
  ) {
    return value;
  }
  return undefined;
};

const createInitialGroupInvitations = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly groupId: string;
    readonly inviteeIds: readonly string[];
  }
) => {
  if (input.inviteeIds.length === 0) {
    return;
  }
  const activeInvitees = await transaction.member.findMany({
    where: {
      id: { in: [...input.inviteeIds] },
      deactivatedAt: null,
      NOT: { id: input.actorId },
    },
    select: { id: true },
  });
  if (activeInvitees.length === 0) {
    return;
  }
  const createdAt = new Date();
  const invitations =
    await transaction.communitySpaceInvitation.createManyAndReturn({
      data: activeInvitees.map(({ id }) => ({
        id: randomUUID(),
        spaceId: input.groupId,
        inviteeId: id,
        inviterId: input.actorId,
      })),
      skipDuplicates: true,
      select: { id: true, inviteeId: true },
    });
  await enqueueGroupInvitationNotifications(transaction, {
    actorId: input.actorId,
    createdAt,
    groupId: input.groupId,
    invitations,
  });
};

const enqueueCommunityGroupPostNotifications = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly groupId: string;
    readonly occurredAt: Date;
    readonly postId: string;
    readonly href: string;
  }
) => {
  const [space, memberships] = await Promise.all([
    transaction.communitySpace.findUnique({
      where: { id: input.groupId },
      select: { ownerId: true, visibility: true, status: true },
    }),
    transaction.communitySpaceMember.findMany({
      where: {
        spaceId: input.groupId,
        member: { deactivatedAt: null },
      },
      select: { memberId: true },
    }),
  ]);
  if (!(space && space.status === ContentStatus.PUBLISHED)) {
    return;
  }
  const recipients = [
    ...new Set([
      ...(space.ownerId ? [space.ownerId] : []),
      ...memberships.map(({ memberId }) => memberId),
    ]),
  ].filter((memberId) => memberId !== input.actorId);
  if (recipients.length === 0) {
    return;
  }
  await enqueueNotificationBatch(transaction, {
    actorId: input.actorId,
    aggregateType: "CommunityPost",
    aggregateId: input.postId,
    idempotencyKey: `community-group-post:${input.postId}`,
    occurredAt: input.occurredAt,
    notifications: recipients.map((recipientId) => ({
      recipientId,
      type: "GROUP_POST",
      entityType: "TOPIC",
      entityId: input.postId,
      groupKey: input.groupId,
      communitySpaceId: input.groupId,
      dedupeKey: `community-group-post:${input.postId}:${recipientId}`,
      href: input.href,
    })),
  });
};

export const createStudyGroup = async (formData: FormData) => {
  const memberId = await currentUserId();
  if (!memberId) {
    redirect("/sign-in");
  }
  await requireActiveGroupCreator(memberId);
  if (textValue(formData.get("coverUploadPending")) === "true") {
    redirect("/comunidade/grupos/novo?error=cover");
  }
  const parsed = groupCreateSchema.safeParse({
    title: textValue(formData.get("title")),
    description: textValue(formData.get("description")),
    details: textValue(formData.get("details")),
    coverUrl: textValue(formData.get("coverUrl")),
    visibility: textValue(formData.get("visibility")) || "PRIVATE",
  });
  const inviteeIds = formInviteeIds(formData);
  if (!(parsed.success && inviteeIds.length <= 50)) {
    redirect("/comunidade/grupos/novo?error=form");
  }
  const normalizedTitle = normalizeCommunitySpaceTitle(parsed.data.title);
  if (!normalizedTitle) {
    redirect("/comunidade/grupos/novo?error=name");
  }
  await consumeMutationRateLimit({
    action: "community.group.create",
    memberId,
  });
  await getOrCreateProfile(memberId);
  const coverUrl = uploadedGroupCoverUrl(parsed.data.coverUrl, memberId);
  if (coverUrl === undefined) {
    redirect("/comunidade/grupos/novo?error=cover");
  }
  const slugBase = communitySpaceSlugBase(parsed.data.title);
  const ownerSuffix = communitySpaceSlugBase(memberId).slice(-7) || "member";

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const result = await database.$transaction(async (transaction) => {
        const duplicateName = await transaction.communitySpace.findFirst({
          where: { ownerId: memberId, normalizedTitle },
          select: { id: true },
        });
        if (duplicateName) {
          return { duplicateName: true as const };
        }

        const suffix =
          attempt === 0
            ? ""
            : `-${ownerSuffix}${attempt > 1 ? `-${attempt}` : ""}`;
        const slug = `${slugBase.slice(0, 80 - suffix.length)}${suffix}`;
        const space = await transaction.communitySpace.create({
          data: {
            title: parsed.data.title,
            normalizedTitle,
            slug,
            description: parsed.data.description || null,
            details: parsed.data.details || null,
            coverUrl,
            visibility: parsed.data.visibility,
            ownerId: memberId,
            status: ContentStatus.PUBLISHED,
            members: {
              create: { memberId, role: CommunitySpaceMemberRole.OWNER },
            },
          },
          select: { id: true, slug: true },
        });
        await transaction.domainEvent.create({
          data: {
            eventType: "community.group.created",
            actorId: memberId,
            aggregateType: "CommunitySpace",
            aggregateId: space.id,
            idempotencyKey: `community.group.created:${space.id}`,
            payload: {
              visibility: parsed.data.visibility,
              initialRole: CommunitySpaceMemberRole.OWNER,
            },
            occurredAt: new Date(),
          },
        });

        await createInitialGroupInvitations(transaction, {
          actorId: memberId,
          groupId: space.id,
          inviteeIds,
        });
        return { duplicateName: false as const, slug: space.slug };
      });
      if (result.duplicateName) {
        redirect("/comunidade/grupos/novo?error=name");
      }
      await dispatchPendingNotifications();
      revalidatePath("/comunidade");
      revalidatePath("/perfil");
      redirect(`/comunidade/grupos/${result.slug}`);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const duplicateName = await database.communitySpace.findFirst({
        where: { ownerId: memberId, normalizedTitle },
        select: { id: true },
      });
      if (duplicateName) {
        redirect("/comunidade/grupos/novo?error=name");
      }
    }
  }
  redirect("/comunidade/grupos/novo?error=slug");
};

export const inviteStudyGroupMembers = async (formData: FormData) => {
  return await inviteStudyGroupMembersV2(formData);
};

export const joinPublicStudyGroup = async (formData: FormData) => {
  const memberId = await currentUserId();
  const groupId = textValue(formData.get("groupId"));
  if (!(memberId && groupId)) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.group.join",
    memberId,
  });
  const group = await database.communitySpace.findFirst({
    where: {
      id: groupId,
      status: ContentStatus.PUBLISHED,
      visibility: CommunitySpaceVisibility.PUBLIC,
    },
    select: { id: true, slug: true },
  });
  if (!group) {
    return;
  }
  await database.communitySpaceMember.createMany({
    data: [{ spaceId: group.id, memberId }],
    skipDuplicates: true,
  });
  revalidatePath("/comunidade/grupos");
  revalidatePath(`/comunidade/grupos/${group.slug}`);
};

export const createSpace = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const title = textValue(formData.get("title"));
  const slug = textValue(formData.get("slug"))
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const description = textValue(formData.get("description"));
  if (!(title && slug)) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  await database.communitySpace.create({
    data: {
      title,
      slug,
      description: description || null,
      status: ContentStatus.DRAFT,
    },
  });
  revalidatePath("/admin/community");
};

export const setSpaceStatus = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const spaceId = textValue(formData.get("spaceId"));
  const status = textValue(formData.get("status"));
  if (
    !(spaceId && Object.values(ContentStatus).includes(status as ContentStatus))
  ) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  await database.communitySpace.update({
    where: { id: spaceId },
    data: { status: status as ContentStatus },
  });
  revalidatePath("/admin/community");
  revalidatePath("/comunidade");
};

export const updateSpace = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const spaceId = textValue(formData.get("spaceId"));
  const title = textValue(formData.get("title"));
  const slug = textValue(formData.get("slug"))
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const description = textValue(formData.get("description"));
  if (!(spaceId && title && slug)) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  const duplicate = await database.communitySpace.findFirst({
    where: { slug, NOT: { id: spaceId } },
    select: { id: true },
  });
  if (duplicate) {
    return;
  }
  await database.communitySpace.update({
    where: { id: spaceId },
    data: { title, slug, description: description || null },
  });
  revalidatePath("/admin/community");
  revalidatePath("/comunidade");
  revalidatePath(`/comunidade/grupos/${slug}`);
};

export const toggleSpaceComments = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const spaceId = textValue(formData.get("spaceId"));
  const desired = textValue(formData.get("desired"));
  if (!(spaceId && (desired === "on" || desired === "off"))) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.moderation",
    memberId: userId,
  });
  const space = await database.communitySpace.findUnique({
    where: { id: spaceId },
    select: { id: true, slug: true },
  });
  if (!space) {
    return;
  }
  await database.communitySpace.update({
    where: { id: space.id },
    data: { commentsClosed: desired === "on" },
  });
  revalidatePath("/admin/community");
  revalidatePath(`/comunidade/grupos/${space.slug}`);
};
