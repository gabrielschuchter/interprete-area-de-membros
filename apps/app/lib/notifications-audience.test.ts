import { beforeEach, expect, test, vi } from "vitest";

const { databaseMock, state } = vi.hoisted(() => {
  const state = {
    accessibleSpaces: [] as Array<{ id: string }>,
    pendingInvitations: [] as Array<{ id: string; spaceId: string }>,
  };
  const databaseMock = {
    communitySpace: {
      findMany: vi.fn((_args?: { where?: unknown }) => state.accessibleSpaces),
    },
    communitySpaceInvitation: {
      findMany: vi.fn(
        (_args?: { where?: unknown }) => state.pendingInvitations
      ),
    },
    notification: {
      count: vi.fn((_args?: { where?: unknown }) => 0),
      create: vi.fn(),
      findMany: vi.fn((_args?: { where?: unknown }) => []),
      updateMany: vi.fn((_args?: { where?: unknown }) => ({ count: 0 })),
    },
    $transaction: vi.fn(
      async (
        callback: (transaction: unknown) => Promise<unknown>,
        _options: unknown
      ) => callback(databaseMock)
    ),
  };
  return { databaseMock, state };
});

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { APP_WRITE_FREEZE: "false" } }));
vi.mock("@/lib/community-announcements", () => ({
  getCommunityAnnouncements: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@repo/observability/performance", () => ({
  tracePerformance: vi.fn((_name: string, callback: () => unknown) =>
    callback()
  ),
}));
vi.mock("@repo/database", () => ({
  AnnouncementAudience: {},
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER", MEMBER: "MEMBER" },
  Prisma: { TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" } },
  database: databaseMock,
}));
vi.mock("@repo/member-domain", () => ({
  enqueueNotificationBatch: vi.fn(),
  notificationPriority: {},
  notificationPreferenceForType: {},
  notificationTitleForType: {},
}));

import {
  getNotificationSummary,
  getNotifications,
  markNotificationsSeen,
} from "./notifications";

const audienceFrom = (where: unknown) => {
  const root = where as {
    AND: Array<{ OR: Record<string, unknown>[] }>;
  };
  return root.AND[1];
};

beforeEach(() => {
  state.accessibleSpaces = [];
  state.pendingInvitations = [];
  vi.clearAllMocks();
});

test("a removed member cannot read or count a stale private comment notification", async () => {
  await getNotifications("member-removed");

  expect(databaseMock.$transaction.mock.calls[0]?.[1]).toEqual({
    isolationLevel: "RepeatableRead",
  });

  const audience = audienceFrom(
    databaseMock.notification.findMany.mock.calls[0]?.[0]?.where
  );
  expect(audience.OR).toContainEqual({
    type: {
      in: [
        "LESSON_AVAILABLE",
        "MODULE_AVAILABLE",
        "ACTIVITY_ASSIGNED",
        "FEEDBACK_RECEIVED",
        "ACTIVITY_DEADLINE",
        "LEARNING_CONTENT_ASSIGNED",
        "BADGE_AWARDED",
        "PLANNER_REMINDER",
      ],
    },
  });
  expect(audience.OR).toContainEqual({
    type: {
      in: [
        "MENTION",
        "COMMENT_REPLY",
        "TOPIC_COMMENT",
        "FOLLOWED_TOPIC_ACTIVITY",
      ],
    },
    OR: [{ communitySpaceId: null }, { communitySpaceId: { in: [] } }],
  });
  expect(audience.OR).not.toContainEqual({
    type: { notIn: expect.any(Array) },
  });

  for (const call of databaseMock.notification.count.mock.calls) {
    const countAudience = (call[0]?.where as { AND: Array<{ AND: unknown[] }> })
      .AND[0].AND[1];
    expect(countAudience).toEqual(audience);
  }

  await markNotificationsSeen("member-removed", ["known-stale-notification"]);
  expect(databaseMock.$transaction.mock.calls[1]?.[1]).toEqual({
    isolationLevel: "RepeatableRead",
  });
  const updateAudience = (
    databaseMock.notification.updateMany.mock.calls[0]?.[0]?.where as {
      AND: unknown[];
    }
  ).AND[1];
  expect(updateAudience).toEqual(audience);
});

test("current group access and a live invitation are narrow audience grants", async () => {
  state.accessibleSpaces = [{ id: "space-member" }];
  state.pendingInvitations = [
    { id: "invite-pending", spaceId: "space-invite" },
  ];

  await getNotifications("member-current");

  const audience = audienceFrom(
    databaseMock.notification.findMany.mock.calls[0]?.[0]?.where
  );
  expect(audience.OR).toContainEqual({
    type: {
      in: [
        "MENTION",
        "COMMENT_REPLY",
        "TOPIC_COMMENT",
        "FOLLOWED_TOPIC_ACTIVITY",
      ],
    },
    OR: [
      { communitySpaceId: null },
      { communitySpaceId: { in: ["space-member"] } },
    ],
  });
  expect(audience.OR).toContainEqual({
    type: "GROUP_POST",
    communitySpaceId: { in: ["space-member"] },
  });
  expect(audience.OR).toContainEqual({
    type: "GROUP_INVITATION",
    entityType: "COMMUNITY_INVITATION",
    entityId: "invite-pending",
    communitySpaceId: "space-invite",
  });
});

test("summary counts share one current-audience repeatable-read snapshot", async () => {
  state.accessibleSpaces = [{ id: "space-member" }];

  const summary = await getNotificationSummary("member-current");

  expect(summary).toEqual({ unreadCount: 0, unseenCount: 0 });
  expect(databaseMock.$transaction.mock.calls).toHaveLength(1);
  expect(databaseMock.$transaction.mock.calls[0]?.[1]).toEqual({
    isolationLevel: "RepeatableRead",
  });
  expect(databaseMock.notification.count).toHaveBeenCalledTimes(2);
  const firstCallOrder = (orders: readonly number[]) => orders.at(0) ?? 0;
  expect(
    firstCallOrder(
      databaseMock.communitySpace.findMany.mock.invocationCallOrder
    )
  ).toBeLessThan(
    firstCallOrder(databaseMock.notification.count.mock.invocationCallOrder)
  );
  expect(
    firstCallOrder(
      databaseMock.communitySpaceInvitation.findMany.mock.invocationCallOrder
    )
  ).toBeLessThan(
    firstCallOrder(databaseMock.notification.count.mock.invocationCallOrder)
  );
  expect(databaseMock.notification.count).toHaveBeenNthCalledWith(1, {
    where: {
      AND: [
        { memberId: "member-current", readAt: null },
        audienceFrom(databaseMock.notification.count.mock.calls[0]?.[0]?.where),
      ],
    },
  });
  expect(databaseMock.notification.count).toHaveBeenNthCalledWith(2, {
    where: {
      AND: [
        { memberId: "member-current", seenAt: null },
        audienceFrom(databaseMock.notification.count.mock.calls[1]?.[0]?.where),
      ],
    },
  });
});
