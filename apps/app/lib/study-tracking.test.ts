import { expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  BadgeCriterion: {
    STUDY_MINUTES: "STUDY_MINUTES",
    STUDY_STREAK_DAYS: "STUDY_STREAK_DAYS",
    STUDY_GOALS_MET: "STUDY_GOALS_MET",
  },
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  database: {},
  ExerciseSessionStatus: { IN_PROGRESS: "IN_PROGRESS", COMPLETED: "COMPLETED" },
  LearningAssignmentStatus: {
    NEW: "NEW",
    VIEWED: "VIEWED",
    STARTED: "STARTED",
  },
  LearningAssignmentTargetType: { ACTIVITY: "ACTIVITY" },
  StudyActivityKind: {
    LESSON: "LESSON",
    RECORDING: "RECORDING",
    EXERCISE: "EXERCISE",
    ACTIVITY: "ACTIVITY",
    COMMUNITY: "COMMUNITY",
    LIBRARY_ITEM: "LIBRARY_ITEM",
  },
}));
vi.mock("./badges", () => ({ evaluateMemberBadges: vi.fn() }));
vi.mock("./content-access", () => ({
  getAccessibleRecording: vi.fn(),
  getLearningAccessScope: vi.fn(),
  hasLessonAccess: vi.fn(),
}));
vi.mock("./library", () => ({ getPublishedLibraryItem: vi.fn() }));

import { summarizeStudyIntervals } from "./study-tracking";

test("merges overlapping sessions without double-counting active study", () => {
  const totals = summarizeStudyIntervals([
    {
      startedAt: new Date("2026-10-03T10:00:00.000Z"),
      endedAt: new Date("2026-10-03T10:10:00.000Z"),
      isPlayback: true,
    },
    {
      startedAt: new Date("2026-10-03T10:05:00.000Z"),
      endedAt: new Date("2026-10-03T10:15:00.000Z"),
      isPlayback: false,
    },
  ]);

  expect(totals).toEqual([
    {
      date: "2026-10-03",
      playbackSeconds: 600,
      studySeconds: 900,
    },
  ]);
});

test("splits intervals at midnight in the Sao Paulo timezone", () => {
  const totals = summarizeStudyIntervals([
    {
      startedAt: new Date("2026-10-05T02:55:00.000Z"),
      endedAt: new Date("2026-10-05T03:05:00.000Z"),
      isPlayback: false,
    },
  ]);

  expect(totals).toEqual([
    { date: "2026-10-04", playbackSeconds: 0, studySeconds: 300 },
    { date: "2026-10-05", playbackSeconds: 0, studySeconds: 300 },
  ]);
});

test("ignores empty or reversed intervals", () => {
  const totals = summarizeStudyIntervals([
    {
      startedAt: new Date("2026-10-03T10:00:00.000Z"),
      endedAt: new Date("2026-10-03T10:00:00.000Z"),
      isPlayback: true,
    },
    {
      startedAt: new Date("2026-10-03T10:05:00.000Z"),
      endedAt: new Date("2026-10-03T10:00:00.000Z"),
      isPlayback: false,
    },
  ]);

  expect(totals).toEqual([]);
});
