import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findBookmark: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  database: {
    exerciseQuestionBookmark: { findUnique: mocks.findBookmark },
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));
vi.mock("@/lib/learning", () => ({
  requireMemberId: async () => "member-1",
}));
vi.mock("@/lib/exercises", () => ({
  getMemberExerciseSession: mocks.getSession,
}));
vi.mock("@/lib/exercise-engine", () => ({
  scoreExerciseSession: () => ({ answered: 1, correct: 1, percentage: 100 }),
}));
vi.mock("@/components/learning/study-heartbeat", () => ({
  StudyHeartbeat: () => null,
}));
vi.mock("@/components/exercises/exercise-session-workspace", () => ({
  ExerciseSessionWorkspace: ({
    currentQuestionId,
  }: {
    readonly currentQuestionId: string;
  }) => <output data-testid="current-question">{currentQuestionId}</output>,
}));

import ExerciseSessionPage from "./page";

const session = {
  id: "session-1",
  status: "IN_PROGRESS",
  list: { slug: "evidencias", title: "Prática Baseada em Evidências" },
  questions: [
    {
      answer: { isCorrect: true },
      id: "session-question-1",
      position: 0,
      questionVersion: {
        statement: "Questão respondida",
        type: "SINGLE_CHOICE",
        question: { id: "question-1" },
        options: [],
      },
    },
    {
      answer: null,
      id: "session-question-2",
      position: 1,
      questionVersion: {
        statement: "Primeira questão pendente",
        type: "MULTIPLE_CHOICE",
        question: { id: "question-2" },
        options: [],
      },
    },
    {
      answer: null,
      id: "session-question-3",
      position: 2,
      questionVersion: {
        statement: "Segunda questão pendente",
        type: "SINGLE_CHOICE",
        question: { id: "question-3" },
        options: [],
      },
    },
  ],
};

const renderSessionPage = async (query: { readonly questao?: string } = {}) => {
  const element = await ExerciseSessionPage({
    params: Promise.resolve({ sessionId: "session-1" }),
    searchParams: Promise.resolve(query),
  });
  render(element);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("resumes an unfinished session at the first unanswered question", async () => {
  mocks.getSession.mockResolvedValue(session);
  mocks.findBookmark.mockResolvedValue(null);

  await renderSessionPage();

  expect(screen.getByTestId("current-question").textContent).toBe(
    "session-question-2"
  );
  expect(mocks.findBookmark).toHaveBeenCalledWith({
    where: {
      memberId_questionId: {
        memberId: "member-1",
        questionId: "question-2",
      },
    },
    select: { id: true },
  });
});

test("opens a requested pending question without changing its response state", async () => {
  mocks.getSession.mockResolvedValue(session);
  mocks.findBookmark.mockResolvedValue(null);

  await renderSessionPage({ questao: "session-question-3" });

  expect(screen.getByTestId("current-question").textContent).toBe(
    "session-question-3"
  );
});

test("routes a requested answered question to its read-only review", async () => {
  mocks.getSession.mockResolvedValue(session);

  await expect(
    ExerciseSessionPage({
      params: Promise.resolve({ sessionId: "session-1" }),
      searchParams: Promise.resolve({ questao: "session-question-1" }),
    })
  ).rejects.toThrow("REDIRECT:/exercicios/sessoes/session-1/revisao/1");
  expect(mocks.findBookmark).not.toHaveBeenCalled();
});
