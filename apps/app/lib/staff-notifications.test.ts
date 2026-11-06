import { beforeEach, expect, test, vi } from "vitest";

const { databaseMock, state } = vi.hoisted(() => {
  const state = {
    open: null as { id: string; metadata: unknown } | null,
    staff: [{ id: "admin-1" }, { id: "teacher-1" }, { id: "author-1" }],
  };
  const databaseMock = {
    member: {
      findMany: vi.fn(() => state.staff),
      findUnique: vi.fn(() => ({ displayName: "Ana", role: "MEMBER" })),
    },
    notification: {
      create: vi.fn(),
      findFirst: vi.fn(() => state.open),
      update: vi.fn(),
    },
    notificationPreference: { findUnique: vi.fn(() => null) },
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
  MemberRole: { ADMIN: "ADMIN", MEMBER: "MEMBER", TEACHER: "TEACHER" },
  Prisma: { TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" } },
  database: databaseMock,
}));
vi.mock("@repo/member-domain", () => ({
  enqueueNotificationBatch: vi.fn(),
  notificationPreferenceForType: {},
  notificationPriority: {},
  notificationTitleForType: {},
}));

import { notifyStaffCommunityActivity } from "./notifications";

const input = {
  actorId: "author-1",
  entityId: "post-1",
  href: "/comunidade/publicacoes/x",
  kind: "community-posts" as const,
  title: "Dúvida sobre NNT",
};

beforeEach(() => {
  vi.clearAllMocks();
  state.open = null;
});

test("cria uma notificação por pessoa da equipe e não avisa o autor", async () => {
  await notifyStaffCommunityActivity(input);
  expect(databaseMock.notification.create).toHaveBeenCalledTimes(2);
  const recipients = databaseMock.notification.create.mock.calls.map(
    (call) => (call[0] as { data: { memberId: string } }).data.memberId
  );
  expect(recipients.sort()).toEqual(["admin-1", "teacher-1"]);
  const first = databaseMock.notification.create.mock.calls[0][0] as {
    data: { title: string; groupKey: string };
  };
  expect(first.data.title).toBe("Nova publicação na Comunidade");
  expect(first.data.groupKey).toBe("staff:community-posts");
});

test("agrupa na notificação ainda não lida em vez de criar outra", async () => {
  state.open = { id: "n1", metadata: { count: 2 } };
  await notifyStaffCommunityActivity(input);
  expect(databaseMock.notification.create).not.toHaveBeenCalled();
  expect(databaseMock.notification.update).toHaveBeenCalledTimes(2);
  const update = databaseMock.notification.update.mock.calls[0][0] as {
    data: { metadata: { count: number }; seenAt: null; title: string };
  };
  expect(update.data.title).toBe("3 novas publicações na Comunidade");
  expect(update.data.metadata).toEqual({ count: 3 });
  expect(update.data.seenAt).toBeNull();
});
