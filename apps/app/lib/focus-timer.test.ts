import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  provision: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  database: {
    $transaction: mocks.transaction,
    plannerPreferences: { createMany: mocks.provision, upsert: mocks.upsert },
  },
  FocusTimerMode: {
    COUNTDOWN: "COUNTDOWN",
    FOCUS: "FOCUS",
    LONG_BREAK: "LONG_BREAK",
    SHORT_BREAK: "SHORT_BREAK",
    STOPWATCH: "STOPWATCH",
  },
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
  },
  StudyActivityKind: {},
  StudyGoalPeriod: { WEEKLY: "WEEKLY" },
}));
vi.mock("./learning", () => ({
  getPublishedLearningPaths: vi.fn().mockResolvedValue([]),
}));
const recordingLesson = vi.hoisted(() => vi.fn());
vi.mock("./recordings", () => ({
  getMemberAccessibleRecordingLesson: recordingLesson,
}));

import {
  addManualFocusTimerSession,
  getActiveFocusTimerState,
  getFocusTimerState,
  updateFocusTimerHistorySession,
} from "./focus-timer";
import { defaultTimerSettings } from "./focus-timer-settings";

const intervalEndingSoon = () => ({
  startedAt: new Date(Date.now() - 30_000).toISOString(),
  elapsedSeconds: 60,
});

describe("first timer reads", () => {
  const preferences = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    preferences.mockResolvedValue(null);
    mocks.transaction.mockImplementation((callback) =>
      callback({
        plannerPreferences: { findUnique: preferences },
        focusTimerSession: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          aggregate: vi.fn().mockResolvedValue({
            _sum: { elapsedBeforePause: null },
            _count: { _all: 0 },
          }),
          groupBy: vi.fn().mockResolvedValue([]),
        },
        studyGoal: { findUnique: vi.fn().mockResolvedValue(null) },
        $queryRaw: vi.fn().mockResolvedValue([]),
      })
    );
  });

  test("concurrent compact and full reads work without provisioning preferences", async () => {
    const states = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        index % 2
          ? getFocusTimerState("member_unused")
          : getActiveFocusTimerState("member_unused")
      )
    );
    for (const state of states) {
      expect(state.active).toBeNull();
      expect(state.settings).toEqual(defaultTimerSettings);
    }
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.provision).not.toHaveBeenCalled();
  });

  test("reads saved preferences without overwriting them with defaults", async () => {
    const saved = {
      ...defaultTimerSettings,
      focusMinutes: 47,
      timezone: "Europe/Lisbon",
      timerSoundEnabled: false,
    };
    preferences.mockResolvedValue(saved);
    expect((await getActiveFocusTimerState("member_saved")).settings).toEqual(
      saved
    );
    expect((await getFocusTimerState("member_saved")).settings).toEqual(saved);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.provision).not.toHaveBeenCalled();
  });
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

describe("links to the lesson behind a recording", () => {
  const pastSession = {
    elapsedSeconds: 60,
    linkedResourceId: "lesson_recording",
    startedAt: new Date(Date.now() - 600_000).toISOString(),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockRejectedValue(new Error("reached the write"));
  });

  test("rejects a lesson that is neither in a path nor a visible recording", async () => {
    recordingLesson.mockResolvedValue(null);
    await expect(
      addManualFocusTimerSession("member_1", pastSession)
    ).rejects.toThrow("A aula vinculada não está disponível para esta conta.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("accepts the lesson of a recording the member can see", async () => {
    recordingLesson.mockResolvedValue({ id: "lesson_recording" });
    await expect(
      addManualFocusTimerSession("member_1", pastSession)
    ).rejects.toThrow("reached the write");
    expect(recordingLesson).toHaveBeenCalledWith(
      "member_1",
      "lesson_recording"
    );
  });
});
