"use client";

import type { getMemberExerciseSession } from "@/lib/exercises";
import { ExerciseAnswerFeedback } from "./exercise-answer-feedback";
import { ExerciseAnswerForm } from "./exercise-answer-form";
import { ExerciseAnswerOptions } from "./exercise-answer-options";
import { ExerciseEyebrow } from "./exercise-eyebrow";
import { ExerciseFavoriteControl } from "./exercise-favorite-control";
import { useExerciseSessionDrafts } from "./exercise-session-drafts";
import {
  ExerciseMobileExitHeader,
  ExerciseSessionExitControl,
} from "./exercise-session-navigation";

type MemberSession = NonNullable<
  Awaited<ReturnType<typeof getMemberExerciseSession>>
>;

export const ExerciseFavoriteAttemptWorkspace = ({
  isBookmarked,
  session,
}: {
  readonly isBookmarked: boolean;
  readonly session: MemberSession;
}) => {
  const question = session.questions[0];
  const { draftFor, setDraftFor } = useExerciseSessionDrafts();
  if (!question) {
    return null;
  }

  return (
    <>
      <ExerciseMobileExitHeader
        backLabel="Voltar para questões salvas"
        destination="/exercicios/favoritas"
        title="Questões salvas"
      />
      <main className="mx-auto w-full max-w-[1080px] px-5 pt-[72px] pb-10 md:px-8 md:pt-12 md:pb-[120px] lg:px-12">
        <div className="mx-auto max-w-[760px]">
          <header className="flex flex-col gap-3.5">
            <div className="hidden min-h-11 items-center justify-between md:flex">
              <ExerciseSessionExitControl
                destination="/exercicios/favoritas"
                label="Questões salvas"
              />
            </div>
            <ExerciseEyebrow className="mt-0">
              Questão salva · {session.list.title} · prática avulsa
            </ExerciseEyebrow>
            <h1 className="m-0 font-display font-semibold text-[32px] leading-[1.05] tracking-[-.02em] md:text-[44px]">
              Responder questão salva
            </h1>
          </header>

          <article className="mt-6 rounded-lg border bg-card p-5 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <span className="inline-flex h-7 items-center rounded-sm border px-2.5 font-mono text-primary text-xs tracking-[.06em]">
                Questão salva · da lista
              </span>
              <ExerciseFavoriteControl
                className="h-11 px-1 text-primary"
                initialBookmarked={isBookmarked}
                questionId={question.questionVersion.question.id}
                sessionId={session.id}
              />
            </div>
            <h2 className="mt-5 whitespace-pre-wrap font-display font-semibold text-[22px] leading-[1.35] md:text-[25px]">
              {question.questionVersion.statement}
            </h2>

            {question.answer ? (
              <>
                <ExerciseAnswerOptions
                  correctOptionIds={question.questionVersion.correctOptionIds}
                  options={question.questionVersion.options}
                  selectedOptionIds={question.answer.selectedOptionIds}
                />
                <ExerciseAnswerFeedback
                  correctOptionLabels={question.questionVersion.correctOptionIds
                    .map(
                      (id) =>
                        question.questionVersion.options.find(
                          (option) => option.id === id
                        )?.label
                    )
                    .filter((label): label is string => Boolean(label))}
                  explanation={question.questionVersion.explanation}
                  isCorrect={question.answer.isCorrect}
                  isSessionComplete
                  nextHref={null}
                  resultHref="/exercicios/favoritas"
                  resultLabel="Voltar para questões salvas"
                />
              </>
            ) : (
              <ExerciseAnswerForm
                draftSelectedOptionIds={draftFor(question.id)}
                initialError={false}
                mobileStickyAction
                onDraftChange={setDraftFor}
                question={question}
                session={session}
              />
            )}
          </article>
        </div>
      </main>
    </>
  );
};
