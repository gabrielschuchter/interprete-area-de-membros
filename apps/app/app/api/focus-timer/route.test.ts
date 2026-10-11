import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  start: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("@repo/database", () => ({
  FocusTimerMode: {
    FOCUS: "FOCUS",
    STOPWATCH: "STOPWATCH",
    COUNTDOWN: "COUNTDOWN",
    SHORT_BREAK: "SHORT_BREAK",
    LONG_BREAK: "LONG_BREAK",
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/mutation-reliability", () => ({
  consumeMutationRateLimit: mocks.rateLimit,
  isMutationRateLimitError: () => false,
}));
vi.mock("@/lib/focus-timer", () => ({ startFocusTimer: mocks.start }));

import { POST } from "./route";

const request = () =>
  new Request("http://localhost/api/focus-timer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "start",
      mode: "FOCUS",
      durationSeconds: 60,
      clientId: "6944bd18-c88c-4ac3-81b4-981ab14dc612",
    }),
  });

describe("focus timer authorization and concurrent start", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({
      userId: "member-qa",
      memberSnapshot: { onboardingStatus: "COMPLETED" },
    });
    mocks.rateLimit.mockResolvedValue(undefined);
  });
  it.each([
    undefined,
    { onboardingStatus: "PENDING" },
  ])("rejects an unprovisioned or incomplete member without a write", async (memberSnapshot) => {
    mocks.auth.mockResolvedValue({ userId: "member-qa", memberSnapshot });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it.each([
    "P2002",
    "P2034",
  ])("reconciles %s as a conflict without exposing database internals", async (code) => {
    mocks.start.mockRejectedValue({
      code,
      message: "private database details",
    });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain(
      "private database details"
    );
  });
  it("starts for a completed member using the cached identity snapshot", async () => {
    mocks.start.mockResolvedValue({ id: "session-qa" });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.start).toHaveBeenCalledWith(
      "member-qa",
      expect.objectContaining({ action: "start" })
    );
  });
});
