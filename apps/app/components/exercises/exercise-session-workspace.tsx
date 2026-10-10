"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExerciseAnswerForm } from "./exercise-answer-form";
import type { ConfirmedExerciseAnswer } from "./exercise-answer-state";
import { ExerciseEyebrow } from "./exercise-eyebrow";
import { ExerciseFavoriteControl } from "./exercise-favorite-control";
import { ExerciseProgress } from "./exercise-progress";
import { useExerciseSessionDrafts } from "./exercise-session-drafts";
import {
  ExerciseQuestionNavigator,
  ExerciseSessionExitControl,
} from "./exercise-session-navigation";

interface MemberSession {
  readonly id: string;
  readonly list: { readonly title: string; readonly slug: string };
  readonly questions: readonly {
    readonly answer: { readonly isCorrect: boolean } | null;
    readonly id: string;
    readonly position: number;
    readonly questionVersion: {
      readonly statement: string;
      readonly type: string;
      readonly question: { readonly id: string };
      readonly options: readonly {
        readonly content: string;
        readonly id: string;
        readonly label: string;
      }[];
    };
  }[];
}

export const ExerciseSessionWorkspace = ({
  currentQuestionId,
  hasInvalidAnswer,
  isBookmarked,
  score,
  session,
}: {
  readonly currentQuestionId: string;
  readonly hasInvalidAnswer: boolean;
  readonly isBookmarked: boolean;
  readonly score: {
    readonly answered: number;
    readonly correct: number;
    readonly percentage: number;
  };
  readonly session: MemberSession;
}) => {
  const question = session.questions.find(({ id }) => id === currentQuestionId);
  const { draftFor, setDraftFor } = useExerciseSessionDrafts();
  const [confirmedAnswers, setConfirmedAnswers] = useState<
    Readonly<Record<string, boolean>>
  >({});
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousQuestionId = useRef(currentQuestionId);
  const handleAnswerConfirmed = useCallback(
    (answer: ConfirmedExerciseAnswer) => {
      setConfirmedAnswers((current) =>
        answer.sessionQuestionId in current
          ? current
          : {
              ...current,
              [answer.sessionQuestionId]: answer.isCorrect,
            }
      );
    },
    []
  );
  useEffect(() => {
    if (previousQuestionId.current !== currentQuestionId) {
      questionHeadingRef.current?.focus();
      previousQuestionId.current = currentQuestionId;
    }
  }, [currentQuestionId]);
  if (!question || question.answer) {
    return null;
  }
  const total = session.questions.length;
  const displayQuestions = session.questions.map((item) => ({
    ...item,
    answer:
      item.answer ??
      (item.id in confirmedAnswers
        ? { isCorrect: confirmedAnswers[item.id] ?? false }
        : null),
  }));
  const localAnswers = displayQuestions.filter(
    (item, index) => !session.questions[index]?.answer && item.answer
  );
  const displayScore = {
    answered: score.answered + localAnswers.length,
    correct:
      score.correct +
      localAnswers.filter((item) => item.answer?.isCorrect).length,
    percentage: 0,
  };
  displayScore.percentage =
    displayScore.answered === 0
      ? 0
      : Math.round((displayScore.correct / displayScore.answered) * 100);

  return (
    <>
      <div className="fixed inset-x-0 top-14 z-40 bg-background/95 px-4 pt-3 pb-3 shadow-[0_4px_12px_-8px_rgba(64,34,47,.22)] backdrop-blur md:hidden">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="flex items-center justify-between gap-3">
            <p aria-live="polite" className="text-muted-foreground text-sm">
              {displayScore.answered} de {total} respondidas ·{" "}
              {displayScore.correct} corretas ({displayScore.percentage}%)
            </p>
            <ExerciseQuestionNavigator
              currentQuestionId={question.id}
              questions={displayQuestions.map(({ answer, id, position }) => ({
                answer,
                id,
                position,
              }))}
              sessionId={session.id}
            />
          </div>
          <ExerciseProgress
            currentQuestionId={question.id}
            questions={displayQuestions}
          />
        </div>
      </div>
      <main className="mx-auto w-full max-w-[760px] px-4 pt-[140px] pb-8 md:px-8 md:pt-8 lg:px-0 lg:pt-12">
        <div className="hidden items-center justify-between md:flex">
          <ExerciseSessionExitControl />
        </div>
        <header className="mt-3.5 hidden md:block">
          <ExerciseEyebrow>Sessão · {session.list.title}</ExerciseEyebrow>
          <h1 className="mt-3.5 font-display text-[42px] leading-[1.1] tracking-[-0.02em]">
            Pratique no seu ritmo
          </h1>
          <div className="mt-6 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p aria-live="polite" className="text-muted-foreground text-sm">
                {displayScore.answered} de {total} respondidas ·{" "}
                {displayScore.correct} corretas ({displayScore.percentage}%)
              </p>
              <ExerciseQuestionNavigator
                currentQuestionId={question.id}
                questions={displayQuestions.map(({ answer, id, position }) => ({
                  answer,
                  id,
                  position,
                }))}
                sessionId={session.id}
              />
            </div>
            <ExerciseProgress
              className="mt-0"
              currentQuestionId={question.id}
              questions={displayQuestions}
            />
          </div>
        </header>

        <article className="mt-5 rounded-lg border bg-card p-5 md:mt-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge
              className="h-7 rounded-[4px] border-border px-[10px] font-data font-medium text-[12px] text-primary tracking-[.06em]"
              variant="outline"
            >
              Questão {question.position + 1} de {total}
            </Badge>
            <ExerciseFavoriteControl
              className="px-0 text-primary"
              initialBookmarked={isBookmarked}
              questionId={question.questionVersion.question.id}
              sessionId={session.id}
            />
          </div>
          <h2
            className="mt-[18px] scroll-mt-40 whitespace-pre-wrap font-display text-xl leading-[1.35] tracking-[-0.005em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:mt-[22px] md:scroll-mt-6 md:text-[25px]"
            ref={questionHeadingRef}
            tabIndex={-1}
          >
            {question.questionVersion.statement}
          </h2>
          <ExerciseAnswerForm
            draftSelectedOptionIds={draftFor(question.id)}
            initialError={hasInvalidAnswer}
            key={question.id}
            mobileStickyAction
            onAnswerConfirmed={handleAnswerConfirmed}
            onDraftChange={setDraftFor}
            question={question}
            session={session}
          />
        </article>
      </main>
    </>
  );
};
