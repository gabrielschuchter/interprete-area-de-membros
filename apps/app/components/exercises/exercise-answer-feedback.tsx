"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ExerciseExplanation } from "./exercise-explanation";

interface ExerciseAnswerFeedbackProperties {
  readonly className?: string;
  readonly correctOptionLabels: readonly string[];
  readonly explanation: string | null;
  readonly focusOnMount?: boolean;
  readonly isCorrect: boolean;
  readonly isSessionComplete: boolean;
  readonly mobileStickyAction?: boolean;
  readonly nextHref: string | null;
  readonly resultHref: string;
  readonly resultLabel?: string;
}

export const ExerciseAnswerFeedback = ({
  className = "mt-6",
  correctOptionLabels,
  explanation,
  isCorrect,
  isSessionComplete,
  mobileStickyAction = false,
  nextHref,
  resultHref,
  resultLabel = "Ver resultado",
  focusOnMount = false,
}: ExerciseAnswerFeedbackProperties) => (
  <FeedbackOutput
    className={className}
    correctOptionLabels={correctOptionLabels}
    explanation={explanation}
    focusOnMount={focusOnMount}
    isCorrect={isCorrect}
    isSessionComplete={isSessionComplete}
    mobileStickyAction={mobileStickyAction}
    nextHref={nextHref}
    resultHref={resultHref}
    resultLabel={resultLabel}
  />
);

const FeedbackOutput = ({
  className,
  correctOptionLabels,
  explanation,
  focusOnMount,
  isCorrect,
  isSessionComplete,
  mobileStickyAction,
  nextHref,
  resultHref,
  resultLabel,
}: ExerciseAnswerFeedbackProperties) => {
  const outputRef = useRef<HTMLOutputElement>(null);
  const actionHref = isSessionComplete ? resultHref : nextHref;
  const actionLabel = isSessionComplete
    ? resultLabel
    : "Ir para próxima questão";

  useEffect(() => {
    if (focusOnMount) {
      outputRef.current?.focus();
    }
  }, [focusOnMount]);

  return (
    <>
      <output
        aria-live="polite"
        className={`${className ?? "mt-6"} flex flex-col gap-3 rounded-lg border p-5 md:p-[22px] ${isCorrect ? "border-success/40 bg-success/5 text-foreground" : "border-destructive/40 bg-destructive/5 text-foreground"}`}
        ref={outputRef}
        tabIndex={-1}
      >
        <h3
          className={`flex items-center gap-2.5 font-display font-semibold text-[21px] leading-[1.2] ${isCorrect ? "text-success" : "text-destructive"}`}
        >
          {isCorrect ? (
            <CheckCircle2Icon
              aria-hidden="true"
              className="size-6 text-success"
            />
          ) : (
            <XCircleIcon
              aria-hidden="true"
              className="size-6 text-destructive"
            />
          )}
          <span>{isCorrect ? "Resposta correta" : "Resposta incorreta"}</span>
        </h3>
        <p className="m-0 font-semibold text-sm leading-[1.5]">
          Resposta(s) correta(s): {correctOptionLabels.join(", ")}
        </p>
        <ExerciseExplanation
          explanation={explanation}
          tone={isCorrect ? "success" : "destructive"}
        />
      </output>
      {actionHref ? (
        <div
          className={
            mobileStickyAction
              ? "fixed inset-x-0 bottom-[var(--exercise-keyboard-overlap,0px)] z-40 border-t bg-background p-4 pt-3 pb-[calc(1.375rem+env(safe-area-inset-bottom))] shadow-[0_-10px_18px_-12px_rgba(64,34,47,.22)] md:static md:mt-5 md:border-0 md:bg-transparent md:p-0 md:pb-0 md:shadow-none"
              : "mt-5"
          }
        >
          <Button
            asChild
            className={
              mobileStickyAction ? "h-12 w-full px-6 md:w-auto" : "h-12"
            }
          >
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        </div>
      ) : null}
    </>
  );
};
