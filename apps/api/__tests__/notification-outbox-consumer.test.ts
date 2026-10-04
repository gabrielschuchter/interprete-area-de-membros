import type { Prisma } from "@repo/database";
import { expect, test, vi } from "vitest";
import { notificationOutboxConsumer } from "../lib/notification-outbox-consumer";

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
            type: "ANNOUNCEMENT",
            dedupeKey: "announcement:teacher_1:event_1",
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
            type: "ANNOUNCEMENT",
            dedupeKey: "announcement:deactivated:event_1",
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
      findMany: vi.fn().mockResolvedValue([{ id: "post_1", title: "Roteiro" }]),
    },
    communitySpace: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "private_group_1",
          ownerId: "owner_1",
          members: [{ memberId: "member_1" }],
        },
      ]),
    },
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
      expect.objectContaining({ memberId: "owner_1", type: "GROUP_POST" }),
      expect.objectContaining({ memberId: "member_1", type: "GROUP_POST" }),
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
          space: { title: "Grupo privado" },
        },
      ]),
    },
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
            href: "/aprender/atribuicoes/assignment_1",
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
        href: "/aprender/atribuicoes/assignment_1",
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
