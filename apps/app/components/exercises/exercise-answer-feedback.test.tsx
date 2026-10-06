import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    readonly children: React.ReactNode;
    readonly href: string;
  }) => <a href={href}>{children}</a>,
}));

import { ExerciseAnswerFeedback } from "./exercise-answer-feedback";

describe("ExerciseAnswerFeedback", () => {
  afterEach(cleanup);

  test("offers the final result after the last answer completes a session", () => {
    render(
      <ExerciseAnswerFeedback
        correctOptionLabels={["B", "D"]}
        explanation="A explicação permanece disponível após a resposta."
        isCorrect
        isSessionComplete
        nextHref={null}
        resultHref="/exercicios/sessoes/session-1"
      />
    );

    expect(screen.getByText("Resposta correta")).toBeDefined();
    expect(screen.getByText("Resposta(s) correta(s): B, D")).toBeDefined();
    expect(
      screen.getByText("A explicação permanece disponível após a resposta.")
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "Ver resultado final" })
        .getAttribute("href")
    ).toBe("/exercicios/sessoes/session-1");
    expect(
      screen.queryByRole("link", { name: "Ir para próxima questão" })
    ).toBeNull();
  });

  test("offers the next question while the session is still in progress", () => {
    render(
      <ExerciseAnswerFeedback
        correctOptionLabels={["A"]}
        explanation={null}
        isCorrect={false}
        isSessionComplete={false}
        nextHref="/exercicios/sessoes/session-1"
        resultHref="/exercicios/sessoes/session-1"
      />
    );

    expect(
      screen
        .getByRole("link", { name: "Ir para próxima questão" })
        .getAttribute("href")
    ).toBe("/exercicios/sessoes/session-1");
    expect(
      screen.queryByRole("link", { name: "Ver resultado final" })
    ).toBeNull();
  });
});
