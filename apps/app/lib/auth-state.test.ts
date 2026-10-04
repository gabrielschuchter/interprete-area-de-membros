import { describe, expect, test } from "vitest";
import { applyMemberDeactivation } from "./auth-state";

describe("member deactivation auth state", () => {
  test("keeps active and not-yet-provisioned Clerk sessions", () => {
    const active = {
      userId: "user_active",
      isAuthenticated: true,
      sessionId: "session_active",
    };
    const unprovisioned = {
      userId: "user_new",
      isAuthenticated: true,
      sessionId: "session_new",
    };

    expect(applyMemberDeactivation(active, false)).toMatchObject({
      userId: "user_active",
      isAuthenticated: true,
      memberDeactivated: false,
    });
    expect(applyMemberDeactivation(unprovisioned, false).userId).toBe(
      "user_new"
    );
  });

  test("removes a deactivated member from server authorization", () => {
    const result = applyMemberDeactivation(
      {
        userId: "user_deleted",
        isAuthenticated: true,
        sessionId: "session_old",
      },
      true
    );

    expect(result).toMatchObject({
      userId: null,
      isAuthenticated: false,
      memberDeactivated: true,
      sessionId: "session_old",
    });
  });
});
