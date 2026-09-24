import { expect, test } from "vitest";
import { calculateLearningProgress } from "./learning-progress";

test("derives progress from completed published lessons", () => {
  expect(
    calculateLearningProgress([
      { progress: [{ status: "COMPLETED" }] },
      { progress: [{ status: "IN_PROGRESS" }] },
      { progress: [] },
    ])
  ).toEqual({ completedLessons: 1, percentage: 33, totalLessons: 3 });
});

test("returns zero progress for a course without lessons", () => {
  expect(calculateLearningProgress([])).toEqual({
    completedLessons: 0,
    percentage: 0,
    totalLessons: 0,
  });
});
