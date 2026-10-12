import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activityAssignmentFindMany: vi.fn(),
  activityFindMany: vi.fn(),
  cohortMembershipFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  LearningAssignmentStatus: { REVOKED: "REVOKED" },
  LearningAssignmentTargetType: { ACTIVITY: "ACTIVITY" },
  database: {
    activity: { findMany: mocks.activityFindMany },
    activityAssignment: { findMany: mocks.activityAssignmentFindMany },
    cohortMembership: { findMany: mocks.cohortMembershipFindMany },
  },
}));
vi.mock("@repo/observability/performance", () => ({
  tracePerformance: (_name: string, operation: () => unknown) => operation(),
}));

import { resolveStudentFeed } from "./student-feed";

describe("resolveStudentFeed", () => {
  const at = new Date("2026-10-12T12:00:00.000Z");
  const joinedAt = new Date("2026-10-10T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cohortMembershipFindMany.mockResolvedValue([
      {
        cohortId: "cohort-a",
        joinedAt,
        cohort: {
          archivedAt: null,
          endsAt: null,
          lateJoinPolicy: "FROM_JOIN",
          startsAt: new Date("2026-09-01T00:00:00.000Z"),
        },
      },
    ]);
    mocks.activityAssignmentFindMany.mockResolvedValue([
      {
        id: "assignment-a",
        targetId: "activity-a",
        status: "NEW",
        message: "Leia antes de enviar",
        availableAt: null,
        dueAt: null,
        expiresAt: null,
        assignedAt: new Date("2026-10-11T12:00:00.000Z"),
      },
    ]);
    mocks.activityFindMany.mockResolvedValue([
      {
        id: "activity-a",
        slug: "atividade-a",
        title: "Atividade A",
        dueAt: new Date("2026-10-20T12:00:00.000Z"),
        cohortTargets: [
          {
            cohortId: "cohort-a",
            assignedAt: new Date("2026-10-11T12:00:00.000Z"),
          },
        ],
        submissions: [],
      },
    ]);
  });

  it("returns one current activity card from the direct and cohort sources", async () => {
    const result = await resolveStudentFeed("member-a", at);

    expect(result).toEqual([
      {
        id: "assignment-a",
        targetId: "activity-a",
        title: "Atividade A",
        slug: "atividade-a",
        href: "/aprender/atribuicoes/assignment-a",
        status: "NEW",
        message: "Leia antes de enviar",
        availableAt: null,
        dueAt: new Date("2026-10-20T12:00:00.000Z"),
        assignedAt: new Date("2026-10-11T12:00:00.000Z"),
      },
    ]);
    expect(mocks.cohortMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ memberId: "member-a" }),
      })
    );
  });

  it("pushes FROM_JOIN eligibility into the database query", async () => {
    await resolveStudentFeed("member-a", at);
    const activityQuery = mocks.activityFindMany.mock.calls[0]?.[0];
    const branches = activityQuery.where.AND[1].OR;
    const cohortBranch = branches.find(
      (branch: { cohortTargets?: unknown }) => branch.cohortTargets
    );

    expect(cohortBranch.cohortTargets.some.OR[0]).toMatchObject({
      cohortId: "cohort-a",
      assignedAt: { gte: joinedAt, lte: at },
    });
  });
});
