import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const navigationHarness = vi.hoisted(() => ({
  pathname: "/biblioteca",
  query: "",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationHarness.pathname,
  useRouter: () => ({ push: navigationHarness.push }),
  useSearchParams: () => new URLSearchParams(navigationHarness.query),
}));

import { FilterForm } from "./filter-form";

afterEach(() => {
  cleanup();
  navigationHarness.pathname = "/biblioteca";
  navigationHarness.query = "";
  navigationHarness.push.mockReset();
});

test("shows immediate pending feedback and pushes only submitted filters", () => {
  render(
    <FilterForm action="/biblioteca">
      <input defaultValue="fono" name="q" />
      <select defaultValue="PDF" name="kind">
        <option value="">Todos</option>
        <option value="PDF">PDF</option>
      </select>
      <input defaultValue="" name="category" />
      <button type="submit">Filtrar</button>
    </FilterForm>
  );

  const form = screen.getByRole("button", { name: "Filtrar" }).closest("form");
  if (!form) {
    throw new Error("Formulário de filtros não encontrado");
  }

  fireEvent.submit(form);

  expect(form.getAttribute("aria-busy")).toBe("true");
  expect(screen.getByRole("status").textContent).toBe("Aplicando filtros…");
  expect(navigationHarness.push).toHaveBeenCalledWith(
    "/biblioteca?q=fono&kind=PDF"
  );
});

test("does not navigate when the submitted filters already match the URL", () => {
  navigationHarness.query = "q=fono&kind=PDF";
  render(
    <FilterForm action="/biblioteca">
      <input defaultValue="fono" name="q" />
      <input defaultValue="PDF" name="kind" />
      <button type="submit">Filtrar</button>
    </FilterForm>
  );

  const form = screen.getByRole("button", { name: "Filtrar" }).closest("form");
  if (!form) {
    throw new Error("Formulário de filtros não encontrado");
  }

  fireEvent.submit(form);

  expect(navigationHarness.push).not.toHaveBeenCalled();
});
