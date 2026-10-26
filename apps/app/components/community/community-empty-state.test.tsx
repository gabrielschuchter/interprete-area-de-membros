import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CommunityEmptyState } from "./community-empty-state";

const NO_RESULTS_HEADING = /Nada encontrado/;

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...properties
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    readonly children: ReactNode;
    readonly href: string;
  }) => (
    <a href={href} {...properties}>
      {children}
    </a>
  ),
}));

vi.mock("./community-draft-starter", () => ({
  CommunityDraftStarter: ({ children }: { readonly children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

describe("CommunityEmptyState", () => {
  afterEach(() => {
    cleanup();
  });

  test("matches the board's filtered no-results state and keeps the query visible", () => {
    render(
      <CommunityEmptyState
        hasFilters
        query="zzzz-sem-resultados"
        sort="recent"
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Nada encontrado para “zzzz-sem-resultados”",
      })
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Tente outras palavras, ou limpe os filtros para voltar a ver todo o feed."
      )
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Limpar filtros" }).getAttribute("href")
    ).toBe("/comunidade");
    expect(screen.queryByRole("button", { name: "Criar conteúdo" })).toBeNull();
  });

  test("offers publication and group actions when the feed has no posts", () => {
    render(<CommunityEmptyState hasFilters={false} sort="recent" />);

    expect(
      screen.getByRole("heading", { name: "Ainda não há publicações por aqui" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Nova publicação" })
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ver grupos" }).getAttribute("href")
    ).toBe("/comunidade/grupos");
  });

  test("keeps the unanswered sort explanation distinct from a search miss", () => {
    render(
      <CommunityEmptyState hasFilters query="pergunta" sort="unanswered" />
    );

    expect(
      screen.getByRole("heading", { name: "Nenhuma publicação sem resposta." })
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: NO_RESULTS_HEADING })
    ).toBeNull();
  });
});
