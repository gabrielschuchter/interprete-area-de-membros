import { describe, expect, it } from "vitest";
import {
  type ActivityCohortTargetForMember,
  hasActivityCohortAccess,
  selectActivityCohortRecipientIds,
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

describe("selectActivityCohortRecipientIds", () => {
  const recipientTarget = (
    cohortId: string,
    lateJoinPolicy: "ALL_ACTIVE" | "FROM_JOIN",
    assignedAt = "2026-10-10T12:00:00.000Z"
  ) => {
    const base = target(lateJoinPolicy, null, assignedAt);
    return {
      assignedAt: base.assignedAt,
      cohort: {
        archivedAt: base.cohort.archivedAt,
        endsAt: base.cohort.endsAt,
        lateJoinPolicy: base.cohort.lateJoinPolicy,
        readAfterEndDays: base.cohort.readAfterEndDays,
        startsAt: base.cohort.startsAt,
      },
      cohortId,
    };
  };

  it("selects only currently accessible members of the selected cohort", () => {
    const recipients = selectActivityCohortRecipientIds(
      [recipientTarget("cohort-a", "FROM_JOIN")],
      [
        {
          cohortId: "cohort-a",
          joinedAt: at("2026-10-10T12:00:00.000Z"),
          memberId: "member-before-or-at-assignment",
        },
        {
          cohortId: "cohort-a",
          joinedAt: at("2026-10-10T12:00:00.001Z"),
          memberId: "member-after-assignment",
        },
        {
          cohortId: "cohort-b",
          joinedAt: at("2026-10-02T12:00:00.000Z"),
          memberId: "member-from-another-cohort",
        },
      ],
      at("2026-10-14T12:00:00.000Z")
    );

    expect([...recipients]).toEqual(["member-before-or-at-assignment"]);
  });

  it("deduplicates a student who is eligible through multiple selected cohorts", () => {
    const recipients = selectActivityCohortRecipientIds(
      [
        recipientTarget("cohort-a", "ALL_ACTIVE"),
        recipientTarget("cohort-b", "FROM_JOIN"),
      ],
      [
        {
          cohortId: "cohort-a",
          joinedAt: at("2026-10-11T12:00:00.000Z"),
          memberId: "member-shared",
        },
        {
          cohortId: "cohort-b",
          joinedAt: at("2026-10-09T12:00:00.000Z"),
          memberId: "member-shared",
        },
      ],
      at("2026-10-14T12:00:00.000Z")
    );

    expect([...recipients]).toEqual(["member-shared"]);
  });
});
