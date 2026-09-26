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
import { createCommunityComment } from "@/lib/community-mutations";
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
  const { space } = await spaceData(formData);
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
  const { space } = await spaceData(formData);
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
  const { space } = await spaceData(formData);
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
  const slug = await uniquePostSlug(parsed.data.title);
  let post: {
    id: string;
    slug: string | null;
    space: { slug: string } | null;
  };
  try {
    post = await database.communityPost.create({
      data: {
        spaceId: space?.id ?? null,
        authorId: userId,
        idempotencyKey,
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
  await ensureTopicFollow(userId, post.id);
  await notifyCommunityPost({
    actorId: userId,
    postId: post.id,
    postTitle: parsed.data.title,
    commentContent: parsed.data.content,
    document,
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
  await consumeMutationRateLimit({
    action: "community.mutation",
    memberId: userId,
  });
  const { spaceId, space } = await spaceData(formData);
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
  const slug = await uniquePostSlug(parsed.data.title, post.id);
  const updatedPost = await database.communityPost.update({
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
  await ensureTopicFollow(userId, updatedPost.id);
  await notifyCommunityPost({
    actorId: userId,
    postId: updatedPost.id,
    postTitle: parsed.data.title,
    commentContent: parsed.data.content,
    document,
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
  const { spaceId, space } = await spaceData(formData);
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
  if (post.status === ContentStatus.PUBLISHED) {
    await notifyCommunityPost({
      actorId: userId,
      postId: post.id,
      postTitle: parsed.data.title,
      commentContent: parsed.data.content,
      document,
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
    select: {
      authorId: true,
      title: true,
      content: true,
      contentJson: true,
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
    !publishRequestIsValid(post, formData)
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
    return;
  }
  await consumeMutationRateLimit({
    action: "community.bookmark",
    memberId: userId,
  });
  const post = await database.communityPost.findFirst({
    where: publishedPostWhere(postId, spaceSlug || undefined),
    select: { id: true, slug: true, space: { select: { slug: true } } },
  });
  if (!post) {
    return;
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
    where: publishedPostWhere(postId, spaceSlug || undefined),
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
    where: publishedPostWhere(postId, spaceSlug || undefined),
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
      post: { is: publishedPostWhere(postId, spaceSlug || undefined) },
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
    return;
  }
  await consumeMutationRateLimit({
    action: "community.vote",
    memberId: userId,
  });
  const post = await database.communityPost.findFirst({
    where: publishedPostWhere(postId, spaceSlug || undefined),
    select: { id: true, slug: true, space: { select: { slug: true } } },
  });
  if (!post) {
    return;
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
      post: { is: publishedPostWhere(postId, spaceSlug || undefined) },
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
      ...publishedPostWhere(postId, spaceSlug || undefined),
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
    where: { ...publishedPostWhere(postId, spaceSlug || undefined) },
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
