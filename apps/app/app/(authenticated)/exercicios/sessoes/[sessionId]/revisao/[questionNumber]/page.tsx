import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { HistoryIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseAnswerFeedback } from "@/components/exercises/exercise-answer-feedback";
import { ExerciseAnswerOptions } from "@/components/exercises/exercise-answer-options";
import { ExerciseEyebrow } from "@/components/exercises/exercise-eyebrow";
import { ExerciseFavoriteControl } from "@/components/exercises/exercise-favorite-control";
import { ExerciseSessionExitControl } from "@/components/exercises/exercise-session-navigation";
import { StudyHeartbeat } from "@/components/learning/study-heartbeat";
import { getMemberExerciseSession } from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";

interface ExerciseQuestionReviewPageProperties {
  readonly params: Promise<{
    readonly questionNumber: string;
    readonly sessionId: string;
  }>;
}

const ExerciseQuestionReviewPage = async ({
  params,
}: ExerciseQuestionReviewPageProperties) => {
  const [{ questionNumber, sessionId }, memberId] = await Promise.all([
    params,
    requireMemberId(),
  ]);
  const number = Number(questionNumber);
  const session = await getMemberExerciseSession(memberId, sessionId);
  if (!(session && Number.isInteger(number)) || number < 1) {
    notFound();
  }
  const question = session.questions[number - 1];
  if (!question?.answer) {
    notFound();
  }
  const isSessionComplete = session.status === "COMPLETED";
  const currentBookmark = await database.exerciseQuestionBookmark.findUnique({
    where: {
      memberId_questionId: {
        memberId,
        questionId: question.questionVersion.question.id,
      },
    },
    select: { id: true },
  });
  const previousQuestion = session.questions[number - 2];
  const nextQuestion = session.questions[number];
  const backHref = isSessionComplete
    ? `/exercicios/sessoes/${session.id}/resultado`
    : `/exercicios/sessoes/${session.id}?questao=${encodeURIComponent(session.questions.find(({ answer }) => !answer)?.id ?? question.id)}`;

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-[68px] pb-14 md:px-8 md:pt-12 md:pb-[120px] lg:px-12">
      <StudyHeartbeat activityKind="EXERCISE" resourceId={session.id} />
      <div className="mx-auto max-w-[760px]">
        <header className="flex flex-col gap-3.5">
          {isSessionComplete ? (
            <Link
              className="hidden min-h-11 items-center gap-2 text-muted-foreground text-sm hover:text-foreground md:inline-flex"
              href={backHref}
            >
              <span aria-hidden="true">←</span> Resultado
            </Link>
          ) : (
            <div className="hidden min-h-11 items-center justify-between md:flex">
              <ExerciseSessionExitControl />
              <Link
                className="text-muted-foreground text-sm hover:text-foreground"
                href={backHref}
              >
                Voltar à sessão
              </Link>
            </div>
          )}
          <ExerciseEyebrow className="mt-0">
            Revisão · {session.list.title} · {session.questions.length} questões
            fundamentais
          </ExerciseEyebrow>
          <h1 className="m-0 font-display font-semibold text-[32px] leading-[1.05] tracking-[-.02em] md:text-[44px]">
            Questão {number} de {session.questions.length}
          </h1>
        </header>
        <p className="mt-5 flex items-center gap-2.5 rounded-lg border bg-card px-4 py-3 text-[14px] text-muted-foreground leading-[1.4]">
          <HistoryIcon
            aria-hidden="true"
            className="size-[18px] flex-none text-primary"
          />
          Você está revendo uma questão já respondida. Nada muda no seu
          resultado.
        </p>

        <article className="mt-6 flex flex-col gap-[22px] rounded-lg border bg-card p-5 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span className="inline-flex h-7 items-center rounded-sm border px-2.5 font-mono text-primary text-xs tracking-[.06em]">
              Questão {number} de {session.questions.length}
            </span>
            <ExerciseFavoriteControl
              className="h-11 px-1 text-primary"
              initialBookmarked={Boolean(currentBookmark)}
              questionId={question.questionVersion.question.id}
              sessionId={session.id}
            />
          </div>
          <h2 className="m-0 whitespace-pre-wrap font-display font-semibold text-[22px] leading-[1.35] tracking-[-.005em] md:text-[25px]">
            {question.questionVersion.statement}
          </h2>
          <ExerciseAnswerOptions
            className="m-0 grid gap-2.5"
            correctOptionIds={question.questionVersion.correctOptionIds}
            options={question.questionVersion.options}
            selectedOptionIds={question.answer.selectedOptionIds}
          />
          <ExerciseAnswerFeedback
            className="m-0"
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
            isSessionComplete={false}
            nextHref={null}
            resultHref={backHref}
          />
        </article>

        <nav
          aria-label="Navegar pela revisão"
          className="mt-6 flex flex-wrap items-center justify-between gap-3"
        >
          {previousQuestion?.answer ? (
            <Button asChild className="h-12" variant="outline">
              <Link
                href={
                  "/exercicios/sessoes/" +
                  session.id +
                  "/revisao/" +
                  (number - 1)
                }
              >
                ← Questão anterior
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <Button asChild className="min-h-11 px-1" variant="ghost">
            <Link href={backHref}>
              {isSessionComplete ? "Voltar ao resultado" : "Voltar à sessão"}
            </Link>
          </Button>
          {nextQuestion?.answer ? (
            <Button asChild className="h-12" variant="outline">
              <Link
                href={
                  "/exercicios/sessoes/" +
                  session.id +
                  "/revisao/" +
                  (number + 1)
                }
              >
                Próxima questão →
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </main>
  );
};

export default ExerciseQuestionReviewPage;
