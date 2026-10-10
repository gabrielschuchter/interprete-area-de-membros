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

const referenceLinkName = /Oxford CEBM, Asking focused questions/u;

describe("ExerciseAnswerFeedback", () => {
  afterEach(cleanup);

  test("offers the final result after the last answer completes a session", () => {
    render(
      <ExerciseAnswerFeedback
        correctOptionLabels={["B", "D"]}
        explanation="A explicação permanece disponível após a resposta."
        isCorrect
        isSessionComplete
        mobileStickyAction
        nextHref={null}
        resultHref="/exercicios/sessoes/session-1/resultado"
      />
    );

    expect(screen.getByText("Resposta correta")).toBeDefined();
    expect(screen.getByText("Resposta(s) correta(s): B, D")).toBeDefined();
    expect(
      screen.getByText("A explicação permanece disponível após a resposta.")
    ).toBeDefined();
    const resultLink = screen.getByRole("link", { name: "Ver resultado" });
    expect(resultLink.getAttribute("href")).toBe(
      "/exercicios/sessoes/session-1/resultado"
    );
    expect(resultLink.parentElement?.className).toContain("fixed inset-x-0");
    expect(resultLink.closest("output")).toBeNull();
    expect(screen.getByRole("status").contains(resultLink)).toBe(false);
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
        nextHref="/exercicios/sessoes/session-1?questao=question-2"
        resultHref="/exercicios/sessoes/session-1"
      />
    );

    const nextLink = screen.getByRole("link", {
      name: "Ir para próxima questão",
    });
    expect(nextLink.getAttribute("href")).toBe(
      "/exercicios/sessoes/session-1?questao=question-2"
    );
    expect(nextLink.closest("output")).toBeNull();
    expect(screen.queryByRole("link", { name: "Ver resultado" })).toBeNull();
  });

  test("does not render a navigation action when an incomplete answer has no destination", () => {
    render(
      <ExerciseAnswerFeedback
        correctOptionLabels={["A"]}
        explanation={null}
        isCorrect={false}
        isSessionComplete={false}
        nextHref={null}
        resultHref="/exercicios/sessoes/session-1/resultado"
      />
    );

    expect(
      screen.queryByRole("link", { name: "Ir para próxima questão" })
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "Ver resultado" })).toBeNull();
  });

  test("renders an inline bibliography as a separate student-facing link", () => {
    render(
      <ExerciseAnswerFeedback
        correctOptionLabels={["A"]}
        explanation={
          "A aplicabilidade depende das características e preferências da pessoa. Referência introdutória: Oxford CEBM, Asking focused questions: https://www.cebm.ox.ac.uk/resources/ebm-tools/asking-focused-questions"
        }
        isCorrect
        isSessionComplete={false}
        nextHref="/exercicios/sessoes/session-1?questao=question-2"
        resultHref="/exercicios/sessoes/session-1"
      />
    );

    expect(
      screen.getByText(
        "A aplicabilidade depende das características e preferências da pessoa."
      )
    ).toBeDefined();
    expect(screen.getByText("Referência")).toBeDefined();
    const referenceLink = screen.getByRole("link", {
      name: referenceLinkName,
    });
    expect(referenceLink.getAttribute("href")).toBe(
      "https://www.cebm.ox.ac.uk/resources/ebm-tools/asking-focused-questions"
    );
  });
});
