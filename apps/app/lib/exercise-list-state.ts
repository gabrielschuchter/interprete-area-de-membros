export type ExerciseListState =
  | { readonly kind: "new" }
  | {
      readonly kind: "in-progress";
      readonly answered: number;
      readonly total: number;
    }
  | { readonly kind: "completed" };

export interface ExerciseListSessionSummary {
  readonly listId: string;
  readonly questions: readonly { readonly answer: unknown }[];
  readonly status: "IN_PROGRESS" | "COMPLETED" | (string & {});
}

/**
 * Resume, por lista, o que a pessoa já fez nela. Uma sessão em andamento vale
 * mais que uma concluída: se há as duas, a lista aparece como "em andamento".
 * Listas sem nenhuma sessão ficam de fora (o chamador trata como "nova").
 */
export const summarizeExerciseListStates = (
  sessions: readonly ExerciseListSessionSummary[]
): Map<string, ExerciseListState> => {
  const states = new Map<string, ExerciseListState>();
  for (const session of sessions) {
    if (session.status === "IN_PROGRESS") {
      if (states.get(session.listId)?.kind !== "in-progress") {
        states.set(session.listId, {
          kind: "in-progress",
          answered: session.questions.filter(({ answer }) => answer !== null)
            .length,
          total: session.questions.length,
        });
      }
    } else if (session.status === "COMPLETED" && !states.has(session.listId)) {
      states.set(session.listId, { kind: "completed" });
    }
  }
  return states;
};

export const exerciseListStateLabel = (
  state: ExerciseListState | undefined
): string => {
  if (!state || state.kind === "new") {
    return "Nova";
  }
  if (state.kind === "completed") {
    return "Concluída";
  }
  return `${state.answered} de ${state.total}`;
};

export const exerciseListStateProgress = (
  state: ExerciseListState | undefined
): number => {
  if (!state || state.kind === "new") {
    return 0;
  }
  if (state.kind === "completed") {
    return 100;
  }
  return state.total === 0
    ? 0
    : Math.round((state.answered / state.total) * 100);
};
