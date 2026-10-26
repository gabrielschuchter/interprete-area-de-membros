import { describe, expect, it } from "vitest";
import {
  gestaoLegacyAdminDestination,
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
    expect(
      withGestaoReturnPath(
        "/gestao/alunos#lista",
        "/biblioteca?q=leitura#retomar"
      )
    ).toBe("/gestao/alunos?from=%2Fbiblioteca%3Fq%3Dleitura%23retomar#lista");
  });

  it("sends legacy /admin addresses to their Gestão equivalents", () => {
    expect(gestaoLegacyAdminDestination("/admin")).toBe("/gestao");
    expect(gestaoLegacyAdminDestination("/admin/community")).toBe(
      "/gestao/comunidade/publicacoes"
    );
    expect(gestaoLegacyAdminDestination("/admin/learning/courses/c1")).toBe(
      "/gestao/ensino/cursos/c1"
    );
    expect(
      gestaoLegacyAdminDestination("/admin/learning/courses/c1/preview")
    ).toBe("/gestao/ensino/cursos/c1/preview");
    expect(gestaoLegacyAdminDestination("/admin/membros/m1/")).toBe(
      "/gestao/alunos/perfil/m1"
    );
    expect(gestaoLegacyAdminDestination("/admin/desconhecido")).toBeNull();
    expect(gestaoLegacyAdminDestination("/administracao")).toBeNull();
  });
});
