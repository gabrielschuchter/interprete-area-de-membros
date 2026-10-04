import type { Prisma } from "@repo/database";
import {
  notificationPreferenceForType,
  notificationPriority,
  notificationTitleForType,
} from "./notification-constants";
import { parseNotificationOutboxPayload } from "./notifications";
import type { OutboxConsumer } from "./outbox-worker";

const preferenceSelect = {
  memberId: true,
  mentions: true,
  commentReplies: true,
  topicComments: true,
  followedTopicActivity: true,
  lessonAvailable: true,
  moduleAvailable: true,
  activityAssigned: true,
  contentAssignments: true,
  feedbackReceived: true,
  activityDeadline: true,
  announcements: true,
  groupInvitations: true,
  groupPosts: true,
} as const;

type NotificationPreferenceSnapshot = Prisma.NotificationPreferenceGetPayload<{
  select: typeof preferenceSelect;
}>;

type NotificationRequest = ReturnType<
  typeof parseNotificationOutboxPayload
>["notifications"][number];

interface NotificationBodyLookups {
  readonly activities: ReadonlyMap<string, string>;
  readonly badges: ReadonlyMap<string, string>;
  readonly comments: ReadonlyMap<string, string>;
  readonly groupAudience: ReadonlyMap<string, ReadonlySet<string>>;
  readonly groupInvitations: ReadonlyMap<
    string,
    { readonly inviteeId: string; readonly title: string }
  >;
  readonly learningAssignments: ReadonlyMap<
    string,
    { readonly recipientId: string; readonly title: string }
  >;
  readonly learningTasks: ReadonlyMap<
    string,
    { readonly recipientIds: ReadonlySet<string>; readonly title: string }
  >;
  readonly lessons: ReadonlyMap<string, string>;
  readonly modules: ReadonlyMap<string, string>;
  readonly posts: ReadonlyMap<string, string>;
  readonly submissions: ReadonlyMap<string, string>;
}

const distinctIds = (values: readonly (string | null | undefined)[]) => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
];

const learningTargetKey = (type: string, id: string) => `${type}:${id}`;

const loadLearningAssignmentBodies = async (
  transaction: Parameters<OutboxConsumer["handle"]>[0],
  assignmentIds: readonly string[]
) => {
  if (assignmentIds.length === 0) {
    return new Map<string, { recipientId: string; title: string }>();
  }
  const now = new Date();
  const assignments = await transaction.activityAssignment.findMany({
    where: {
      id: { in: [...assignmentIds] },
      revokedAt: null,
      status: { not: "REVOKED" },
      AND: [
        { OR: [{ availableAt: null }, { availableAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    select: { id: true, memberId: true, targetType: true, targetId: true },
  });
  const idsByType = new Map<string, string[]>();
  for (const assignment of assignments) {
    const ids = idsByType.get(assignment.targetType) ?? [];
    ids.push(assignment.targetId);
    idsByType.set(assignment.targetType, ids);
  }
  const ids = (type: string) => idsByType.get(type) ?? [];
  const [
    activities,
    courses,
    modules,
    lessons,
    assets,
    libraryItems,
    exerciseLists,
  ] = await Promise.all([
    ids("ACTIVITY").length
      ? transaction.activity.findMany({
          where: {
            id: { in: ids("ACTIVITY") },
            status: "PUBLISHED",
            AND: [
              {
                OR: [
                  { courseId: null },
                  {
                    course: {
                      is: {
                        status: "PUBLISHED",
                        experience: "ASYNC",
                        OR: [
                          { learningPathId: null },
                          {
                            learningPath: {
                              is: { status: "PUBLISHED" },
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
              {
                OR: [
                  { lessonId: null },
                  {
                    lesson: {
                      is: {
                        status: "PUBLISHED",
                        module: {
                          is: {
                            status: "PUBLISHED",
                            course: {
                              is: {
                                status: "PUBLISHED",
                                experience: "ASYNC",
                                OR: [
                                  { learningPathId: null },
                                  {
                                    learningPath: {
                                      is: { status: "PUBLISHED" },
                                    },
                                  },
                                ],
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
          select: { id: true, title: true },
        })
      : [],
    ids("COURSE").length
      ? transaction.course.findMany({
          where: {
            id: { in: ids("COURSE") },
            status: "PUBLISHED",
            experience: "ASYNC",
            OR: [
              { learningPathId: null },
              { learningPath: { is: { status: "PUBLISHED" } } },
            ],
          },
          select: { id: true, title: true },
        })
      : [],
    ids("MODULE").length
      ? transaction.module.findMany({
          where: {
            id: { in: ids("MODULE") },
            status: "PUBLISHED",
            course: {
              is: {
                status: "PUBLISHED",
                experience: "ASYNC",
                OR: [
                  { learningPathId: null },
                  { learningPath: { is: { status: "PUBLISHED" } } },
                ],
              },
            },
          },
          select: { id: true, title: true },
        })
      : [],
    ids("LESSON").length
      ? transaction.lesson.findMany({
          where: {
            id: { in: ids("LESSON") },
            status: "PUBLISHED",
            module: {
              is: {
                status: "PUBLISHED",
                course: {
                  is: {
                    status: "PUBLISHED",
                    experience: "ASYNC",
                    OR: [
                      { learningPathId: null },
                      { learningPath: { is: { status: "PUBLISHED" } } },
                    ],
                  },
                },
              },
            },
          },
          select: { id: true, title: true },
        })
      : [],
    ids("ASSET").length
      ? transaction.lessonAsset.findMany({
          where: {
            id: { in: ids("ASSET") },
            lesson: {
              is: {
                status: "PUBLISHED",
                module: {
                  is: {
                    status: "PUBLISHED",
                    course: {
                      is: {
                        status: "PUBLISHED",
                        experience: "ASYNC",
                        OR: [
                          { learningPathId: null },
                          { learningPath: { is: { status: "PUBLISHED" } } },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          select: { id: true, title: true },
        })
      : [],
    ids("LIBRARY_ITEM").length
      ? transaction.libraryItem.findMany({
          where: { id: { in: ids("LIBRARY_ITEM") }, status: "PUBLISHED" },
          select: { id: true, title: true },
        })
      : [],
    ids("EXERCISE_LIST").length
      ? transaction.exerciseList.findMany({
          where: {
            id: { in: ids("EXERCISE_LIST") },
            status: "PUBLISHED",
            bank: { is: { status: "PUBLISHED" } },
          },
          select: { id: true, title: true },
        })
      : [],
  ]);
  const titlesByTarget = new Map<string, string>();
  for (const [type, targets] of [
    ["ACTIVITY", activities],
    ["COURSE", courses],
    ["MODULE", modules],
    ["LESSON", lessons],
    ["ASSET", assets],
    ["LIBRARY_ITEM", libraryItems],
    ["EXERCISE_LIST", exerciseLists],
  ] as const) {
    for (const target of targets) {
      titlesByTarget.set(learningTargetKey(type, target.id), target.title);
    }
  }
  return new Map(
    assignments.flatMap((assignment) => {
      const title = titlesByTarget.get(
        learningTargetKey(assignment.targetType, assignment.targetId)
      );
      return title
        ? [
            [
              assignment.id,
              { recipientId: assignment.memberId, title },
            ] as const,
          ]
        : [];
    })
  );
};

const loadNotificationBodies = async (
  transaction: Parameters<OutboxConsumer["handle"]>[0],
  requests: readonly NotificationRequest[]
): Promise<NotificationBodyLookups> => {
  const activityIds = distinctIds(
    requests
      .filter(
        ({ type }) =>
          type === "ACTIVITY_ASSIGNED" || type === "ACTIVITY_DEADLINE"
      )
      .map(({ entityId }) => entityId)
  );
  const submissionIds = distinctIds(
    requests
      .filter(({ type }) => type === "FEEDBACK_RECEIVED")
      .map(({ entityId }) => entityId)
  );
  const lessonIds = distinctIds(
    requests
      .filter(({ type }) => type === "LESSON_AVAILABLE")
      .map(({ entityId }) => entityId)
  );
  const moduleIds = distinctIds(
    requests
      .filter(({ type }) => type === "MODULE_AVAILABLE")
      .map(({ entityId }) => entityId)
  );
  const postIds = distinctIds(
    requests.flatMap((request) => [
      request.entityType === "TOPIC" ? request.entityId : null,
      request.parentEntityType === "TOPIC" ? request.parentEntityId : null,
    ])
  );
  const commentIds = distinctIds(
    requests.flatMap((request) => [
      request.entityType === "COMMENT" ? request.entityId : null,
      request.parentEntityType === "COMMENT" ? request.parentEntityId : null,
    ])
  );
  const groupIds = distinctIds(
    requests
      .filter(({ type }) => type === "GROUP_POST")
      .map(({ groupKey }) => groupKey)
  );
  const invitationIds = distinctIds(
    requests
      .filter(({ type }) => type === "GROUP_INVITATION")
      .map(({ entityId }) => entityId)
  );
  const assignmentIds = distinctIds(
    requests
      .filter(({ type }) => type === "LEARNING_CONTENT_ASSIGNED")
      .map(({ entityId }) => entityId)
  );
  const badgeIds = distinctIds(
    requests
      .filter(
        ({ type, entityType }) =>
          type === "BADGE_AWARDED" && entityType === "BADGE"
      )
      .map(({ entityId }) => entityId)
  );
  const taskIds = distinctIds(
    requests
      .filter(
        ({ type, entityType }) =>
          type === "LEARNING_CONTENT_ASSIGNED" && entityType === "LEARNING_TASK"
      )
      .map(({ entityId }) => entityId)
  );
  const recipientIds = distinctIds(
    requests.map(({ recipientId }) => recipientId)
  );

  const [
    activities,
    submissions,
    lessons,
    modules,
    posts,
    comments,
    groups,
    invitations,
    learningAssignments,
    badges,
    learningTasks,
  ] = await Promise.all([
    activityIds.length
      ? transaction.activity.findMany({
          where: { id: { in: activityIds } },
          select: { id: true, title: true },
        })
      : [],
    submissionIds.length
      ? transaction.activitySubmission.findMany({
          where: { id: { in: submissionIds } },
          select: { id: true, activity: { select: { title: true } } },
        })
      : [],
    lessonIds.length
      ? transaction.lesson.findMany({
          where: { id: { in: lessonIds } },
          select: { id: true, title: true },
        })
      : [],
    moduleIds.length
      ? transaction.module.findMany({
          where: { id: { in: moduleIds } },
          select: { id: true, title: true },
        })
      : [],
    postIds.length
      ? transaction.communityPost.findMany({
          where: { deletedAt: null, id: { in: postIds } },
          select: { id: true, title: true },
        })
      : [],
    commentIds.length
      ? transaction.communityComment.findMany({
          where: { deletedAt: null, id: { in: commentIds } },
          select: { id: true, post: { select: { id: true, title: true } } },
        })
      : [],
    groupIds.length
      ? transaction.communitySpace.findMany({
          where: { id: { in: groupIds }, status: "PUBLISHED" },
          select: {
            id: true,
            ownerId: true,
            members: {
              where: { memberId: { in: recipientIds } },
              select: { memberId: true },
            },
          },
        })
      : [],
    invitationIds.length
      ? transaction.communitySpaceInvitation.findMany({
          where: {
            id: { in: invitationIds },
            inviteeId: { in: recipientIds },
            status: "PENDING",
            space: { is: { status: "PUBLISHED" } },
          },
          select: {
            id: true,
            inviteeId: true,
            space: { select: { title: true } },
          },
        })
      : [],
    loadLearningAssignmentBodies(transaction, assignmentIds),
    badgeIds.length
      ? transaction.badgeAward.findMany({
          where: {
            badgeId: { in: badgeIds },
            memberId: { in: recipientIds },
          },
          select: {
            badgeId: true,
            memberId: true,
            definitionRevision: { select: { title: true } },
          },
        })
      : [],
    taskIds.length
      ? transaction.learningTask.findMany({
          where: {
            id: { in: taskIds },
            recipients: { some: { memberId: { in: recipientIds } } },
          },
          select: {
            id: true,
            title: true,
            recipients: {
              where: { memberId: { in: recipientIds } },
              select: { memberId: true },
            },
          },
        })
      : [],
  ]);

  const commentBodies = new Map(
    comments.map(({ id, post }) => [id, post.title])
  );
  const postsById = new Map(posts.map(({ id, title }) => [id, title]));
  for (const comment of comments) {
    postsById.set(comment.post.id, comment.post.title);
  }
  const groupAudience = new Map(
    groups.map(({ id, ownerId, members }) => [
      id,
      new Set([
        ...(ownerId ? [ownerId] : []),
        ...members.map(({ memberId }) => memberId),
      ]),
    ])
  );

  return {
    activities: new Map(activities.map(({ id, title }) => [id, title])),
    submissions: new Map(
      submissions.map(({ id, activity }) => [id, activity.title])
    ),
    lessons: new Map(lessons.map(({ id, title }) => [id, title])),
    modules: new Map(modules.map(({ id, title }) => [id, title])),
    posts: postsById,
    comments: commentBodies,
    groupAudience,
    groupInvitations: new Map(
      invitations.map(({ id, inviteeId, space }) => [
        id,
        { inviteeId, title: space.title },
      ])
    ),
    learningAssignments,
    badges: new Map(
      badges.map(({ badgeId, memberId, definitionRevision }) => [
        `${memberId}:${badgeId}`,
        definitionRevision.title,
      ])
    ),
    learningTasks: new Map(
      learningTasks.map(({ id, title, recipients }) => [
        id,
        {
          recipientIds: new Set(recipients.map(({ memberId }) => memberId)),
          title,
        },
      ])
    ),
  };
};

const bodyMapForType = (
  type: string,
  lookups: NotificationBodyLookups
): ReadonlyMap<string, string> | undefined => {
  if (type === "ACTIVITY_ASSIGNED" || type === "ACTIVITY_DEADLINE") {
    return lookups.activities;
  }
  if (type === "FEEDBACK_RECEIVED") {
    return lookups.submissions;
  }
  if (type === "LESSON_AVAILABLE") {
    return lookups.lessons;
  }
  if (type === "MODULE_AVAILABLE") {
    return lookups.modules;
  }
  return undefined;
};

const directNotificationBody = (
  request: NotificationRequest,
  lookups: NotificationBodyLookups
) => {
  if (request.type === "GROUP_INVITATION" && request.entityId) {
    return lookups.groupInvitations.get(request.entityId)?.title ?? null;
  }
  if (request.type === "LEARNING_CONTENT_ASSIGNED" && request.entityId) {
    if (request.entityType === "LEARNING_TASK") {
      return lookups.learningTasks.get(request.entityId)?.title ?? null;
    }
    return lookups.learningAssignments.get(request.entityId)?.title ?? null;
  }
  if (request.type === "BADGE_AWARDED" && request.entityId) {
    return (
      lookups.badges.get(`${request.recipientId}:${request.entityId}`) ?? null
    );
  }
  return undefined;
};

const relatedEntityId = (
  request: NotificationRequest,
  entityType: "COMMENT" | "TOPIC"
) => {
  if (request.entityType === entityType) {
    return request.entityId;
  }
  if (request.parentEntityType === entityType) {
    return request.parentEntityId;
  }
  return null;
};

const relatedNotificationBody = (
  request: NotificationRequest,
  lookups: NotificationBodyLookups
) => {
  const topicId = relatedEntityId(request, "TOPIC");
  if (topicId) {
    return lookups.posts.get(topicId) ?? null;
  }
  const commentId = relatedEntityId(request, "COMMENT");
  return commentId ? (lookups.comments.get(commentId) ?? null) : null;
};

const notificationBody = (
  request: NotificationRequest,
  lookups: NotificationBodyLookups
) => {
  const directBody = directNotificationBody(request, lookups);
  if (directBody !== undefined) {
    return directBody;
  }
  const bodyMap = bodyMapForType(request.type, lookups);
  if (bodyMap && request.entityId) {
    return bodyMap.get(request.entityId) ?? null;
  }
  return relatedNotificationBody(request, lookups);
};

const isNotificationAllowed = (
  request: NotificationRequest,
  activeMemberIds: ReadonlySet<string>,
  preferencesByMemberId: ReadonlyMap<string, NotificationPreferenceSnapshot>
) => {
  if (!activeMemberIds.has(request.recipientId)) {
    return false;
  }
  const preferences = preferencesByMemberId.get(request.recipientId);
  const preferenceKey =
    notificationPreferenceForType[
      request.type as keyof typeof notificationPreferenceForType
    ];
  if (!(preferences && preferenceKey)) {
    return true;
  }
  return (
    preferences[preferenceKey as keyof NotificationPreferenceSnapshot] !== false
  );
};

const toNotificationRow = (
  request: NotificationRequest,
  event: Parameters<OutboxConsumer["handle"]>[1],
  lookups: NotificationBodyLookups
): Prisma.NotificationCreateManyInput => ({
  memberId: request.recipientId,
  actorId: event.actorId,
  type: request.type,
  entityType: request.entityType ?? null,
  entityId: request.entityId ?? null,
  parentEntityType: request.parentEntityType ?? null,
  parentEntityId: request.parentEntityId ?? null,
  groupKey: request.groupKey ?? null,
  dedupeKey: request.dedupeKey,
  priority:
    request.priority ??
    notificationPriority[request.type as keyof typeof notificationPriority] ??
    0,
  title:
    notificationTitleForType[
      request.type as keyof typeof notificationTitleForType
    ] ?? "Nova atualização",
  body: notificationBody(request, lookups),
  href: request.href ?? null,
});

export const notificationOutboxConsumer: OutboxConsumer = {
  handle: async (transaction, event) => {
    if (event.eventType !== "notifications.batch_requested") {
      throw new Error(`Unsupported notification event: ${event.eventType}`);
    }

    const { notifications } = parseNotificationOutboxPayload(event.payload);
    const requests = notifications.filter(
      (notification) => notification.recipientId !== event.actorId
    );
    const recipientIds = [
      ...new Set(requests.map(({ recipientId }) => recipientId)),
    ];
    if (recipientIds.length === 0) {
      return;
    }

    const [activeMembers, preferences, bodies] = await Promise.all([
      transaction.member.findMany({
        where: { deactivatedAt: null, id: { in: recipientIds } },
        select: { id: true },
      }),
      transaction.notificationPreference.findMany({
        where: { memberId: { in: recipientIds } },
        select: preferenceSelect,
      }),
      loadNotificationBodies(transaction, requests),
    ]);
    const activeMemberIds = new Set(activeMembers.map(({ id }) => id));
    const preferencesByMemberId = new Map(
      preferences.map((preference) => [preference.memberId, preference])
    );
    const rows = requests
      .filter((request) => {
        if (request.type === "LEARNING_CONTENT_ASSIGNED") {
          if (request.entityType === "LEARNING_TASK") {
            return Boolean(
              request.entityId &&
                bodies.learningTasks
                  .get(request.entityId)
                  ?.recipientIds.has(request.recipientId)
            );
          }
          return (
            typeof request.entityId === "string" &&
            bodies.learningAssignments.get(request.entityId)?.recipientId ===
              request.recipientId
          );
        }
        if (request.type === "GROUP_INVITATION") {
          return (
            typeof request.entityId === "string" &&
            bodies.groupInvitations.get(request.entityId)?.inviteeId ===
              request.recipientId
          );
        }
        if (request.type === "BADGE_AWARDED") {
          return (
            request.entityType === "BADGE" &&
            typeof request.entityId === "string" &&
            bodies.badges.has(`${request.recipientId}:${request.entityId}`)
          );
        }
        if (request.type === "GROUP_POST" && request.groupKey) {
          return bodies.groupAudience
            .get(request.groupKey)
            ?.has(request.recipientId);
        }
        return true;
      })
      .filter((request) =>
        isNotificationAllowed(request, activeMemberIds, preferencesByMemberId)
      )
      .map((request) => toNotificationRow(request, event, bodies));

    if (rows.length > 0) {
      await transaction.notification.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }
  },
};
