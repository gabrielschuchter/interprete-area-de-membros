import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { ExerciseEyebrow } from "@/components/exercises/exercise-eyebrow";
import { ExerciseProgress } from "@/components/exercises/exercise-progress";
import { scoreExerciseSession } from "@/lib/exercise-engine";
import { getMemberExerciseHistoryPage } from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";

interface ExerciseHistoryPageProperties {
  readonly searchParams: Promise<{
    readonly cursor?: string;
    readonly direcao?: string;
  }>;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
  year: "numeric",
});

const ExerciseHistoryPage = async ({
  searchParams,
}: ExerciseHistoryPageProperties) => {
  const [memberId, query] = await Promise.all([
    requireMemberId(),
    searchParams,
  ]);
  const direction = query.direcao === "antes" ? "before" : "after";
  const history = await getMemberExerciseHistoryPage(
    memberId,
    query.cursor,
    direction
  );

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-3 pb-14 md:px-8 md:pt-12 md:pb-[120px] lg:px-12">
      <header className="flex flex-col gap-3.5">
        <Link
          className="hidden min-h-11 items-center gap-2 text-muted-foreground text-sm hover:text-foreground md:inline-flex"
          href="/exercicios"
        >
          <span aria-hidden="true">←</span> Exercícios
        </Link>
        <ExerciseEyebrow className="mt-0">Seu percurso</ExerciseEyebrow>
        <h1 className="m-0 font-display font-semibold text-4xl leading-[1.05] tracking-[-.02em] md:text-[52px]">
          Histórico recente
        </h1>
        <p className="m-0 max-w-[560px] text-[15px] text-muted-foreground leading-[1.6] md:text-base">
          Suas sessões concluídas e o resultado de cada uma.
        </p>
      </header>

      {history.items.length ? (
        <ol className="mt-6 max-w-[860px] border-foreground/80 border-t">
          {history.items.map((session) => {
            const answers = session.questions.flatMap(({ answer }) =>
              answer ? [answer] : []
            );
            const score = scoreExerciseSession(answers);
            const isFavorite = session.kind === "FAVORITE";
            const question = session.questions[0];
            const title = isFavorite
              ? (question?.questionVersion.statement ?? "Questão salva")
              : session.list.title;
            const reviewHref =
              isFavorite && question
                ? `/exercicios/favoritas/${encodeURIComponent(question.questionVersion.question.id)}?sessao=${encodeURIComponent(session.id)}`
                : `/exercicios/sessoes/${session.id}/resultado`;
            const date = session.completedAt ?? session.startedAt;

            return (
              <li
                className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b py-[18px] md:py-5"
                key={session.id}
              >
                <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
                  <p className="m-0 font-data text-[10.5px] text-muted-foreground uppercase leading-[1.3] tracking-[.1em]">
                    {dateFormatter.format(date)}
                    {isFavorite ? " · prática avulsa" : ""}
                  </p>
                  <Link
                    className="font-display font-semibold text-[17px] text-foreground leading-[1.3] no-underline hover:text-primary md:text-[19px]"
                    href={reviewHref}
                  >
                    {title}
                  </Link>
                  <p className="m-0 text-[13.5px] text-muted-foreground leading-[1.4]">
                    {score.correct} de {score.answered} corretas (
                    {score.percentage}%)
                  </p>
                </div>
                <div className="w-full md:w-[180px] md:flex-none">
                  <ExerciseProgress
                    className="m-0"
                    questions={session.questions}
                  />
                </div>
                <Button asChild className="h-11" variant="outline">
                  <Link href={reviewHref}>
                    {isFavorite ? "Rever resposta" : "Ver resultado"}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-6 max-w-[860px] border-foreground/80 border-t py-5 text-muted-foreground">
          Suas sessões concluídas aparecerão aqui.
        </p>
      )}

      {(history.hasPrevious || history.hasNext) && (
        <nav
          aria-label="Paginação do histórico"
          className="mt-6 flex max-w-[860px] flex-wrap justify-between gap-3"
        >
          {history.hasPrevious && history.previousCursor ? (
            <Button asChild className="h-11" variant="outline">
              <Link
                href={`/exercicios/historico?cursor=${encodeURIComponent(history.previousCursor)}&direcao=antes`}
              >
                ← Mais recentes
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {history.hasNext && history.nextCursor && (
            <Button asChild className="h-11" variant="outline">
              <Link
                href={`/exercicios/historico?cursor=${encodeURIComponent(history.nextCursor)}&direcao=depois`}
              >
                Mais antigas →
              </Link>
            </Button>
          )}
        </nav>
      )}
    </main>
  );
};

export default ExerciseHistoryPage;
