import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  favorites: {
    items: [] as never[],
    totalCount: 0,
    hasPrevious: false,
    previousCursor: null,
    hasNext: false,
    nextCursor: null,
  },
}));

vi.mock("@/lib/learning", () => ({
  requireMemberId: async () => "member-1",
}));

vi.mock("@/lib/exercises", () => ({
  getMemberExerciseFavorites: async () => state.favorites,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...properties
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    readonly href: string;
  }) => (
    <a href={href} {...properties}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/exercises/exercise-favorites-grid", () => ({
  ExerciseFavoritesGrid: () => <div>Favoritas</div>,
}));

vi.mock("@/components/exercises/exercise-empty-illustration", () => ({
  ExerciseEmptyIllustration: () => <svg aria-hidden="true" />,
}));

vi.mock("@repo/design-system/components/ui/button", () => ({
  Button: ({
    asChild: _asChild,
    children,
    ...properties
  }: {
    readonly asChild?: boolean;
    readonly children: ReactNode;
  }) => <div {...properties}>{children}</div>,
}));

import ExerciseFavoritesPage from "./page";

afterEach(() => {
  cleanup();
  state.favorites = {
    items: [],
    totalCount: 0,
    hasPrevious: false,
    previousCursor: null,
    hasNext: false,
    nextCursor: null,
  };
});

test("shows a refresh path when the current page is stale but favorites remain", async () => {
  state.favorites = {
    ...state.favorites,
    totalCount: 2,
  };

  render(
    await ExerciseFavoritesPage({
      searchParams: Promise.resolve({ cursor: "stale-cursor" }),
    })
  );

  expect(
    screen.getByRole("heading", {
      name: "Esta página da lista ficou desatualizada.",
    })
  ).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Ver questões salvas" })
      .getAttribute("href")
  ).toBe("/exercicios/favoritas");
  expect(
    screen.queryByRole("heading", { name: "Você ainda não salvou questões." })
  ).toBeNull();
});

test("shows the empty state only when the member has no favorites", async () => {
  render(await ExerciseFavoritesPage({ searchParams: Promise.resolve({}) }));

  expect(
    screen.getByRole("heading", { name: "Você ainda não salvou questões." })
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Explorar listas" }).getAttribute("href")
  ).toBe("/exercicios");
  expect(
    screen.queryByRole("heading", {
      name: "Esta página da lista ficou desatualizada.",
    })
  ).toBeNull();
});
