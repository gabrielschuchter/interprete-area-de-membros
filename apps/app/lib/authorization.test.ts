import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({ MemberRole: {} }));
vi.mock("./auth", () => ({
  getAuth: mocks.auth,
  getMemberIdentitySnapshot: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  },
}));

import { requireOnboardedMemberId } from "./authorization";

describe("private planner and tools authorization", () => {
  beforeEach(() => mocks.auth.mockReset());

  it("redirects a Clerk identity without a provisioned member to onboarding", async () => {
    mocks.auth.mockResolvedValue({ userId: "member-qa", memberSnapshot: null });
    await expect(requireOnboardedMemberId()).rejects.toThrow(
      "redirect:/onboarding"
    );
  });

  it("keeps an incomplete member in onboarding", async () => {
    mocks.auth.mockResolvedValue({
      userId: "member-qa",
      memberSnapshot: { onboardingStatus: "PENDING" },
    });
    await expect(requireOnboardedMemberId()).rejects.toThrow(
      "redirect:/onboarding"
    );
  });

  it("rejects deactivation before exposing private data", async () => {
    mocks.auth.mockResolvedValue({ userId: null, memberDeactivated: true });
    await expect(requireOnboardedMemberId()).rejects.toThrow(
      "redirect:/conta-desativada"
    );
  });

  it("redirects a visitor to sign in", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    await expect(requireOnboardedMemberId()).rejects.toThrow(
      "redirect:/sign-in"
    );
  });

  it("uses the established member snapshot without another identity query", async () => {
    mocks.auth.mockResolvedValue({
      userId: "member-qa",
      memberSnapshot: { onboardingStatus: "COMPLETED" },
    });
    await expect(requireOnboardedMemberId()).resolves.toBe("member-qa");
    expect(mocks.auth).toHaveBeenCalledTimes(1);
  });
});
