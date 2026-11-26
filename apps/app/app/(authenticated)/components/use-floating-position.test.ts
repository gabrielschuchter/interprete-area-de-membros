import { describe, expect, test } from "vitest";
import { clampFloatingPosition } from "./use-floating-position";

const size = { height: 44, width: 180 };
const viewport = { height: 800, width: 390 };

describe("clampFloatingPosition", () => {
  test("mantém a posição dentro da tela", () => {
    expect(clampFloatingPosition({ x: 100, y: 300 }, size, viewport)).toEqual({
      x: 100,
      y: 300,
    });
  });

  test("não deixa a janela sair pela direita nem por baixo", () => {
    expect(clampFloatingPosition({ x: 999, y: 999 }, size, viewport)).toEqual({
      x: 390 - 180 - 8,
      y: 800 - 44 - 8,
    });
  });

  test("não deixa a janela sair pela esquerda nem por cima", () => {
    expect(clampFloatingPosition({ x: -50, y: -50 }, size, viewport)).toEqual({
      x: 8,
      y: 8,
    });
  });

  test("janela maior que a tela encosta na margem", () => {
    expect(
      clampFloatingPosition(
        { x: 40, y: 40 },
        { height: 44, width: 500 },
        viewport
      )
    ).toEqual({ x: 8, y: 40 });
  });
});
