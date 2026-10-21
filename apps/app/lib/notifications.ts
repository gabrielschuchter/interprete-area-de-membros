import "server-only";

import {
  AnnouncementAudience,
  ContentStatus,
  database,
  MemberRole,
  type Prisma,
} from "@repo/database";
import {
  enqueueNotificationBatch,
  notificationPreferenceForType,
  notificationTitleForType,
} from "@repo/member-domain";
import { tracePerformance } from "@repo/observability/performance";
import { env } from "@/env";
import { getMemberRole } from "./authorization";
import {
  mergeNotificationRecipients,
  notificationFilterTypes,
  notificationPriority,
} from "./notifications-domain";

export const notificationTypes = {
  mention: "MENTION",
  commentReply: "COMMENT_REPLY",
  topicComment: "TOPIC_COMMENT",
  followedTopicActivity: "FOLLOWED_TOPIC_ACTIVITY",
  lessonAvailable: "LESSON_AVAILABLE",
  moduleAvailable: "MODULE_AVAILABLE",
  activityAssigned: "ACTIVITY_ASSIGNED",
  feedbackReceived: "FEEDBACK_RECEIVED",
  activityDeadline: "ACTIVITY_DEADLINE",
  announcement: "ANNOUNCEMENT",
  groupInvitation: "GROUP_INVITATION",
  groupPost: "GROUP_POST",
  contentAssigned: "LEARNING_CONTENT_ASSIGNED",
  badgeAwarded: "BADGE_AWARDED",
  plannerReminder: "PLANNER_REMINDER",
} as const;

export type NotificationType =
  (typeof notificationTypes)[keyof typeof notificationTypes];

export type NotificationEntityType =
  | "TOPIC"
  | "COMMENT"
  | "ACTIVITY"
  | "SUBMISSION"
  | "LESSON"
  | "MODULE"
  | "MEETING"
  | "ANNOUNCEMENT"
  | "COMMUNITY_INVITATION"
  | "BADGE"
  | "LEARNING_TASK";

export type NotificationFilter =
  | "ALL"
  | "MENTIONS"
  | "COMMUNITY"
  | "ACTIVITIES"
  | "LEARNING"
  | "BADGES";

const priorityForType: Record<NotificationType, number> = {
  ...notificationPriority,
};

const titleForType: Record<NotificationType, string> = {
  ...notificationTitleForType,
};

const commentHref = (href: string, commentId: string) =>
  `${href}${href.includes("?") ? "&" : "?"}commentId=${encodeURIComponent(commentId)}#comment-${encodeURIComponent(commentId)}`;

const filterTypes = notificationFilterTypes;

interface NotificationCursor {
  readonly createdAt: string;
  readonly id: string;
  readonly priority: number;
}

const encodeNotificationCursor = (value: NotificationCursor) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const decodeNotificationCursor = (value: string | undefined) => {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as Partial<NotificationCursor>;
    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      typeof parsed.priority !== "number"
    ) {
      return null;
    }
    const createdAt = new Date(parsed.createdAt);
    return Number.isNaN(createdAt.valueOf())
      ? null
      : { createdAt, id: parsed.id, priority: parsed.priority };
  } catch {
    return null;
  }
};

const memberNotificationAudienceWhere = async (
  memberId: string
): Promise<Prisma.NotificationWhereInput> => {
  const groups = await database.communitySpace.findMany({
    where: {
      OR: [{ ownerId: memberId }, { members: { some: { memberId } } }],
    },
    select: { id: true },
  });
  return {
    OR: [
      { type: { not: notificationTypes.groupPost } },
      {
        type: notificationTypes.groupPost,
        groupKey: { in: groups.map(({ id }) => id) },
      },
    ],
  };
};

const isNotificationType = (value: string): value is NotificationType =>
  Object.values(notificationTypes).includes(value as NotificationType);

const asNotificationType = (value: string): NotificationType =>
  isNotificationType(value) ? value : "ANNOUNCEMENT";

const preferenceEnabled = async (memberId: string, type: NotificationType) => {
  const preference = await database.notificationPreference.findUnique({
    where: { memberId },
    select: {
      mentions: true,
      commentReplies: true,
      topicComments: true,
      followedTopicActivity: true,
      lessonAvailable: true,
      moduleAvailable: true,
      activityAssigned: true,
      feedbackReceived: true,
      activityDeadline: true,
      announcements: true,
      groupInvitations: true,
      groupPosts: true,
      contentAssignments: true,
    },
  });

  if (!preference) {
    return true;
  }

  const preferenceKey =
    notificationPreferenceForType[
      type as keyof typeof notificationPreferenceForType
    ];
  return preferenceKey
    ? (preference[preferenceKey as keyof typeof preference] as boolean)
    : true;
};

export const getOrCreateNotificationPreferences = async (memberId: string) => {
  if (env.APP_WRITE_FREEZE === "true") {
    const current = await database.notificationPreference.findUnique({
      where: { memberId },
      select: {
        memberId: true,
        mentions: true,
        commentReplies: true,
        topicComments: true,
        followedTopicActivity: true,
        lessonAvailable: true,
        moduleAvailable: true,
        activityAssigned: true,
        feedbackReceived: true,
        activityDeadline: true,
        announcements: true,
        groupInvitations: true,
        groupPosts: true,
        contentAssignments: true,
      },
    });

    return (
      current ?? {
        memberId,
        mentions: true,
        commentReplies: true,
        topicComments: true,
        followedTopicActivity: true,
        lessonAvailable: true,
        moduleAvailable: true,
        activityAssigned: true,
        feedbackReceived: true,
        activityDeadline: true,
        announcements: true,
        groupInvitations: true,
        groupPosts: true,
        contentAssignments: true,
      }
    );
  }

  return database.notificationPreference.upsert({
    where: { memberId },
    create: { memberId },
    update: {},
  });
};

export const getNotificationFilterTypes = (filter: NotificationFilter) =>
  filter === "ALL" ? undefined : { in: [...filterTypes[filter]] };

export const createNotification = async (input: {
  readonly recipientId?: string;
  readonly memberId?: string;
  readonly actorId?: string | null;
  readonly type: NotificationType | string;
  readonly entityType?: NotificationEntityType | string;
  readonly entityId?: string;
  readonly parentEntityType?: NotificationEntityType | string;
  readonly parentEntityId?: string;
  readonly metadata?: Prisma.InputJsonValue;
  readonly groupKey?: string;
  readonly dedupeKey?: string;
  readonly body?: string;
  readonly href?: string;
  readonly title?: string;
  readonly bypassPreference?: boolean;
}) => {
  const recipientId = input.recipientId ?? input.memberId;
  if (!recipientId || recipientId === input.actorId) {
    return null;
  }

  const type = asNotificationType(input.type);
  if (
    !(input.bypassPreference || (await preferenceEnabled(recipientId, type)))
  ) {
    return null;
  }

  try {
    return await database.notification.create({
      data: {
        memberId: recipientId,
        actorId: input.actorId ?? null,
        type,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        parentEntityType: input.parentEntityType ?? null,
        parentEntityId: input.parentEntityId ?? null,
        metadata: input.metadata,
        groupKey: input.groupKey ?? null,
        dedupeKey: input.dedupeKey ?? null,
        priority: priorityForType[type],
        title: input.title ?? titleForType[type],
        body: input.body ?? null,
        href: input.href ?? null,
      },
      select: { id: true },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return null;
    }
    throw error;
  }
};

export const markNotificationsSeen = (
  memberId: string,
  notificationIds: readonly string[]
) => {
  const ids = [...new Set(notificationIds.filter(Boolean))];
  if (ids.length === 0) {
    return { count: 0 };
  }
  return database.notification.updateMany({
    where: { id: { in: ids }, memberId, seenAt: null },
    data: { seenAt: new Date() },
  });
};

export const markNotificationRead = (
  memberId: string,
  notificationId: string
) =>
  database.notification.updateMany({
    where: { id: notificationId, memberId, readAt: null },
    data: { readAt: new Date(), seenAt: new Date() },
  });

export const markNotificationUnread = (
  memberId: string,
  notificationId: string
) =>
  database.notification.updateMany({
    where: { id: notificationId, memberId },
    data: { readAt: null },
  });

export const markAllNotificationsRead = (memberId: string) =>
  database.notification.updateMany({
    where: { memberId, readAt: null },
    data: { readAt: new Date(), seenAt: new Date() },
  });

const notificationSelect = {
  id: true,
  memberId: true,
  actorId: true,
  type: true,
  entityType: true,
  entityId: true,
  parentEntityType: true,
  parentEntityId: true,
  metadata: true,
  groupKey: true,
  priority: true,
  title: true,
  body: true,
  href: true,
  seenAt: true,
  readAt: true,
  createdAt: true,
  actor: {
    select: {
      displayName: true,
      avatarUrl: true,
      profile: {
        select: { username: true, displayName: true, avatarUrl: true },
      },
    },
  },
} as const;

export const getNotifications = async (
  memberId: string,
  options: {
    readonly cursor?: string;
    readonly limit?: number;
    readonly filter?: NotificationFilter;
  } = {}
) => {
  const limit = Math.min(Math.max(options.limit ?? 24, 1), 50);
  const types = options.filter
    ? getNotificationFilterTypes(options.filter)
    : undefined;
  const [audienceWhere, baseWhere] = await Promise.all([
    memberNotificationAudienceWhere(memberId),
    Promise.resolve({ memberId, ...(types ? { type: types } : {}) }),
  ]);
  const visibleBaseWhere = { AND: [baseWhere, audienceWhere] };
  const cursor = decodeNotificationCursor(options.cursor);
  const where = cursor
    ? {
        AND: [
          visibleBaseWhere,
          {
            OR: [
              { priority: { lt: cursor.priority } },
              {
                priority: cursor.priority,
                createdAt: { lt: cursor.createdAt },
              },
              {
                priority: cursor.priority,
                createdAt: cursor.createdAt,
                id: { lt: cursor.id },
              },
            ],
          },
        ],
      }
    : visibleBaseWhere;
  const items = await database.notification.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: notificationSelect,
  });
  const hasMore = items.length > limit;
  if (hasMore) {
    items.pop();
  }
  const [unreadCount, unseenCount] = await Promise.all([
    database.notification.count({
      where: { AND: [visibleBaseWhere, { readAt: null }] },
    }),
    database.notification.count({
      where: { AND: [visibleBaseWhere, { seenAt: null }] },
    }),
  ]);
  return {
    items,
    unreadCount,
    unseenCount,
    nextCursor: hasMore
      ? (() => {
          const last = items.at(-1);
          return last
            ? encodeNotificationCursor({
                createdAt: last.createdAt.toISOString(),
                id: last.id,
                priority: last.priority,
              })
            : null;
        })()
      : null,
  };
};

export const getRecentCommunityAnnouncements = async (
  memberId: string,
  limit = 3
) => {
  const [role, now] = await Promise.all([
    getMemberRole(memberId),
    Promise.resolve(new Date()),
  ]);
  const isStaff = role === MemberRole.TEACHER || role === MemberRole.ADMIN;
  const announcements = await tracePerformance(
    "member.community.announcements",
    () =>
      database.announcement.findMany({
        where: {
          status: ContentStatus.PUBLISHED,
          deletedAt: null,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          ],
          OR: [
            { audience: AnnouncementAudience.ALL },
            ...(isStaff ? [{ audience: AnnouncementAudience.STAFF }] : []),
            {
              audience: AnnouncementAudience.SELECTED,
              recipientIds: { has: memberId },
            },
          ],
        },
        orderBy: [
          { isPinned: "desc" },
          { publishedAt: "desc" },
          { id: "desc" },
        ],
        take: Math.min(Math.max(limit, 1), 3),
        select: {
          id: true,
          title: true,
          body: true,
          href: true,
          createdAt: true,
          publishedAt: true,
        },
      })
  );
  return announcements.map((announcement) => ({
    ...announcement,
    createdAt: announcement.publishedAt ?? announcement.createdAt,
    groupKey: `announcement:${announcement.id}`,
  }));
};

export const getUnreadNotificationCount = async (memberId: string) =>
  database.notification.count({
    where: {
      AND: [
        { memberId, readAt: null },
        await memberNotificationAudienceWhere(memberId),
      ],
    },
  });

export const getUnseenNotificationCount = async (memberId: string) =>
  database.notification.count({
    where: {
      AND: [
        { memberId, seenAt: null },
        await memberNotificationAudienceWhere(memberId),
      ],
    },
  });

export const extractMentionUsernames = (content: string) =>
  [
    ...new Set(
      [...content.matchAll(/@([a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?)/gi)].map(
        (match) => match[1].toLowerCase()
      )
    ),
  ].slice(0, 20);

export const extractMentionIdsFromDocument = (value: unknown) => {
  const ids = new Set<string>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    if (
      record.type === "mention" &&
      record.attrs &&
      typeof record.attrs === "object"
    ) {
      const id = (record.attrs as Record<string, unknown>).id;
      if (typeof id === "string" && id) {
        ids.add(id);
      }
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return [...ids].slice(0, 20);
};

export const documentHasGroupMention = (value: unknown) =>
  extractMentionIdsFromDocument(value).some((id) => id.startsWith("group:"));

const groupIdsFromMentionIds = (ids: Set<string>) =>
  [...ids].filter((id) => id.startsWith("group:"));

const groupWhereForMention = (
  role: MemberRole | undefined,
  groupIds: readonly string[]
): Prisma.MemberWhereInput[] => {
  if (role === MemberRole.ADMIN) {
    return [
      ...(groupIds.includes("group:STAFF")
        ? [{ role: { in: [MemberRole.ADMIN, MemberRole.TEACHER] } }]
        : []),
      ...(groupIds.includes("group:STUDENTS")
        ? [{ role: MemberRole.MEMBER }]
        : []),
    ];
  }
  return role === MemberRole.TEACHER && groupIds.includes("group:STUDENTS")
    ? [{ role: MemberRole.MEMBER }]
    : [];
};

const expandMentionGroups = async (
  actorId: string,
  ids: Set<string>,
  transaction: Prisma.TransactionClient = database,
  context?: {
    readonly postId?: string;
    readonly postAuthorId?: string;
    readonly unmutedFollowerIds?: readonly string[];
  }
) => {
  const groupIds = groupIdsFromMentionIds(ids);
  if (groupIds.length === 0) {
    return;
  }
  const actor = await transaction.member.findUnique({
    where: { id: actorId },
    select: { role: true },
  });
  const groupWhere = groupWhereForMention(actor?.role, groupIds);
  if (groupWhere.length > 0) {
    const groupMembers = await transaction.member.findMany({
      where: { AND: [{ deactivatedAt: null }, { OR: groupWhere }] },
      select: { id: true },
    });
    for (const member of groupMembers) {
      ids.add(member.id);
    }
  }

  const canMentionAll =
    actor?.role === MemberRole.ADMIN || actor?.role === MemberRole.TEACHER;
  if (canMentionAll && groupIds.includes("group:ALL") && context?.postId) {
    const [comments, mutedFollows] = await Promise.all([
      transaction.communityComment.findMany({
        where: { postId: context.postId, deletedAt: null },
        select: { authorId: true },
      }),
      transaction.topicFollow.findMany({
        where: { topicId: context.postId, mutedAt: { not: null } },
        select: { userId: true },
      }),
    ]);
    const mutedIds = new Set(mutedFollows.map(({ userId }) => userId));
    const currentParticipants = new Set([
      ...comments.map(({ authorId }) => authorId),
      ...(context.postAuthorId ? [context.postAuthorId] : []),
      ...(context.unmutedFollowerIds ?? []),
    ]);
    for (const memberId of currentParticipants) {
      if (!mutedIds.has(memberId)) {
        ids.add(memberId);
      }
    }
  }
};

const resolveMentionTargets = async (
  ids: Set<string>,
  usernames: string[],
  transaction: Prisma.TransactionClient = database
) => {
  if (ids.size > 0) {
    const members = await transaction.member.findMany({
      where: { id: { in: [...ids] }, deactivatedAt: null },
      select: { id: true },
    });
    const validIds = new Set(members.map((member) => member.id));
    for (const id of ids) {
      if (!validIds.has(id)) {
        ids.delete(id);
      }
    }
  }
  if (usernames.length === 0) {
    return;
  }
  const profiles = await transaction.profile.findMany({
    where: { username: { in: usernames } },
    select: { clerkUserId: true },
  });
  for (const profile of profiles) {
    ids.add(profile.clerkUserId);
  }
};

export const resolveMentionedMemberIds = async (input: {
  readonly actorId: string;
  readonly content?: string;
  readonly document?: unknown;
  readonly postId?: string;
  readonly postAuthorId?: string;
  readonly unmutedFollowerIds?: readonly string[];
  readonly transaction?: Prisma.TransactionClient;
}) => {
  const transaction = input.transaction ?? database;
  const ids = new Set(extractMentionIdsFromDocument(input.document));
  const groupIds = groupIdsFromMentionIds(ids);
  const hasGroupMention = groupIds.length > 0;
  await expandMentionGroups(input.actorId, ids, transaction, {
    postId: input.postId,
    postAuthorId: input.postAuthorId,
    unmutedFollowerIds: input.unmutedFollowerIds,
  });
  for (const groupId of groupIds) {
    ids.delete(groupId);
  }
  const usernames = extractMentionUsernames(input.content ?? "");
  await resolveMentionTargets(ids, usernames, transaction);
  ids.delete(input.actorId);
  return hasGroupMention ? [...ids] : [...ids].slice(0, 20);
};

export const recordMentions = async (input: {
  readonly actorId: string;
  readonly mentionedUserIds: readonly string[];
  readonly entityType: string;
  readonly entityId: string;
  readonly transaction?: Prisma.TransactionClient;
}) => {
  const ids = [...new Set(input.mentionedUserIds)].filter(
    (id) => id && id !== input.actorId
  );
  if (ids.length === 0) {
    return;
  }
  await (input.transaction ?? database).mention.createMany({
    data: ids.map((mentionedUserId) => ({
      actorId: input.actorId,
      mentionedUserId,
      entityType: input.entityType,
      entityId: input.entityId,
    })),
    skipDuplicates: true,
  });
};

export const filterPrivateCommunityRecipients = async (
  postId: string,
  recipientIds: readonly string[],
  transaction: Prisma.TransactionClient = database
) => {
  const uniqueIds = [...new Set(recipientIds)];
  if (uniqueIds.length === 0) {
    return uniqueIds;
  }
  const post = await transaction.communityPost.findUnique({
    where: { id: postId },
    select: {
      space: {
        select: { id: true, visibility: true, ownerId: true },
      },
    },
  });
  if (!post?.space || post.space.visibility !== "PRIVATE") {
    return uniqueIds;
  }
  const members = await transaction.communitySpaceMember.findMany({
    where: {
      spaceId: post.space.id,
      memberId: { in: uniqueIds },
      member: { deactivatedAt: null },
    },
    select: { memberId: true },
  });
  const allowed = new Set(members.map(({ memberId }) => memberId));
  if (post.space.ownerId) {
    allowed.add(post.space.ownerId);
  }
  return uniqueIds.filter((memberId) => allowed.has(memberId));
};

export const notifyCommunityComment = async (input: {
  readonly actorId: string;
  readonly postId: string;
  readonly postAuthorId: string;
  readonly postTitle: string;
  readonly commentId: string;
  readonly commentContent: string;
  readonly parentCommentId?: string | null;
  readonly parentAuthorId?: string | null;
  readonly href: string;
  readonly document?: unknown;
  readonly occurredAt: Date;
  readonly idempotencyKey: string;
  readonly transaction: Prisma.TransactionClient;
}) => {
  const follows = await input.transaction.topicFollow.findMany({
    where: { topicId: input.postId, mutedAt: null },
    select: { userId: true },
  });
  const mentionedIds = await resolveMentionedMemberIds({
    actorId: input.actorId,
    content: input.commentContent,
    document: input.document,
    postId: input.postId,
    postAuthorId: input.postAuthorId,
    unmutedFollowerIds: follows.map(({ userId }) => userId),
    transaction: input.transaction,
  });
  const recipientCandidates: {
    readonly memberId: string | null | undefined;
    readonly type: NotificationType;
  }[] = mentionedIds.map((memberId) => ({
    memberId,
    type: notificationTypes.mention,
  }));
  recipientCandidates.push({
    memberId: input.parentAuthorId,
    type: notificationTypes.commentReply,
  });
  if (!input.parentCommentId && input.postAuthorId !== input.parentAuthorId) {
    recipientCandidates.push({
      memberId: input.postAuthorId,
      type: notificationTypes.topicComment,
    });
  }

  for (const { userId } of follows) {
    recipientCandidates.push({
      memberId: userId,
      type: notificationTypes.followedTopicActivity,
    });
  }

  const allowedRecipients = new Set(
    await filterPrivateCommunityRecipients(
      input.postId,
      recipientCandidates
        .map(({ memberId }) => memberId)
        .filter((memberId): memberId is string => Boolean(memberId)),
      input.transaction
    )
  );
  const allowedMentions = mentionedIds.filter((memberId) =>
    allowedRecipients.has(memberId)
  );
  await recordMentions({
    actorId: input.actorId,
    mentionedUserIds: allowedMentions,
    entityType: "COMMENT",
    entityId: input.commentId,
    transaction: input.transaction,
  });

  const recipients = mergeNotificationRecipients(
    input.actorId,
    recipientCandidates.filter(({ memberId }) =>
      memberId ? allowedRecipients.has(memberId) : false
    )
  );
  if (recipients.length === 0) {
    return;
  }
  await enqueueNotificationBatch(input.transaction, {
    actorId: input.actorId,
    aggregateType: "COMMUNITY_COMMENT",
    aggregateId: input.commentId,
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    notifications: recipients.map(([recipientId, type]) => ({
      recipientId,
      type,
      entityType: "COMMENT",
      entityId: input.commentId,
      parentEntityType: input.parentCommentId ? "COMMENT" : "TOPIC",
      parentEntityId: input.parentCommentId ?? input.postId,
      groupKey:
        type === notificationTypes.followedTopicActivity
          ? `topic:${input.postId}:activity`
          : undefined,
      dedupeKey: `${type}:${recipientId}:${input.commentId}`,
      priority: priorityForType[type],
      title: titleForType[type],
      body: input.postTitle,
      href: commentHref(input.href, input.commentId),
    })),
  });
};

export const notifyCommunityPost = async (input: {
  readonly actorId: string;
  readonly postId: string;
  readonly postTitle: string;
  readonly commentContent?: string;
  readonly document?: unknown;
  readonly href: string;
}) => {
  const mentionedIds = await resolveMentionedMemberIds({
    actorId: input.actorId,
    content: input.commentContent,
    document: input.document,
  });
  const allowedMentionIds = await filterPrivateCommunityRecipients(
    input.postId,
    mentionedIds
  );

  await recordMentions({
    actorId: input.actorId,
    mentionedUserIds: allowedMentionIds,
    entityType: "TOPIC",
    entityId: input.postId,
  });

  await Promise.all(
    allowedMentionIds.map((recipientId) =>
      createNotification({
        recipientId,
        actorId: input.actorId,
        type: notificationTypes.mention,
        entityType: "TOPIC",
        entityId: input.postId,
        metadata: { postId: input.postId },
        dedupeKey: `mention:${recipientId}:TOPIC:${input.postId}`,
        body: input.postTitle,
        href: input.href,
      })
    )
  );
};

export const notifyActivityAssigned = (input: {
  readonly recipientId: string;
  readonly actorId?: string;
  readonly activityId: string;
  readonly activityTitle: string;
  readonly href: string;
}) =>
  createNotification({
    ...input,
    type: notificationTypes.activityAssigned,
    entityType: "ACTIVITY",
    entityId: input.activityId,
    dedupeKey: `activity-assigned:${input.recipientId}:${input.activityId}`,
    body: input.activityTitle,
  });

export const notifyFeedbackReceived = (input: {
  readonly recipientId: string;
  readonly actorId?: string;
  readonly submissionId: string;
  readonly activityTitle: string;
  readonly href: string;
}) =>
  createNotification({
    ...input,
    type: notificationTypes.feedbackReceived,
    entityType: "SUBMISSION",
    entityId: input.submissionId,
    dedupeKey: `feedback:${input.submissionId}`,
    body: input.activityTitle,
  });

export const notifyLessonAvailable = (input: {
  readonly recipientId: string;
  readonly actorId?: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly href: string;
}) =>
  createNotification({
    ...input,
    type: notificationTypes.lessonAvailable,
    entityType: "LESSON",
    entityId: input.lessonId,
    dedupeKey: `lesson-available:${input.recipientId}:${input.lessonId}`,
    body: input.lessonTitle,
  });

export const notifyModuleAvailable = (input: {
  readonly recipientId: string;
  readonly actorId?: string;
  readonly moduleId: string;
  readonly moduleTitle: string;
  readonly href: string;
}) =>
  createNotification({
    ...input,
    type: notificationTypes.moduleAvailable,
    entityType: "MODULE",
    entityId: input.moduleId,
    dedupeKey: `module-available:${input.recipientId}:${input.moduleId}`,
    body: input.moduleTitle,
  });

export const notifyActivityDeadline = (input: {
  readonly recipientId: string;
  readonly activityId: string;
  readonly activityTitle: string;
  readonly dueAt: Date;
  readonly href: string;
}) =>
  createNotification({
    ...input,
    type: notificationTypes.activityDeadline,
    entityType: "ACTIVITY",
    entityId: input.activityId,
    dedupeKey: `activity-deadline:${input.recipientId}:${input.activityId}:${input.dueAt.toISOString()}`,
    body: input.activityTitle,
  });

export const notifyAnnouncement = (input: {
  readonly actorId: string;
  readonly announcementId: string;
  readonly body: string;
  readonly href?: string;
  readonly recipientId: string;
  readonly title: string;
}) =>
  createNotification({
    ...input,
    type: notificationTypes.announcement,
    entityType: "ANNOUNCEMENT",
    entityId: input.announcementId,
    groupKey: `announcement:${input.announcementId}`,
    dedupeKey: `announcement:${input.announcementId}:${input.recipientId}`,
  });

export const notificationTitle = (type: string) =>
  titleForType[asNotificationType(type)];
