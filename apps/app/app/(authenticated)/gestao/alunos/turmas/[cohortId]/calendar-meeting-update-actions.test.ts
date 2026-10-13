import { beforeEach, describe, expect, it, vi } from "vitest";

const { database, tx, requireGestaoAction, enqueueDomainEvent } = vi.hoisted(
  () => ({
    database: { $transaction: vi.fn() },
    tx: {
      member: { findFirst: vi.fn() },
      cohort: { findFirst: vi.fn(), updateMany: vi.fn() },
      meeting: { findFirst: vi.fn(), updateMany: vi.fn() },
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
vi.mock("@repo/member-domain/recurrence", () => ({
  expandPlannerOccurrences: vi.fn(() => []),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/gestao-authorization", () => ({ requireGestaoAction }));
vi.mock("@/lib/mutation-reliability", () => ({
  consumeMutationRateLimit: vi.fn(),
}));

import {
  getGestaoCohortMeetingForEdit,
  updateGestaoCohortMeeting,
} from "./calendar-actions";

const updatedAt = new Date("2026-10-12T12:00:00.000Z");
const input = {
  cohortId: "cohort-a",
  meetingId: "meeting-shared",
  expectedCohortVersion: 4,
  expectedMeetingUpdatedAt: updatedAt.toISOString(),
  title: "Encontro atualizado",
  description: "Descrição atualizada",
  startsAt: "2026-10-19T09:00",
  endsAt: "2026-10-19T10:00",
  timezone: "America/Sao_Paulo",
  joinUrl: "https://example.invalid/room",
  recurrence: "NONE",
  recurrenceUntil: "",
  status: "PUBLISHED",
  confirmed: true,
  idempotencyKey: "1a79f8c0-7d80-4fb0-82d1-e74b1d9fe8d5",
};
const meeting = {
  id: "meeting-shared",
  title: "Encontro anterior",
  description: null,
  startsAt: new Date("2026-10-19T12:00:00.000Z"),
  endsAt: new Date("2026-10-19T13:00:00.000Z"),
  timezone: "America/Sao_Paulo",
  joinUrl: "https://example.invalid/old-room",
  recurrenceRule: null,
  recurrenceUntil: null,
  status: "DRAFT",
  publishedAt: null,
  updatedAt,
};

describe("cohort meeting edit and publication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireGestaoAction.mockResolvedValue({
      actor: { role: "TEACHER", userId: "teacher-a" },
    });
    tx.member.findFirst.mockResolvedValue({ role: "TEACHER" });
    tx.cohort.findFirst.mockResolvedValue({
      id: "cohort-a",
      version: 4,
      archivedAt: null,
    });
    tx.cohort.updateMany.mockResolvedValue({ count: 1 });
    tx.meeting.findFirst.mockResolvedValue(meeting);
    tx.meeting.updateMany.mockResolvedValue({ count: 1 });
    tx.domainEvent.findUnique.mockResolvedValue(null);
    database.$transaction.mockImplementation(
      (operation: (transaction: typeof tx) => unknown) => operation(tx)
    );
  });

  it("returns edit fields only through the responsible-cohort scope", async () => {
    expect(
      await getGestaoCohortMeetingForEdit({
        cohortId: "cohort-a",
        meetingId: "meeting-shared",
      })
    ).toEqual({
      ok: true,
      meeting: {
        cohortVersion: 4,
        description: null,
        endsAt: meeting.endsAt.toISOString(),
        id: "meeting-shared",
        joinUrl: meeting.joinUrl,
        recurrence: "NONE",
        recurrenceUntil: "",
        startsAt: meeting.startsAt.toISOString(),
        status: "DRAFT",
        timezone: "America/Sao_Paulo",
        title: "Encontro anterior",
        updatedAt: updatedAt.toISOString(),
      },
    });
    expect(tx.meeting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "meeting-shared",
          demoKey: null,
          cohortTargets: {
            some: { cohortId: "cohort-a", revokedAt: null },
            none: {
              revokedAt: null,
              cohort: { teachers: { none: { memberId: "teacher-a" } } },
            },
          },
        },
      })
    );
  });

  it("returns an empty end time for a legacy meeting without one", async () => {
    tx.meeting.findFirst.mockResolvedValue({ ...meeting, endsAt: null });
    expect(
      await getGestaoCohortMeetingForEdit({
        cohortId: "cohort-a",
        meetingId: "meeting-shared",
      })
    ).toMatchObject({ ok: true, meeting: { endsAt: "" } });
  });

  it("publishes a scoped draft and audits it without changing cohort targets", async () => {
    expect(await updateGestaoCohortMeeting(input)).toEqual({
      ok: true,
      meetingId: "meeting-shared",
    });
    expect(tx.meeting.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "meeting-shared",
          demoKey: null,
          updatedAt,
          cohortTargets: {
            some: { cohortId: "cohort-a", revokedAt: null },
            none: {
              revokedAt: null,
              cohort: { teachers: { none: { memberId: "teacher-a" } } },
            },
          },
        }),
        data: expect.objectContaining({
          title: input.title,
          startsAt: new Date("2026-10-19T12:00:00.000Z"),
          status: "PUBLISHED",
          publishedAt: expect.any(Date),
        }),
      })
    );
    expect(tx.meeting.updateMany.mock.calls[0]?.[0].data).not.toHaveProperty(
      "cohortTargets"
    );
    expect(enqueueDomainEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: "event.published",
        aggregateId: "meeting-shared",
        payload: expect.objectContaining({
          cohortId: "cohort-a",
          meetingId: "meeting-shared",
          status: "PUBLISHED",
        }),
      })
    );
  });

  it("denies a teacher outside the target cohort before writing", async () => {
    tx.meeting.findFirst.mockResolvedValue(null);
    expect(await updateGestaoCohortMeeting(input)).toMatchObject({
      ok: false,
      code: "not-found",
    });
    expect(tx.meeting.updateMany).not.toHaveBeenCalled();
    expect(enqueueDomainEvent).not.toHaveBeenCalled();
  });

  it("rejects stale meeting revisions and does not mutate", async () => {
    tx.meeting.findFirst.mockResolvedValue({
      ...meeting,
      updatedAt: new Date("2026-10-12T12:01:00.000Z"),
    });
    expect(await updateGestaoCohortMeeting(input)).toMatchObject({
      ok: false,
      code: "conflict",
    });
    expect(tx.cohort.updateMany).not.toHaveBeenCalled();
    expect(tx.meeting.updateMany).not.toHaveBeenCalled();
  });

  it("does not demote a published meeting to draft", async () => {
    tx.meeting.findFirst.mockResolvedValue({
      ...meeting,
      status: "PUBLISHED",
      publishedAt: new Date("2026-10-01T12:00:00.000Z"),
    });
    expect(
      await updateGestaoCohortMeeting({
        ...input,
        status: "DRAFT",
        confirmed: false,
      })
    ).toMatchObject({ ok: false, code: "conflict" });
    expect(tx.meeting.updateMany).not.toHaveBeenCalled();
  });

  it("replays a committed update with the same key after checking access", async () => {
    await updateGestaoCohortMeeting(input);
    const payload = enqueueDomainEvent.mock.calls[0]?.[1].payload;
    tx.domainEvent.findUnique.mockResolvedValue({ payload });
    expect(await updateGestaoCohortMeeting(input)).toEqual({
      ok: true,
      meetingId: "meeting-shared",
    });
    expect(tx.member.findFirst).toHaveBeenCalledTimes(2);
    expect(tx.cohort.updateMany).toHaveBeenCalledOnce();
    expect(tx.meeting.updateMany).toHaveBeenCalledOnce();
  });
});
