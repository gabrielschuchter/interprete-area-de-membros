import { describe, expect, test } from "vitest";
import {
  evaluateExerciseAnswer,
  scoreExerciseSession,
  validateExerciseDraft,
} from "./exercise-engine";

const choices = [
  { id: "a", content: "Primeira", correct: false },
  { id: "b", content: "Segunda", correct: true },
  { id: "c", content: "Terceira", correct: true },
];

describe("exercise question engine", () => {
  test("requires one correct option for single-choice questions", () => {
    expect(
      validateExerciseDraft("SINGLE_CHOICE", "Enunciado válido", choices)
    ).toMatchObject({ valid: false });
  });

  test("compares exact sets for multiple-choice answers", () => {
    expect(
      evaluateExerciseAnswer("MULTIPLE_CHOICE", choices, ["c", "b", "b"])
    ).toMatchObject({ isCorrect: true, selectedOptionIds: ["c", "b"] });
    expect(
      evaluateExerciseAnswer("MULTIPLE_CHOICE", choices, ["a", "b", "c"])
        ?.isCorrect
    ).toBe(false);
  });

  test("rejects foreign and empty option selections", () => {
    expect(
      evaluateExerciseAnswer("SINGLE_CHOICE", choices, ["foreign"])
    ).toBeNull();
    expect(evaluateExerciseAnswer("SINGLE_CHOICE", choices, [])).toBeNull();
  });

  test("scores only submitted answers", () => {
    expect(
      scoreExerciseSession([{ isCorrect: true }, { isCorrect: false }])
    ).toEqual({ answered: 2, correct: 1, percentage: 50 });
  });
});
