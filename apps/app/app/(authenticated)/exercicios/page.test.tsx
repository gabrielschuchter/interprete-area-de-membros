import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  pathname: "/exercicios",
  search: "",
  lists: [] as Record<string, unknown>[],
  inProgressSessions: [] as Record<string, unknown>[],
}));

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => ({ toString: () => state.search }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    ...properties
  }: ComponentProps<"a"> & { readonly prefetch?: boolean }) => (
    <a
      data-prefetch={prefetch === true ? "full" : "disabled"}
      href={href}
      {...properties}
    />
  ),
}));

vi.mock("@/lib/learning", () => ({
  requireMemberId: async () => "member-1",
}));

vi.mock("@/lib/exercises", () => ({
  getPublishedExerciseLists: async () => state.lists,
  getPublishedExerciseCategories: async () => [],
  getMemberInProgressExerciseSessions: async () => state.inProgressSessions,
  getMemberExerciseHistory: async () => [],
}));

vi.mock("@/lib/exercise-engine", () => ({
  scoreExerciseSession: vi.fn(),
}));

vi.mock("@/components/exercises/exercise-empty-illustration", () => ({
  ExerciseEmptyIllustration: () => <svg aria-hidden="true" />,
}));

vi.mock("@/components/exercises/exercise-eyebrow", () => ({
  ExerciseEyebrow: ({ children }: { readonly children: string }) => (
    <p>{children}</p>
  ),
}));

vi.mock("@/components/exercises/exercise-list-cover", () => ({
  ExerciseListCover: () => <div aria-hidden="true" />,
}));

vi.mock("@/components/exercises/exercise-progress", () => ({
  ExerciseProgress: () => <div aria-hidden="true" />,
}));

import { resetNavigationPrefetchBudget } from "../components/navigation-prefetch";
import ExercisesPage from "./page";

afterEach(() => {
  cleanup();
  resetNavigationPrefetchBudget();
  state.pathname = "/exercicios";
  state.search = "";
  state.lists = [];
  state.inProgressSessions = [];
});

test("matches the handoff outer width and defers list-card prefetch until intent", async () => {
  state.lists = [
    {
      id: "list-1",
      title: "Bioestatística",
      slug: "bioestatistica",
      description: "Lista de fundamentos.",
      coverUrl: null,
      bank: { title: "Bioestatística" },
      _count: { items: 10 },
    },
  ];
  state.inProgressSessions = [
    {
      id: "session-1",
      list: { title: "Prática em andamento" },
      questions: [],
    },
  ];

  render(await ExercisesPage({ searchParams: Promise.resolve({}) }));

  const resumeHeading = screen.getByRole("heading", {
    level: 3,
    name: "Prática em andamento",
  });
  expect(resumeHeading.closest("article")?.className).toContain(
    "md:max-w-[610px]"
  );

  const listTitle = screen.getByRole("link", { name: "Bioestatística" });
  const openList = screen.getByRole("link", { name: "Abrir lista" });
  expect(listTitle.getAttribute("data-prefetch")).toBe("disabled");
  expect(openList.getAttribute("data-prefetch")).toBe("disabled");

  fireEvent.focus(listTitle);
  expect(listTitle.getAttribute("data-prefetch")).toBe("full");
});
