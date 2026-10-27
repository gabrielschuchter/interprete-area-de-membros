import { beforeEach, describe, expect, test } from "vitest";
import {
  previousPathLabel,
  readPreviousPath,
  rememberNavigation,
} from "./previous-path";

describe("previous path", () => {
  beforeEach(() => window.sessionStorage.clear());

  test("the page left behind becomes the previous one", () => {
    rememberNavigation("/comunidade/grupos/clinica");
    rememberNavigation("/membros/ana");
    expect(readPreviousPath("/membros/ana")).toBe("/comunidade/grupos/clinica");
  });

  test("a reload of the same page keeps what was remembered", () => {
    rememberNavigation("/membros");
    rememberNavigation("/membros/ana");
    rememberNavigation("/membros/ana");
    expect(readPreviousPath("/membros/ana")).toBe("/membros");
  });

  test("never points back at the page itself", () => {
    rememberNavigation("/membros/ana?a=1");
    rememberNavigation("/membros/ana");
    expect(readPreviousPath("/membros/ana")).toBeNull();
  });

  test("labels the destination", () => {
    expect(previousPathLabel("/membros")).toBe("Voltar para os membros");
    expect(previousPathLabel("/comunidade")).toBe("Voltar para a comunidade");
    expect(previousPathLabel("/comunidade/grupos/x")).toBe(
      "Voltar para o grupo"
    );
    expect(previousPathLabel("/estudar")).toBe("Voltar");
  });
});
