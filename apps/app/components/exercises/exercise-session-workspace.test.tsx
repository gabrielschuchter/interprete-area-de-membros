import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  onAnswerConfirmed: undefined as
    | ((answer: {
        correctOptionIds: string[];
        correctOptionLabels: string[];
        explanation: string | null;
        isCorrect: boolean;
        isSessionComplete: boolean;
        nextHref: string | null;
        resultHref: string;
        selectedOptionIds: string[];
        sessionQuestionId: string;
      }) => void)
    | undefined,
}));

vi.mock("./exercise-answer-form", () => ({
  ExerciseAnswerForm: ({
    onAnswerConfirmed,
  }: {
    readonly onAnswerConfirmed?: typeof mocks.onAnswerConfirmed;
  }) => {
    mocks.onAnswerConfirmed = onAnswerConfirmed;
    return null;
  },
}));
vi.mock("./exercise-eyebrow", () => ({
  ExerciseEyebrow: () => null,
}));
vi.mock("./exercise-favorite-control", () => ({
  ExerciseFavoriteControl: () => null,
}));
vi.mock("./exercise-progress", () => ({
  ExerciseProgress: ({
    questions,
  }: {
    readonly questions: readonly {
      readonly answer: { readonly isCorrect: boolean } | null;
      readonly id: string;
    }[];
  }) => (
    <output data-testid="progress-state">
      {questions
        .map(({ answer, id }) => `${id}:${answer?.isCorrect ?? "pending"}`)
        .join(",")}
    </output>
  ),
}));
vi.mock("./exercise-session-drafts", () => ({
  useExerciseSessionDrafts: () => ({
    draftFor: () => [],
    setDraftFor: vi.fn(),
  }),
}));
vi.mock("./exercise-session-navigation", () => ({
  ExerciseQuestionNavigator: () => null,
  ExerciseSessionExitControl: () => null,
}));

import { ExerciseSessionWorkspace } from "./exercise-session-workspace";

const updatedProgressText = /1 de 2 respondidas · 1 corretas \(100%\)/;

const session = {
  id: "session-1",
  list: { slug: "evidencias", title: "Prática Baseada em Evidências" },
  questions: [
    {
      answer: null,
      id: "session-question-a",
      position: 0,
      questionVersion: {
        statement: "Enunciado da questão A",
        type: "SINGLE_CHOICE",
        question: { id: "question-a" },
        options: [],
      },
    },
    {
      answer: null,
      id: "session-question-b",
      position: 1,
      questionVersion: {
        statement: "Enunciado da questão B",
        type: "SINGLE_CHOICE",
        question: { id: "question-b" },
        options: [],
      },
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("moves focus to the new question after navigating within the session", async () => {
  const view = render(
    <ExerciseSessionWorkspace
      currentQuestionId="session-question-a"
      hasInvalidAnswer={false}
      isBookmarked={false}
      score={{ answered: 0, correct: 0, percentage: 0 }}
      session={session}
    />
  );

  expect(
    screen.getByRole("heading", { name: "Enunciado da questão A" })
  ).toBeTruthy();

  view.rerender(
    <ExerciseSessionWorkspace
      currentQuestionId="session-question-b"
      hasInvalidAnswer={false}
      isBookmarked={false}
      score={{ answered: 0, correct: 0, percentage: 0 }}
      session={session}
    />
  );

  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Enunciado da questão B" })
    )
  );
});

test("updates progress immediately when the server confirms an answer", () => {
  render(
    <ExerciseSessionWorkspace
      currentQuestionId="session-question-a"
      hasInvalidAnswer={false}
      isBookmarked={false}
      score={{ answered: 0, correct: 0, percentage: 0 }}
      session={session}
    />
  );

  act(() => {
    mocks.onAnswerConfirmed?.({
      correctOptionIds: ["option-a"],
      correctOptionLabels: ["A"],
      explanation: "Explicação persistida.",
      isCorrect: true,
      isSessionComplete: false,
      nextHref: "/exercicios/sessoes/session-1?questao=session-question-b",
      resultHref: "/exercicios/sessoes/session-1/resultado",
      selectedOptionIds: ["option-a"],
      sessionQuestionId: "session-question-a",
    });
  });

  expect(screen.getAllByText(updatedProgressText)).toHaveLength(2);
  expect(
    screen.getAllByTestId("progress-state").map((item) => item.textContent)
  ).toEqual([
    "session-question-a:true,session-question-b:pending",
    "session-question-a:true,session-question-b:pending",
  ]);
});
