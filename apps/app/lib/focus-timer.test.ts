import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  database: { $transaction: mocks.transaction },
  FocusTimerMode: {
    COUNTDOWN: "COUNTDOWN",
    FOCUS: "FOCUS",
    LONG_BREAK: "LONG_BREAK",
    SHORT_BREAK: "SHORT_BREAK",
    STOPWATCH: "STOPWATCH",
  },
  Prisma: {},
  StudyActivityKind: {},
  StudyGoalPeriod: {},
}));
vi.mock("./learning", () => ({
  getPublishedLearningPaths: vi.fn().mockResolvedValue([]),
}));

import {
  addManualFocusTimerSession,
  updateFocusTimerHistorySession,
} from "./focus-timer";

const intervalEndingSoon = () => ({
  startedAt: new Date(Date.now() - 30_000).toISOString(),
  elapsedSeconds: 60,
});

describe("manual focus timer history", () => {
  beforeEach(() => {
    mocks.transaction.mockReset();
  });

  test("does not register study time that extends into the future", async () => {
    await expect(
      addManualFocusTimerSession("member_1", intervalEndingSoon())
    ).rejects.toThrow("Uma sessão manual não pode conter horário futuro.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("does not update study time that extends into the future", async () => {
    await expect(
      updateFocusTimerHistorySession("member_1", {
        ...intervalEndingSoon(),
        id: "session_1",
      })
    ).rejects.toThrow("Uma sessão manual não pode conter horário futuro.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
