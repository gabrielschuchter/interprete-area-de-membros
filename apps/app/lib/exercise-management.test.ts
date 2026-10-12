import { describe, expect, it } from "vitest";
import {
  exerciseBankListsHref,
  exerciseBankListsPath,
  exerciseManagementPath,
  resolveExercisePage,
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

describe("exercise bank list routes and pagination", () => {
  it("encodes bank identifiers and retains only active list filters", () => {
    expect(
      exerciseBankListsHref({
        bankId: "bank/one",
        page: 3,
        query: "pbe aplicada",
        status: "PUBLISHED",
      })
    ).toBe(
      "/gestao/ensino/exercicios/bancos/bank%2Fone?q=pbe+aplicada&estado=PUBLISHED&pagina=3"
    );
    expect(exerciseBankListsPath("bank-one")).toBe(
      "/gestao/ensino/exercicios/bancos/bank-one"
    );
  });

  it("clamps requested pages to the visible result range", () => {
    expect(resolveExercisePage("9", 41, 20)).toEqual({
      page: 3,
      totalPages: 3,
    });
    expect(resolveExercisePage("0", 0, 20)).toEqual({
      page: 1,
      totalPages: 1,
    });
    expect(resolveExercisePage("2.5", 41, 20)).toEqual({
      page: 1,
      totalPages: 3,
    });
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
