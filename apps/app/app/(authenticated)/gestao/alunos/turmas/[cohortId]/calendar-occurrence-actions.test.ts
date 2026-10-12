import { beforeEach, describe, expect, it, vi } from "vitest";

const { database, tx, requireGestaoAction, enqueueDomainEvent } = vi.hoisted(
  () => ({
    database: { $transaction: vi.fn() },
    tx: {
      member: { findFirst: vi.fn() },
      cohort: { findFirst: vi.fn(), updateMany: vi.fn() },
      domainEvent: { findUnique: vi.fn() },
      meeting: { findFirst: vi.fn() },
      meetingOccurrenceException: { findUnique: vi.fn(), create: vi.fn() },
    },
    requireGestaoAction: vi.fn(),
    enqueueDomainEvent: vi.fn(),
  })
);

vi.mock("@repo/database", () => ({
  database,
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER", MEMBER: "MEMBER" },
  PlannerRecurrence: {
    NONE: "NONE",
    DAILY: "DAILY",
    WEEKLY: "WEEKLY",
    MONTHLY: "MONTHLY",
  },
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
}));
vi.mock("@repo/member-domain", () => ({
  enqueueDomainEvent,
  isPlannerSeriesOccurrence: () => true,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/gestao-authorization", () => ({ requireGestaoAction }));
vi.mock("@/lib/mutation-reliability", () => ({
  consumeMutationRateLimit: vi.fn(),
}));

import { setGestaoCohortCalendarOccurrence } from "./calendar-occurrence-actions";

const revision = new Date("2026-10-12T12:00:00.000Z");
const input = {
  cohortId: "cohort-a",
  sourceType: "meeting",
  sourceId: "meeting-shared",
  occurrenceStartsAt: "2026-10-15T12:00:00.000Z",
  expectedCohortVersion: 1,
  expectedSourceRevision: revision.toISOString(),
  expectedExceptionVersion: 0,
  operation: "cancel",
  idempotencyKey: "9fd5f0f7-88fb-4ac5-9f2e-c875c04b993d",
};

describe("cohort meeting occurrence authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireGestaoAction.mockResolvedValue({
      actor: { role: "TEACHER", userId: "teacher-a" },
    });
    tx.member.findFirst.mockResolvedValue({ role: "TEACHER" });
    tx.cohort.findFirst.mockResolvedValue({
      id: "cohort-a",
      version: 1,
      archivedAt: null,
    });
    tx.cohort.updateMany.mockResolvedValue({ count: 1 });
    tx.domainEvent.findUnique.mockResolvedValue(null);
    tx.meeting.findFirst.mockResolvedValue({
      id: "meeting-shared",
      startsAt: new Date("2026-10-01T12:00:00.000Z"),
      endsAt: new Date("2026-10-01T13:00:00.000Z"),
      recurrenceRule: "WEEKLY",
      recurrenceUntil: null,
      timezone: "America/Sao_Paulo",
      updatedAt: revision,
    });
    tx.meetingOccurrenceException.findUnique.mockResolvedValue(null);
    database.$transaction.mockImplementation(
      async (operation: (transaction: typeof tx) => unknown) => operation(tx)
    );
  });

  it("requires the teacher to manage every cohort linked to the shared meeting", async () => {
    expect(await setGestaoCohortCalendarOccurrence(input)).toEqual({
      ok: true,
      sourceId: "meeting-shared",
    });
    expect(tx.meeting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cohortTargets: {
            some: { cohortId: "cohort-a", revokedAt: null },
            none: {
              revokedAt: null,
              cohort: { teachers: { none: { memberId: "teacher-a" } } },
            },
          },
        }),
      })
    );
    expect(tx.meetingOccurrenceException.create).toHaveBeenCalledOnce();
  });

  it("does not save an occurrence when the scoped source query denies access", async () => {
    tx.meeting.findFirst.mockResolvedValue(null);
    expect(await setGestaoCohortCalendarOccurrence(input)).toMatchObject({
      ok: false,
      code: "not-found",
    });
    expect(tx.meetingOccurrenceException.create).not.toHaveBeenCalled();
    expect(enqueueDomainEvent).not.toHaveBeenCalled();
  });

  it("uses the fresh transaction role for admin access", async () => {
    tx.member.findFirst.mockResolvedValue({ role: "ADMIN" });
    expect(await setGestaoCohortCalendarOccurrence(input)).toMatchObject({
      ok: true,
    });
    expect(tx.meeting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cohortTargets: { some: { cohortId: "cohort-a", revokedAt: null } },
        }),
      })
    );
  });

  it("rechecks cohort access before returning an idempotent result", async () => {
    tx.cohort.findFirst.mockResolvedValue(null);
    tx.domainEvent.findUnique.mockResolvedValue({ id: "processed" });
    expect(await setGestaoCohortCalendarOccurrence(input)).toMatchObject({
      ok: false,
      code: "not-found",
    });
    expect(tx.domainEvent.findUnique).not.toHaveBeenCalled();
    expect(tx.meetingOccurrenceException.create).not.toHaveBeenCalled();
  });

  it("rejects a revoked staff role before any mutation", async () => {
    tx.member.findFirst.mockResolvedValue(null);
    expect(await setGestaoCohortCalendarOccurrence(input)).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    expect(tx.cohort.updateMany).not.toHaveBeenCalled();
    expect(tx.meetingOccurrenceException.create).not.toHaveBeenCalled();
  });

  it("scopes the same client idempotency key to the acting member", async () => {
    await setGestaoCohortCalendarOccurrence(input);
    const firstKey =
      tx.domainEvent.findUnique.mock.calls[0][0].where.idempotencyKey;
    requireGestaoAction.mockResolvedValue({
      actor: { role: "TEACHER", userId: "teacher-b" },
    });
    await setGestaoCohortCalendarOccurrence(input);
    const secondKey =
      tx.domainEvent.findUnique.mock.calls[1][0].where.idempotencyKey;
    expect(secondKey).not.toEqual(firstKey);
  });
});
