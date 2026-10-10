import { describe, expect, test } from "vitest";
import {
  decodeExerciseFavoriteCursor,
  encodeExerciseFavoriteCursor,
} from "./exercise-favorite-cursor";

describe("exercise favorite cursors", () => {
  test("round trips a database keyset anchor", () => {
    const value = encodeExerciseFavoriteCursor({
      createdAt: new Date("2026-10-08T15:30:00.000Z"),
      id: "favorite-1",
    });
    expect(decodeExerciseFavoriteCursor(value)).toEqual({
      createdAt: new Date("2026-10-08T15:30:00.000Z"),
      id: "favorite-1",
    });
  });

  test.each([
    undefined,
    "",
    "!invalid",
    "eyJpZCI6Im9ubHkifQ",
    "x".repeat(513),
  ])("rejects invalid cursor %s", (value) => {
    expect(decodeExerciseFavoriteCursor(value)).toBeNull();
  });
});
