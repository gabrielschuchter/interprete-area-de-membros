export interface ConfirmedExerciseAnswer {
  readonly correctOptionLabels: readonly string[];
  readonly explanation: string | null;
  readonly isCorrect: boolean;
  readonly isSessionComplete: boolean;
  readonly nextHref: string | null;
  readonly resultHref: string;
}

export type ExerciseAnswerActionState =
  | { readonly status: "idle" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "success";
      readonly feedback: ConfirmedExerciseAnswer;
    };

export const initialExerciseAnswerState: ExerciseAnswerActionState = {
  status: "idle",
};
