import { describe, expect, it } from "vitest";
import { goalArtModel } from "./study-goal-art-model";

describe("goalArtModel", () => {
  it("sem meta, desenha peças vazias", () => {
    expect(goalArtModel("LESSONS", 3, 0)).toEqual({
      filled: 0,
      cells: 6,
      perCell: 1,
    });
  });

  it("meta pequena: uma peça por unidade", () => {
    expect(goalArtModel("READINGS", 3, 8)).toEqual({
      filled: 3,
      cells: 8,
      perCell: 1,
    });
  });

  it("meta batida enche todas as peças", () => {
    expect(goalArtModel("LESSONS", 5, 5).filled).toBe(5);
    expect(goalArtModel("LESSONS", 9, 5).filled).toBe(5);
  });

  it("agrupa metas maiores que o limite do desenho", () => {
    const art = goalArtModel("EXERCISES", 100, 150);
    expect(art.cells).toBe(50);
    expect(art.perCell).toBe(3);
    expect(art.filled).toBe(33);
  });

  it("nunca mostra tudo cheio antes de bater a meta", () => {
    expect(goalArtModel("EXERCISES", 149, 150).filled).toBe(49);
    expect(goalArtModel("READINGS", 11, 12).filled).toBe(11);
  });
});
