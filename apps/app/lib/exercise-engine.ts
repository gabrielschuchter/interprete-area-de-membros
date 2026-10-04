export interface ExerciseChoiceDraft {
  readonly content: string;
  readonly correct: boolean;
  readonly id: string;
}

export type ExerciseChoiceKind = "SINGLE_CHOICE" | "MULTIPLE_CHOICE";

export interface ExerciseAnswerEvaluation {
  readonly correctOptionIds: readonly string[];
  readonly isCorrect: boolean;
  readonly selectedOptionIds: readonly string[];
}

export const validateExerciseDraft = (
  kind: ExerciseChoiceKind,
  statement: string,
  options: readonly ExerciseChoiceDraft[]
) => {
  const normalized = options.map((option) => option.content.trim());
  if (statement.trim().length < 5) {
    return { valid: false, reason: "Escreva o enunciado da questão." } as const;
  }
  if (options.length < 2 || normalized.some((option) => option.length < 1)) {
    return {
      valid: false,
      reason: "Inclua pelo menos duas alternativas preenchidas.",
    } as const;
  }
  if (new Set(normalized).size !== normalized.length) {
    return {
      valid: false,
      reason: "As alternativas precisam ser diferentes.",
    } as const;
  }
  const correctCount = options.filter(({ correct }) => correct).length;
  if (correctCount === 0 || (kind === "SINGLE_CHOICE" && correctCount !== 1)) {
    return {
      valid: false,
      reason:
        kind === "SINGLE_CHOICE"
          ? "Marque exatamente uma alternativa correta."
          : "Marque pelo menos uma alternativa correta.",
    } as const;
  }
  return { valid: true, reason: null } as const;
};

export const evaluateExerciseAnswer = (
  kind: ExerciseChoiceKind,
  options: readonly ExerciseChoiceDraft[],
  submittedOptionIds: readonly string[]
): ExerciseAnswerEvaluation | null => {
  const allowedIds = new Set(options.map(({ id }) => id));
  const selectedOptionIds = [...new Set(submittedOptionIds)];
  if (
    selectedOptionIds.length === 0 ||
    selectedOptionIds.some((id) => !allowedIds.has(id)) ||
    (kind === "SINGLE_CHOICE" && selectedOptionIds.length !== 1)
  ) {
    return null;
  }
  const correctOptionIds = options
    .filter(({ correct }) => correct)
    .map(({ id }) => id)
    .sort();
  const normalizedSelection = [...selectedOptionIds].sort();
  return {
    correctOptionIds,
    isCorrect:
      normalizedSelection.length === correctOptionIds.length &&
      normalizedSelection.every((id, index) => id === correctOptionIds[index]),
    selectedOptionIds,
  };
};

export const scoreExerciseSession = (
  answers: readonly { readonly isCorrect: boolean }[]
) => {
  const correct = answers.filter(({ isCorrect }) => isCorrect).length;
  const answered = answers.length;
  return {
    answered,
    correct,
    percentage: answered === 0 ? 0 : Math.round((correct / answered) * 100),
  };
};
