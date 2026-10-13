import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  rate: vi.fn(),
  event: vi.fn(),
  invalidate: vi.fn(),
  tx: {
    member: { findUnique: vi.fn(), findMany: vi.fn() },
    cohort: { findFirst: vi.fn() },
    cohortMembership: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    domainEvent: { findUnique: vi.fn() },
    accessGrantSource: { updateMany: vi.fn() },
    activitySubmission: { deleteMany: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  AccessGrantOrigin: { HISTORICAL: "HISTORICAL" },
  AccessResourceType: { COURSE: "COURSE" },
  CohortLateJoinPolicy: { ALL_ACTIVE: "ALL_ACTIVE", FROM_JOIN: "FROM_JOIN" },
  CohortMemberSource: { MANUAL: "MANUAL" },
  CohortMemberStatus: { ACTIVE: "ACTIVE", REMOVED: "REMOVED" },
  CohortReleaseMode: { ALL_AT_ONCE: "ALL_AT_ONCE", SCHEDULE: "SCHEDULE" },
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER", MEMBER: "MEMBER" },
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
  database: {
    $transaction: (operation: (tx: typeof mocks.tx) => unknown) =>
      operation(mocks.tx),
  },
}));
vi.mock("@repo/member-domain", () => ({ enqueueDomainEvent: mocks.event }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate }));
vi.mock("@/lib/auth", () => ({ getMemberIdentitySnapshot: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ requireOnboardedMemberId: vi.fn() }));
vi.mock("@/lib/gestao-authorization", () => ({
  requireGestaoAction: mocks.actor,
}));
vi.mock("@/lib/mutation-reliability", () => ({
  consumeMutationRateLimit: mocks.rate,
}));

import {
  addGestaoCohortMembers,
  removeGestaoCohortMembers,
} from "@/app/(authenticated)/gestao/alunos/turmas/actions";

const input = {
  cohortId: "qa-cohort",
  memberIds: ["qa-student"],
  idempotencyKey: "f7fca631-d17a-4b55-9809-d144717a1110",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue({
    actor: { userId: "qa-teacher", role: "TEACHER" },
  });
  mocks.tx.member.findUnique.mockResolvedValue({
    role: "TEACHER",
    deactivatedAt: null,
  });
  mocks.tx.member.findMany.mockResolvedValue([{ id: "qa-student" }]);
  mocks.tx.cohort.findFirst.mockResolvedValue({
    id: "qa-cohort",
    version: 1,
    archivedAt: null,
  });
  mocks.tx.domainEvent.findUnique.mockResolvedValue(null);
  mocks.tx.cohortMembership.createMany.mockResolvedValue({ count: 1 });
  mocks.tx.cohortMembership.findMany.mockResolvedValue([
    {
      id: "qa-membership",
      memberId: "qa-student",
      joinedAt: new Date("2026-10-01"),
    },
  ]);
  mocks.tx.cohortMembership.updateMany.mockResolvedValue({ count: 1 });
});
test.each([
  ["missing", null],
  ["deactivated", { role: "TEACHER", deactivatedAt: new Date() }],
  ["demoted", { role: "MEMBER", deactivatedAt: null }],
])("rejects membership creation if actor is %s inside transaction", async (_label, actor) => {
  mocks.tx.member.findUnique.mockResolvedValue(actor);
  expect(await addGestaoCohortMembers(input)).toMatchObject({
    ok: false,
    code: "forbidden",
  });
  expect(mocks.tx.cohortMembership.createMany).not.toHaveBeenCalled();
  expect(mocks.event).not.toHaveBeenCalled();
});
test("stale admin cannot remove using broader scope after demotion to teacher", async () => {
  mocks.actor.mockResolvedValue({
    actor: { userId: "qa-teacher", role: "ADMIN" },
  });
  expect(await removeGestaoCohortMembers(input)).toMatchObject({
    ok: false,
    code: "forbidden",
  });
  expect(mocks.tx.cohort.findFirst).not.toHaveBeenCalled();
  expect(mocks.tx.cohortMembership.updateMany).not.toHaveBeenCalled();
});
test("idempotent replay reauthorizes before checking the prior event", async () => {
  mocks.tx.domainEvent.findUnique.mockResolvedValue({ id: "prior-event" });
  mocks.tx.member.findUnique.mockResolvedValue(null);
  expect(await addGestaoCohortMembers(input)).toMatchObject({
    ok: false,
    code: "forbidden",
  });
  expect(mocks.tx.domainEvent.findUnique).not.toHaveBeenCalled();
});
test("teacher's cohort responsibility is checked inside transaction", async () => {
  mocks.tx.cohort.findFirst.mockResolvedValue(null);
  expect(await removeGestaoCohortMembers(input)).toMatchObject({
    ok: false,
    code: "not-found",
  });
  expect(mocks.tx.cohort.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        id: "qa-cohort",
        teachers: { some: { memberId: "qa-teacher" } },
      },
    })
  );
  expect(mocks.tx.cohortMembership.updateMany).not.toHaveBeenCalled();
});
test("removal retains history and independent grants, and records membership end", async () => {
  expect(await removeGestaoCohortMembers(input)).toMatchObject({
    ok: true,
    invitedCount: 1,
  });
  expect(mocks.tx.cohortMembership.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        activeKey: null,
        status: "REMOVED",
        leftAt: expect.any(Date),
      }),
    })
  );
  expect(mocks.tx.accessGrantSource.updateMany).not.toHaveBeenCalled();
  expect(mocks.tx.activitySubmission.deleteMany).not.toHaveBeenCalled();
  expect(mocks.tx.activitySubmission.updateMany).not.toHaveBeenCalled();
  expect(mocks.event).toHaveBeenCalled();
});
test("active actor adds membership without provisioning grants or content", async () => {
  expect(await addGestaoCohortMembers(input)).toMatchObject({
    ok: true,
    invitedCount: 1,
  });
  expect(mocks.tx.cohortMembership.createMany).toHaveBeenCalledWith(
    expect.objectContaining({ skipDuplicates: true })
  );
  expect(mocks.tx.accessGrantSource.updateMany).not.toHaveBeenCalled();
});
