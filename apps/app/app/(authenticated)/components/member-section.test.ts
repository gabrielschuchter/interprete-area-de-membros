import { describe, expect, test } from "vitest";
import {
  isSidebarPathActive,
  memberSectionForPathname,
  personalContentNavigation,
} from "./member-section";

describe("memberSectionForPathname", () => {
  test.each([
    ["/", "Início"],
    ["/exercicios", "Exercícios"],
    ["/exercicios/sessoes/session-1", "Exercícios"],
    ["/tarefas", "Metas e tarefas"],
    ["/tarefas/historico", "Metas e tarefas"],
    ["/configuracoes", "Configurações"],
    ["/comunidade/meus-topicos", "Meus tópicos"],
    ["/salvos", "Salvos"],
    ["/comunidade/salvos", "Comunidade"],
    ["/encontros/gravacoes", "Minhas gravações"],
    ["/encontros", "Encontros"],
  ])("resolves %s to %s", (pathname, section) => {
    expect(memberSectionForPathname(pathname)).toBe(section);
  });
});

describe("personal sidebar active states", () => {
  const knownHrefs = [
    "/",
    "/tarefas",
    "/encontros",
    "/encontros/gravacoes",
    "/comunidade",
  ];

  test("selects only recordings on the recordings route", () => {
    expect(
      isSidebarPathActive(
        "/encontros/gravacoes",
        "/encontros/gravacoes",
        knownHrefs
      )
    ).toBe(true);
    expect(
      isSidebarPathActive("/encontros/gravacoes", "/encontros", knownHrefs)
    ).toBe(false);
  });

  test("keeps community saved posts inside the Community navigation", () => {
    expect(
      isSidebarPathActive("/comunidade/salvos", "/comunidade", knownHrefs)
    ).toBe(true);
  });

  test("keeps only recordings in the isolated personal navigation group", () => {
    expect(personalContentNavigation).toEqual([
      {
        href: "/encontros/gravacoes",
        icon: "recordings",
        label: "Minhas gravações",
      },
    ]);
  });
});
