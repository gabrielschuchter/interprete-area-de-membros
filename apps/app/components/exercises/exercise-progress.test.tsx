import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ExerciseProgress } from "./exercise-progress";

afterEach(cleanup);

test("uses one labeled segment per question for lists up to 30", () => {
  const questions = Array.from({ length: 30 }, (_, index) => {
    let answer: { readonly isCorrect: boolean } | null = null;
    if (index === 0) {
      answer = { isCorrect: true };
    } else if (index === 1) {
      answer = { isCorrect: false };
    }
    return { answer, id: `question-${index}` };
  });
  const { container } = render(
    <ExerciseProgress currentQuestionId="question-2" questions={questions} />
  );

  const progress = screen.getByRole("img", {
    name: "2 de 30 questões respondidas",
  });
  const segments = container.querySelectorAll("span[aria-hidden='true']");
  expect(segments).toHaveLength(30);
  expect(segments[0]?.className).toContain("bg-success");
  expect(segments[1]?.className).toContain("bg-destructive");
  expect(segments[2]?.className).toContain("border-2");
  expect(progress).toBeTruthy();
});

test("uses a continuous progress bar above 30 questions", () => {
  const questions = Array.from({ length: 31 }, (_, index) => ({
    answer: index === 0 ? { isCorrect: true } : null,
    id: `question-${index}`,
  }));
  const { container } = render(<ExerciseProgress questions={questions} />);

  const progress = screen.getByRole("progressbar", {
    name: "1 de 31 questões respondidas",
  });
  expect(progress.getAttribute("aria-valuenow")).toBe("1");
  expect(progress.getAttribute("aria-valuemax")).toBe("31");
  expect(container.querySelectorAll("span[aria-hidden='true']")).toHaveLength(
    0
  );
});

test("shows in-progress home-card count below ungraded primary segments", () => {
  const questions = [
    { answer: { isCorrect: true }, id: "question-1" },
    { answer: { isCorrect: false }, id: "question-2" },
    { answer: null, id: "question-3" },
  ];
  const { container } = render(
    <ExerciseProgress
      captionPlacement="below"
      className="mt-0"
      questions={questions}
      showAnswerStatus={false}
    />
  );

  const caption = screen.getByText("2 de 3 questões respondidas");
  const segments = container.querySelectorAll("span[aria-hidden='true']");
  expect(segments).toHaveLength(3);
  expect(segments[0]?.className).toContain("bg-primary");
  expect(segments[1]?.className).toContain("bg-primary");
  expect(segments[0]?.className).not.toContain("bg-success");
  expect(segments[1]?.className).not.toContain("bg-destructive");
  expect(caption.compareDocumentPosition(segments[0] as Node)).toBe(
    Node.DOCUMENT_POSITION_PRECEDING
  );
});
