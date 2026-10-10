import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExerciseEyebrow } from "@/components/exercises/exercise-eyebrow";
import { ExerciseProgress } from "@/components/exercises/exercise-progress";
import { scoreExerciseSession } from "@/lib/exercise-engine";
import { getMemberExerciseSession } from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";

interface ExerciseSessionResultPageProperties {
  readonly params: Promise<{ readonly sessionId: string }>;
}

const ExerciseSessionResultPage = async ({
  params,
}: ExerciseSessionResultPageProperties) => {
  const [{ sessionId }, memberId] = await Promise.all([
    params,
    requireMemberId(),
  ]);
  const session = await getMemberExerciseSession(memberId, sessionId);
  if (!session) {
    notFound();
  }
  if (session.status !== "COMPLETED") {
    redirect(`/exercicios/sessoes/${session.id}`);
  }

  const score = scoreExerciseSession(
    session.questions.flatMap(({ answer }) => (answer ? [answer] : []))
  );

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-[68px] pb-14 md:px-8 md:pt-12 md:pb-[120px] lg:px-12">
      <div className="mx-auto max-w-[760px]">
        <header className="flex flex-col gap-3.5">
          <Link
            className="hidden min-h-11 items-center gap-2 text-muted-foreground text-sm hover:text-foreground md:inline-flex"
            href="/exercicios"
          >
            <span aria-hidden="true">←</span> Exercícios
          </Link>
          <ExerciseEyebrow className="mt-0">
            Sessão concluída · {session.list.title} | {session.questions.length}{" "}
            questões fundamentais
          </ExerciseEyebrow>
          <h1 className="m-0 font-display font-semibold text-[32px] leading-[1.05] tracking-[-.02em] md:text-[52px]">
            Resultado
          </h1>
        </header>

        <section
          aria-label="Resumo do resultado"
          className="mt-5 flex flex-col gap-5 rounded-lg border bg-card p-5 md:mt-7 md:p-8"
        >
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <p className="m-0 font-display font-semibold text-[44px] leading-none tracking-[-.03em] md:text-[72px]">
              {score.correct} de {session.questions.length}
            </p>
            <p className="m-0 text-[15px] text-muted-foreground leading-[1.3] md:text-lg">
              corretas ({score.percentage}%)
            </p>
          </div>
          <ExerciseProgress
            className="m-0"
            questions={session.questions}
            size="result"
          />
          <p className="m-0 text-muted-foreground text-sm leading-[1.5]">
            Suas respostas e o resultado ficam salvos no seu perfil.
          </p>
        </section>

        <section
          aria-labelledby="exercise-review-list-title"
          className="mt-8 md:mt-11"
        >
          <h2
            className="m-0 font-display font-semibold text-2xl leading-[1.25] tracking-[-.005em] md:text-[26px]"
            id="exercise-review-list-title"
          >
            Revise suas respostas
          </h2>
          <svg
            aria-hidden="true"
            className="mt-2 h-2.5 w-24"
            fill="none"
            viewBox="0 0 96 10"
          >
            <path d="M0 5H34M62 5H96" stroke="var(--border)" />
            <path d="M48 1L52 5L48 9L44 5Z" fill="var(--muted-foreground)" />
            <circle cx="38" cy="5" fill="var(--muted-foreground)" r="1.2" />
            <circle cx="58" cy="5" fill="var(--muted-foreground)" r="1.2" />
          </svg>
          <ol className="mt-3 border-foreground/80 border-t">
            {session.questions.map((question) => {
              const questionNumber = question.position + 1;
              const isCorrect = Boolean(question.answer?.isCorrect);
              const reviewHref =
                "/exercicios/sessoes/" +
                session.id +
                "/revisao/" +
                questionNumber;

              return (
                <li
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3.5"
                  key={question.id}
                >
                  <Link
                    aria-label={
                      "Questão " +
                      questionNumber +
                      ", respondida, " +
                      (isCorrect ? "correta" : "incorreta")
                    }
                    className={cn(
                      "relative inline-flex size-10 flex-none items-center justify-center rounded-md border-2 font-semibold text-sm no-underline",
                      isCorrect
                        ? "border-success bg-success/5 text-success"
                        : "border-destructive bg-destructive/5 text-destructive"
                    )}
                    href={reviewHref}
                  >
                    {questionNumber}
                    {isCorrect ? (
                      <CheckCircle2Icon
                        aria-hidden="true"
                        className="absolute top-[3px] right-[3px] size-[11px]"
                      />
                    ) : (
                      <XCircleIcon
                        aria-hidden="true"
                        className="absolute top-[3px] right-[3px] size-[11px]"
                      />
                    )}
                  </Link>
                  <p className="m-0 min-w-0 flex-[1_1_260px] text-[15px] leading-[1.45]">
                    {question.questionVersion.statement}
                  </p>
                  <span
                    className={cn(
                      "inline-flex flex-none items-center gap-1.5 font-semibold text-[13px] leading-none",
                      isCorrect ? "text-success" : "text-destructive"
                    )}
                  >
                    {isCorrect ? (
                      <CheckCircle2Icon
                        aria-hidden="true"
                        className="size-[18px]"
                      />
                    ) : (
                      <XCircleIcon aria-hidden="true" className="size-[18px]" />
                    )}
                    {isCorrect ? "Correta" : "Incorreta"}
                  </span>
                  <Link
                    aria-label={`Revisar questão ${questionNumber}`}
                    className="inline-flex min-h-11 flex-none items-center px-1 font-semibold text-[13px] text-primary no-underline hover:underline"
                    href={reviewHref}
                  >
                    Revisar
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="mt-8 flex flex-col gap-3 md:flex-row">
          <Button asChild className="h-12 w-full px-6 md:w-auto">
            <Link href="/exercicios">Voltar para Exercícios</Link>
          </Button>
          <Button
            asChild
            className="h-12 w-full px-6 md:w-auto"
            variant="outline"
          >
            <Link href="/exercicios/historico">Ver histórico recente</Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default ExerciseSessionResultPage;
