import { describe, expect, test } from "vitest";
import { parseExerciseExplanation } from "./exercise-references";

describe("exercise bibliography in the versioned explanation", () => {
  test("separates a labelled reference while preserving the explanation", () => {
    expect(
      parseExerciseExplanation(
        "A explicação existente continua intacta.\n\nReferência: Cochrane Handbook, Chapter 8 — https://training.cochrane.org/handbook/current/chapter-08"
      )
    ).toEqual({
      explanation: "A explicação existente continua intacta.",
      references: [
        {
          href: "https://training.cochrane.org/handbook/current/chapter-08",
          label: "Cochrane Handbook, Chapter 8",
        },
      ],
    });
  });

  test("renders a labelled Markdown reference without its syntax", () => {
    expect(
      parseExerciseExplanation(
        "A explicação continua intacta.\n\nReferência: [Cochrane Handbook, Chapter 8](https://training.cochrane.org/handbook/current/chapter-08)"
      )
    ).toEqual({
      explanation: "A explicação continua intacta.",
      references: [
        {
          href: "https://training.cochrane.org/handbook/current/chapter-08",
          label: "Cochrane Handbook, Chapter 8",
        },
      ],
    });
  });

  test("separates a labelled reference appended to the explanation line", () => {
    expect(
      parseExerciseExplanation(
        "O risco observado depende do desfecho e do período de acompanhamento. Referência: CDC, Field Epidemiology Manual: https://www.cdc.gov/field-epi-manual/php/chapters/design-conduct-analyze-field-studies.html"
      )
    ).toEqual({
      explanation:
        "O risco observado depende do desfecho e do período de acompanhamento.",
      references: [
        {
          href: "https://www.cdc.gov/field-epi-manual/php/chapters/design-conduct-analyze-field-studies.html",
          label: "CDC, Field Epidemiology Manual",
        },
      ],
    });
  });

  test("supports a descriptive qualifier in an inline reference label", () => {
    expect(
      parseExerciseExplanation(
        "A aplicabilidade depende das características e preferências da pessoa. Referência introdutória: Oxford CEBM, Asking focused questions: https://www.cebm.ox.ac.uk/resources/ebm-tools/asking-focused-questions"
      )
    ).toEqual({
      explanation:
        "A aplicabilidade depende das características e preferências da pessoa.",
      references: [
        {
          href: "https://www.cebm.ox.ac.uk/resources/ebm-tools/asking-focused-questions",
          label: "Oxford CEBM, Asking focused questions",
        },
      ],
    });
  });

  test("extracts a final standalone URL without changing surrounding text", () => {
    expect(
      parseExerciseExplanation(
        "O cegamento reduz viés de aferição.\n\nhttps://example.org/handbook."
      )
    ).toEqual({
      explanation: "O cegamento reduz viés de aferição.",
      references: [
        {
          href: "https://example.org/handbook",
          label: "https://example.org/handbook",
        },
      ],
    });
  });

  test("leaves ordinary inline links in the explanation and accepts no reference", () => {
    expect(
      parseExerciseExplanation(
        "Consulte https://example.org/methods para conhecer o método."
      )
    ).toEqual({
      explanation:
        "Consulte https://example.org/methods para conhecer o método.",
      references: [],
    });
    expect(parseExerciseExplanation(null)).toEqual({
      explanation: "",
      references: [],
    });
  });

  test("does not expose unsafe URL protocols as references", () => {
    expect(parseExerciseExplanation("Referência: javascript:alert(1)")).toEqual(
      {
        explanation: "",
        references: [{ label: "javascript:alert(1)" }],
      }
    );
  });

  test("preserves a text-only reference and supports multiple trailing references", () => {
    expect(
      parseExerciseExplanation(
        "A explicação permanece.\n\nReferência: Cochrane Handbook, Chapter 8\nFonte: https://example.org/source"
      )
    ).toEqual({
      explanation: "A explicação permanece.",
      references: [
        { label: "Cochrane Handbook, Chapter 8" },
        {
          href: "https://example.org/source",
          label: "https://example.org/source",
        },
      ],
    });
  });
});
