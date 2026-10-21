import "server-only";

import { ContentStatus, database, type Prisma } from "@repo/database";
import {
  communityPostMutationAudienceWhere,
  communitySpaceMemberAudienceWhere,
} from "@/lib/community-space-rules";
import type { MutationAction } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
  isUniqueConstraintError,
  mutationLog,
} from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";
import {
  documentHasGroupMention,
  notifyCommunityComment,
} from "@/lib/notifications";
import { getOrCreateProfile } from "@/lib/profile";

const publishedPostWhere = async (
  postId: string,
  memberId: string,
  spaceSlug: string | undefined,
  transaction: Prisma.TransactionClient
) => {
  const member = await transaction.member.findUnique({
    where: { id: memberId },
    select: { role: true, deactivatedAt: true },
  });
  if (!member || member.deactivatedAt) {
    return { id: `inactive-member:${memberId}` };
  }
  const canModerate = member.role === "TEACHER" || member.role === "ADMIN";
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
              ...communitySpaceMemberAudienceWhere(memberId, canModerate),
            },
          },
        }
      : communityPostMutationAudienceWhere(memberId, canModerate)),
  };
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
  readonly createdAt: Date;
  readonly id: string;
  readonly parentId: string | null;
  readonly postId: string;
}

const reconcileCommentEffects = async ({
  transaction,
  actorId,
  document,
  enqueueNotifications = true,
  post,
  record,
}: {
  readonly transaction: Prisma.TransactionClient;
  readonly actorId: string;
  readonly document?: unknown;
  readonly enqueueNotifications?: boolean;
  readonly post: CommentNotificationPost;
  readonly record: CommentNotificationRecord;
}) => {
  let parentAuthorId: string | null = null;
  if (record.parentId) {
    const parent = await transaction.communityComment.findUnique({
      where: { id: record.parentId },
      select: { authorId: true },
    });
    parentAuthorId = parent?.authorId ?? null;
  }
  await transaction.topicFollow.upsert({
    where: { userId_topicId: { userId: actorId, topicId: record.postId } },
    create: { userId: actorId, topicId: record.postId },
    update: {},
    select: { id: true },
  });
  if (!enqueueNotifications) {
    return;
  }
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
    occurredAt: record.createdAt,
    idempotencyKey: `community-comment:${record.id}:created`,
    transaction,
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
  createdAt: true,
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

const loadExistingComment = (
  transaction: Prisma.TransactionClient,
  input: CreateCommunityCommentInput
) =>
  transaction.communityComment.findUnique({
    where: {
      authorId_idempotencyKey: {
        authorId: input.actorId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    select: commentSelect,
  });

const visiblePost = async (
  transaction: Prisma.TransactionClient,
  input: CreateCommunityCommentInput,
  postId = input.postId,
  spaceSlug = input.spaceSlug
) =>
  transaction.communityPost.findFirst({
    where: await publishedPostWhere(
      postId,
      input.actorId,
      spaceSlug,
      transaction
    ),
    select: {
      id: true,
      authorId: true,
      title: true,
      slug: true,
      space: { select: { slug: true, commentsClosed: true } },
    },
  });

const ensureCommentCanBeCreated = async (
  transaction: Prisma.TransactionClient,
  input: CreateCommunityCommentInput
) => {
  const post = await visiblePost(transaction, input);
  if (!post || post.space?.commentsClosed) {
    throw new Error("Esta discussão não está disponível para comentários.");
  }

  if (input.parentId) {
    const parent = await transaction.communityComment.findFirst({
      where: {
        id: input.parentId,
        postId: input.postId,
        parentId: null,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!parent) {
      throw new Error("A resposta original não está mais disponível.");
    }
  }

  return post;
};

const reconcileExistingComment = async (
  transaction: Prisma.TransactionClient,
  input: CreateCommunityCommentInput
) => {
  const existing = await loadExistingComment(transaction, input);
  if (!existing) {
    return null;
  }
  const post = await visiblePost(
    transaction,
    input,
    existing.postId,
    existing.post.space?.slug ?? undefined
  );
  if (!post) {
    throw new Error("Esta discussão não está disponível para comentários.");
  }
  const existingNotificationEvent = await transaction.domainEvent.findFirst({
    where: {
      eventType: "notifications.batch_requested",
      aggregateType: "COMMUNITY_COMMENT",
      aggregateId: existing.id,
    },
    select: { id: true },
  });
  await reconcileCommentEffects({
    transaction,
    actorId: input.actorId,
    enqueueNotifications: !existingNotificationEvent,
    post,
    record: existing,
    document: existing.contentJson ?? undefined,
  });
  return {
    commentId: existing.id,
    duplicate: true,
    postId: existing.postId,
    postHref: communityHref(post),
  } satisfies CreateCommunityCommentResult;
};

export const createCommunityComment = async (
  input: CreateCommunityCommentInput
): Promise<CreateCommunityCommentResult> => {
  const startedAt = Date.now();
  const action: MutationAction = "community.comment.create";

  validateCommentInput(input);

  const existing = await database.communityComment.findUnique({
    where: {
      authorId_idempotencyKey: {
        authorId: input.actorId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    select: { id: true },
  });

  if (existing) {
    const result = await database.$transaction((transaction) =>
      reconcileExistingComment(transaction, input)
    );
    if (!result) {
      throw new Error("O comentário criado não pôde ser recuperado.");
    }
    await dispatchPendingNotifications();
    mutationLog({
      action,
      memberId: input.actorId,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      resource: result.commentId,
      status: "duplicate",
      durationMs: Date.now() - startedAt,
    });
    return result;
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

  await ensureCommentCanBeCreated(database, input);

  await getOrCreateProfile(input.actorId);

  let result: CreateCommunityCommentResult;
  try {
    result = await database.$transaction(async (transaction) => {
      const concurrent = await reconcileExistingComment(transaction, input);
      if (concurrent) {
        return concurrent;
      }

      const post = await ensureCommentCanBeCreated(transaction, input);

      const comment = await transaction.communityComment.create({
        data: {
          postId: input.postId,
          authorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          content: input.content,
          contentJson: input.document,
          parentId: input.parentId,
        },
        select: { id: true, createdAt: true },
      });
      await reconcileCommentEffects({
        transaction,
        actorId: input.actorId,
        post,
        record: {
          content: input.content,
          contentJson: input.document,
          createdAt: comment.createdAt,
          id: comment.id,
          parentId: input.parentId,
          postId: post.id,
        },
        document: input.document,
      });
      return {
        commentId: comment.id,
        duplicate: false,
        postId: post.id,
        postHref: communityHref(post),
      };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      try {
        const duplicate = await database.$transaction((transaction) =>
          reconcileExistingComment(transaction, input)
        );
        if (duplicate) {
          result = duplicate;
        } else {
          throw error;
        }
      } catch (retryError) {
        mutationLog({
          action,
          memberId: input.actorId,
          requestId: input.requestId,
          idempotencyKey: input.idempotencyKey,
          status: "error",
          durationMs: Date.now() - startedAt,
        });
        throw retryError;
      }
    } else {
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
  }

  await dispatchPendingNotifications();

  mutationLog({
    action,
    memberId: input.actorId,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    resource: result.commentId,
    status: result.duplicate ? "duplicate" : "success",
    durationMs: Date.now() - startedAt,
  });

  return result;
};
