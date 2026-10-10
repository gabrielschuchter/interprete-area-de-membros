import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

import { ExerciseQuestionNavigator } from "./exercise-session-navigation";

const questions = [
  { answer: { isCorrect: true }, id: "question-1", position: 0 },
  { answer: { isCorrect: false }, id: "question-2", position: 1 },
  { answer: null, id: "question-3", position: 2 },
  { answer: null, id: "question-4", position: 3 },
] as const;

afterEach(cleanup);

test("shows question states and routes answered questions to review", async () => {
  render(
    <ExerciseQuestionNavigator
      currentQuestionId="question-3"
      questions={questions}
      sessionId="session-1"
    />
  );

  const [desktopTrigger] = screen.getAllByRole("button", { name: "Questões" });
  fireEvent.click(desktopTrigger as HTMLButtonElement);

  const correct = await screen.findByRole("link", {
    name: "Questão 1, correta",
  });
  expect(correct.getAttribute("href")).toBe(
    "/exercicios/sessoes/session-1/revisao/1"
  );
  expect(
    screen
      .getByRole("link", { name: "Questão 2, incorreta" })
      .getAttribute("href")
  ).toBe("/exercicios/sessoes/session-1/revisao/2");

  const current = screen.getByRole("link", { name: "Questão 3, atual" });
  expect(current.getAttribute("aria-current")).toBe("step");
  expect(current.getAttribute("href")).toBe(
    "/exercicios/sessoes/session-1?questao=question-3"
  );
  expect(
    screen
      .getByRole("link", { name: "Questão 4, pendente" })
      .getAttribute("href")
  ).toBe("/exercicios/sessoes/session-1?questao=question-4");
});

test("opens the mobile question navigator as a sheet", async () => {
  render(
    <ExerciseQuestionNavigator
      currentQuestionId="question-3"
      questions={questions}
      sessionId="session-1"
    />
  );

  const [, mobileTrigger] = screen.getAllByRole("button", { name: "Questões" });
  fireEvent.click(mobileTrigger as HTMLButtonElement);

  expect(
    await screen.findByRole("dialog", { name: "Questões da sessão" })
  ).toBeDefined();
  await waitFor(() =>
    expect(
      screen
        .getByRole("link", { name: "Questão 4, pendente" })
        .getAttribute("href")
    ).toBe("/exercicios/sessoes/session-1?questao=question-4")
  );
});
