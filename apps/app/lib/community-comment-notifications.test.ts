import { beforeEach, describe, expect, test, vi } from "vitest";

const { databaseMock, enqueueNotificationBatchMock, state } = vi.hoisted(() => {
  const state = { privateSpace: false };
  const databaseMock = {
    communityPost: {
      findUnique: vi.fn(() =>
        state.privateSpace
          ? {
              space: {
                id: "space-private",
                visibility: "PRIVATE",
                ownerId: "member-owner",
              },
            }
          : { space: null }
      ),
    },
    communitySpaceMember: {
      findMany: vi.fn(() => [{ memberId: "member-mentioned" }]),
    },
    member: {
      findMany: vi.fn(() => [{ id: "member-mentioned" }]),
      findUnique: vi.fn(() => ({ role: "MEMBER" })),
    },
    mention: {
      createMany: vi.fn(() => ({ count: 1 })),
    },
    profile: {
      findMany: vi.fn(() => []),
    },
    topicFollow: {
      findMany: vi.fn(() => [
        { userId: "member-follower" },
        { userId: "member-author" },
      ]),
    },
  };
  const enqueueNotificationBatchMock = vi.fn(() => Promise.resolve([]));
  return { databaseMock, enqueueNotificationBatchMock, state };
});

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { APP_WRITE_FREEZE: "false" } }));
vi.mock("./authorization", () => ({ getMemberRole: vi.fn() }));
vi.mock("@repo/observability/performance", () => ({
  tracePerformance: vi.fn((_name: string, callback: () => unknown) =>
    callback()
  ),
}));
vi.mock("@repo/database", () => ({
  AnnouncementAudience: {},
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER", MEMBER: "MEMBER" },
  database: databaseMock,
}));
vi.mock("@repo/member-domain", () => ({
  enqueueNotificationBatch: enqueueNotificationBatchMock,
  notificationPriority: {
    COMMENT_REPLY: 3,
    FOLLOWED_TOPIC_ACTIVITY: 2,
    MENTION: 4,
    TOPIC_COMMENT: 2,
  },
  notificationPreferenceForType: {},
  notificationTitleForType: {},
}));

import { notifyCommunityComment } from "./notifications";

const transaction = databaseMock as never;
const occurredAt = new Date("2026-10-20T12:00:00.000Z");

const notify = () =>
  notifyCommunityComment({
    actorId: "member-author",
    postId: "post-1",
    commentId: "comment-1",
    commentContent: "Uma resposta com menção.",
    postAuthorId: "member-owner",
    postTitle: "Uma discussão",
    parentCommentId: null,
    parentAuthorId: null,
    href: "/comunidade/publicacoes/discussao",
    document: {
      type: "doc",
      content: [
        {
          type: "mention",
          attrs: { id: "member-mentioned" },
        },
      ],
    },
    occurredAt,
    idempotencyKey: "community-comment:comment-1:created",
    transaction,
  });

describe("community comment notification outbox", () => {
  beforeEach(() => {
    state.privateSpace = false;
    vi.clearAllMocks();
  });

  test("persists mentions and notification requests through the supplied transaction", async () => {
    await notify();

    expect(databaseMock.mention.createMany).toHaveBeenCalledWith({
      data: [
        {
          actorId: "member-author",
          mentionedUserId: "member-mentioned",
          entityType: "COMMENT",
          entityId: "comment-1",
        },
      ],
      skipDuplicates: true,
    });
    expect(enqueueNotificationBatchMock).toHaveBeenCalledTimes(1);
    const [tx, event] = enqueueNotificationBatchMock.mock
      .calls[0] as unknown as [
      unknown,
      {
        aggregateId: string;
        idempotencyKey: string;
        notifications: Array<{
          dedupeKey: string;
          parentEntityId: string;
          recipientId: string;
          type: string;
        }>;
        occurredAt: Date;
      },
    ];
    expect(tx).toBe(transaction);
    expect(event).toMatchObject({
      aggregateId: "comment-1",
      idempotencyKey: "community-comment:comment-1:created",
      occurredAt,
    });
    expect(event.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientId: "member-mentioned",
          type: "MENTION",
          dedupeKey: "MENTION:member-mentioned:comment-1",
          parentEntityId: "post-1",
        }),
        expect.objectContaining({
          recipientId: "member-owner",
          type: "TOPIC_COMMENT",
        }),
        expect.objectContaining({
          recipientId: "member-follower",
          type: "FOLLOWED_TOPIC_ACTIVITY",
        }),
      ])
    );
  });

  test("keeps private-group notification recipients inside the group", async () => {
    state.privateSpace = true;

    await notify();

    const [, event] = enqueueNotificationBatchMock.mock.calls[0] as unknown as [
      unknown,
      { notifications: Array<{ recipientId: string }> },
    ];
    expect(event.notifications.map(({ recipientId }) => recipientId)).toEqual(
      expect.arrayContaining(["member-mentioned", "member-owner"])
    );
    expect(
      event.notifications.map(({ recipientId }) => recipientId)
    ).not.toContain("member-follower");
  });
});
