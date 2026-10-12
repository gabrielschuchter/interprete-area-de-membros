import { beforeEach, describe, expect, it, vi } from "vitest";

const { database, tx, requireGestaoAction, enqueueDomainEvent } = vi.hoisted(
  () => ({
    database: { $transaction: vi.fn() },
    tx: {
      member: { findFirst: vi.fn() },
      cohort: { findFirst: vi.fn(), updateMany: vi.fn() },
      meeting: { findFirst: vi.fn(), create: vi.fn() },
      domainEvent: { findUnique: vi.fn() },
    },
    requireGestaoAction: vi.fn(),
    enqueueDomainEvent: vi.fn(),
  })
);
vi.mock("@repo/database", () => ({
  database,
  ContentStatus: {
    DRAFT: "DRAFT",
    PUBLISHED: "PUBLISHED",
    ARCHIVED: "ARCHIVED",
  },
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER", MEMBER: "MEMBER" },
  PlannerRecurrence: {
    NONE: "NONE",
    DAILY: "DAILY",
    WEEKLY: "WEEKLY",
    MONTHLY: "MONTHLY",
  },
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
}));
vi.mock("@repo/member-domain", () => ({ enqueueDomainEvent }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/gestao-authorization", () => ({ requireGestaoAction }));
vi.mock("@/lib/mutation-reliability", () => ({
  consumeMutationRateLimit: vi.fn(),
}));

import { createGestaoCohortMeeting } from "./calendar-actions";

const input = {
  cohortId: "cohort-a",
  expectedCohortVersion: 1,
  title: "Encontro QA",
  description: "",
  startsAt: "2026-10-19T09:00",
  endsAt: "2026-10-19T10:00",
  timezone: "America/Sao_Paulo",
  recurrence: "NONE",
  recurrenceUntil: "",
  joinUrl: "https://example.invalid/qa",
  status: "PUBLISHED",
  confirmed: true,
  idempotencyKey: "9fd5f0f7-88fb-4ac5-9f2e-c875c04b993d",
};

describe("meeting creation from cohort calendar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireGestaoAction.mockResolvedValue({
      actor: { userId: "teacher-a", role: "TEACHER" },
    });
    tx.member.findFirst.mockResolvedValue({ role: "TEACHER" });
    tx.cohort.findFirst.mockResolvedValue({
      id: "cohort-a",
      version: 1,
      archivedAt: null,
    });
    tx.cohort.updateMany.mockResolvedValue({ count: 1 });
    tx.meeting.findFirst.mockResolvedValue(null);
    tx.meeting.create.mockResolvedValue({ id: "meeting-new" });
    database.$transaction.mockImplementation(
      (operation: (transaction: typeof tx) => unknown) => operation(tx)
    );
  });

  it("persists a published canonical Meeting, cohort target and audit in a serializable transaction", async () => {
    expect(await createGestaoCohortMeeting(input)).toEqual({
      ok: true,
      meetingId: "meeting-new",
    });
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(tx.cohort.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "cohort-a",
          teachers: { some: { memberId: "teacher-a" } },
        },
      })
    );
    expect(tx.meeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startsAt: new Date("2026-10-19T12:00:00Z"),
          endsAt: new Date("2026-10-19T13:00:00Z"),
          status: "PUBLISHED",
          publishedAt: expect.any(Date),
          teacherId: "teacher-a",
          cohortTargets: {
            create: {
              cohortId: "cohort-a",
              createdByMemberId: "teacher-a",
              assignedAt: expect.any(Date),
            },
          },
        }),
      })
    );
    expect(enqueueDomainEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventType: "event.published" })
    );
  });

  it("allows a draft without a room link and keeps publication null", async () => {
    expect(
      await createGestaoCohortMeeting({
        ...input,
        status: "DRAFT",
        confirmed: false,
        joinUrl: "",
      })
    ).toMatchObject({ ok: true });
    expect(tx.meeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT", publishedAt: null }),
      })
    );
  });

  it.each([
    [{ joinUrl: "" }, "joinUrl"],
    [{ joinUrl: "javascript:alert(1)" }, "joinUrl"],
    [{ confirmed: false }, "confirmed"],
    [{ endsAt: input.startsAt }, "endsAt"],
    [{ timezone: "invalid" }, "startsAt"],
    [
      { recurrenceUntil: "2026-10-18T09:00", recurrence: "WEEKLY" },
      "recurrenceUntil",
    ],
  ])("rejects invalid publication fields before writing", async (change, field) => {
    expect(
      await createGestaoCohortMeeting({ ...input, ...change })
    ).toMatchObject({
      ok: false,
      code: "validation",
      fields: { [field]: expect.any(String) },
    });
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it("denies a freshly revoked staff role", async () => {
    tx.member.findFirst.mockResolvedValue(null);
    expect(await createGestaoCohortMeeting(input)).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    expect(tx.meeting.create).not.toHaveBeenCalled();
  });

  it("denies a teacher outside the cohort scope", async () => {
    tx.cohort.findFirst.mockResolvedValue(null);
    expect(await createGestaoCohortMeeting(input)).toMatchObject({
      ok: false,
      code: "not-found",
    });
    expect(tx.meeting.create).not.toHaveBeenCalled();
  });

  it("rejects a concurrent cohort version change", async () => {
    tx.cohort.updateMany.mockResolvedValue({ count: 0 });
    expect(await createGestaoCohortMeeting(input)).toMatchObject({
      ok: false,
      code: "conflict",
    });
    expect(tx.meeting.create).not.toHaveBeenCalled();
  });

  it("replays the same payload without creating another meeting, after fresh authorization", async () => {
    await createGestaoCohortMeeting(input);
    const payload = enqueueDomainEvent.mock.calls[0][1].payload;
    tx.domainEvent.findUnique.mockResolvedValue({ payload });
    tx.meeting.findFirst.mockResolvedValue({
      id: "meeting-new",
      cohortTargets: [{ id: "target" }],
    });
    expect(
      await createGestaoCohortMeeting({ ...input, expectedCohortVersion: 2 })
    ).toEqual({ ok: true, meetingId: "meeting-new" });
    expect(tx.member.findFirst).toHaveBeenCalledTimes(2);
    expect(tx.meeting.create).toHaveBeenCalledOnce();
    expect(tx.cohort.updateMany).toHaveBeenCalledOnce();
    expect(
      await createGestaoCohortMeeting({ ...input, title: "Changed" })
    ).toMatchObject({ ok: false, code: "conflict" });
  });

  it("does not replay a key from another cohort", async () => {
    tx.meeting.findFirst.mockResolvedValue({
      id: "meeting-other",
      cohortTargets: [],
    });
    expect(await createGestaoCohortMeeting(input)).toMatchObject({
      ok: false,
      code: "conflict",
    });
    expect(tx.meeting.create).not.toHaveBeenCalled();
  });

  it("denies new writes for an archived cohort", async () => {
    tx.cohort.findFirst.mockResolvedValue({
      id: "cohort-a",
      version: 1,
      archivedAt: new Date(),
    });
    expect(await createGestaoCohortMeeting(input)).toMatchObject({
      ok: false,
      code: "conflict",
    });
    expect(tx.meeting.create).not.toHaveBeenCalled();
  });
});
