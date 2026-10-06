import { describe, expect, test } from "vitest";
import {
  evaluateExerciseAnswer,
  findMissingExerciseExplanationOptionReferences,
  scoreExerciseSession,
  validateExerciseDraft,
} from "./exercise-engine";

const choices = [
  { id: "a", content: "Primeira", correct: false },
  { id: "b", content: "Segunda", correct: true },
  { id: "c", content: "Terceira", correct: true },
];

describe("exercise question engine", () => {
  test("finds explanation references to unfilled option labels", () => {
    expect(
      findMissingExerciseExplanationOptionReferences(
        "As opções D e E descrevem problemas diferentes.",
        [
          { id: "A", content: "Uma", correct: false },
          { id: "B", content: "Duas", correct: false },
          { id: "C", content: "Três", correct: false },
          { id: "D", content: "Quatro", correct: true },
        ]
      )
    ).toEqual(["E"]);
  });

  test("accepts explanations that mention only available options", () => {
    expect(
      findMissingExerciseExplanationOptionReferences(
        "A alternativa D está correta.",
        [{ id: "D", content: "Correta", correct: true }]
      )
    ).toEqual([]);
  });

  test("does not treat conjunctions as option labels", () => {
    expect(
      findMissingExerciseExplanationOptionReferences(
        "As opções A ou C estão corretas.",
        [
          { id: "A", content: "Primeira", correct: true },
          { id: "C", content: "Terceira", correct: true },
        ]
      )
    ).toEqual([]);
  });

  test("ignores option letters when the explanation does not identify options", () => {
    expect(
      findMissingExerciseExplanationOptionReferences(
        "O grupo A foi comparado ao grupo B.",
        [{ id: "A", content: "Primeira", correct: true }]
      )
    ).toEqual([]);
  });

  test("requires one correct option for single-choice questions", () => {
    expect(
      validateExerciseDraft("SINGLE_CHOICE", "Enunciado válido", choices)
    ).toMatchObject({ valid: false });
  });

  test.each([
    {
      options: [
        { content: "Correta A", correct: true, id: "a" },
        { content: "Incorreta B", correct: false, id: "b" },
      ],
    },
    {
      options: [
        { content: "Correta A", correct: true, id: "a" },
        { content: "Correta B", correct: true, id: "b" },
      ],
    },
    {
      options: [
        { content: "Correta A", correct: true, id: "a" },
        { content: "Correta B", correct: true, id: "b" },
        { content: "Correta C", correct: true, id: "c" },
      ],
    },
  ])("requires multiple choice to include correct and incorrect options", ({
    options,
  }) => {
    expect(
      validateExerciseDraft("MULTIPLE_CHOICE", "Enunciado válido", options)
    ).toMatchObject({ valid: false });
  });

  test("accepts multiple correct options alongside a distractor", () => {
    expect(
      validateExerciseDraft("MULTIPLE_CHOICE", "Enunciado válido", choices)
    ).toMatchObject({ valid: true });
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
