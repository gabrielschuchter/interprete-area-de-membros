import { describe, expect, it } from "vitest";
import {
  exerciseManagementPath,
  resolveExerciseQuestionSwap,
} from "./exercise-management";

describe("exerciseManagementPath", () => {
  it("keeps legacy actions on the admin route by default", () => {
    expect(exerciseManagementPath(false)).toBe("/admin/exercicios");
    expect(exerciseManagementPath(false, "list/one")).toBe(
      "/admin/exercicios/list%2Fone"
    );
  });

  it("returns only to the fixed Gestão route when requested", () => {
    expect(exerciseManagementPath(true, "list-one")).toBe(
      "/gestao/ensino/exercicios/list-one"
    );
  });
});

describe("resolveExerciseQuestionSwap", () => {
  const items = [
    { id: "question-c", position: 20 },
    { id: "question-a", position: 0 },
    { id: "question-b", position: 10 },
  ];

  it("swaps adjacent items in sorted order and reserves a unique temporary position", () => {
    expect(resolveExerciseQuestionSwap(items, "question-b", "UP")).toEqual({
      current: { id: "question-b", position: 10 },
      neighbor: { id: "question-a", position: 0 },
      temporaryPosition: 21,
    });
    expect(resolveExerciseQuestionSwap(items, "question-b", "DOWN")).toEqual({
      current: { id: "question-b", position: 10 },
      neighbor: { id: "question-c", position: 20 },
      temporaryPosition: 21,
    });
  });

  it("does not produce a swap outside the list boundaries", () => {
    expect(resolveExerciseQuestionSwap(items, "question-a", "UP")).toBeNull();
    expect(resolveExerciseQuestionSwap(items, "question-c", "DOWN")).toBeNull();
    expect(resolveExerciseQuestionSwap(items, "unknown", "UP")).toBeNull();
  });
});
