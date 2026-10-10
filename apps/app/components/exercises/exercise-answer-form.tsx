"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CircleAlertIcon, Loader2Icon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { submitExerciseAnswer } from "@/app/(authenticated)/exercicios/actions";
import { ExerciseAnswerFeedback } from "./exercise-answer-feedback";
import type { ExerciseAnswerOption } from "./exercise-answer-options";
import { ExerciseAnswerOptions } from "./exercise-answer-options";
import {
  type ConfirmedExerciseAnswer,
  type ExerciseAnswerActionState,
  initialExerciseAnswerState,
} from "./exercise-answer-state";

interface ExerciseAnswerFormProperties {
  readonly draftSelectedOptionIds: readonly string[];
  readonly initialError: boolean;
  readonly mobileStickyAction?: boolean;
  readonly onAnswerConfirmed?: (answer: ConfirmedExerciseAnswer) => void;
  readonly onDraftChange: (
    questionId: string,
    selectedOptionIds: readonly string[]
  ) => void;
  readonly question: {
    readonly id: string;
    readonly questionVersion: {
      readonly options: readonly ExerciseAnswerOption[];
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

const desktopActionSpacing = (
  status: ExerciseAnswerActionState["status"],
  message: string | null,
  initialError: boolean
) => {
  if (message || (initialError && status === "idle")) {
    return "md:mt-2";
  }
  return "md:mt-7";
};

export const ExerciseAnswerForm = ({
  draftSelectedOptionIds,
  initialError,
  mobileStickyAction = false,
  onAnswerConfirmed,
  onDraftChange,
  question,
  session,
}: ExerciseAnswerFormProperties) => {
  const formRef = useRef<HTMLFormElement>(null);
  const notifiedAnswerRef = useRef<string | null>(null);
  const [state, formAction, pending] = useActionState(
    submitExerciseAnswer,
    initialExerciseAnswerState
  );

  const stateBelongsToQuestion =
    state.status === "idle" ||
    (state.status === "error"
      ? state.sessionQuestionId === question.id
      : state.feedback.sessionQuestionId === question.id);
  const currentState = stateBelongsToQuestion
    ? state
    : initialExerciseAnswerState;
  const confirmedForQuestion =
    currentState.status === "success" &&
    currentState.feedback.sessionQuestionId === question.id;

  useEffect(() => {
    if (confirmedForQuestion && currentState.status === "success") {
      onDraftChange(question.id, []);
      if (
        notifiedAnswerRef.current !== currentState.feedback.sessionQuestionId
      ) {
        notifiedAnswerRef.current = currentState.feedback.sessionQuestionId;
        onAnswerConfirmed?.(currentState.feedback);
      }
    }
  }, [
    confirmedForQuestion,
    currentState,
    onAnswerConfirmed,
    onDraftChange,
    question.id,
  ]);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      return;
    }
    const updateKeyboardOverlap = () => {
      const overlap = Math.max(
        0,
        window.innerHeight - visualViewport.height - visualViewport.offsetTop
      );
      document.documentElement.style.setProperty(
        "--exercise-keyboard-overlap",
        `${overlap}px`
      );
    };
    updateKeyboardOverlap();
    visualViewport.addEventListener("resize", updateKeyboardOverlap);
    visualViewport.addEventListener("scroll", updateKeyboardOverlap);
    return () => {
      visualViewport.removeEventListener("resize", updateKeyboardOverlap);
      visualViewport.removeEventListener("scroll", updateKeyboardOverlap);
      document.documentElement.style.removeProperty(
        "--exercise-keyboard-overlap"
      );
    };
  }, []);

  if (confirmedForQuestion && currentState.status === "success") {
    return (
      <div className={mobileStickyAction ? "pb-24 md:pb-0" : undefined}>
        <ExerciseAnswerOptions
          correctOptionIds={currentState.feedback.correctOptionIds}
          options={question.questionVersion.options}
          selectedOptionIds={currentState.feedback.selectedOptionIds}
        />
        <ExerciseAnswerFeedback
          {...currentState.feedback}
          focusOnMount
          mobileStickyAction={mobileStickyAction}
        />
      </div>
    );
  }

  const message = messageForState(currentState);
  const actionSpacingClass = desktopActionSpacing(
    currentState.status,
    message,
    initialError
  );
  const selectedIds = new Set(draftSelectedOptionIds);

  return (
    <form
      action={formAction}
      className="mt-[10px] pb-24 md:mt-[14px] md:pb-0"
      key={
        currentState.status === "error" ? `${question.id}:retry` : question.id
      }
      ref={formRef}
    >
      <input name="sessionId" type="hidden" value={session.id} />
      <input name="sessionQuestionId" type="hidden" value={question.id} />
      <fieldset className="grid gap-2.5" disabled={pending}>
        <legend className="mb-2 font-normal text-[13.5px] text-muted-foreground leading-[1.5] md:mb-3">
          {question.questionVersion.type === "MULTIPLE_CHOICE"
            ? "Selecione todas as alternativas corretas."
            : "Selecione uma alternativa."}
        </legend>
        {question.questionVersion.options.map((option) => (
          <label
            className="grid min-h-[60px] cursor-pointer grid-cols-[1.25rem_1.875rem_minmax(0,1fr)] items-center gap-3.5 rounded-lg border px-4 py-3 text-[15px] leading-[1.45] transition-colors hover:border-[#BFA9A3] hover:bg-[#FBF8F6] has-[:disabled]:cursor-not-allowed has-[:checked]:border-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:px-[15px] has-[:checked]:py-[11px] has-[:disabled]:opacity-70 md:min-h-14 md:text-base"
            key={option.id}
          >
            <input
              checked={selectedIds.has(option.id)}
              className="peer size-5 accent-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              name="optionIds"
              onChange={(event) => {
                let nextIds: readonly string[] = [option.id];
                if (question.questionVersion.type === "MULTIPLE_CHOICE") {
                  nextIds = event.currentTarget.checked
                    ? [...draftSelectedOptionIds, option.id]
                    : draftSelectedOptionIds.filter((id) => id !== option.id);
                }
                onDraftChange(question.id, [...new Set(nextIds)]);
              }}
              required={question.questionVersion.type !== "MULTIPLE_CHOICE"}
              type={
                question.questionVersion.type === "MULTIPLE_CHOICE"
                  ? "checkbox"
                  : "radio"
              }
              value={option.id}
            />
            <span className="inline-flex size-[1.875rem] items-center justify-center rounded-md border bg-muted/60 font-mono font-semibold text-[13px] peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
              {option.label}
            </span>
            <span className="whitespace-pre-wrap leading-6">
              {option.content}
            </span>
          </label>
        ))}
      </fieldset>
      {initialError && currentState.status === "idle" && (
        <output
          aria-live="polite"
          className="mt-4 block rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          Selecione uma alternativa válida antes de confirmar.
        </output>
      )}
      {message && (
        <div
          aria-live="polite"
          className="mt-4 flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm md:flex-row md:items-center md:justify-between"
          role="alert"
        >
          {currentState.status === "error" && currentState.retryable ? (
            <div className="flex items-center gap-2.5">
              <CircleAlertIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-destructive"
              />
              <div>
                <p className="font-semibold text-destructive">
                  Não foi possível confirmar sua resposta.
                </p>
                <p className="mt-1">
                  Sua seleção foi mantida. Verifique a conexão e tente
                  novamente.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <CircleAlertIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-destructive"
              />
              <p className="m-0">{message}</p>
            </div>
          )}
          {currentState.status === "error" && currentState.retryable && (
            <Button
              className="h-11 shrink-0 border-destructive text-destructive hover:bg-destructive/5 hover:text-destructive"
              onClick={() => formRef.current?.requestSubmit()}
              type="button"
              variant="outline"
            >
              Tentar novamente
            </Button>
          )}
        </div>
      )}
      <div
        className={`fixed inset-x-0 bottom-[var(--exercise-keyboard-overlap,0px)] z-40 flex flex-wrap items-center gap-3 border-t bg-background p-4 pt-3 pb-[calc(1.375rem+env(safe-area-inset-bottom))] shadow-[0_-10px_18px_-12px_rgba(64,34,47,.22)] md:static ${actionSpacingClass} md:border-0 md:bg-transparent md:p-0 md:pb-0 md:shadow-none`}
      >
        <Button
          className="h-12 w-full px-6 md:w-auto"
          disabled={pending || draftSelectedOptionIds.length === 0}
          type="submit"
        >
          {pending ? (
            <>
              <Loader2Icon
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
              Confirmando
            </>
          ) : (
            "Confirmar resposta"
          )}
        </Button>
        {draftSelectedOptionIds.length > 0 && !pending && (
          <p
            aria-live="polite"
            className="hidden text-muted-foreground text-sm md:block"
          >
            {draftSelectedOptionIds.length}{" "}
            {draftSelectedOptionIds.length === 1
              ? "alternativa selecionada"
              : "alternativas selecionadas"}
          </p>
        )}
      </div>
    </form>
  );
};
