import { describe, expect, test } from "vitest";
import {
  decodeExerciseHistoryCursor,
  encodeExerciseHistoryCursor,
} from "./exercise-history-cursor";

describe("exercise history cursors", () => {
  test("round trips a database keyset anchor", () => {
    const value = encodeExerciseHistoryCursor({
      completedAt: new Date("2026-10-08T15:30:00.000Z"),
      id: "session-1",
    });
    expect(decodeExerciseHistoryCursor(value)).toEqual({
      completedAt: new Date("2026-10-08T15:30:00.000Z"),
      id: "session-1",
    });
  });

  test.each([
    undefined,
    "",
    "!invalid",
    "eyJpZCI6Im9ubHkifQ",
    "x".repeat(513),
  ])("rejects invalid cursor %s", (value) => {
    expect(decodeExerciseHistoryCursor(value)).toBeNull();
  });
});
