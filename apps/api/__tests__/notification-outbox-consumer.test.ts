import type { Prisma } from "@repo/database";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { notificationOutboxConsumer } from "../lib/notification-outbox-consumer";

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  AnnouncementAudience: {
    ALL: "ALL",
    COHORT: "COHORT",
    SELECTED: "SELECTED",
    STAFF: "STAFF",
  },
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER" },
}));

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("OUTBOX_QUEUE_NAMESPACE", "");
  vi.stubEnv("OUTBOX_PREVIEW_MEMBER_IDS", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const deliverPrivateCommentMention = async (
  memberIsCurrent: boolean,
  options: {
    readonly groupDeleted?: boolean;
    readonly includeScope?: boolean;
    readonly audienceScope?: "GLOBAL" | "GROUP" | "UNRESOLVED";
  } = {}
) => {
  const notificationCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const spaceId = options.groupDeleted ? null : "private_group_1";
  const post = {
    id: "post_private_1",
    title: "Título privado",
    spaceId,
    audienceScope: options.audienceScope ?? "GROUP",
    status: "PUBLISHED",
    deletedAt: null,
    space: options.groupDeleted
      ? null
      : {
          id: "private_group_1",
          visibility: "PRIVATE",
          status: "PUBLISHED",
          ownerId: "owner_1",
          members: memberIsCurrent ? [{ memberId: "removed_member_1" }] : [],
        },
  };
  let commentQuery = 0;
  const transaction = {
    member: {
      findMany: vi.fn().mockResolvedValue([{ id: "removed_member_1" }]),
    },
    notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
    communityComment: {
      findMany: vi.fn().mockImplementation(() => {
        commentQuery += 1;
        return commentQuery === 1
          ? [{ postId: post.id }]
          : [{ id: "comment_private_1", post }];
      }),
    },
    communityPost: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce([{ spaceId: post.spaceId }])
        .mockResolvedValue([post]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    notification: { createMany: notificationCreateMany },
  } as unknown as Prisma.TransactionClient;

  await notificationOutboxConsumer.handle(
    transaction,
    {
      id: `event_private_mention_${memberIsCurrent}`,
      eventType: "notifications.batch_requested",
      schemaVersion: 1,
      actorId: "author_1",
      aggregateType: "COMMUNITY_COMMENT",
      aggregateId: "comment_private_1",
      payload: {
        notifications: [
          {
            recipientId: "removed_member_1",
            type: "MENTION",
            entityType: "COMMENT",
            entityId: "comment_private_1",
            parentEntityType: "TOPIC",
            parentEntityId: post.id,
            ...(options.includeScope === false
              ? {}
              : { communitySpaceId: post.spaceId }),
            dedupeKey: `mention:removed_member_1:${memberIsCurrent}`,
            body: post.title,
            href: "/comunidade/publicacoes/privada?commentId=comment_private_1",
          },
        ],
      },
      occurredAt: new Date("2026-10-23T10:00:00.000Z"),
    },
    {
      id: `job_private_mention_${memberIsCurrent}`,
      consumerKey: "notifications.create.v1",
      idempotencyKey: `private-mention:${memberIsCurrent}`,
      attemptCount: 1,
    }
  );

  return { notificationCreateMany, transaction };
};

test("batches active recipients, honors preferences, and excludes the actor", async () => {
  const notificationCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = {
    member: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "student_1" }, { id: "student_2" }]),
    },
    notificationPreference: {
      findMany: vi.fn().mockResolvedValue([
        {
          memberId: "student_1",
          mentions: false,
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
        {
          memberId: "student_2",
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
      ]),
    },
    notification: { createMany: notificationCreateMany },
  } as unknown as Prisma.TransactionClient;

  await notificationOutboxConsumer.handle(
    tx,
    {
      id: "event_1",
      eventType: "notifications.batch_requested",
      schemaVersion: 1,
      actorId: "teacher_1",
      aggregateType: "learning_assignment",
      aggregateId: "assignment_1",
      payload: {
        notifications: [
          {
            recipientId: "teacher_1",
            type: "MENTION",
            dedupeKey: "mention:teacher_1:event_1",
          },
          {
            recipientId: "student_1",
            type: "MENTION",
            dedupeKey: "mention:student_1:event_1",
          },
          {
            recipientId: "student_2",
            type: "ACTIVITY_ASSIGNED",
            dedupeKey: "activity-assigned:student_2:assignment_1",
            href: "/atividades",
          },
          {
            recipientId: "deactivated_member",
            type: "MENTION",
            dedupeKey: "mention:deactivated:event_1",
          },
        ],
      },
      occurredAt: new Date("2026-10-03T15:00:00.000Z"),
    },
    {
      id: "job_1",
      consumerKey: "notifications.create.v1",
      idempotencyKey: "event_1:notifications.create.v1",
      attemptCount: 1,
    }
  );

  expect(tx.member.findMany).toHaveBeenCalledOnce();
  expect(tx.notificationPreference.findMany).toHaveBeenCalledOnce();
  expect(notificationCreateMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        memberId: "student_2",
        actorId: "teacher_1",
        type: "ACTIVITY_ASSIGNED",
        dedupeKey: "activity-assigned:student_2:assignment_1",
        title: "Nova atividade para você",
      }),
    ],
    skipDuplicates: true,
  });
});

test("sends group-post notices only to current owners and members", async () => {
  const notificationCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = {
    member: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "owner_1" },
          { id: "member_1" },
          { id: "other_1" },
        ]),
    },
    notificationPreference: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    communityPost: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "post_1",
          title: "Roteiro",
          spaceId: "private_group_1",
          audienceScope: "GROUP",
          status: "PUBLISHED",
          deletedAt: null,
          space: {
            id: "private_group_1",
            visibility: "PRIVATE",
            status: "PUBLISHED",
            ownerId: "owner_1",
            members: [{ memberId: "member_1" }],
          },
        },
      ]),
    },
    communitySpace: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "private_group_1",
          ownerId: "owner_1",
          visibility: "PRIVATE",
          members: [{ memberId: "member_1" }],
        },
      ]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    notification: { createMany: notificationCreateMany },
  } as unknown as Prisma.TransactionClient;

  await notificationOutboxConsumer.handle(
    tx,
    {
      id: "event_group_post_1",
      eventType: "notifications.batch_requested",
      schemaVersion: 1,
      actorId: "author_1",
      aggregateType: "CommunityPost",
      aggregateId: "post_1",
      payload: {
        notifications: [
          {
            recipientId: "owner_1",
            type: "GROUP_POST",
            entityType: "TOPIC",
            entityId: "post_1",
            groupKey: "private_group_1",
            dedupeKey: "group-post:owner_1",
          },
          {
            recipientId: "member_1",
            type: "GROUP_POST",
            entityType: "TOPIC",
            entityId: "post_1",
            groupKey: "private_group_1",
            dedupeKey: "group-post:member_1",
          },
          {
            recipientId: "other_1",
            type: "GROUP_POST",
            entityType: "TOPIC",
            entityId: "post_1",
            groupKey: "private_group_1",
            dedupeKey: "group-post:other_1",
          },
          {
            recipientId: "author_1",
            type: "GROUP_POST",
            entityType: "TOPIC",
            entityId: "post_1",
            groupKey: "private_group_1",
            dedupeKey: "group-post:author_1",
          },
        ],
      },
      occurredAt: new Date("2026-10-03T15:00:00.000Z"),
    },
    {
      id: "job_group_post_1",
      consumerKey: "notifications.create.v1",
      idempotencyKey: "event_group_post_1:notifications.create.v1",
      attemptCount: 1,
    }
  );

  expect(notificationCreateMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        memberId: "owner_1",
        type: "GROUP_POST",
        communitySpaceId: "private_group_1",
      }),
      expect.objectContaining({
        memberId: "member_1",
        type: "GROUP_POST",
        communitySpaceId: "private_group_1",
      }),
    ],
    skipDuplicates: true,
  });
});

test("drops a delayed private-group mention after membership is removed", async () => {
  const { notificationCreateMany, transaction } =
    await deliverPrivateCommentMention(false);

  expect(transaction.$queryRaw).toHaveBeenCalledTimes(2);
  expect(notificationCreateMany).not.toHaveBeenCalled();
});

test("persists private notification scope while the recipient is a member", async () => {
  const { notificationCreateMany } = await deliverPrivateCommentMention(true);

  expect(notificationCreateMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        memberId: "removed_member_1",
        type: "MENTION",
        body: "Título privado",
        communitySpaceId: "private_group_1",
      }),
    ],
    skipDuplicates: true,
  });
});

test("drops a legacy comment event when a deleted group's scope is ambiguous", async () => {
  const { notificationCreateMany } = await deliverPrivateCommentMention(true, {
    groupDeleted: true,
    includeScope: false,
  });

  expect(notificationCreateMany).not.toHaveBeenCalled();
});

test("drops an explicit null-scope event for a detached group post", async () => {
  const { notificationCreateMany } = await deliverPrivateCommentMention(true, {
    groupDeleted: true,
  });

  expect(notificationCreateMany).not.toHaveBeenCalled();
});

test("keeps a current explicitly global comment notification", async () => {
  const { notificationCreateMany } = await deliverPrivateCommentMention(true, {
    groupDeleted: true,
    audienceScope: "GLOBAL",
  });

  expect(notificationCreateMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        type: "MENTION",
        communitySpaceId: null,
      }),
    ],
    skipDuplicates: true,
  });
});

test("keeps group invitations tied to a current pending invitation", async () => {
  const notificationCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = {
    member: { findMany: vi.fn().mockResolvedValue([{ id: "invitee_1" }]) },
    notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
    communitySpaceInvitation: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "invitation_1",
          inviteeId: "invitee_1",
          space: { id: "private_group_1", title: "Grupo privado" },
        },
      ]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    notification: { createMany: notificationCreateMany },
  } as unknown as Prisma.TransactionClient;

  await notificationOutboxConsumer.handle(
    tx,
    {
      id: "event_invitation_1",
      eventType: "notifications.batch_requested",
      schemaVersion: 1,
      actorId: "inviter_1",
      aggregateType: "CommunitySpaceInvitation",
      aggregateId: "invitation_1",
      payload: {
        notifications: [
          {
            recipientId: "invitee_1",
            type: "GROUP_INVITATION",
            entityType: "COMMUNITY_INVITATION",
            entityId: "invitation_1",
            groupKey: "private_group_1",
            dedupeKey: "group-invitation:invitation_1",
            href: "/perfil#convites",
          },
        ],
      },
      occurredAt: new Date("2026-10-03T15:00:00.000Z"),
    },
    {
      id: "job_invitation_1",
      consumerKey: "notifications.create.v1",
      idempotencyKey: "event_invitation_1:notifications.create.v1",
      attemptCount: 1,
    }
  );

  expect(notificationCreateMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        memberId: "invitee_1",
        type: "GROUP_INVITATION",
        body: "Grupo privado",
        href: "/perfil#convites",
      }),
    ],
    skipDuplicates: true,
  });
});

test("delivers assigned-content notices only for a current assignment recipient", async () => {
  const notificationCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const assignmentFindMany = vi.fn().mockResolvedValue([
    {
      id: "assignment_1",
      memberId: "student_1",
      targetType: "COURSE",
      targetId: "course_1",
    },
  ]);
  const tx = {
    member: {
      findMany: vi.fn().mockResolvedValue([{ id: "student_1" }]),
    },
    notificationPreference: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { memberId: "student_1", contentAssignments: true },
        ]),
    },
    activityAssignment: { findMany: assignmentFindMany },
    course: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "course_1", title: "Método clínico" }]),
    },
    notification: { createMany: notificationCreateMany },
  } as unknown as Prisma.TransactionClient;

  await notificationOutboxConsumer.handle(
    tx,
    {
      id: "event_assignment_1",
      eventType: "notifications.batch_requested",
      schemaVersion: 1,
      actorId: "teacher_1",
      aggregateType: "learning_assignment_batch",
      aggregateId: "batch_1",
      payload: {
        notifications: [
          {
            recipientId: "student_1",
            type: "LEARNING_CONTENT_ASSIGNED",
            entityType: "LEARNING_ASSIGNMENT",
            entityId: "assignment_1",
            dedupeKey: "learning-assignment:assignment_1",
            href: "/cursos/atribuicoes/assignment_1",
          },
        ],
      },
      occurredAt: new Date("2026-10-03T15:00:00.000Z"),
    },
    {
      id: "job_assignment_1",
      consumerKey: "notifications.create.v1",
      idempotencyKey: "event_assignment_1:notifications.create.v1",
      attemptCount: 1,
    }
  );

  expect(assignmentFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        revokedAt: null,
        status: { not: "REVOKED" },
      }),
    })
  );
  expect(notificationCreateMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        memberId: "student_1",
        type: "LEARNING_CONTENT_ASSIGNED",
        title: "Novo conteúdo para você",
        body: "Método clínico",
        href: "/cursos/atribuicoes/assignment_1",
      }),
    ],
    skipDuplicates: true,
  });
});

test("does not deliver an assignment notice to a different recipient", async () => {
  const notificationCreateMany = vi.fn().mockResolvedValue({ count: 0 });
  const tx = {
    member: { findMany: vi.fn().mockResolvedValue([{ id: "student_1" }]) },
    notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
    activityAssignment: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "assignment_1",
          memberId: "another_student",
          targetType: "COURSE",
          targetId: "course_1",
        },
      ]),
    },
    course: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "course_1", title: "Método clínico" }]),
    },
    notification: { createMany: notificationCreateMany },
  } as unknown as Prisma.TransactionClient;

  await notificationOutboxConsumer.handle(
    tx,
    {
      id: "event_assignment_2",
      eventType: "notifications.batch_requested",
      schemaVersion: 1,
      actorId: "teacher_1",
      aggregateType: "learning_assignment_batch",
      aggregateId: "batch_1",
      payload: {
        notifications: [
          {
            recipientId: "student_1",
            type: "LEARNING_CONTENT_ASSIGNED",
            entityType: "LEARNING_ASSIGNMENT",
            entityId: "assignment_1",
            dedupeKey: "learning-assignment:assignment_1",
          },
        ],
      },
      occurredAt: new Date("2026-10-03T15:00:00.000Z"),
    },
    {
      id: "job_assignment_2",
      consumerKey: "notifications.create.v1",
      idempotencyKey: "event_assignment_2:notifications.create.v1",
      attemptCount: 1,
    }
  );

  expect(notificationCreateMany).not.toHaveBeenCalled();
});

test("delivers an assigned task only to the snapshotted recipient", async () => {
  const notificationCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const taskFindMany = vi.fn().mockResolvedValue([
    {
      id: "task_1",
      title: "Ler o capítulo introdutório",
      recipients: [{ memberId: "student_1" }],
    },
  ]);
  const tx = {
    member: { findMany: vi.fn().mockResolvedValue([{ id: "student_1" }]) },
    notificationPreference: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { memberId: "student_1", contentAssignments: true },
        ]),
    },
    activityAssignment: { findMany: vi.fn().mockResolvedValue([]) },
    learningTask: { findMany: taskFindMany },
    notification: { createMany: notificationCreateMany },
  } as unknown as Prisma.TransactionClient;

  await notificationOutboxConsumer.handle(
    tx,
    {
      id: "event_task_1",
      eventType: "notifications.batch_requested",
      schemaVersion: 1,
      actorId: "teacher_1",
      aggregateType: "LEARNING_TASK",
      aggregateId: "task_1",
      payload: {
        notifications: [
          {
            recipientId: "student_1",
            type: "LEARNING_CONTENT_ASSIGNED",
            entityType: "LEARNING_TASK",
            entityId: "task_1",
            dedupeKey: "learning-task:task_1:student_1",
            href: "/tarefas",
          },
        ],
      },
      occurredAt: new Date("2026-10-03T15:00:00.000Z"),
    },
    {
      id: "job_task_1",
      consumerKey: "notifications.create.v1",
      idempotencyKey: "event_task_1:notifications.create.v1",
      attemptCount: 1,
    }
  );

  expect(taskFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ["task_1"] },
        recipients: { some: { memberId: { in: ["student_1"] } } },
      }),
    })
  );
  expect(notificationCreateMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        memberId: "student_1",
        type: "LEARNING_CONTENT_ASSIGNED",
        body: "Ler o capítulo introdutório",
        href: "/tarefas",
      }),
    ],
    skipDuplicates: true,
  });
});

test("delivers a badge notice only for a persisted award and its revision", async () => {
  const notificationCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const badgeAwardFindMany = vi.fn().mockResolvedValue([
    {
      badgeId: "badge_1",
      memberId: "student_1",
      definitionRevision: { title: "Ritmo de uma semana" },
    },
  ]);
  const tx = {
    member: { findMany: vi.fn().mockResolvedValue([{ id: "student_1" }]) },
    notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
    badgeAward: { findMany: badgeAwardFindMany },
    notification: { createMany: notificationCreateMany },
  } as unknown as Prisma.TransactionClient;

  await notificationOutboxConsumer.handle(
    tx,
    {
      id: "event_badge_1",
      eventType: "notifications.batch_requested",
      schemaVersion: 1,
      actorId: null,
      aggregateType: "BADGE_AWARD",
      aggregateId: "student_1:badge_1",
      payload: {
        notifications: [
          {
            recipientId: "student_1",
            type: "BADGE_AWARDED",
            entityType: "BADGE",
            entityId: "badge_1",
            dedupeKey: "badge-awarded:student_1:badge_1",
            href: "/perfil#conquistas",
          },
        ],
      },
      occurredAt: new Date("2026-10-03T15:00:00.000Z"),
    },
    {
      id: "job_badge_1",
      consumerKey: "notifications.create.v1",
      idempotencyKey: "event_badge_1:notifications.create.v1",
      attemptCount: 1,
    }
  );

  expect(badgeAwardFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        badgeId: { in: ["badge_1"] },
        memberId: { in: ["student_1"] },
      },
    })
  );
  expect(notificationCreateMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        memberId: "student_1",
        type: "BADGE_AWARDED",
        title: "Nova conquista desbloqueada",
        body: "Ritmo de uma semana",
        href: "/perfil#conquistas",
      }),
    ],
    skipDuplicates: true,
  });
});
