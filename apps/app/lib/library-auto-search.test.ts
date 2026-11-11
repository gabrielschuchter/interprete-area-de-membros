import { describe, expect, test } from "vitest";
import { libraryAutoSearchTarget } from "./library-auto-search";

describe("libraryAutoSearchTarget", () => {
  test("busca o termo digitado, sem espaços nas pontas", () => {
    expect(libraryAutoSearchTarget("  grade ", "")).toBe("grade");
  });

  test("não repete a busca já aplicada", () => {
    expect(libraryAutoSearchTarget("grade", "grade")).toBeNull();
    expect(libraryAutoSearchTarget("grade ", " grade")).toBeNull();
  });

  test("espera pelo menos duas letras", () => {
    expect(libraryAutoSearchTarget("g", "")).toBeNull();
    expect(libraryAutoSearchTarget("gr", "")).toBe("gr");
  });

  test("apagar o campo limpa a busca aplicada", () => {
    expect(libraryAutoSearchTarget("", "grade")).toBe("");
    expect(libraryAutoSearchTarget("   ", "grade")).toBe("");
  });

  test("apagar até uma letra não dispara busca", () => {
    expect(libraryAutoSearchTarget("g", "grade")).toBeNull();
  });
});
