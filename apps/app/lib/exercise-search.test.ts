import { expect, test } from "vitest";
import {
  dedupeExerciseCategories,
  exerciseListSearchScore,
  exerciseSearchTerms,
  foldSearchText,
} from "./exercise-search";

const LIST = {
  title: "Bioestatística | 10 questões fundamentais",
  bankTitle: "Banco de Bioestatística — fundamentos",
  description: "Dez questões autorais sobre descrição de dados e incerteza.",
  extras: ["Bioestatística", "intervalo de confiança", "poder estatístico"],
};

test("ignora acento e caixa", () => {
  expect(foldSearchText("Bioestatística")).toBe("bioestatistica");
  expect(foldSearchText("PRÁTICA")).toBe("pratica");
});

test("separa a busca em palavras e limita o tamanho", () => {
  expect(exerciseSearchTerms("  Poder   Estatístico ")).toEqual([
    "poder",
    "estatistico",
  ]);
  expect(exerciseSearchTerms(undefined)).toEqual([]);
  expect(exerciseSearchTerms("a".repeat(300)).join("").length).toBe(100);
});

test("acha sem acento e por pedaço de palavra", () => {
  expect(
    exerciseListSearchScore(LIST, exerciseSearchTerms("bioestatistica"))
  ).not.toBeNull();
  expect(
    exerciseListSearchScore(LIST, exerciseSearchTerms("fundament"))
  ).not.toBeNull();
});

test("exige todas as palavras, em qualquer campo", () => {
  expect(
    exerciseListSearchScore(
      LIST,
      exerciseSearchTerms("bioestatistica incerteza")
    )
  ).not.toBeNull();
  expect(
    exerciseListSearchScore(LIST, exerciseSearchTerms("bioestatistica coorte"))
  ).toBeNull();
});

test("acha por tag parcial e por categoria", () => {
  expect(exerciseListSearchScore(LIST, exerciseSearchTerms("confianca"))).toBe(
    0
  );
});

test("título vale mais que banco, que vale mais que o resto", () => {
  expect(exerciseListSearchScore(LIST, exerciseSearchTerms("questoes"))).toBe(
    2
  );
  expect(exerciseListSearchScore(LIST, exerciseSearchTerms("banco"))).toBe(1);
  expect(exerciseListSearchScore(LIST, exerciseSearchTerms("incerteza"))).toBe(
    0
  );
});

test("os caracteres % e _ não funcionam como curinga", () => {
  expect(exerciseListSearchScore(LIST, exerciseSearchTerms("%"))).toBeNull();
  expect(exerciseListSearchScore(LIST, exerciseSearchTerms("_"))).toBeNull();
});

test("busca vazia aceita tudo", () => {
  expect(exerciseListSearchScore(LIST, [])).toBe(0);
});

test("categorias repetidas aparecem uma vez, mantendo a primeira", () => {
  const result = dedupeExerciseCategories([
    { id: "1", title: "Bioestatística", slug: "bioestatistica" },
    { id: "2", title: "Bioestatistica ", slug: "bioestatistica-7627c60f" },
    { id: "3", title: "Epidemiologia", slug: "epidemiologia" },
    { id: "4", title: "epidemiologia", slug: "epidemiologia-c9f0a60a" },
  ]);
  expect(result.map(({ id }) => id)).toEqual(["1", "3"]);
});
