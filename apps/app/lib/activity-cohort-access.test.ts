import { describe, expect, it } from "vitest";
import {
  type ActivityCohortTargetForMember,
  hasActivityCohortAccess,
} from "./activity-cohort-access";

const at = (value: string) => new Date(value);
const target = (
  lateJoinPolicy: "ALL_ACTIVE" | "FROM_JOIN",
  joinedAt: string | null,
  assignedAt = "2026-10-10T12:00:00.000Z"
): ActivityCohortTargetForMember => ({
  assignedAt: at(assignedAt),
  cohort: {
    archivedAt: null,
    endsAt: null,
    lateJoinPolicy,
    memberships: joinedAt ? [{ joinedAt: at(joinedAt) }] : [],
    readAfterEndDays: 90,
    startsAt: at("2026-10-01T00:00:00.000Z"),
  },
});

describe("hasActivityCohortAccess", () => {
  it("grants access to active members under ALL_ACTIVE, including later joins", () => {
    expect(
      hasActivityCohortAccess([
        target("ALL_ACTIVE", "2026-10-11T12:00:00.000Z"),
      ])
    ).toBe(true);
  });

  it("honors the assignment-time boundary under FROM_JOIN", () => {
    expect(
      hasActivityCohortAccess([target("FROM_JOIN", "2026-10-10T12:00:00.000Z")])
    ).toBe(true);
    expect(
      hasActivityCohortAccess([target("FROM_JOIN", "2026-10-10T12:00:00.001Z")])
    ).toBe(false);
  });

  it("does not grant access without an active membership", () => {
    expect(hasActivityCohortAccess([target("ALL_ACTIVE", null)])).toBe(false);
  });

  it("keeps ended cohorts readable for the configured read-only period", () => {
    const ended = target("ALL_ACTIVE", "2026-10-02T12:00:00.000Z");
    expect(
      hasActivityCohortAccess(
        [
          {
            ...ended,
            cohort: { ...ended.cohort, endsAt: at("2026-10-10T00:00:00Z") },
          },
        ],
        at("2026-11-01T00:00:00Z")
      )
    ).toBe(true);
    expect(
      hasActivityCohortAccess(
        [
          {
            ...ended,
            cohort: { ...ended.cohort, endsAt: at("2026-10-10T00:00:00Z") },
          },
        ],
        at("2027-01-10T00:00:00Z")
      )
    ).toBe(false);
  });
});
