import { describe, expect, it } from "vitest";
import { resolveCohortCourseAccess } from "./cohort-domain";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const access = {
  createdAt: date("2026-09-01"),
  releaseMode: "ALL_AT_ONCE" as const,
  revokedAt: null,
  startsAt: null,
};

describe("archived cohort access window", () => {
  it("keeps archived cohort content readable for 90 days", () => {
    expect(
      resolveCohortCourseAccess({
        cohort: {
          archivedAt: date("2026-10-01"),
          endsAt: date("2026-10-01"),
          lateJoinPolicy: "ALL_ACTIVE",
          readAfterEndDays: 90,
          startsAt: date("2026-09-01"),
        },
        membership: { joinedAt: date("2026-09-10"), leftAt: null },
        access,
        now: date("2026-10-15"),
      })
    ).toEqual({ available: true, readOnly: true });
  });
  it("expires archived access after the read window", () => {
    expect(
      resolveCohortCourseAccess({
        cohort: {
          archivedAt: date("2026-07-01"),
          endsAt: date("2026-07-01"),
          lateJoinPolicy: "ALL_ACTIVE",
          readAfterEndDays: 90,
          startsAt: date("2026-06-01"),
        },
        membership: { joinedAt: date("2026-06-10"), leftAt: null },
        access,
        now: date("2026-10-01"),
      })
    ).toEqual({ available: false, readOnly: false });
  });
});
