"use server";

import { auth } from "@repo/auth/server";
import {
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
import { getOrCreateProfile } from "@/lib/profile";

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

  return {
    document,
    plainText,
  };
};

const revalidateCommunity = (spaceSlug?: string, postId?: string) => {
  revalidatePath("/comunidade");
  revalidatePath("/comunidade/meus-topicos");
  if (spaceSlug) {
    revalidatePath(`/comunidade/${spaceSlug}`);
  }
  if (spaceSlug && postId) {
    revalidatePath(`/comunidade/${spaceSlug}/${postId}`);
  }
};

const canManagePost = (authorId: string, userId: string, role: string) =>
  authorId === userId || role === "TEACHER" || role === "ADMIN";

export const createPost = async (formData: FormData) => {
  const userId = await currentUserId();
  const spaceId = textValue(formData.get("spaceId"));
  const providedSpaceSlug = textValue(formData.get("spaceSlug"));
  const statusValue = textValue(formData.get("status"));
  const status =
    statusValue === "DRAFT" ? ContentStatus.DRAFT : ContentStatus.PUBLISHED;

  if (!(userId && spaceId)) {
    return;
  }

  const { document, plainText } = contentFromForm(formData);
  const parsed = postInput.safeParse({
    title: textValue(formData.get("title")),
    content: plainText,
  });

  if (!parsed.success) {
    return;
  }

  const space = await database.communitySpace.findFirst({
    where: {
      id: spaceId,
      ...(providedSpaceSlug ? { slug: providedSpaceSlug } : {}),
      status: ContentStatus.PUBLISHED,
    },
    select: { id: true, slug: true },
  });
  if (!space) {
    return;
  }

  await getOrCreateProfile(userId);
  const post = await database.communityPost.create({
    data: {
      spaceId,
      authorId: userId,
      title: parsed.data.title,
      content: parsed.data.content,
      contentJson: document as Prisma.InputJsonValue | undefined,
      status,
    },
    select: { id: true },
  });

  revalidateCommunity(space.slug, post.id);
  redirect(
    status === ContentStatus.DRAFT
      ? "/comunidade/meus-topicos?saved=draft"
      : `/comunidade/${space.slug}/${post.id}`
  );
};

export const updatePost = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  if (!(userId && postId && spaceSlug)) {
    return;
  }

  const { document, plainText } = contentFromForm(formData);
  const parsed = postInput.safeParse({
    title: textValue(formData.get("title")),
    content: plainText,
  });
  if (!parsed.success) {
    return;
  }

  const post = await database.communityPost.findFirst({
    where: { id: postId, space: { slug: spaceSlug }, deletedAt: null },
    select: { id: true, authorId: true },
  });
  if (!post || post.authorId !== userId) {
    return;
  }

  await database.communityPost.update({
    where: { id: postId },
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      contentJson: document as Prisma.InputJsonValue | undefined,
    },
  });
  revalidateCommunity(spaceSlug, postId);
  redirect(`/comunidade/${spaceSlug}/${postId}`);
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
      spaceSlug &&
      [
        ContentStatus.DRAFT,
        ContentStatus.PUBLISHED,
        ContentStatus.ARCHIVED,
      ].includes(requestedStatus as ContentStatus)
    )
  ) {
    return;
  }

  const post = await database.communityPost.findFirst({
    where: { id: postId, space: { slug: spaceSlug }, deletedAt: null },
    select: { authorId: true },
  });
  const role = await getMemberRole(userId);
  if (!(post && canManagePost(post.authorId, userId, role))) {
    return;
  }

  await database.communityPost.update({
    where: { id: postId },
    data: { status: requestedStatus as ContentStatus },
  });
  revalidateCommunity(spaceSlug, postId);
  let destination = `/comunidade/${spaceSlug}/${postId}`;
  if (requestedStatus === ContentStatus.ARCHIVED) {
    destination = "/comunidade";
  } else if (requestedStatus === ContentStatus.DRAFT) {
    destination = "/comunidade/meus-topicos";
  }
  redirect(destination);
};

export const createComment = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const content = textValue(formData.get("content"));
  const parentId = textValue(formData.get("parentId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));

  if (!(userId && postId && content && spaceSlug) || content.length > 10_000) {
    return;
  }
  const post = await database.communityPost.findFirst({
    where: {
      id: postId,
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      space: { slug: spaceSlug, status: ContentStatus.PUBLISHED },
    },
    select: { id: true },
  });
  if (!post) {
    return;
  }

  if (parentId) {
    const parent = await database.communityComment.findFirst({
      where: { id: parentId, postId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) {
      return;
    }
  }

  await getOrCreateProfile(userId);
  await database.communityComment.create({
    data: { postId, authorId: userId, content, parentId: parentId || null },
  });
  revalidateCommunity(spaceSlug, postId);
};

export const updateComment = async (formData: FormData) => {
  const userId = await currentUserId();
  const commentId = textValue(formData.get("commentId"));
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const content = textValue(formData.get("content"));
  if (
    !(userId && commentId && postId && spaceSlug && content) ||
    content.length > 10_000
  ) {
    return;
  }

  const comment = await database.communityComment.findFirst({
    where: {
      id: commentId,
      postId,
      authorId: userId,
      deletedAt: null,
      post: {
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
        space: { slug: spaceSlug, status: ContentStatus.PUBLISHED },
      },
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
  revalidateCommunity(spaceSlug, postId);
};

export const togglePostVote = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  if (!(userId && postId && spaceSlug)) {
    return;
  }

  const post = await database.communityPost.findFirst({
    where: { id: postId, status: ContentStatus.PUBLISHED, deletedAt: null },
    select: { id: true },
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
  revalidateCommunity(spaceSlug, postId);
};

export const toggleCommentVote = async (formData: FormData) => {
  const userId = await currentUserId();
  const commentId = textValue(formData.get("commentId"));
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  if (!(userId && commentId && postId && spaceSlug)) {
    return;
  }

  const comment = await database.communityComment.findFirst({
    where: {
      id: commentId,
      postId,
      deletedAt: null,
      post: {
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
        space: { slug: spaceSlug, status: ContentStatus.PUBLISHED },
      },
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
  revalidateCommunity(spaceSlug, postId);
};

export const softDeletePost = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  if (!(userId && postId && spaceSlug)) {
    return;
  }
  const post = await database.communityPost.findFirst({
    where: { id: postId, space: { slug: spaceSlug } },
    select: { authorId: true },
  });
  const role = await getMemberRole(userId);
  if (!(post && canManagePost(post.authorId, userId, role))) {
    return;
  }
  await database.communityPost.update({
    where: { id: postId },
    data: { deletedAt: new Date(), status: ContentStatus.ARCHIVED },
  });
  revalidateCommunity(spaceSlug, postId);
  redirect(`/comunidade/${spaceSlug}`);
};

export const softDeleteComment = async (formData: FormData) => {
  const userId = await currentUserId();
  const commentId = textValue(formData.get("commentId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const postId = textValue(formData.get("postId"));
  if (!(userId && commentId && spaceSlug && postId)) {
    return;
  }
  const comment = await database.communityComment.findFirst({
    where: { id: commentId, post: { id: postId, space: { slug: spaceSlug } } },
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
  revalidateCommunity(spaceSlug, postId);
};

export const togglePostPin = async (formData: FormData) => {
  await requireStaff();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  if (!(postId && spaceSlug)) {
    return;
  }
  const post = await database.communityPost.findFirst({
    where: { id: postId, space: { slug: spaceSlug }, deletedAt: null },
    select: { isPinned: true },
  });
  if (!post) {
    return;
  }
  await database.communityPost.update({
    where: { id: postId },
    data: { isPinned: !post.isPinned },
  });
  revalidateCommunity(spaceSlug, postId);
};

export const createSpace = async (formData: FormData) => {
  await requireStaff();
  const title = textValue(formData.get("title"));
  const slug = textValue(formData.get("slug")).toLowerCase();
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
