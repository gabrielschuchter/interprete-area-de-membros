import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const replace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch: _prefetch,
    scroll: _scroll,
    ...properties
  }: ComponentProps<"a"> & {
    readonly prefetch?: boolean;
    readonly scroll?: boolean;
  }) => <a href={href} {...properties} />,
}));

import {
  ExerciseSearchControls,
  exerciseFiltersHref,
} from "./exercise-search-controls";

const SAVED_TAB = /Listas salvas/u;

const CATEGORIES = [
  { id: "c1", slug: "pbe", title: "Prática baseada em evidências" },
  { id: "c2", slug: "bio", title: "Bioestatística" },
];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  replace.mockClear();
  vi.useRealTimers();
});

test("monta o endereço com busca e categoria", () => {
  expect(exerciseFiltersHref("")).toBe("/exercicios");
  expect(exerciseFiltersHref(" coorte ")).toBe("/exercicios?q=coorte");
  expect(exerciseFiltersHref("a b", "bio")).toBe(
    "/exercicios?q=a+b&categoria=bio"
  );
});

test("a aba Listas salvas mantém a busca e marca a seleção", () => {
  render(
    <ExerciseSearchControls
      categories={CATEGORIES}
      query="coorte"
      savedCount={3}
      savedOnly
    />
  );
  const tab = screen.getByRole("link", { name: SAVED_TAB });
  expect(tab.getAttribute("aria-current")).toBe("true");
  expect(tab.getAttribute("href")).toBe("/exercicios?q=coorte&salvas=1");
  expect(screen.getByRole("link", { name: "Todas" }).getAttribute("href")).toBe(
    "/exercicios?q=coorte"
  );
});

test("busca sozinho depois de uma pausa, mantendo a categoria", () => {
  render(
    <ExerciseSearchControls
      categories={CATEGORIES}
      categorySlug="bio"
      query=""
    />
  );
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "teste" },
  });
  expect(replace).not.toHaveBeenCalled();
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(replace).toHaveBeenCalledWith("/exercicios?q=teste&categoria=bio", {
    scroll: false,
  });
});

test("uma letra só não dispara a busca", () => {
  render(<ExerciseSearchControls categories={CATEGORIES} query="" />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "a" } });
  act(() => {
    vi.advanceTimersByTime(800);
  });
  expect(replace).not.toHaveBeenCalled();
});

test("as categorias são links e a ativa fica marcada", () => {
  render(
    <ExerciseSearchControls
      categories={CATEGORIES}
      categorySlug="pbe"
      query="coorte"
    />
  );
  const active = screen.getByRole("link", {
    name: "Prática baseada em evidências",
  });
  expect(active.getAttribute("aria-current")).toBe("true");
  expect(screen.getByRole("link", { name: "Todas" }).getAttribute("href")).toBe(
    "/exercicios?q=coorte"
  );
  expect(
    screen.getByRole("link", { name: "Bioestatística" }).getAttribute("href")
  ).toBe("/exercicios?q=coorte&categoria=bio");
});

test("Enter busca na hora", () => {
  render(<ExerciseSearchControls categories={CATEGORIES} query="" />);
  const input = screen.getByRole("searchbox");
  fireEvent.change(input, { target: { value: "pico" } });
  fireEvent.submit(input.closest("form") as HTMLFormElement);
  expect(replace).toHaveBeenCalledWith("/exercicios?q=pico", {
    scroll: false,
  });
});

test("o botão de limpar esvazia a busca na hora", () => {
  render(
    <ExerciseSearchControls
      categories={CATEGORIES}
      categorySlug="bio"
      query="coorte"
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
  expect(replace).toHaveBeenCalledWith("/exercicios?categoria=bio", {
    scroll: false,
  });
});
