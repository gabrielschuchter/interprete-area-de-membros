import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  pathname: "/exercicios",
  search: "",
  lists: [] as Record<string, unknown>[],
  inProgressSessions: [] as Record<string, unknown>[],
  listSessions: [] as Record<string, unknown>[],
  history: [] as Record<string, unknown>[],
  favorites: 0,
  savedLists: [] as string[],
}));

vi.mock("server-only", () => ({}));

vi.mock("./actions", () => ({
  setExerciseListBookmark: vi.fn(async () => ({ ok: true, saved: true })),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => ({ toString: () => state.search }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    scroll: _scroll,
    ...properties
  }: ComponentProps<"a"> & {
    readonly prefetch?: boolean;
    readonly scroll?: boolean;
  }) => (
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
  getMemberExerciseHistory: async () => state.history,
  getMemberExerciseListSessions: async () => state.listSessions,
  getMemberBookmarkedExerciseListIds: async () => new Set(state.savedLists),
  countMemberExerciseFavorites: async () => state.favorites,
}));

vi.mock("@/lib/exercise-engine", () => ({
  scoreExerciseSession: (answers: { isCorrect: boolean }[]) => {
    const correct = answers.filter(({ isCorrect }) => isCorrect).length;
    return {
      answered: answers.length,
      correct,
      percentage: answers.length
        ? Math.round((correct / answers.length) * 100)
        : 0,
    };
  },
}));

vi.mock("@/components/exercises/exercise-empty-illustration", () => ({
  ExerciseEmptyIllustration: () => <svg aria-hidden="true" />,
}));

vi.mock("@/components/exercises/exercise-eyebrow", () => ({
  ExerciseEyebrow: ({ children }: { readonly children: string }) => (
    <p>{children}</p>
  ),
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
  state.listSessions = [];
  state.history = [];
  state.favorites = 0;
  state.savedLists = [];
});

const HISTORY_ROW = /Medidas de tendência central/u;
const CLEAR_LINK = /Limpar/u;
const SAVED_TAB = /Salvas/u;
const RESUME_LINK = /^Retomar na questão 2/u;

const LIST = {
  id: "list-1",
  title: "Bioestatística",
  slug: "bioestatistica",
  description: "Lista de fundamentos.",
  coverUrl: null,
  bank: { title: "Banco de bioestatística" },
  _count: { items: 10 },
};

test("o card da lista é um único link, adiado até haver intenção", async () => {
  state.lists = [LIST];

  render(await ExercisesPage({ searchParams: Promise.resolve({}) }));

  const listTitle = screen.getByRole("link", { name: "Bioestatística" });
  expect(screen.queryByRole("link", { name: "Abrir lista" })).toBeNull();
  expect(listTitle.getAttribute("data-prefetch")).toBe("disabled");

  fireEvent.focus(listTitle);
  expect(listTitle.getAttribute("data-prefetch")).toBe("full");
});

test("cada lista mostra se é nova, está em andamento ou concluída", async () => {
  state.lists = [
    LIST,
    { ...LIST, id: "list-2", title: "Epidemiologia", slug: "epi" },
    { ...LIST, id: "list-3", title: "Coortes", slug: "coortes" },
  ];
  state.listSessions = [
    {
      listId: "list-2",
      status: "IN_PROGRESS",
      questions: [{ answer: { id: "a" } }, { answer: null }],
    },
    { listId: "list-3", status: "COMPLETED", questions: [] },
  ];

  render(await ExercisesPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByText("Nova")).toBeTruthy();
  expect(screen.getByText("1 de 2")).toBeTruthy();
  expect(screen.getByText("Concluída")).toBeTruthy();
});

test("sessão em andamento aparece em destaque com o botão Retomar", async () => {
  state.inProgressSessions = [
    {
      id: "session-1",
      list: { title: "Prática em andamento" },
      questions: [{ answer: { isCorrect: true } }, { answer: null }],
    },
  ];

  render(await ExercisesPage({ searchParams: Promise.resolve({}) }));

  expect(
    screen.getByRole("heading", { level: 3, name: "Prática em andamento" })
  ).toBeTruthy();
  expect(screen.getByText("1 de 2 respondidas")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: RESUME_LINK }).getAttribute("href")
  ).toBe("/exercicios/sessoes/session-1");
});

test("atalhos de histórico e questões salvas ficam no topo com a contagem", async () => {
  state.favorites = 8;

  render(await ExercisesPage({ searchParams: Promise.resolve({}) }));

  const shortcuts = screen.getByRole("navigation", {
    name: "Atalhos de exercícios",
  });
  expect(shortcuts.textContent).toContain("Histórico");
  expect(shortcuts.textContent).toContain("Questões salvas");
  expect(shortcuts.textContent).toContain("8");
});

test("o histórico mostra data, título e acerto em uma linha clicável", async () => {
  state.history = [
    {
      id: "s1",
      kind: "LIST",
      startedAt: new Date("2026-11-10T12:00:00Z"),
      completedAt: new Date("2026-11-10T13:00:00Z"),
      list: { title: "Medidas de tendência central" },
      questions: [
        { answer: { isCorrect: true } },
        { answer: { isCorrect: true } },
        { answer: { isCorrect: true } },
        { answer: { isCorrect: true } },
        { answer: { isCorrect: false } },
      ],
    },
  ];

  render(await ExercisesPage({ searchParams: Promise.resolve({}) }));

  const row = screen.getByRole("link", {
    name: HISTORY_ROW,
  });
  expect(row.getAttribute("href")).toBe("/exercicios/sessoes/s1/resultado");
  expect(row.textContent).toContain("80%");
});

test("sem resultado na busca mostra o estado vazio e limpa filtros", async () => {
  render(await ExercisesPage({ searchParams: Promise.resolve({ q: "zzz" }) }));

  expect(
    screen.getByRole("heading", {
      name: "Nenhuma lista encontrada para esta busca.",
    })
  ).toBeTruthy();
  expect(
    screen.getAllByRole("link", { name: CLEAR_LINK }).length
  ).toBeGreaterThan(0);
});

test("o hero mostra quantas questões faltam e leva à questão certa", async () => {
  state.inProgressSessions = [
    {
      id: "session-9",
      list: { title: "Prática em andamento" },
      questions: [
        { answer: { isCorrect: true } },
        { answer: { isCorrect: true } },
        { answer: null },
        { answer: null },
      ],
    },
  ];

  render(await ExercisesPage({ searchParams: Promise.resolve({}) }));

  const cta = screen.getByRole("link", { name: "Continuar na questão 3 →" });
  expect(cta.getAttribute("href")).toBe("/exercicios/sessoes/session-9");
  expect(screen.getByText("2 questões")).toBeTruthy();
});

test("a seção de listas sempre se chama Escolha um caderno, sem limpar filtros", async () => {
  render(await ExercisesPage({ searchParams: Promise.resolve({ q: "zzz" }) }));

  expect(
    screen.getByRole("heading", { level: 2, name: "Escolha um caderno" })
  ).toBeTruthy();
  expect(screen.queryByText("Limpar filtros")).toBeNull();
});

test("a folha em andamento tem altura mínima fixa e se endireita ao passar o mouse", async () => {
  state.inProgressSessions = [
    {
      id: "session-1",
      list: { title: "Prática em andamento" },
      questions: [{ answer: null }],
    },
  ];

  render(await ExercisesPage({ searchParams: Promise.resolve({}) }));

  const sheet = screen
    .getByRole("heading", { level: 3, name: "Prática em andamento" })
    .closest("article");
  expect(sheet?.className).toContain("min-h-[244px]");
  expect(sheet?.className).toContain("hover:rotate-0");
  expect(sheet?.className).toContain("hover:-translate-y-2");
});

test("a lista salva aparece marcada e dá para desmarcar; a aba Salvas filtra", async () => {
  state.lists = [
    LIST,
    { ...LIST, id: "list-2", title: "Epidemiologia", slug: "epi" },
  ];
  state.savedLists = ["list-1"];

  render(
    await ExercisesPage({ searchParams: Promise.resolve({ salvas: "1" }) })
  );

  const marked = screen.getByRole("button", {
    name: "Remover Bioestatística das salvas",
  });
  expect(marked.getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("link", { name: "Epidemiologia" })).toBeNull();
  expect(
    screen.getByRole("link", { name: SAVED_TAB }).getAttribute("aria-current")
  ).toBe("true");
});
