import { describe, expect, it } from "vitest";
import {
  getGestaoCorrectionCohortScope,
  getGestaoCorrectionRecipientScope,
} from "./gestao-correction-scope";

describe("Gestão correction recipient scope", () => {
  it("limits teachers to active students in their own active cohorts", () => {
    expect(
      getGestaoCorrectionRecipientScope({
        role: "TEACHER",
        userId: "teacher-1",
      })
    ).toEqual({
      deactivatedAt: null,
      cohortMemberships: {
        some: {
          status: "ACTIVE",
          leftAt: null,
          cohort: {
            is: {
              archivedAt: null,
              teachers: { some: { memberId: "teacher-1" } },
            },
          },
        },
      },
    });
  });

  it("keeps admin cohort access global while excluding deactivated students", () => {
    expect(
      getGestaoCorrectionCohortScope({ role: "ADMIN", userId: "admin-1" })
    ).toEqual({ archivedAt: null });
    expect(
      getGestaoCorrectionRecipientScope({ role: "ADMIN", userId: "admin-1" })
    ).toEqual({ deactivatedAt: null });
  });
});
