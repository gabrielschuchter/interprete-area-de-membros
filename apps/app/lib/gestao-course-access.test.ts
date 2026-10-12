import { beforeEach, describe, expect, it, vi } from "vitest";

const { databaseMock, requireGestaoAction } = vi.hoisted(() => ({
  databaseMock: {
    accessGrant: { count: vi.fn(), findMany: vi.fn() },
    accessGrantSource: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    cohort: { count: vi.fn(), findMany: vi.fn() },
    cohortCourseAccess: { count: vi.fn(), findMany: vi.fn() },
    course: { findUnique: vi.fn() },
    member: { count: vi.fn(), findMany: vi.fn() },
  },
  requireGestaoAction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  AccessGrantOrigin: { DIRECT: "DIRECT", OPEN_ACCESS: "OPEN_ACCESS" },
  AccessResourceType: { COURSE: "COURSE" },
  CohortMemberStatus: { ACTIVE: "ACTIVE" },
  MemberRole: { MEMBER: "MEMBER" },
  database: databaseMock,
}));
vi.mock("@/lib/gestao-authorization", () => ({ requireGestaoAction }));

import { getGestaoCourseAccessPage } from "./gestao-course-access";

describe("getGestaoCourseAccessPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGestaoAction.mockResolvedValue({
      actor: { role: "TEACHER", userId: "teacher-a" },
    });
    databaseMock.course.findUnique.mockResolvedValue({
      id: "course-a",
      title: "Curso real",
      status: "PUBLISHED",
      slug: "curso-real",
    });
    databaseMock.cohortCourseAccess.count.mockResolvedValue(0);
    databaseMock.cohortCourseAccess.findMany.mockResolvedValue([]);
    databaseMock.cohort.count.mockResolvedValue(0);
    databaseMock.cohort.findMany.mockResolvedValue([]);
    databaseMock.accessGrantSource.findFirst.mockResolvedValue(null);
    databaseMock.accessGrantSource.count.mockResolvedValue(0);
    databaseMock.accessGrantSource.findMany.mockResolvedValue([]);
    databaseMock.accessGrant.count.mockResolvedValue(0);
    databaseMock.accessGrant.findMany.mockResolvedValue([]);
    databaseMock.member.count.mockResolvedValue(0);
    databaseMock.member.findMany.mockResolvedValue([]);
  });

  it("limits teachers to owned cohorts and never loads individual member data", async () => {
    const result = await getGestaoCourseAccessPage({ courseId: "course-a" });

    expect(result).toMatchObject({
      actorRole: "TEACHER",
      course: { id: "course-a", title: "Curso real" },
      cohortAccesses: [],
      candidateCohorts: [],
      directGrants: [],
      directGrantCount: 0,
      members: [],
      memberCount: 0,
    });
    expect(databaseMock.cohortCourseAccess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cohort: {
            is: expect.objectContaining({
              teachers: { some: { memberId: "teacher-a" } },
            }),
          },
        }),
      })
    );
    expect(databaseMock.cohort.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teachers: { some: { memberId: "teacher-a" } },
          NOT: {
            courseAccesses: {
              some: { courseId: "course-a", revokedAt: null },
            },
          },
        }),
      })
    );
    expect(databaseMock.accessGrantSource.count).not.toHaveBeenCalled();
    expect(databaseMock.accessGrantSource.findMany).not.toHaveBeenCalled();
    expect(databaseMock.accessGrant.count).not.toHaveBeenCalled();
    expect(databaseMock.accessGrant.findMany).not.toHaveBeenCalled();
    expect(databaseMock.member.count).not.toHaveBeenCalled();
    expect(databaseMock.member.findMany).not.toHaveBeenCalled();
  });
});
