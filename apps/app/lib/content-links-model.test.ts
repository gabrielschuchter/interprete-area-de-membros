import { expect, test } from "vitest";
import { isLinkSide, linkColumns } from "./content-links-model";

test("liga dois tipos diferentes pelas colunas certas, em qualquer ordem", () => {
  expect(
    linkColumns(
      { side: "lesson", id: "a1" },
      { side: "exerciseList", id: "l1" }
    )
  ).toEqual({ lessonId: "a1", exerciseListId: "l1" });
  expect(
    linkColumns({ side: "libraryItem", id: "m1" }, { side: "lesson", id: "a1" })
  ).toEqual({ libraryItemId: "m1", lessonId: "a1" });
});

test("recusa o mesmo tipo dos dois lados e ids vazios", () => {
  expect(
    linkColumns({ side: "lesson", id: "a" }, { side: "lesson", id: "b" })
  ).toBeNull();
  expect(
    linkColumns({ side: "lesson", id: "" }, { side: "exerciseList", id: "l" })
  ).toBeNull();
});

test("reconhece só os três tipos de conteúdo", () => {
  expect(isLinkSide("lesson")).toBe(true);
  expect(isLinkSide("course")).toBe(false);
  expect(isLinkSide(undefined)).toBe(false);
});
