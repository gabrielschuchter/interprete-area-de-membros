import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/salvos",
  useSearchParams: () => ({ toString: () => "" }),
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
vi.mock("@/app/(authenticated)/biblioteca/actions", () => ({
  toggleLearningBookmark: vi.fn(),
}));
vi.mock("@/app/(authenticated)/comunidade/actions", () => ({
  toggleBookmark: vi.fn(),
}));
vi.mock("@/app/(authenticated)/exercicios/actions", () => ({
  setExerciseListBookmark: vi.fn(async () => ({ ok: true, saved: false })),
}));
vi.mock("@/components/exercises/exercise-favorite-control", () => ({
  ExerciseFavoriteControl: () => <button type="button">Salvo</button>,
}));
vi.mock("@/components/mutations/single-flight-form", () => ({
  SingleFlightForm: ({ children }: { readonly children: React.ReactNode }) => (
    <form>{children}</form>
  ),
  SingleFlightSubmit: ({
    children,
  }: {
    readonly children: React.ReactNode;
  }) => <button type="submit">{children}</button>,
}));
vi.mock("@/lib/learning", () => ({ requireMemberId: async () => "member-1" }));
vi.mock("@/lib/library", () => ({ getPersonalLibraryItems: async () => [] }));
vi.mock("@/lib/community", () => ({
  communityPostHref: () => "/comunidade",
  getSavedCommunityPosts: async () => ({
    hasMore: false,
    posts: [],
    totalCount: 0,
  }),
}));
vi.mock("@/lib/exercises", () => ({
  getMemberExerciseFavorites: async () => ({
    hasNext: false,
    items: [],
    totalCount: 0,
  }),
  getMemberSavedExerciseLists: async () => [
    {
      id: "b1",
      createdAt: new Date("2026-11-20T12:00:00Z"),
      list: {
        id: "list-1",
        title: "Bioestatística",
        slug: "bioestatistica",
        bank: { title: "Banco de bioestatística" },
      },
    },
  ],
}));

import SavedPage from "./page";

afterEach(cleanup);

test("a lista de exercícios salva aparece na central, com link e botão de remover", async () => {
  render(await SavedPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByText("Lista de exercícios")).toBeTruthy();
  expect(
    screen
      .getAllByRole("link", { name: "Bioestatística" })[0]
      ?.getAttribute("href")
  ).toBe("/exercicios/listas/bioestatistica");
  expect(
    screen
      .getByRole("button", { name: "Remover Bioestatística das salvas" })
      .getAttribute("aria-pressed")
  ).toBe("true");
  expect(screen.getByRole("button", { name: "Exercícios 1" })).toBeTruthy();
});
