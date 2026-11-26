import { expect, test } from "vitest";
import {
  countGoalPresets,
  countGoalUnit,
  emptyCountGoals,
  isCountGoalKind,
} from "./study-count-goals-model";

test("presets incluem o valor atual sem repetir e em ordem", () => {
  expect(countGoalPresets("LESSONS", 7)).toEqual([3, 5, 7, 8, 12]);
  expect(countGoalPresets("LESSONS", 5)).toEqual([3, 5, 8, 12]);
  expect(countGoalPresets("READINGS", null)).toEqual([2, 4, 6, 10]);
});

test("unidade concorda no singular e no plural", () => {
  expect(countGoalUnit("EXERCISES", 1)).toBe("exercício");
  expect(countGoalUnit("EXERCISES", 0)).toBe("exercícios");
  expect(countGoalUnit("LESSONS", 3)).toBe("aulas");
});

test("valida o tipo e começa vazio", () => {
  expect(isCountGoalKind("READINGS")).toBe(true);
  expect(isCountGoalKind("MINUTES")).toBe(false);
  expect(emptyCountGoals().LESSONS).toEqual({ done: 0, target: null });
});
