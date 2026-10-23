import { beforeEach, describe, expect, test, vi } from "vitest";

const { databaseMock, enqueueNotificationBatchMock, state } = vi.hoisted(() => {
  const state = {
    privateSpace: false,
    actorRole: "MEMBER",
    activeMemberIds: [
      "member-mentioned",
      "member-follower",
      "member-author",
      "member-owner",
    ],
    commentAuthors: [] as string[],
    unmutedFollowerIds: ["member-follower", "member-author"],
    mutedFollowerIds: [] as string[],
    spaceMemberIds: ["member-mentioned"],
  };
  const databaseMock = {
    communityComment: {
      findMany: vi.fn(() =>
        state.commentAuthors.map((authorId) => ({ authorId }))
      ),
    },
    communityPost: {
      findUnique: vi.fn(() =>
        state.privateSpace
          ? {
              status: "PUBLISHED",
              deletedAt: null,
              space: {
                id: "space-private",
                visibility: "PRIVATE",
                ownerId: "member-owner",
                status: "PUBLISHED",
              },
            }
          : { status: "PUBLISHED", deletedAt: null, space: null }
      ),
    },
    communitySpaceMember: {
      findMany: vi.fn(() =>
        state.spaceMemberIds.map((memberId) => ({ memberId }))
      ),
    },
    member: {
      findMany: vi.fn((args?: { where?: { id?: { in?: string[] } } }) => {
        const requestedIds = args?.where?.id?.in;
        if (requestedIds) {
          return requestedIds
            .filter((id) => state.activeMemberIds.includes(id))
            .map((id) => ({ id }));
        }
        return [{ id: "member-mentioned" }];
      }),
      findUnique: vi.fn(() => ({ role: state.actorRole })),
    },
    mention: {
      createMany: vi.fn(
        (_args?: { data: Array<{ mentionedUserId: string }> }) => ({ count: 1 })
      ),
    },
    profile: {
      findMany: vi.fn(() => []),
    },
    topicFollow: {
      findMany: vi.fn((args?: { where?: { mutedAt?: unknown } }) => {
        const mutedAt = args?.where?.mutedAt;
        if (mutedAt && typeof mutedAt === "object") {
          return state.mutedFollowerIds.map((userId) => ({ userId }));
        }
        return state.unmutedFollowerIds.map((userId) => ({ userId }));
      }),
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

const notify = (
  document: unknown = {
    type: "doc",
    content: [
      {
        type: "mention",
        attrs: { id: "member-mentioned" },
      },
    ],
  }
) =>
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
    document,
    occurredAt,
    idempotencyKey: "community-comment:comment-1:created",
    transaction,
  });

describe("community comment notification outbox", () => {
  beforeEach(() => {
    state.privateSpace = false;
    state.actorRole = "MEMBER";
    state.activeMemberIds = [
      "member-mentioned",
      "member-follower",
      "member-author",
      "member-owner",
    ];
    state.commentAuthors = [];
    state.unmutedFollowerIds = ["member-follower", "member-author"];
    state.mutedFollowerIds = [];
    state.spaceMemberIds = ["member-mentioned"];
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
          communitySpaceId: string | null;
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
          communitySpaceId: null,
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
      {
        notifications: Array<{
          communitySpaceId: string | null;
          recipientId: string;
        }>;
      },
    ];
    expect(event.notifications.map(({ recipientId }) => recipientId)).toEqual(
      expect.arrayContaining(["member-mentioned", "member-owner"])
    );
    expect(
      event.notifications.map(({ recipientId }) => recipientId)
    ).not.toContain("member-follower");
    expect(
      event.notifications.every(
        ({ communitySpaceId }) => communitySpaceId === "space-private"
      )
    ).toBe(true);
  });

  test.each([
    "ADMIN",
    "TEACHER",
  ])("%s @todos only reaches active, unmuted participants and followers of this post", async (role) => {
    state.actorRole = role;
    state.commentAuthors = [
      "member-participant",
      "member-muted",
      "member-inactive",
    ];
    state.unmutedFollowerIds = ["member-follower", "member-author"];
    state.mutedFollowerIds = ["member-muted"];
    state.activeMemberIds = [
      "member-participant",
      "member-muted",
      "member-follower",
      "member-author",
      "member-owner",
    ];

    await notify({
      type: "doc",
      content: [
        {
          type: "mention",
          attrs: { id: "group:ALL", kind: "GROUP", username: "todos" },
        },
      ],
    });

    expect(databaseMock.communityComment.findMany).toHaveBeenCalledWith({
      where: { postId: "post-1", deletedAt: null },
      select: { authorId: true },
    });
    expect(databaseMock.topicFollow.findMany).toHaveBeenCalledWith({
      where: { topicId: "post-1", mutedAt: { not: null } },
      select: { userId: true },
    });
    const mentionedIds =
      databaseMock.mention.createMany.mock.calls[0]?.[0]?.data.map(
        ({ mentionedUserId }) => mentionedUserId
      );
    expect(mentionedIds).toEqual(
      expect.arrayContaining([
        "member-participant",
        "member-follower",
        "member-owner",
      ])
    );
    expect(mentionedIds).not.toEqual(
      expect.arrayContaining([
        "member-muted",
        "member-inactive",
        "member-author",
      ])
    );
    expect(mentionedIds).toHaveLength(3);
  });

  test("does not expand @todos for a regular member", async () => {
    state.commentAuthors = ["member-participant"];
    state.unmutedFollowerIds = [];

    await notify({
      type: "doc",
      content: [
        {
          type: "mention",
          attrs: { id: "group:ALL", kind: "GROUP", username: "todos" },
        },
      ],
    });

    expect(databaseMock.communityComment.findMany).not.toHaveBeenCalled();
    expect(databaseMock.mention.createMany).not.toHaveBeenCalled();
    expect(enqueueNotificationBatchMock).toHaveBeenCalledTimes(1);
    const [, event] = enqueueNotificationBatchMock.mock.calls[0] as unknown as [
      unknown,
      { notifications: Array<{ type: string }> },
    ];
    expect(event.notifications.some(({ type }) => type === "MENTION")).toBe(
      false
    );
  });

  test("filters private @todos recipients to current group members and owner", async () => {
    state.privateSpace = true;
    state.actorRole = "ADMIN";
    state.commentAuthors = [
      "member-private-participant",
      "member-private-outsider",
    ];
    state.unmutedFollowerIds = ["member-private-follower", "member-author"];
    state.activeMemberIds = [
      "member-private-participant",
      "member-private-outsider",
      "member-private-follower",
      "member-author",
      "member-owner",
    ];
    state.spaceMemberIds = ["member-private-participant"];

    await notify({
      type: "doc",
      content: [
        {
          type: "mention",
          attrs: { id: "group:ALL", kind: "GROUP", username: "todos" },
        },
      ],
    });

    const mentionedIds =
      databaseMock.mention.createMany.mock.calls[0]?.[0]?.data.map(
        ({ mentionedUserId }) => mentionedUserId
      );
    expect(mentionedIds).toEqual(
      expect.arrayContaining(["member-private-participant", "member-owner"])
    );
    expect(mentionedIds).not.toEqual(
      expect.arrayContaining([
        "member-private-outsider",
        "member-private-follower",
      ])
    );
    expect(mentionedIds).toHaveLength(2);
  });
});
