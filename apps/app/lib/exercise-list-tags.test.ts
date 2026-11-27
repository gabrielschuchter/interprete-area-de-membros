import { expect, test } from "vitest";
import { parseExerciseListTopics } from "./exercise-list-tags";

test("separa por vírgula, tira espaços e repetições", () => {
  expect(
    parseExerciseListTopics(" Perguntas clínicas, busca ,, desenhos; BUSCA\n")
  ).toEqual(["Perguntas clínicas", "busca", "desenhos"]);
});

test("campo vazio não gera temas e o excesso é cortado", () => {
  expect(parseExerciseListTopics("  ")).toEqual([]);
  const many = Array.from({ length: 20 }, (_, i) => `tema ${i}`).join(",");
  expect(parseExerciseListTopics(many)).toHaveLength(12);
});
