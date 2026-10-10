import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ExerciseAnswerOptions } from "./exercise-answer-options";

afterEach(cleanup);

test("distinguishes correct green answers from incorrect red selections", () => {
  const { container } = render(
    <ExerciseAnswerOptions
      correctOptionIds={["option-a", "option-b"]}
      options={[
        { content: "Alternativa correta marcada", id: "option-a", label: "A" },
        {
          content: "Alternativa correta não marcada",
          id: "option-b",
          label: "B",
        },
        {
          content: "Alternativa incorreta marcada",
          id: "option-c",
          label: "C",
        },
        {
          content: "Alternativa incorreta não marcada",
          id: "option-d",
          label: "D",
        },
      ]}
      selectedOptionIds={["option-a", "option-c"]}
    />
  );

  const options = container.querySelectorAll("li");
  expect(options).toHaveLength(4);
  expect(options[0]?.className).toContain("border-success bg-success/5");
  expect(options[1]?.className).toContain("border-success border-dashed");
  expect(options[2]?.className).toContain(
    "border-destructive bg-destructive/5"
  );
  expect(options[3]?.className).toContain("text-muted-foreground");
  expect(screen.getByText("Correta · sua resposta")).toBeDefined();
  expect(screen.getByText("Correta · não selecionada")).toBeDefined();
  expect(screen.getByText("Incorreta · sua resposta")).toBeDefined();
});
