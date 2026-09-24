"use server";

import { auth } from "@repo/auth/server";
import { CommunityVoteKind, ContentStatus, database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { getMemberRole, requireStaff } from "@/lib/authorization";

const textValue = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const currentUserId = async () => {
  const { userId } = await auth();
  return userId;
};

export const createPost = async (formData: FormData) => {
  const userId = await currentUserId();
  const spaceId = textValue(formData.get("spaceId"));
  const title = textValue(formData.get("title"));
  const content = textValue(formData.get("content"));
  const spaceSlug = textValue(formData.get("spaceSlug"));

  if (!(userId && spaceId && title && content && spaceSlug)) {
    return;
  }

  const space = await database.communitySpace.findFirst({
    where: { id: spaceId, status: ContentStatus.PUBLISHED },
    select: { id: true },
  });

  if (!space) {
    return;
  }

  const post = await database.communityPost.create({
    data: {
      spaceId,
      authorId: userId,
      title,
      content,
      status: ContentStatus.PUBLISHED,
    },
    select: { id: true },
  });

  revalidatePath(`/comunidade/${spaceSlug}`);
  revalidatePath(`/comunidade/${spaceSlug}/${post.id}`);
};

export const createComment = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const content = textValue(formData.get("content"));
  const parentId = textValue(formData.get("parentId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));

  if (!(userId && postId && content && spaceSlug)) {
    return;
  }

  const post = await database.communityPost.findFirst({
    where: { id: postId, status: ContentStatus.PUBLISHED, deletedAt: null },
    select: { id: true },
  });

  if (!post) {
    return;
  }

  await database.communityComment.create({
    data: {
      postId,
      authorId: userId,
      content,
      parentId: parentId || null,
    },
  });

  revalidatePath(`/comunidade/${spaceSlug}/${postId}`);
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

  revalidatePath(`/comunidade/${spaceSlug}`);
  revalidatePath(`/comunidade/${spaceSlug}/${postId}`);
};

export const toggleCommentVote = async (formData: FormData) => {
  const userId = await currentUserId();
  const commentId = textValue(formData.get("commentId"));
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));

  if (!(userId && commentId && postId && spaceSlug)) {
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

  revalidatePath(`/comunidade/${spaceSlug}/${postId}`);
};

export const softDeletePost = async (formData: FormData) => {
  const userId = await currentUserId();
  const postId = textValue(formData.get("postId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));

  if (!(userId && postId && spaceSlug)) {
    return;
  }

  const post = await database.communityPost.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  const role = await getMemberRole(userId);

  if (
    !post ||
    (post.authorId !== userId && role !== "TEACHER" && role !== "ADMIN")
  ) {
    return;
  }

  await database.communityPost.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/comunidade/${spaceSlug}`);
  revalidatePath(`/comunidade/${spaceSlug}/${postId}`);
};

export const softDeleteComment = async (formData: FormData) => {
  const userId = await currentUserId();
  const commentId = textValue(formData.get("commentId"));
  const spaceSlug = textValue(formData.get("spaceSlug"));
  const postId = textValue(formData.get("postId"));

  if (!(userId && commentId && spaceSlug && postId)) {
    return;
  }

  const comment = await database.communityComment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });
  const role = await getMemberRole(userId);

  if (
    !comment ||
    (comment.authorId !== userId && role !== "TEACHER" && role !== "ADMIN")
  ) {
    return;
  }

  await database.communityComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/comunidade/${spaceSlug}/${postId}`);
  revalidatePath("/admin/community");
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
