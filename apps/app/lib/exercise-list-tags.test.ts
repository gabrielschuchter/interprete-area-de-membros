import { expect, test } from "vitest";
import { exerciseListTags } from "./exercise-list-tags";

test("tira a frase de abertura e separa os temas", () => {
  expect(
    exerciseListTags(
      "Dez questões autorais sobre perguntas clínicas, busca, desenhos, avaliação crítica e aplicação."
    )
  ).toEqual([
    "perguntas clínicas",
    "busca",
    "desenhos",
    "avaliação crítica",
    "aplicação",
  ]);
});

test("sem 'sobre' ou sem texto não inventa temas", () => {
  expect(exerciseListTags("Treino de leitura crítica.")).toBeNull();
  expect(exerciseListTags(null)).toBeNull();
});
