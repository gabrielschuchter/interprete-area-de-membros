"use server";

import { randomUUID } from "node:crypto";
import {
  BadgeCriterion,
  CommunitySpaceInvitationStatus,
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
import { createCommunityComment } from "@/lib/community-mutations";
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
  spaceSlug?: string
) => {
  const role = await getMemberRole(memberId);
  const canModeratePrivateGroups = canModerate(role);
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
  revalidatePath("/comunidade/salvos");
  revalidatePath("/membros");
  if (spaceSlug) {
    revalidatePath(`/comunidade/${spaceSlug}`);
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
    return;
  }
  const { space } = await spaceData(formData, userId);
  const existing = await database.communityPost.findUnique({
    where: {
      authorId_idempotencyKey: { authorId: userId, idempotencyKey },
    },
    select: { id: true, space: { select: { slug: true } } },
  });
  if (existing) {
    await ensureTopicFollow(userId, existing.id);
    redirect(`/comunidade/editor/${existing.id}`);
  }
  await consumeMutationRateLimit({
    action: "community.post.create",
    memberId: userId,
  });
  await getOrCreateProfile(userId);
  let post: { id: string };
  try {
    post = await database.communityPost.create({
      data: {
        spaceId: space?.id ?? null,
        authorId: userId,
        idempotencyKey,
        kind: "DISCUSSION",
        title: draftTitle,
        content: "",
        excerpt: "",
        contentJson: emptyDocument as Prisma.InputJsonValue,
        status: ContentStatus.DRAFT,
        tags: [],
      },
      select: { id: true },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    post = (await database.communityPost.findUniqueOrThrow({
      where: {
        authorId_idempotencyKey: { authorId: userId, idempotencyKey },
      },
      select: { id: true },
    })) as { id: string };
  }
  await ensureTopicFollow(userId, post.id);
  revalidateCommunity(space?.slug, post.id);
  redirect(`/comunidade/editor/${post.id}`);
};

export const createDraft = async (formData: FormData) => {
  const userId = await currentUserId();
  const idempotencyKey = readIdempotencyKeyFromForm(formData);
  if (!(userId && idempotencyKey)) {
    return { ok: false as const };
  }
  const { space } = await spaceData(formData, userId);
  const existing = await database.communityPost.findUnique({
    where: {
      authorId_idempotencyKey: { authorId: userId, idempotencyKey },
    },
    select: { id: true, space: { select: { slug: true } } },
  });
  if (existing) {
    await ensureTopicFollow(userId, existing.id);
    return {
      ok: true as const,
      postId: existing.id,
      spaceSlug: existing.space?.slug ?? "",
    };
  }
  await consumeMutationRateLimit({
    action: "community.post.create",
    memberId: userId,
  });
  await getOrCreateProfile(userId);
  let post: { id: string };
  try {
    post = await database.communityPost.create({
      data: {
        spaceId: space?.id ?? null,
        authorId: userId,
        idempotencyKey,
        kind: "DISCUSSION",
        title: draftTitle,
        content: "",
        excerpt: "",
        contentJson: emptyDocument as Prisma.InputJsonValue,
        status: ContentStatus.DRAFT,
        tags: [],
      },
      select: { id: true },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    post = (await database.communityPost.findUniqueOrThrow({
      where: {
        authorId_idempotencyKey: { authorId: userId, idempotencyKey },
      },
      select: { id: true },
    })) as { id: string };
  }
  await ensureTopicFollow(userId, post.id);
  revalidateCommunity(space?.slug, post.id);
  return { ok: true as const, postId: post.id, spaceSlug: space?.slug ?? "" };
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

export const updateDraft = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  if (!(userId && postId)) {
    return { ok: false as const, error: "Rascunho indisponível." };
  }
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  const { spaceId, space } = await spaceData(formData, userId);
  const { document, plainText } = contentFromForm(formData);
  const post = await database.communityPost.findFirst({
    where: {
      id: postId,
      authorId: userId,
      status: ContentStatus.DRAFT,
      deletedAt: null,
    },
    select: {
      id: true,
      coverUrl: true,
      contentJson: true,
      space: { select: { slug: true } },
    },
  });
  if (!post) {
    return { ok: false as const, error: "Você não pode editar este rascunho." };
  }
  const title = textValue(formData.get("title")) || draftTitle;
  await database.communityPost.update({
    where: { id: post.id },
    data: {
      spaceId,
      title: title.slice(0, 180),
      subtitle: textValue(formData.get("subtitle")).slice(0, 1000) || null,
      coverUrl: safeImageUrl(textValue(formData.get("coverUrl")), userId),
      content: plainText.slice(0, 40_000),
      excerpt: excerptFrom(plainText),
      contentJson: document as Prisma.InputJsonValue | undefined,
      tags: parseTags(formData.get("tags")),
    },
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
  revalidateCommunity(post.space?.slug, post.id);
  revalidateCommunity(space?.slug, post.id);
  return {
    ok: true as const,
    savedAt: new Date().toISOString(),
    spaceSlug: space?.slug ?? "",
  };
};

export const publishPost = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  if (!(userId && postId)) {
    return { ok: false as const, error: "Não foi possível publicar agora." };
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
      ok: false as const,
      error: "Confirme que deseja notificar o grupo antes de publicar.",
    };
  }
  const parsed = postInput.safeParse({
    title: textValue(formData.get("title")),
    content: plainText,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Adicione um título e algum conteúdo antes de publicar.",
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
      coverUrl: true,
      contentJson: true,
      space: { select: { slug: true } },
    },
  });
  if (!post) {
    return {
      ok: false as const,
      error: "Você não pode publicar este rascunho.",
    };
  }
  if (post.status === ContentStatus.PUBLISHED && post.slug) {
    await ensureTopicFollow(userId, post.id);
    await notifyCommunityPost({
      actorId: userId,
      postId: post.id,
      postTitle: post.title,
      commentContent: post.content,
      document: post.contentJson,
      href: communityHref(post),
    });
    redirect(communityHref(post));
  }
  if (post.status !== ContentStatus.DRAFT) {
    return {
      ok: false as const,
      error: "Você não pode publicar este conteúdo agora.",
    };
  }
  const persistedDocument = await enrichCommunityArticleMetadata(document);
  const slug = await uniquePostSlug(parsed.data.title, post.id);
  const publishedAt = new Date();
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
      return null;
    }
    const published = await transaction.communityPost.update({
      where: { id: post.id },
      data: {
        spaceId,
        title: parsed.data.title,
        subtitle: textValue(formData.get("subtitle")).slice(0, 1000) || null,
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
        postId: published.id,
        href: `/comunidade/publicacoes/${slug}`,
      });
    }
    await evaluateMemberBadges(transaction, userId, publishedAt, {
      criteria: [BadgeCriterion.COMMUNITY_PUBLICATIONS],
      force: true,
    });
    return published;
  });
  if (!updatedPost) {
    return {
      ok: false as const,
      error: "Você não pode publicar neste grupo.",
    };
  }
  await dispatchPendingNotifications();
  await ensureTopicFollow(userId, updatedPost.id);
  await notifyCommunityPost({
    actorId: userId,
    postId: updatedPost.id,
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
  redirect(`/comunidade/publicacoes/${slug}`);
};

export const updatePost = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  if (!(userId && postId)) {
    return;
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
    return;
  }
  const parsed = postInput.safeParse({
    title: textValue(formData.get("title")),
    content: plainText,
  });
  if (!parsed.success) {
    return;
  }
  const post = await database.communityPost.findFirst({
    where: { id: postId, authorId: userId, deletedAt: null },
    select: {
      id: true,
      slug: true,
      status: true,
      coverUrl: true,
      contentJson: true,
      space: { select: { slug: true } },
    },
  });
  if (!post) {
    return;
  }
  const persistedDocument = await enrichCommunityArticleMetadata(document);
  const slug =
    post.status === ContentStatus.PUBLISHED
      ? (post.slug ?? (await uniquePostSlug(parsed.data.title, post.id)))
      : post.slug;
  await database.communityPost.update({
    where: { id: post.id },
    data: {
      spaceId,
      title: parsed.data.title,
      subtitle: textValue(formData.get("subtitle")).slice(0, 1000) || null,
      coverUrl: safeImageUrl(textValue(formData.get("coverUrl")), userId),
      content: parsed.data.content,
      excerpt: excerptFrom(parsed.data.content),
      contentJson: persistedDocument as Prisma.InputJsonValue | undefined,
      tags: parseTags(formData.get("tags")),
      slug,
      editedAt: new Date(),
    },
  });
  if (post.status === ContentStatus.PUBLISHED) {
    await notifyCommunityPost({
      actorId: userId,
      postId: post.id,
      postTitle: parsed.data.title,
      commentContent: parsed.data.content,
      document: persistedDocument,
      href: slug
        ? `/comunidade/publicacoes/${slug}`
        : `/comunidade/publicacoes/${post.id}`,
    });
  }
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
  revalidateCommunity(post.space?.slug, post.id, slug ?? undefined);
  revalidateCommunity(space?.slug, post.id, slug ?? undefined);
  redirect(
    slug ? `/comunidade/publicacoes/${slug}` : "/comunidade/meus-topicos"
  );
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
  if (
    !(
      post &&
      (post.authorId === userId ||
        (requestedStatus === ContentStatus.ARCHIVED && canModerate(role)))
    )
  ) {
    return {
      ok: false as const,
      error: "Você não pode alterar esta publicação.",
    };
  }
  if (
    requestedStatus === ContentStatus.PUBLISHED &&
    !publishRequestIsValid(post, formData)
  ) {
    return {
      ok: false as const,
      error: publishStatusError(post, formData),
    };
  }
  const slug =
    requestedStatus === ContentStatus.PUBLISHED
      ? (post.slug ?? (await uniquePostSlug(post.title, postId)))
      : post.slug;
  const publishedAt = post.publishedAt ?? new Date();
  await database.$transaction(async (transaction) => {
    await transaction.communityPost.update({
      where: { id: postId },
      data: {
        status: requestedStatus as ContentStatus,
        ...(requestedStatus === ContentStatus.PUBLISHED
          ? { publishedAt, slug }
          : {}),
      },
    });
    if (
      requestedStatus === ContentStatus.PUBLISHED &&
      post.space?.id &&
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
  }
  if (requestedStatus === ContentStatus.PUBLISHED) {
    await ensureTopicFollow(post.authorId, postId);
    await notifyCommunityPost({
      actorId: userId,
      postId,
      postTitle: post.title,
      commentContent: post.content,
      document: post.contentJson,
      href: slug
        ? `/comunidade/publicacoes/${slug}`
        : `/comunidade/publicacoes/${postId}`,
    });
  }
  revalidateCommunity(post.space?.slug, postId, slug ?? undefined);
  if (requestedStatus === ContentStatus.ARCHIVED) {
    redirect("/comunidade");
  }
  if (requestedStatus === ContentStatus.DRAFT) {
    redirect("/comunidade/meus-topicos");
  }
  redirect(`/comunidade/publicacoes/${slug}`);
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
  const post = await database.communityPost.findFirst({
    where: await publishedPostWhere(postId, userId, spaceSlug || undefined),
    select: { id: true, slug: true, space: { select: { slug: true } } },
  });
  if (!post) {
    return;
  }
  if (desired === "on") {
    await database.topicFollow.upsert({
      where: { userId_topicId: { userId, topicId: postId } },
      create: { userId, topicId: postId },
      update: {},
    });
  } else {
    await database.topicFollow.deleteMany({
      where: { userId, topicId: postId },
    });
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
  const post = await database.communityPost.findFirst({
    where: await publishedPostWhere(postId, userId, spaceSlug || undefined),
    select: { id: true, slug: true, space: { select: { slug: true } } },
  });
  if (!post) {
    return;
  }
  const existing = await database.topicFollow.findUnique({
    where: { userId_topicId: { userId, topicId: postId } },
    select: { id: true, mutedAt: true },
  });
  if (existing) {
    await database.topicFollow.update({
      where: { id: existing.id },
      data: { mutedAt: desired === "on" ? new Date() : null },
    });
  } else if (desired === "on") {
    await database.topicFollow.create({
      data: { userId, topicId: postId, mutedAt: new Date() },
    });
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
  const comment = await database.communityComment.findFirst({
    where: {
      id: commentId,
      postId,
      authorId: userId,
      deletedAt: null,
      post: {
        is: await publishedPostWhere(postId, userId, spaceSlug || undefined),
      },
    },
    select: {
      id: true,
      parentId: true,
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
    return;
  }
  await database.communityComment.update({
    where: { id: commentId },
    data: {
      content,
      contentJson: document as Prisma.InputJsonValue | undefined,
      editedAt: new Date(),
    },
  });
  if (
    extractMentionIdsFromDocument(document).length > 0 ||
    extractMentionUsernames(content).length > 0
  ) {
    let parentAuthorId: string | null = null;
    if (comment.parentId) {
      const parent = await database.communityComment.findUnique({
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
    });
  }
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
  const comment = await database.communityComment.findFirst({
    where: {
      id: commentId,
      postId,
      deletedAt: null,
      post: {
        is: await publishedPostWhere(postId, userId, spaceSlug || undefined),
      },
    },
    select: { id: true },
  });
  if (!comment) {
    return;
  }
  if (desired === "on") {
    await database.commentVote.upsert({
      where: { commentId_memberId: { commentId, memberId: userId } },
      create: { commentId, memberId: userId, kind: CommunityVoteKind.UP },
      update: {},
    });
  } else {
    await database.commentVote.deleteMany({
      where: { commentId, memberId: userId },
    });
  }
  revalidateCommunity(spaceSlug || undefined, postId);
};

export const softDeletePost = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
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
  await database.communityPost.update({
    where: { id: postId },
    data: { deletedAt: new Date(), status: ContentStatus.ARCHIVED },
  });
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
  redirect(post.space ? `/comunidade/${post.space.slug}` : "/comunidade");
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
  const comment = await database.communityComment.findFirst({
    where: {
      id: commentId,
      post: {
        is: await publishedPostWhere(postId, userId, spaceSlug || undefined),
      },
    },
    select: { authorId: true, deletedAt: true },
  });
  const role = await getMemberRole(userId);
  if (
    !comment ||
    comment.deletedAt ||
    !canManagePost(comment.authorId, userId, role)
  ) {
    return;
  }
  await database.communityComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
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
      space: { select: { slug: true } },
    },
  });
  if (!post) {
    return;
  }
  await database.communityPost.update({
    where: { id: postId },
    data: { isPinned: desired === "on" },
  });
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
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
      dedupeKey: `community-space-invitation:${invitation.id}`,
      groupKey: input.groupId,
      href: "/perfil#convites",
    })),
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
  const coverUrl = safeImageUrl(parsed.data.coverUrl, memberId);
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

        let invitations: { id: string; inviteeId: string }[] = [];
        if (inviteeIds.length > 0) {
          const activeInvitees = await transaction.member.findMany({
            where: {
              id: { in: inviteeIds },
              deactivatedAt: null,
              NOT: { id: memberId },
            },
            select: { id: true },
          });
          if (activeInvitees.length > 0) {
            invitations =
              await transaction.communitySpaceInvitation.createManyAndReturn({
                data: activeInvitees.map(({ id }) => ({
                  id: randomUUID(),
                  spaceId: space.id,
                  inviteeId: id,
                  inviterId: memberId,
                })),
                skipDuplicates: true,
                select: { id: true, inviteeId: true },
              });
            await enqueueGroupInvitationNotifications(transaction, {
              actorId: memberId,
              createdAt: new Date(),
              groupId: space.id,
              invitations,
            });
          }
        }
        return { duplicateName: false as const, slug: space.slug };
      });
      if (result.duplicateName) {
        redirect("/comunidade/grupos/novo?error=name");
      }
      await dispatchPendingNotifications();
      revalidatePath("/comunidade");
      revalidatePath("/perfil");
      redirect(`/comunidade/${result.slug}`);
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
  const memberId = await currentUserId();
  const groupId = textValue(formData.get("groupId"));
  const inviteeIds = formInviteeIds(formData);
  if (
    !(memberId && groupId) ||
    inviteeIds.length === 0 ||
    inviteeIds.length > 50
  ) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.group.invite",
    memberId,
  });
  const role = await getMemberRole(memberId);
  const group = await database.communitySpace.findFirst({
    where: {
      id: groupId,
      status: ContentStatus.PUBLISHED,
      ...(canModerate(role) ? {} : { ownerId: memberId }),
    },
    select: { id: true, slug: true, ownerId: true, visibility: true },
  });
  if (!group) {
    return;
  }
  const createdAt = new Date();
  const invitations = await database.$transaction(async (transaction) => {
    const activeInvitees = await transaction.member.findMany({
      where: {
        id: { in: inviteeIds },
        deactivatedAt: null,
        NOT: { id: memberId },
        communitySpaceMemberships: { none: { spaceId: groupId } },
      },
      select: { id: true },
    });
    const pending = await transaction.communitySpaceInvitation.findMany({
      where: {
        spaceId: groupId,
        status: CommunitySpaceInvitationStatus.PENDING,
        inviteeId: { in: activeInvitees.map(({ id }) => id) },
      },
      select: { inviteeId: true },
    });
    const pendingIds = new Set(pending.map(({ inviteeId }) => inviteeId));
    const newInvitees = activeInvitees.filter(({ id }) => !pendingIds.has(id));
    if (newInvitees.length === 0) {
      return [];
    }
    const created =
      await transaction.communitySpaceInvitation.createManyAndReturn({
        data: newInvitees.map(({ id }) => ({
          id: randomUUID(),
          spaceId: groupId,
          inviteeId: id,
          inviterId: memberId,
        })),
        skipDuplicates: true,
        select: { id: true, inviteeId: true },
      });
    await enqueueGroupInvitationNotifications(transaction, {
      actorId: memberId,
      createdAt,
      groupId,
      invitations: created,
    });
    return created;
  });
  if (invitations.length > 0) {
    await dispatchPendingNotifications();
    revalidatePath("/perfil");
    revalidatePath(`/comunidade/${group.slug}`);
  }
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
  await database.communitySpaceMember.upsert({
    where: { spaceId_memberId: { spaceId: group.id, memberId } },
    create: { spaceId: group.id, memberId },
    update: {},
  });
  revalidatePath(`/comunidade/${group.slug}`);
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
  revalidatePath(`/comunidade/${slug}`);
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
  revalidatePath(`/comunidade/${space.slug}`);
};
