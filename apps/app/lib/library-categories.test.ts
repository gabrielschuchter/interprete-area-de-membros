import { expect, test } from "vitest";
import {
  libraryCategoriesInGroup,
  libraryCategoryGroup,
  libraryCategoryGroupsFor,
} from "./library-categories";

const published = [
  "Bioestatística e interpretação",
  "Busca bibliográfica",
  "Causalidade",
  "Certeza da evidência e GRADE",
  "Evidence-Based Nutrition",
  "GRADE",
  "Nutrição baseada em evidências",
  "Revisões sistemáticas",
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

test("lists each present group once, editorial order first", () => {
  expect(libraryCategoryGroupsFor(published)).toEqual([
    "Epidemiologia e desenhos de estudo",
    "Bioestatística e interpretação",
    "Leitura crítica e certeza da evidência",
    "Revisões sistemáticas e busca",
    "Nutrição baseada em evidências",
    "Tema novo",
  ]);
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

test("builds the filter values for a group without a database round trip", async () => {
  const { libraryCategoryFilterValues } = await import("./library-categories");
  expect(libraryCategoryFilterValues("Evidence-Based Nutrition")).toEqual([
    "Nutrição baseada em evidências",
    "Evidence-Based Nutrition",
  ]);
  expect(libraryCategoryFilterValues("Tema novo")).toEqual(["Tema novo"]);
});
