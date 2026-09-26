"use server";

import { auth } from "@repo/auth/server";
import {
  CommunityPostKind,
  CommunityVoteKind,
  ContentStatus,
  database,
  type Prisma,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getMemberRole, requireStaff } from "@/lib/authorization";
import {
  plainTextFromDocument,
  sanitizeRichDocument,
} from "@/lib/community-content";
import {
  deleteMemberAsset,
  isOwnedMemberAssetPath,
  memberAssetPathFromUrl,
} from "@/lib/member-storage";
import { createNotification } from "@/lib/notifications";
import { getOrCreateProfile } from "@/lib/profile";

const draftTitle = "Rascunho sem título";
const tagSeparatorPattern = /[\n,]/;
const tagPrefixPattern = /^#/;
const tagCharactersPattern = /[^a-z0-9áàâãéêíóôõúçü -]/gi;
const mentionPattern = /@([a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?)/gi;

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

const parseKind = (value: FormDataEntryValue | null) =>
  textValue(value) === CommunityPostKind.PUBLICATION
    ? CommunityPostKind.PUBLICATION
    : CommunityPostKind.DISCUSSION;

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
    assetPath &&
    (assetPath.startsWith("community-assets/covers/") ||
      assetPath.startsWith("community-assets/inline/")) &&
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
  const rawJson = textValue(formData.get("contentJson"));
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
    if (path?.startsWith("community-assets/inline/")) {
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

const publishedPostWhere = (postId: string, spaceSlug?: string) => ({
  id: postId,
  status: ContentStatus.PUBLISHED,
  deletedAt: null,
  ...(spaceSlug
    ? {
        space: {
          is: { slug: spaceSlug, status: ContentStatus.PUBLISHED },
        },
      }
    : {
        OR: [
          { space: null },
          { space: { is: { status: ContentStatus.PUBLISHED } } },
        ],
      }),
});

const publishedSpace = (spaceId: string, spaceSlug?: string) => {
  if (!spaceId) {
    return null;
  }
  return database.communitySpace.findFirst({
    where: {
      id: spaceId,
      status: ContentStatus.PUBLISHED,
      ...(spaceSlug ? { slug: spaceSlug } : {}),
    },
    select: { id: true, slug: true },
  });
};

const spaceData = async (formData: FormData) => {
  const spaceId = textValue(formData.get("spaceId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const space = await publishedSpace(spaceId, spaceSlug || undefined);
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

const mentionedMemberIds = async (content: string) => {
  const usernames = [
    ...new Set(
      [...content.matchAll(mentionPattern)].map((match) =>
        match[1].toLowerCase()
      )
    ),
  ].slice(0, 20);
  if (usernames.length === 0) {
    return [];
  }
  const profiles = await database.profile.findMany({
    where: { username: { in: usernames } },
    select: { clerkUserId: true },
  });
  return profiles.map((profile) => profile.clerkUserId);
};

const notifyCommunityMembers = async (input: {
  readonly authorId: string;
  readonly content: string;
  readonly postAuthorId: string;
  readonly postTitle: string;
  readonly href: string;
  readonly parentAuthorId?: string | null;
}) => {
  const mentionedIds = await mentionedMemberIds(input.content);
  const recipients = [
    input.postAuthorId,
    input.parentAuthorId,
    ...mentionedIds,
  ].filter((recipient): recipient is string =>
    Boolean(recipient && recipient !== input.authorId)
  );
  const uniqueRecipients = [...new Set(recipients)];
  if (uniqueRecipients.length === 0) {
    return;
  }
  await Promise.all(
    uniqueRecipients.map((memberId) =>
      createNotification({
        memberId,
        type:
          mentionedIds.length > 0 ? "COMMUNITY_ACTIVITY" : "COMMUNITY_REPLY",
        title:
          mentionedIds.length > 0
            ? "Você foi mencionado na comunidade"
            : "Nova resposta na comunidade",
        body: input.postTitle,
        href: input.href,
      })
    )
  );
};

export const startDraft = async (formData: FormData) => {
  const userId = await currentUserId();
  if (!userId) {
    return;
  }
  const { space } = await spaceData(formData);
  await getOrCreateProfile(userId);
  const post = await database.communityPost.create({
    data: {
      spaceId: space?.id ?? null,
      authorId: userId,
      kind: parseKind(formData.get("kind")),
      title: draftTitle,
      content: "",
      excerpt: "",
      contentJson: emptyDocument as Prisma.InputJsonValue,
      status: ContentStatus.DRAFT,
      tags: [],
    },
    select: { id: true },
  });
  revalidateCommunity(space?.slug, post.id);
  redirect(`/comunidade/editor/${post.id}`);
};

export const createDraft = async (formData: FormData) => {
  const userId = await currentUserId();
  if (!userId) {
    return { ok: false as const };
  }
  const { space } = await spaceData(formData);
  await getOrCreateProfile(userId);
  const post = await database.communityPost.create({
    data: {
      spaceId: space?.id ?? null,
      authorId: userId,
      kind: parseKind(formData.get("kind")),
      title: draftTitle,
      content: "",
      excerpt: "",
      contentJson: emptyDocument as Prisma.InputJsonValue,
      status: ContentStatus.DRAFT,
      tags: [],
    },
    select: { id: true },
  });
  revalidateCommunity(space?.slug, post.id);
  return { ok: true as const, postId: post.id, spaceSlug: space?.slug ?? "" };
};

export const createPost = async (formData: FormData) => {
  const userId = await currentUserId();
  if (!userId) {
    return;
  }
  const { space } = await spaceData(formData);
  const { document, plainText } = contentFromForm(formData);
  const parsed = postInput.safeParse({
    title: textValue(formData.get("title")),
    content: plainText,
  });
  if (!parsed.success) {
    return;
  }
  await getOrCreateProfile(userId);
  const slug = await uniquePostSlug(parsed.data.title);
  const post = await database.communityPost.create({
    data: {
      spaceId: space?.id ?? null,
      authorId: userId,
      kind: parseKind(formData.get("kind")),
      title: parsed.data.title,
      subtitle: textValue(formData.get("subtitle")) || null,
      coverUrl: safeImageUrl(textValue(formData.get("coverUrl")), userId),
      content: parsed.data.content,
      excerpt: excerptFrom(parsed.data.content),
      contentJson: document as Prisma.InputJsonValue | undefined,
      tags: parseTags(formData.get("tags")),
      slug,
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
    },
    select: { id: true, slug: true, space: { select: { slug: true } } },
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
  const { spaceId, space } = await spaceData(formData);
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
      kind: parseKind(formData.get("kind")),
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
  const { spaceId, space } = await spaceData(formData);
  const { document, plainText } = contentFromForm(formData);
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
    return {
      ok: false as const,
      error: "Você não pode publicar este rascunho.",
    };
  }
  const slug = await uniquePostSlug(parsed.data.title, post.id);
  await database.communityPost.update({
    where: { id: post.id },
    data: {
      spaceId,
      kind: parseKind(formData.get("kind")),
      title: parsed.data.title,
      subtitle: textValue(formData.get("subtitle")).slice(0, 1000) || null,
      coverUrl: safeImageUrl(textValue(formData.get("coverUrl")), userId),
      content: parsed.data.content,
      excerpt: excerptFrom(parsed.data.content),
      contentJson: document as Prisma.InputJsonValue | undefined,
      tags: parseTags(formData.get("tags")),
      slug,
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
    },
    select: { id: true, slug: true, space: { select: { slug: true } } },
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
  const { spaceId, space } = await spaceData(formData);
  const { document, plainText } = contentFromForm(formData);
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
  const slug =
    post.status === ContentStatus.PUBLISHED
      ? (post.slug ?? (await uniquePostSlug(parsed.data.title, post.id)))
      : post.slug;
  await database.communityPost.update({
    where: { id: post.id },
    data: {
      spaceId,
      kind: parseKind(formData.get("kind")),
      title: parsed.data.title,
      subtitle: textValue(formData.get("subtitle")).slice(0, 1000) || null,
      coverUrl: safeImageUrl(textValue(formData.get("coverUrl")), userId),
      content: parsed.data.content,
      excerpt: excerptFrom(parsed.data.content),
      contentJson: document as Prisma.InputJsonValue | undefined,
      tags: parseTags(formData.get("tags")),
      slug,
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
    return;
  }
  const post = await database.communityPost.findFirst({
    where: {
      id: postId,
      deletedAt: null,
      ...(spaceSlug ? { space: { is: { slug: spaceSlug } } } : {}),
    },
    select: {
      authorId: true,
      title: true,
      content: true,
      slug: true,
      publishedAt: true,
      space: { select: { slug: true } },
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
    return;
  }
  if (
    requestedStatus === ContentStatus.PUBLISHED &&
    !postInput.safeParse({ title: post.title, content: post.content }).success
  ) {
    return;
  }
  const slug =
    requestedStatus === ContentStatus.PUBLISHED
      ? (post.slug ?? (await uniquePostSlug(post.title, postId)))
      : post.slug;
  await database.communityPost.update({
    where: { id: postId },
    data: {
      status: requestedStatus as ContentStatus,
      ...(requestedStatus === ContentStatus.PUBLISHED
        ? { publishedAt: post.publishedAt ?? new Date(), slug }
        : {}),
    },
  });
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
  if (!(userId && postId)) {
    return;
  }
  const post = await database.communityPost.findFirst({
    where: publishedPostWhere(postId, spaceSlug || undefined),
    select: { id: true, slug: true, space: { select: { slug: true } } },
  });
  if (!post) {
    return;
  }
  const existing = await database.communityBookmark.findUnique({
    where: { postId_memberId: { postId, memberId: userId } },
    select: { id: true },
  });
  if (existing) {
    await database.communityBookmark.delete({ where: { id: existing.id } });
  } else {
    await database.communityBookmark.create({
      data: { postId, memberId: userId },
    });
  }
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
};

export const createComment = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const content = textValue(formData.get("content"));
  const parentId = textValue(formData.get("parentId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  if (!(userId && postId && content) || content.length > 10_000) {
    return;
  }
  const post = await database.communityPost.findFirst({
    where: publishedPostWhere(postId, spaceSlug || undefined),
    select: {
      id: true,
      authorId: true,
      title: true,
      slug: true,
      space: { select: { slug: true } },
    },
  });
  if (!post) {
    return;
  }
  let parentAuthorId: string | null = null;
  if (parentId) {
    const parent = await database.communityComment.findFirst({
      where: { id: parentId, postId, deletedAt: null },
      select: { authorId: true },
    });
    if (!parent) {
      return;
    }
    parentAuthorId = parent.authorId;
  }
  await getOrCreateProfile(userId);
  await database.communityComment.create({
    data: { postId, authorId: userId, content, parentId: parentId || null },
  });
  await notifyCommunityMembers({
    authorId: userId,
    content,
    postAuthorId: post.authorId,
    postTitle: post.title,
    parentAuthorId,
    href: communityHref(post),
  });
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
};

export const updateComment = async (formData: FormData) => {
  const userId = await currentUserId();
  const commentId = textValue(formData.get("commentId"));
  const postId = textValue(formData.get("postId"));
  const content = textValue(formData.get("content"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  if (!(userId && commentId && postId && content) || content.length > 10_000) {
    return;
  }
  const comment = await database.communityComment.findFirst({
    where: {
      id: commentId,
      postId,
      authorId: userId,
      deletedAt: null,
      post: { is: publishedPostWhere(postId, spaceSlug || undefined) },
    },
    select: { id: true },
  });
  if (!comment) {
    return;
  }
  await database.communityComment.update({
    where: { id: commentId },
    data: { content },
  });
  revalidateCommunity(spaceSlug || undefined, postId);
};

export const togglePostVote = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  if (!(userId && postId)) {
    return;
  }
  const post = await database.communityPost.findFirst({
    where: publishedPostWhere(postId, spaceSlug || undefined),
    select: { id: true, slug: true, space: { select: { slug: true } } },
  });
  if (!post) {
    return;
  }
  const existing = await database.postVote.findUnique({
    where: { postId_memberId: { postId, memberId: userId } },
    select: { id: true },
  });
  if (existing) {
    await database.postVote.delete({ where: { id: existing.id } });
  } else {
    await database.postVote.create({
      data: { postId, memberId: userId, kind: CommunityVoteKind.UP },
    });
  }
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
};

export const toggleCommentVote = async (formData: FormData) => {
  const userId = await currentUserId();
  const commentId = textValue(formData.get("commentId"));
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  if (!(userId && commentId && postId)) {
    return;
  }
  const comment = await database.communityComment.findFirst({
    where: {
      id: commentId,
      postId,
      deletedAt: null,
      post: { is: publishedPostWhere(postId, spaceSlug || undefined) },
    },
    select: { id: true },
  });
  if (!comment) {
    return;
  }
  const existing = await database.commentVote.findUnique({
    where: { commentId_memberId: { commentId, memberId: userId } },
    select: { id: true },
  });
  if (existing) {
    await database.commentVote.delete({ where: { id: existing.id } });
  } else {
    await database.commentVote.create({
      data: { commentId, memberId: userId, kind: CommunityVoteKind.UP },
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
  const comment = await database.communityComment.findFirst({
    where: {
      id: commentId,
      post: { is: publishedPostWhere(postId, spaceSlug || undefined) },
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
  await requireStaff();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  if (!postId) {
    return;
  }
  const post = await database.communityPost.findFirst({
    where: {
      ...publishedPostWhere(postId, spaceSlug || undefined),
    },
    select: {
      id: true,
      isPinned: true,
      slug: true,
      space: { select: { slug: true } },
    },
  });
  if (!post) {
    return;
  }
  await database.communityPost.update({
    where: { id: postId },
    data: { isPinned: !post.isPinned },
  });
  revalidateCommunity(post.space?.slug, postId, post.slug ?? undefined);
};

export const createSpace = async (formData: FormData) => {
  await requireStaff();
  const title = textValue(formData.get("title"));
  const slug = textValue(formData.get("slug"))
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const description = textValue(formData.get("description"));
  if (!(title && slug)) {
    return;
  }
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
  await requireStaff();
  const spaceId = textValue(formData.get("spaceId"));
  const status = textValue(formData.get("status"));
  if (
    !(spaceId && Object.values(ContentStatus).includes(status as ContentStatus))
  ) {
    return;
  }
  await database.communitySpace.update({
    where: { id: spaceId },
    data: { status: status as ContentStatus },
  });
  revalidatePath("/admin/community");
  revalidatePath("/comunidade");
};
