export interface ConfirmedExerciseAnswer {
  readonly correctOptionIds: readonly string[];
  readonly correctOptionLabels: readonly string[];
  readonly explanation: string | null;
  readonly isCorrect: boolean;
  readonly isSessionComplete: boolean;
  readonly nextHref: string | null;
  readonly resultHref: string;
  readonly resultLabel?: string;
  readonly selectedOptionIds: readonly string[];
  readonly sessionQuestionId: string;
}

export type ExerciseAnswerActionState =
  | { readonly status: "idle" }
  | {
      readonly status: "error";
      readonly message: string;
      readonly retryable?: boolean;
      readonly sessionQuestionId?: string;
    }
  | {
      readonly status: "success";
      readonly feedback: ConfirmedExerciseAnswer;
    };

export const initialExerciseAnswerState: ExerciseAnswerActionState = {
  status: "idle",
};
