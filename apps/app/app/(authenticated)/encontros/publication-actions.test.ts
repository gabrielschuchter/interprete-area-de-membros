import { beforeEach, describe, expect, it, vi } from "vitest";

const { database, tx, requireStaff, revalidatePath } = vi.hoisted(() => ({
  database: { $transaction: vi.fn() },
  tx: { meeting: { update: vi.fn(), updateMany: vi.fn() } },
  requireStaff: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@repo/database", () => ({
  database,
  ContentStatus: {
    DRAFT: "DRAFT",
    PUBLISHED: "PUBLISHED",
    ARCHIVED: "ARCHIVED",
  },
  BadgeCriterion: {},
  MeetingKind: {},
  Prisma: {},
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/authorization", () => ({ requireStaff }));
vi.mock("@/lib/badges", () => ({ evaluateMemberBadges: vi.fn() }));
vi.mock("@/lib/meeting-attendance", () => ({
  resolveMeetingAttendance: vi.fn(),
}));
vi.mock("@/lib/mutation-contract", () => ({ readIdempotencyKey: vi.fn() }));
vi.mock("@/lib/mutation-reliability", () => ({
  consumeMutationRateLimit: vi.fn(),
  isUniqueConstraintError: vi.fn(),
}));
vi.mock("@/lib/notification-outbox-dispatch", () => ({
  dispatchPendingNotifications: vi.fn(),
}));

import { setMeetingStatus } from "./actions";

const form = (status: string) => {
  const data = new FormData();
  data.set("id", "meeting-qa");
  data.set("status", status);
  return data;
};

describe("meeting first publication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireStaff.mockResolvedValue({ userId: "teacher-qa" });
    database.$transaction.mockImplementation(
      (operation: (transaction: typeof tx) => unknown) => operation(tx)
    );
  });

  it("records publication only when the stored instant is null in the same transaction", async () => {
    await setMeetingStatus(form("PUBLISHED"));
    expect(database.$transaction).toHaveBeenCalledOnce();
    expect(tx.meeting.update).toHaveBeenCalledWith({
      where: { id: "meeting-qa" },
      data: { status: "PUBLISHED" },
    });
    expect(tx.meeting.updateMany).toHaveBeenCalledWith({
      where: { id: "meeting-qa", publishedAt: null },
      data: { publishedAt: expect.any(Date) },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/planejamento");
  });

  it("does not clear the first publication when returning to draft", async () => {
    await setMeetingStatus(form("DRAFT"));
    expect(tx.meeting.update).toHaveBeenCalledWith({
      where: { id: "meeting-qa" },
      data: { status: "DRAFT" },
    });
    expect(tx.meeting.updateMany).not.toHaveBeenCalled();
  });

  it("does not write when staff authorization fails", async () => {
    requireStaff.mockRejectedValue(new Error("Denied"));
    await expect(setMeetingStatus(form("PUBLISHED"))).rejects.toThrow("Denied");
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it("does not write an invalid status", async () => {
    await setMeetingStatus(form("invalid"));
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});
