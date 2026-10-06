"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useActionState } from "react";
import { submitExerciseAnswer } from "@/app/(authenticated)/exercicios/actions";
import { ExerciseAnswerFeedback } from "./exercise-answer-feedback";
import {
  type ExerciseAnswerActionState,
  initialExerciseAnswerState,
} from "./exercise-answer-state";

interface ExerciseAnswerFormProperties {
  readonly initialError: boolean;
  readonly question: {
    readonly id: string;
    readonly questionVersion: {
      readonly options: readonly {
        readonly content: string;
        readonly id: string;
        readonly label: string;
      }[];
      readonly type: string;
    };
  };
  readonly session: {
    readonly id: string;
    readonly questions: readonly { id: string }[];
  };
}

const messageForState = (state: ExerciseAnswerActionState) => {
  if (state.status === "error") {
    return state.message;
  }
  return null;
};

export const ExerciseAnswerForm = ({
  initialError,
  question,
  session,
}: ExerciseAnswerFormProperties) => {
  const [state, formAction, pending] = useActionState(
    submitExerciseAnswer,
    initialExerciseAnswerState
  );

  if (state.status === "success") {
    return <ExerciseAnswerFeedback {...state.feedback} />;
  }

  const message = messageForState(state);

  return (
    <form action={formAction} className="mt-7">
      <input name="sessionId" type="hidden" value={session.id} />
      <input name="sessionQuestionId" type="hidden" value={question.id} />
      <fieldset className="grid gap-3" disabled={pending}>
        <legend className="mb-3 font-medium text-sm">
          {question.questionVersion.type === "MULTIPLE_CHOICE"
            ? "Selecione todas as alternativas corretas."
            : "Selecione uma alternativa."}
        </legend>
        {question.questionVersion.options.map((option) => (
          <label
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/60 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            key={option.id}
          >
            <input
              className="mt-1 accent-primary"
              name="optionIds"
              required={question.questionVersion.type !== "MULTIPLE_CHOICE"}
              type={
                question.questionVersion.type === "MULTIPLE_CHOICE"
                  ? "checkbox"
                  : "radio"
              }
              value={option.id}
            />
            <span className="flex-1 whitespace-pre-wrap leading-6">
              <span className="mr-2 font-semibold">{option.label}.</span>
              {option.content}
            </span>
          </label>
        ))}
      </fieldset>
      {initialError && state.status === "idle" && (
        <output
          aria-live="polite"
          className="mt-4 block rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          Selecione uma alternativa válida antes de confirmar.
        </output>
      )}
      {message && (
        <output
          aria-live="polite"
          className="mt-4 block rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          {message}
        </output>
      )}
      <div
        aria-live="polite"
        className="mt-4 min-h-6 text-muted-foreground text-sm"
      >
        {pending ? "Registrando sua resposta…" : ""}
      </div>
      <Button className="mt-2" disabled={pending} type="submit">
        {pending ? "Registrando resposta…" : "Confirmar resposta"}
      </Button>
    </form>
  );
};
