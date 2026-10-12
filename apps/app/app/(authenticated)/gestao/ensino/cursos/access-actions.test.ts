import { beforeEach, describe, expect, it, vi } from "vitest";

const { databaseMock, transactionMock, requireGestaoAction } = vi.hoisted(
  () => {
    const transactionMock = {
      $queryRaw: vi.fn(),
      cohort: { findUnique: vi.fn(), updateMany: vi.fn() },
      cohortCourseAccess: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        upsert: vi.fn(),
      },
      course: { findUnique: vi.fn() },
      accessGrantSource: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      accessGrant: { deleteMany: vi.fn(), findFirst: vi.fn() },
      domainEvent: { create: vi.fn(), findUnique: vi.fn() },
    };
    return {
      databaseMock: {
        $transaction: vi.fn(),
      },
      transactionMock,
      requireGestaoAction: vi.fn(),
    };
  }
);

vi.mock("@repo/database", () => ({
  AccessGrantOrigin: { DIRECT: "DIRECT", OPEN_ACCESS: "OPEN_ACCESS" },
  AccessResourceType: { COURSE: "COURSE" },
  CohortReleaseMode: { ALL_AT_ONCE: "ALL_AT_ONCE", SCHEDULE: "SCHEDULE" },
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  Prisma: {
    TransactionIsolationLevel: {
      ReadCommitted: "ReadCommitted",
      Serializable: "Serializable",
    },
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: [...strings],
      values,
    }),
  },
  database: databaseMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/gestao-authorization", () => ({ requireGestaoAction }));
vi.mock("@/lib/mutation-contract", () => ({
  readIdempotencyKey: (value: unknown) => value,
}));
vi.mock("@/lib/mutation-reliability", () => ({
  consumeMutationRateLimit: vi.fn(),
}));

import {
  grantGestaoCourseDirectAccess,
  revokeGestaoCourseDirectAccess,
  setGestaoCourseCohortAccess,
  setGestaoCourseOpenAccess,
} from "./access-actions";

const operationId = "2b195f7c-8c08-4620-973a-b6aa445f41af";

describe("setGestaoCourseOpenAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGestaoAction.mockResolvedValue({
      actor: { role: "ADMIN", userId: "admin-a" },
    });
    transactionMock.$queryRaw.mockResolvedValue([
      { id: "course-a", status: "PUBLISHED" },
    ]);
    transactionMock.accessGrantSource.findFirst.mockResolvedValue(null);
    transactionMock.domainEvent.findUnique.mockResolvedValue(null);
    transactionMock.accessGrantSource.create.mockResolvedValue({
      id: "source-a",
    });
    transactionMock.accessGrantSource.update.mockResolvedValue({
      id: "source-a",
    });
    transactionMock.accessGrantSource.updateMany.mockResolvedValue({
      count: 1,
    });
    transactionMock.accessGrant.findFirst.mockResolvedValue(null);
    transactionMock.accessGrant.deleteMany.mockResolvedValue({ count: 1 });
    transactionMock.cohort.findUnique.mockResolvedValue({
      id: "cohort-a",
      version: 3,
      archivedAt: null,
    });
    transactionMock.cohort.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.course.findUnique.mockResolvedValue({
      id: "course-a",
      status: "PUBLISHED",
    });
    transactionMock.cohortCourseAccess.findFirst.mockResolvedValue(null);
    transactionMock.cohortCourseAccess.upsert.mockResolvedValue({
      id: "cohort-access-a",
    });
    transactionMock.cohortCourseAccess.updateMany.mockResolvedValue({
      count: 1,
    });
    transactionMock.domainEvent.create.mockResolvedValue({ id: "event-a" });
    databaseMock.$transaction.mockImplementation(
      async (operation: (transaction: typeof transactionMock) => unknown) =>
        operation(transactionMock)
    );
  });

  it("creates an independent global source and audit event when enabled", async () => {
    const result = await setGestaoCourseOpenAccess({
      courseId: "course-a",
      enabled: true,
      idempotencyKey: operationId,
    });

    expect(result).toEqual({ ok: true, duplicate: false });
    expect(requireGestaoAction).toHaveBeenCalledWith("access.manage", {
      contentId: "course-a",
    });
    expect(transactionMock.accessGrantSource.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdByMemberId: "admin-a",
        origin: "OPEN_ACCESS",
        originRefId: "course-a",
        resourceId: "course-a",
        resourceType: "COURSE",
        subjectCohortId: null,
        subjectMemberId: null,
        validUntil: null,
      }),
    });
    expect(transactionMock.domainEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "admin-a",
        aggregateId: "course-a",
        eventType: "gestao.course.open_access.changed",
        payload: expect.objectContaining({ enabled: true }),
      }),
    });
  });

  it("requires a published course before enabling global access", async () => {
    transactionMock.$queryRaw.mockResolvedValue([
      { id: "course-a", status: "DRAFT" },
    ]);

    const result = await setGestaoCourseOpenAccess({
      courseId: "course-a",
      enabled: true,
      idempotencyKey: operationId,
    });

    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(transactionMock.accessGrantSource.create).not.toHaveBeenCalled();
  });

  it("replays the same idempotency key without creating another source", async () => {
    transactionMock.domainEvent.findUnique.mockResolvedValue({
      eventType: "gestao.course.open_access.changed",
      payload: { fingerprint: "course-a:open" },
    });

    const result = await setGestaoCourseOpenAccess({
      courseId: "course-a",
      enabled: true,
      idempotencyKey: operationId,
    });

    expect(result).toEqual({ ok: true, duplicate: true });
    expect(transactionMock.accessGrantSource.create).not.toHaveBeenCalled();
    expect(transactionMock.domainEvent.create).not.toHaveBeenCalled();
  });

  it("revokes only the global source when disabled", async () => {
    transactionMock.accessGrantSource.findFirst.mockResolvedValue({
      id: "source-a",
      revokedAt: null,
    });

    const result = await setGestaoCourseOpenAccess({
      courseId: "course-a",
      enabled: false,
      idempotencyKey: operationId,
    });

    expect(result).toEqual({ ok: true, duplicate: false });
    expect(transactionMock.accessGrantSource.update).toHaveBeenCalledWith({
      where: { id: "source-a" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(transactionMock.accessGrantSource.create).not.toHaveBeenCalled();
  });

  it("serializes individual grants and audits the independent source", async () => {
    transactionMock.$queryRaw
      .mockResolvedValueOnce([{ id: "course-a", status: "PUBLISHED" }])
      .mockResolvedValueOnce([{ id: "member-a" }]);

    const result = await grantGestaoCourseDirectAccess({
      courseId: "course-a",
      memberId: "member-a",
      expiresAt: "",
      idempotencyKey: operationId,
    });

    expect(result).toEqual({ ok: true, duplicate: false });
    expect(requireGestaoAction).toHaveBeenCalledWith("access.manage", {
      contentId: "course-a",
    });
    expect(transactionMock.accessGrantSource.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdByMemberId: "admin-a",
        origin: "DIRECT",
        resourceId: "course-a",
        subjectMemberId: "member-a",
      }),
    });
    expect(transactionMock.domainEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "gestao.course.direct_access.granted",
        aggregateId: "course-a",
      }),
    });
  });

  it("creates a versioned course release scoped to the responsible cohort", async () => {
    requireGestaoAction.mockResolvedValue({
      actor: { role: "TEACHER", userId: "teacher-a" },
    });
    transactionMock.$queryRaw.mockResolvedValueOnce([{ id: "cohort-a" }]);

    const result = await setGestaoCourseCohortAccess({
      cohortId: "cohort-a",
      courseId: "course-a",
      enabled: true,
      expectedCohortVersion: 3,
      idempotencyKey: operationId,
      releaseMode: "ALL_AT_ONCE",
      startsAt: "",
    });

    expect(result).toEqual({ ok: true, duplicate: false });
    expect(requireGestaoAction).toHaveBeenCalledWith("cohort.manage", {
      cohortId: "cohort-a",
    });
    expect(transactionMock.cohort.updateMany).toHaveBeenCalledWith({
      where: { id: "cohort-a", version: 3 },
      data: { version: { increment: 1 } },
    });
    expect(transactionMock.cohortCourseAccess.upsert).toHaveBeenCalledWith({
      where: { activeKey: expect.any(String) },
      create: expect.objectContaining({
        cohortId: "cohort-a",
        courseId: "course-a",
        createdByMemberId: "teacher-a",
        releaseMode: "ALL_AT_ONCE",
      }),
      update: expect.objectContaining({
        releaseMode: "ALL_AT_ONCE",
        startsAt: null,
        revokedAt: null,
      }),
    });
    expect(transactionMock.domainEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "teacher-a",
        eventType: "gestao.course.cohort_access.changed",
      }),
    });
  });

  it("rejects a teacher outside the cohort assignment before writing", async () => {
    requireGestaoAction.mockResolvedValue({
      actor: { role: "TEACHER", userId: "teacher-a" },
    });
    transactionMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await setGestaoCourseCohortAccess({
      cohortId: "cohort-a",
      courseId: "course-a",
      enabled: true,
      expectedCohortVersion: 3,
      idempotencyKey: operationId,
      releaseMode: "ALL_AT_ONCE",
      startsAt: "",
    });

    expect(result).toMatchObject({ ok: false, code: "not-found" });
    expect(transactionMock.cohortCourseAccess.upsert).not.toHaveBeenCalled();
    expect(transactionMock.domainEvent.create).not.toHaveBeenCalled();
  });

  it("revokes only the selected direct source and keeps the member in audit", async () => {
    transactionMock.accessGrantSource.findFirst.mockResolvedValue({
      subjectMemberId: "member-a",
    });

    const result = await revokeGestaoCourseDirectAccess({
      courseId: "course-a",
      grantId: "source-a",
      grantKind: "SOURCE",
      idempotencyKey: operationId,
    });

    expect(result).toEqual({ ok: true, duplicate: false });
    expect(transactionMock.accessGrantSource.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "source-a",
        resourceId: "course-a",
        subjectMemberId: "member-a",
        revokedAt: null,
      }),
      data: { revokedAt: expect.any(Date) },
    });
    expect(transactionMock.accessGrant.deleteMany).not.toHaveBeenCalled();
    expect(transactionMock.domainEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "gestao.course.direct_access.revoked",
        payload: expect.objectContaining({ memberId: "member-a" }),
      }),
    });
  });
});
