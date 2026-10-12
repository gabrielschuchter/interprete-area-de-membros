import { describe, expect, it } from "vitest";
import {
  canOpenGestaoAdministration,
  canPerformGestaoAction,
  isGestaoStaff,
} from "./gestao-permissions";

describe("Gestão role capabilities", () => {
  it("allows teachers to manage teaching and community work", () => {
    for (const action of [
      "dashboard.read",
      "content.manage",
      "cohort.manage",
      "students.read",
      "assignments.manage",
      "community.moderate",
      "administration.open",
    ] as const) {
      expect(canPerformGestaoAction("TEACHER", action)).toBe(true);
    }
  });

  it("keeps administration data restricted to admins", () => {
    for (const action of [
      "members.manage",
      "access.manage",
      "recordings.manage",
      "customization.manage",
      "badges.manage",
      "integrations.manage",
      "audit.read",
    ] as const) {
      expect(canPerformGestaoAction("TEACHER", action)).toBe(false);
      expect(canPerformGestaoAction("ADMIN", action)).toBe(true);
    }
    expect(canOpenGestaoAdministration("TEACHER")).toBe(true);
  });

  it("does not treat members as staff", () => {
    expect(isGestaoStaff("MEMBER")).toBe(false);
    expect(canPerformGestaoAction("MEMBER", "dashboard.read")).toBe(false);
    expect(canOpenGestaoAdministration("MEMBER")).toBe(false);
  });
});
