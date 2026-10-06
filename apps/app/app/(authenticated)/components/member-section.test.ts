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
    ["/comunidade/salvos", "Salvos"],
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
    "/comunidade/salvos",
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

  test("selects only saved content on the saved route", () => {
    expect(
      isSidebarPathActive(
        "/comunidade/salvos",
        "/comunidade/salvos",
        knownHrefs
      )
    ).toBe(true);
    expect(
      isSidebarPathActive("/comunidade/salvos", "/comunidade", knownHrefs)
    ).toBe(false);
  });

  test("keeps recordings and saved content as separate ordered entries", () => {
    expect(personalContentNavigation).toEqual([
      {
        href: "/encontros/gravacoes",
        icon: "recordings",
        label: "Minhas gravações",
      },
      { href: "/comunidade/salvos", icon: "saved", label: "Salvos" },
    ]);
  });
});
