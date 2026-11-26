import { expect, test } from "vitest";
import {
  libraryCategoriesInGroup,
  libraryCategoryFilterValues,
  libraryCategoryGroup,
  libraryCategoryGroups,
  libraryCategoryGroupsFor,
  libraryItemGroups,
  normalizeLibraryCategories,
} from "./library-categories";

const published = [
  "Bioestatística e interpretação",
  "Busca bibliográfica",
  "Busca da evidência",
  "Causalidade",
  "Certeza da evidência e GRADE",
  "Evidence-Based Nutrition",
  "GRADE",
  "Leitura crítica e certeza da evidência e risco de viés",
  "Nutrição baseada em evidências",
  "Revisões sistemáticas",
  "Revisões sistemáticas e busca",
  "Tema novo",
];

test("merges duplicates and synonyms into one group", () => {
  expect(libraryCategoryGroup("Evidence-Based Nutrition")).toBe(
    "Nutrição baseada em evidências"
  );
  expect(libraryCategoryGroup(" nutricao baseada em evidencias ")).toBe(
    "Nutrição baseada em evidências"
  );
  expect(libraryCategoryGroup("GRADE")).toBe(
    "Leitura crítica e certeza da evidência"
  );
  expect(libraryCategoryGroup("Tema novo")).toBe("Tema novo");
});

test("risco de viés is its own group, not part of leitura crítica", () => {
  expect(libraryCategoryGroup("Risco de viés")).toBe("Risco de viés");
  expect(libraryCategoryGroups("Risco de viés")).toEqual(["Risco de viés"]);
});

test("a combined category belongs to every group it names", () => {
  expect(libraryCategoryGroups("Revisões sistemáticas e busca")).toEqual([
    "Revisões sistemáticas",
    "Busca da evidência",
  ]);
  expect(
    libraryCategoryGroups(
      "Leitura crítica e certeza da evidência e risco de viés e revisão sistematica"
    )
  ).toEqual([
    "Leitura crítica e certeza da evidência",
    "Risco de viés",
    "Revisões sistemáticas",
  ]);
  expect(libraryCategoryGroup("Revisões sistemáticas e risco de viés")).toBe(
    "Revisões sistemáticas"
  );
});

test("lists each present group once, editorial order first", () => {
  expect(libraryCategoryGroupsFor(published)).toEqual([
    "Busca da evidência",
    "Revisões sistemáticas",
    "Leitura crítica e certeza da evidência",
    "Risco de viés",
    "Epidemiologia e desenhos de estudo",
    "Nutrição baseada em evidências",
    "Bioestatística e interpretação",
    "Tema novo",
  ]);
});

test("never lists a combined category as a group of its own", () => {
  const groups = libraryCategoryGroupsFor(["Revisões sistemáticas e busca"]);
  expect(groups).toEqual(["Busca da evidência", "Revisões sistemáticas"]);
});

test("expands a group, or an old raw category link, to stored categories", () => {
  expect(
    libraryCategoriesInGroup("Nutrição baseada em evidências", published)
  ).toEqual(["Evidence-Based Nutrition", "Nutrição baseada em evidências"]);
  expect(
    libraryCategoriesInGroup("Evidence-Based Nutrition", published)
  ).toEqual(["Evidence-Based Nutrition", "Nutrição baseada em evidências"]);
  expect(libraryCategoriesInGroup("Inexistente", published)).toEqual([]);
});

test("a group also expands to the combined categories that include it", () => {
  expect(libraryCategoriesInGroup("Busca da evidência", published)).toEqual([
    "Busca bibliográfica",
    "Busca da evidência",
    "Revisões sistemáticas e busca",
  ]);
  expect(libraryCategoriesInGroup("Risco de viés", published)).toEqual([
    "Leitura crítica e certeza da evidência e risco de viés",
  ]);
});

test("builds the filter values for a group without a database round trip", () => {
  expect(libraryCategoryFilterValues("Evidence-Based Nutrition")).toEqual([
    "Nutrição baseada em evidências",
    "Evidence-Based Nutrition",
  ]);
  expect(libraryCategoryFilterValues("Tema novo")).toEqual(["Tema novo"]);
  expect(libraryCategoryFilterValues("Risco de viés")).toEqual([
    "Risco de viés",
    "Leitura crítica e certeza da evidência e risco de viés",
    "Leitura crítica e certeza da evidência e risco de viés e revisão sistemática",
    "Revisões sistemáticas e risco de viés",
  ]);
  expect(libraryCategoryFilterValues("Busca da evidência")).toEqual([
    "Busca da evidência",
    "Busca bibliográfica",
    "Revisões sistemáticas e busca",
    "Fundamentos da PBE e busca",
  ]);
});

test("os grupos de um material vêm da lista; sem lista, da categoria principal", () => {
  expect(
    libraryItemGroups({
      categories: ["Busca da evidência", "Registros de protocolo"],
      category: "Busca da evidência",
    })
  ).toEqual(["Busca da evidência", "Registros de protocolo"]);
  expect(
    libraryItemGroups({
      categories: [],
      category: "Revisões sistemáticas e busca",
    })
  ).toEqual(["Revisões sistemáticas", "Busca da evidência"]);
  expect(libraryItemGroups({ categories: [], category: null })).toEqual([]);
});

test("a lista escolhida no cadastro vira grupos canônicos, sem repetição", () => {
  expect(
    normalizeLibraryCategories([
      " Busca bibliográfica ",
      "Registros de protocolo",
      "Busca da evidência",
      "",
    ])
  ).toEqual(["Busca da evidência", "Registros de protocolo"]);
  expect(normalizeLibraryCategories([])).toEqual([]);
});
