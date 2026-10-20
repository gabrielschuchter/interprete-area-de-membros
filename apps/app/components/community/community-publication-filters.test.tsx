import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CommunityPublicationFilters } from "./community-publication-filters";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("applies search and sort while preserving the selected publication status", () => {
  const { container } = render(
    <CommunityPublicationFilters activeView="drafts" query="" sort="recent" />
  );

  const search = container.querySelector("search");
  if (!search) {
    throw new Error("Publication filters should render a search region.");
  }
  const form = search.querySelector("form");
  if (!form) {
    throw new Error("Publication filters should render a search form.");
  }

  fireEvent.change(
    screen.getByRole("searchbox", { name: "Buscar nos meus rascunhos" }),
    { target: { value: " artigo " } }
  );
  fireEvent.submit(form);
  expect(router.push).toHaveBeenLastCalledWith(
    "/comunidade/minhas-publicacoes?status=drafts&q=artigo"
  );

  fireEvent.change(screen.getByRole("combobox", { name: "Ordenar por" }), {
    target: { value: "oldest" },
  });
  expect(router.push).toHaveBeenLastCalledWith(
    "/comunidade/minhas-publicacoes?status=drafts&q=artigo&sort=oldest"
  );
});
