import { describe, expect, it } from "vitest";
import {
  isGestaoShellPath,
  professorDestination,
  safeGestaoReturnPath,
  withGestaoReturnPath,
} from "./gestao-navigation";

describe("Gestão navigation", () => {
  it("maps known /professor routes to Gestão routes and preserves query values", () => {
    expect(
      professorDestination(["conteudo"], true, {
        busca: "análise clínica",
        aba: ["rascunhos", "publicados"],
      })
    ).toBe(
      "/gestao/ensino/cursos?busca=an%C3%A1lise+cl%C3%ADnica&aba=rascunhos&aba=publicados"
    );
    expect(professorDestination(["rota-desconhecida"], true)).toBe("/gestao");
  });

  it("keeps legacy staff routes available while the feature flag is off", () => {
    expect(professorDestination(["conteudo"], false)).toBe("/admin/learning");
    expect(professorDestination(["rota-desconhecida"], false)).toBe("/admin");
  });

  it("rejects external, management, and malformed return destinations", () => {
    expect(safeGestaoReturnPath("https://evil.example/path")).toBe("/estudar");
    expect(safeGestaoReturnPath("//evil.example/path")).toBe("/estudar");
    expect(safeGestaoReturnPath("/gestao/alunos")).toBe("/estudar");
    expect(safeGestaoReturnPath("/admin/acessos")).toBe("/estudar");
    expect(safeGestaoReturnPath("/estudar?curso=1#retomar")).toBe(
      "/estudar?curso=1#retomar"
    );
  });

  it("keeps the current shell path classification explicit", () => {
    expect(isGestaoShellPath("/gestao/ensino/cursos")).toBe(true);
    expect(isGestaoShellPath("/professor/conteudo")).toBe(true);
    expect(isGestaoShellPath("/estudar")).toBe(false);
  });

  it("carries only a validated return path between Gestão routes", () => {
    expect(
      withGestaoReturnPath("/gestao/alunos?aba=turmas", "//evil.example")
    ).toBe("/gestao/alunos?aba=turmas&from=%2Festudar");
  });
});
