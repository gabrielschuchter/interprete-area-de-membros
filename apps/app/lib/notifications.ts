import "server-only";

import { database, MemberRole, type Prisma } from "@repo/database";
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
  | "ANNOUNCEMENT";

export type NotificationFilter =
  | "ALL"
  | "MENTIONS"
  | "COMMUNITY"
  | "ACTIVITIES"
  | "LEARNING";

const preferenceForType: Record<NotificationType, string> = {
  MENTION: "mentions",
  COMMENT_REPLY: "commentReplies",
  TOPIC_COMMENT: "topicComments",
  FOLLOWED_TOPIC_ACTIVITY: "followedTopicActivity",
  LESSON_AVAILABLE: "lessonAvailable",
  MODULE_AVAILABLE: "moduleAvailable",
  ACTIVITY_ASSIGNED: "activityAssigned",
  FEEDBACK_RECEIVED: "feedbackReceived",
  ACTIVITY_DEADLINE: "activityDeadline",
  ANNOUNCEMENT: "announcements",
};

const priorityForType: Record<NotificationType, number> = {
  ...notificationPriority,
};

const titleForType: Record<NotificationType, string> = {
  MENTION: "Você foi mencionado",
  COMMENT_REPLY: "Nova resposta ao seu comentário",
  TOPIC_COMMENT: "Novo comentário no seu tópico",
  FOLLOWED_TOPIC_ACTIVITY: "Nova atividade em uma discussão seguida",
  LESSON_AVAILABLE: "Nova aula disponível",
  MODULE_AVAILABLE: "Novo módulo disponível",
  ACTIVITY_ASSIGNED: "Nova atividade para você",
  FEEDBACK_RECEIVED: "Você recebeu feedback",
  ACTIVITY_DEADLINE: "Prazo de atividade se aproximando",
  ANNOUNCEMENT: "Novo comunicado",
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
    },
  });

  if (!preference) {
    return true;
  }

  return preference[
    preferenceForType[type] as keyof typeof preference
  ] as boolean;
};

export const getOrCreateNotificationPreferences = (memberId: string) =>
  database.notificationPreference.upsert({
    where: { memberId },
    create: { memberId },
    update: {},
  });

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
  const baseWhere = { memberId, ...(types ? { type: types } : {}) };
  const cursor = decodeNotificationCursor(options.cursor);
  const where = cursor
    ? {
        AND: [
          baseWhere,
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
    : baseWhere;
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
    database.notification.count({ where: { memberId, readAt: null } }),
    database.notification.count({ where: { memberId, seenAt: null } }),
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

export const getUnreadNotificationCount = (memberId: string) =>
  database.notification.count({ where: { memberId, readAt: null } });

export const getUnseenNotificationCount = (memberId: string) =>
  database.notification.count({ where: { memberId, seenAt: null } });

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
      ...(groupIds.includes("group:ALL") ? [{}] : []),
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

const expandMentionGroups = async (actorId: string, ids: Set<string>) => {
  const groupIds = groupIdsFromMentionIds(ids);
  if (groupIds.length === 0) {
    return;
  }
  const actor = await database.member.findUnique({
    where: { id: actorId },
    select: { role: true },
  });
  const groupWhere = groupWhereForMention(actor?.role, groupIds);
  if (groupWhere.length === 0) {
    return;
  }
  const groupMembers = await database.member.findMany({
    where: { OR: groupWhere },
    select: { id: true },
  });
  for (const member of groupMembers) {
    ids.add(member.id);
  }
};

const resolveMentionTargets = async (ids: Set<string>, usernames: string[]) => {
  if (ids.size > 0) {
    const members = await database.member.findMany({
      where: { id: { in: [...ids] } },
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
  const profiles = await database.profile.findMany({
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
}) => {
  const ids = new Set(extractMentionIdsFromDocument(input.document));
  const hasGroupMention = groupIdsFromMentionIds(ids).length > 0;
  for (const groupId of groupIdsFromMentionIds(ids)) {
    ids.delete(groupId);
  }
  await expandMentionGroups(input.actorId, ids);
  const usernames = extractMentionUsernames(input.content ?? "");
  await resolveMentionTargets(ids, usernames);
  ids.delete(input.actorId);
  return hasGroupMention ? [...ids] : [...ids].slice(0, 20);
};

export const recordMentions = async (input: {
  readonly actorId: string;
  readonly mentionedUserIds: readonly string[];
  readonly entityType: string;
  readonly entityId: string;
}) => {
  const ids = [...new Set(input.mentionedUserIds)].filter(
    (id) => id && id !== input.actorId
  );
  if (ids.length === 0) {
    return;
  }
  await database.mention.createMany({
    data: ids.map((mentionedUserId) => ({
      actorId: input.actorId,
      mentionedUserId,
      entityType: input.entityType,
      entityId: input.entityId,
    })),
    skipDuplicates: true,
  });
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
}) => {
  const mentionedIds = await resolveMentionedMemberIds({
    actorId: input.actorId,
    content: input.commentContent,
    document: input.document,
  });
  await recordMentions({
    actorId: input.actorId,
    mentionedUserIds: mentionedIds,
    entityType: "COMMENT",
    entityId: input.commentId,
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

  const follows = await database.topicFollow.findMany({
    where: { topicId: input.postId, mutedAt: null },
    select: { userId: true },
  });
  for (const { userId } of follows) {
    recipientCandidates.push({
      memberId: userId,
      type: notificationTypes.followedTopicActivity,
    });
  }

  await Promise.all(
    mergeNotificationRecipients(input.actorId, recipientCandidates).map(
      ([recipientId, type]) =>
        createNotification({
          recipientId,
          actorId: input.actorId,
          type,
          entityType: "COMMENT",
          entityId: input.commentId,
          parentEntityType: input.parentCommentId ? "COMMENT" : "TOPIC",
          parentEntityId: input.parentCommentId ?? input.postId,
          groupKey:
            type === notificationTypes.followedTopicActivity
              ? `topic:${input.postId}:activity`
              : undefined,
          metadata: { postId: input.postId },
          dedupeKey: `${type}:${recipientId}:${input.commentId}`,
          body: input.postTitle,
          href: commentHref(input.href, input.commentId),
        })
    )
  );
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

  await recordMentions({
    actorId: input.actorId,
    mentionedUserIds: mentionedIds,
    entityType: "TOPIC",
    entityId: input.postId,
  });

  await Promise.all(
    mentionedIds.map((recipientId) =>
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
