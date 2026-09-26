import "server-only";

import { ContentStatus, database, type Prisma } from "@repo/database";
import type { MutationAction } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
  isUniqueConstraintError,
  mutationLog,
} from "@/lib/mutation-reliability";
import {
  documentHasGroupMention,
  notifyCommunityComment,
} from "@/lib/notifications";
import { getOrCreateProfile } from "@/lib/profile";

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

const ensureTopicFollow = (userId: string, topicId: string) =>
  database.topicFollow.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: { userId, topicId },
    update: {},
    select: { id: true },
  });

export interface CreateCommunityCommentInput {
  readonly actorId: string;
  readonly content: string;
  readonly document: Prisma.InputJsonValue | undefined;
  readonly groupMentionConfirmed: boolean;
  readonly idempotencyKey: string;
  readonly parentId: string | null;
  readonly postId: string;
  readonly requestId?: string;
  readonly spaceSlug?: string;
}

export interface CreateCommunityCommentResult {
  readonly commentId: string;
  readonly duplicate: boolean;
  readonly postHref: string;
  readonly postId: string;
}

interface CommentNotificationPost {
  readonly authorId: string;
  readonly id: string;
  readonly slug: string | null;
  readonly space: { readonly slug: string } | null;
  readonly title: string;
}

interface CommentNotificationRecord {
  readonly content: string;
  readonly contentJson: unknown;
  readonly id: string;
  readonly parentId: string | null;
  readonly postId: string;
}

const reconcileCommentEffects = async ({
  actorId,
  document,
  post,
  record,
}: {
  readonly actorId: string;
  readonly document?: unknown;
  readonly post: CommentNotificationPost;
  readonly record: CommentNotificationRecord;
}) => {
  let parentAuthorId: string | null = null;
  if (record.parentId) {
    const parent = await database.communityComment.findUnique({
      where: { id: record.parentId },
      select: { authorId: true },
    });
    parentAuthorId = parent?.authorId ?? null;
  }
  await ensureTopicFollow(actorId, record.postId);
  await notifyCommunityComment({
    actorId,
    postId: record.postId,
    commentId: record.id,
    commentContent: record.content,
    postAuthorId: post.authorId,
    postTitle: post.title,
    parentCommentId: record.parentId,
    parentAuthorId,
    href: communityHref(post),
    document,
  });
};

const validateCommentInput = (input: CreateCommunityCommentInput) => {
  if (
    !input.content ||
    input.content.length > 10_000 ||
    (documentHasGroupMention(input.document) && !input.groupMentionConfirmed)
  ) {
    throw new Error("Revise o conteúdo do comentário antes de enviar.");
  }
};

const commentSelect = {
  id: true,
  postId: true,
  content: true,
  contentJson: true,
  parentId: true,
  post: {
    select: {
      id: true,
      authorId: true,
      title: true,
      slug: true,
      space: { select: { slug: true } },
    },
  },
} satisfies Prisma.CommunityCommentSelect;

const loadExistingComment = (input: CreateCommunityCommentInput) =>
  database.communityComment.findUnique({
    where: {
      authorId_idempotencyKey: {
        authorId: input.actorId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    select: commentSelect,
  });

const returnExistingComment = async ({
  existing,
  input,
  startedAt,
}: {
  readonly existing: Prisma.CommunityCommentGetPayload<{
    select: typeof commentSelect;
  }>;
  readonly input: CreateCommunityCommentInput;
  readonly startedAt: number;
}): Promise<CreateCommunityCommentResult> => {
  await reconcileCommentEffects({
    actorId: input.actorId,
    post: existing.post,
    record: {
      content: existing.content,
      contentJson: existing.contentJson,
      id: existing.id,
      parentId: existing.parentId,
      postId: existing.postId,
    },
    document: existing.contentJson ?? undefined,
  });
  mutationLog({
    action: "community.comment.create",
    memberId: input.actorId,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    resource: existing.id,
    status: "duplicate",
    durationMs: Date.now() - startedAt,
  });
  return {
    commentId: existing.id,
    duplicate: true,
    postId: existing.postId,
    postHref: communityHref(existing.post),
  };
};

const createOrReuseComment = async ({
  input,
}: {
  readonly input: CreateCommunityCommentInput;
}): Promise<{
  readonly comment: { readonly id: string };
  readonly duplicate: boolean;
}> => {
  try {
    return {
      comment: await database.communityComment.create({
        data: {
          postId: input.postId,
          authorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          content: input.content,
          contentJson: input.document,
          parentId: input.parentId,
        },
        select: { id: true },
      }),
      duplicate: false,
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const racedComment = await database.communityComment.findUnique({
      where: {
        authorId_idempotencyKey: {
          authorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      select: { id: true },
    });
    if (!racedComment) {
      throw error;
    }
    return { comment: racedComment, duplicate: true };
  }
};

export const createCommunityComment = async (
  input: CreateCommunityCommentInput
): Promise<CreateCommunityCommentResult> => {
  const startedAt = Date.now();
  const action: MutationAction = "community.comment.create";

  validateCommentInput(input);

  const existing = await loadExistingComment(input);

  if (existing) {
    return returnExistingComment({ existing, input, startedAt });
  }

  try {
    await consumeMutationRateLimit({ action, memberId: input.actorId });
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      mutationLog({
        action,
        memberId: input.actorId,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
        status: "rate_limited",
        durationMs: Date.now() - startedAt,
      });
    }
    throw error;
  }

  const post = await database.communityPost.findFirst({
    where: publishedPostWhere(input.postId, input.spaceSlug),
    select: {
      id: true,
      authorId: true,
      title: true,
      slug: true,
      space: { select: { slug: true, commentsClosed: true } },
    },
  });

  if (!post || post.space?.commentsClosed) {
    throw new Error("Esta discussão não está disponível para comentários.");
  }

  if (input.parentId) {
    const parent = await database.communityComment.findFirst({
      where: {
        id: input.parentId,
        postId: input.postId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!parent) {
      throw new Error("A resposta original não está mais disponível.");
    }
  }

  await getOrCreateProfile(input.actorId);

  let comment: { id: string };
  let duplicate: boolean;
  try {
    ({ comment, duplicate } = await createOrReuseComment({ input }));
  } catch (error) {
    mutationLog({
      action,
      memberId: input.actorId,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      status: "error",
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }

  if (duplicate) {
    const canonical = await database.communityComment.findUnique({
      where: { id: comment.id },
      select: {
        id: true,
        postId: true,
        content: true,
        contentJson: true,
        parentId: true,
      },
    });
    if (!canonical) {
      throw new Error("O comentário criado não pôde ser recuperado.");
    }
    await reconcileCommentEffects({
      actorId: input.actorId,
      post,
      record: canonical,
      document: canonical.contentJson ?? input.document,
    });
  } else {
    await reconcileCommentEffects({
      actorId: input.actorId,
      post,
      record: {
        content: input.content,
        contentJson: input.document,
        id: comment.id,
        parentId: input.parentId,
        postId: post.id,
      },
      document: input.document,
    });
  }

  mutationLog({
    action,
    memberId: input.actorId,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    resource: comment.id,
    status: duplicate ? "duplicate" : "success",
    durationMs: Date.now() - startedAt,
  });

  return {
    commentId: comment.id,
    duplicate,
    postId: post.id,
    postHref: communityHref(post),
  };
};
