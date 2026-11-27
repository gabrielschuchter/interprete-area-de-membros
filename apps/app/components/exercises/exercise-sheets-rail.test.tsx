import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ExerciseSheetsRail } from "./exercise-sheets-rail";

afterEach(cleanup);

test("mostra todas as folhas na esteira, sem setas quando cabem", () => {
  render(
    <ExerciseSheetsRail label="folhas em andamento">
      <article>Folha 1</article>
      <article>Folha 2</article>
    </ExerciseSheetsRail>
  );
  expect(screen.getAllByRole("article")).toHaveLength(2);
  expect(screen.queryByRole("button")).toBeNull();
});
