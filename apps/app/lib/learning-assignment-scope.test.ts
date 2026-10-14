import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  MemberRole: { ADMIN: "ADMIN", MEMBER: "MEMBER", TEACHER: "TEACHER" },
}));

import {
  getLearningAssignmentRecipientScope,
  getLearningAssignmentRecipientSearchWhere,
} from "./learning-assignment-scope";

describe("learning assignment recipient scope", () => {
  it("lets admins search active students without exposing other roles", () => {
    expect(
      getLearningAssignmentRecipientScope({
        role: "ADMIN",
        userId: "admin-1",
      })
    ).toEqual({ role: "MEMBER", deactivatedAt: null });
  });

  it("limits teachers to active students in their non-archived cohorts", () => {
    expect(
      getLearningAssignmentRecipientScope({
        role: "TEACHER",
        userId: "teacher-1",
      })
    ).toEqual({
      role: "MEMBER",
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

  it("searches private staff-visible fields without changing public directory visibility", () => {
    expect(
      getLearningAssignmentRecipientSearchWhere(
        { role: "ADMIN", userId: "admin-1" },
        "student"
      )
    ).toEqual({
      AND: [
        { role: "MEMBER", deactivatedAt: null },
        {
          OR: [
            { displayName: { contains: "student", mode: "insensitive" } },
            {
              profile: {
                is: {
                  username: { contains: "student", mode: "insensitive" },
                },
              },
            },
          ],
        },
      ],
    });
  });
});
