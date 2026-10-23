import { describe, expect, it } from "vitest";
import {
  resolveStudentFeedActivities,
  type StudentFeedActivityCandidate,
  type StudentFeedMembership,
} from "./student-feed-domain";

const at = new Date("2026-10-12T12:00:00.000Z");
const day = (days: number) => new Date(at.getTime() + days * 86_400_000);

const membership = (
  cohortId: string,
  input: Partial<StudentFeedMembership> = {}
): StudentFeedMembership => ({
  cohortId,
  joinedAt: day(-2),
  lateJoinPolicy: "ALL_ACTIVE",
  startsAt: day(-30),
  endsAt: null,
  archivedAt: null,
  ...input,
});

const activity = (
  input: Partial<StudentFeedActivityCandidate> = {}
): StudentFeedActivityCandidate => ({
  id: "activity-1",
  slug: "atividade-1",
  title: "Atividade 1",
  dueAt: day(5),
  assignments: [],
  cohortTargets: [],
  submissions: [],
  ...input,
});

describe("resolveStudentFeedActivities", () => {
  it("honors ALL_ACTIVE and FROM_JOIN for open cohort activities", () => {
    const result = resolveStudentFeedActivities(
      [
        activity({
          id: "all-active",
          cohortTargets: [{ cohortId: "all", assignedAt: day(-8) }],
        }),
        activity({
          id: "from-join-old",
          cohortTargets: [{ cohortId: "from-join", assignedAt: day(-8) }],
        }),
        activity({
          id: "from-join-new",
          cohortTargets: [{ cohortId: "from-join", assignedAt: day(-1) }],
        }),
        activity({
          id: "already-ended",
          dueAt: day(-3),
          cohortTargets: [{ cohortId: "all", assignedAt: day(-8) }],
        }),
      ],
      [
        membership("all"),
        membership("from-join", { lateJoinPolicy: "FROM_JOIN" }),
      ],
      at
    );

    expect(result.map(({ id }) => id)).toEqual([
      "cohort-activity:from-join-new",
      "cohort-activity:all-active",
    ]);
  });

  it("deduplicates direct and multi-cohort delivery, choosing the earliest due date and latest note", () => {
    const result = resolveStudentFeedActivities(
      [
        activity({
          dueAt: day(8),
          assignments: [
            {
              id: "assignment-old",
              status: "NEW",
              message: "Recado antigo",
              availableAt: null,
              dueAt: day(6),
              expiresAt: null,
              assignedAt: day(-4),
            },
            {
              id: "assignment-new",
              status: "STARTED",
              message: "Recado mais recente",
              availableAt: null,
              dueAt: day(7),
              expiresAt: null,
              assignedAt: day(-1),
            },
          ],
          cohortTargets: [
            { cohortId: "cohort-a", assignedAt: day(-6) },
            { cohortId: "cohort-b", assignedAt: day(-3) },
          ],
        }),
      ],
      [membership("cohort-a"), membership("cohort-b")],
      at
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "assignment-new",
      href: "/cursos/atribuicoes/assignment-new",
      dueAt: day(6),
      message: "Recado mais recente",
      status: "STARTED",
    });
  });

  it("preserves future individual availability and hides expired sources", () => {
    const result = resolveStudentFeedActivities(
      [
        activity({
          assignments: [
            {
              id: "future",
              status: "NEW",
              message: null,
              availableAt: day(1),
              dueAt: null,
              expiresAt: null,
              assignedAt: day(-1),
            },
          ],
        }),
        activity({
          id: "expired",
          assignments: [
            {
              id: "expired-assignment",
              status: "NEW",
              message: null,
              availableAt: null,
              dueAt: null,
              expiresAt: day(-1),
              assignedAt: day(-3),
            },
          ],
        }),
      ],
      [],
      at
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "future", availableAt: day(1) });
  });

  it("treats a submitted activity as complete without creating feed progress", () => {
    const result = resolveStudentFeedActivities(
      [
        activity({
          submissions: [{ status: "SUBMITTED" }],
          cohortTargets: [{ cohortId: "cohort-a", assignedAt: day(-1) }],
        }),
      ],
      [membership("cohort-a")],
      at
    );

    expect(result[0]?.status).toBe("COMPLETED");
  });
});
