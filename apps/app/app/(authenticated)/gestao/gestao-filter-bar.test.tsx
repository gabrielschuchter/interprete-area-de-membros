import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/gestao/alunos/correcoes",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { GestaoFilterBar } from "./gestao-filter-bar";

afterEach(cleanup);

const selects = [
  {
    label: "Todas as turmas",
    options: [["turma-a", "Turma A"]] as const,
    param: "turma",
    value: "",
  },
];

const toolbarOf = () =>
  screen.getByRole("searchbox", { name: "Buscar aluno ou atividade" })
    .parentElement?.parentElement;

test("a versão compacta aplica as duas classes da pilha da fila", () => {
  render(
    <GestaoFilterBar
      compact
      placeholder="Buscar aluno ou atividade"
      query=""
      selects={selects}
    />
  );

  const classes = toolbarOf()?.classList;
  expect(classes?.contains("gk-toolbar-group")).toBe(true);
  expect(classes?.contains("gk-toolbar-group--stack")).toBe(true);
});

test("a versão padrão mantém só a barra em linha", () => {
  render(
    <GestaoFilterBar
      placeholder="Buscar aluno ou atividade"
      query=""
      selects={selects}
    />
  );

  const toolbar = toolbarOf();
  expect(toolbar?.className).toBe("gk-toolbar-group");
});
