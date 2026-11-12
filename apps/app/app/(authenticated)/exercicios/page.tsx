import { Button } from "@repo/design-system/components/ui/button";
import {
  BookmarkIcon,
  ChevronRightIcon,
  HistoryIcon,
  PlayIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { ExerciseEmptyIllustration } from "@/components/exercises/exercise-empty-illustration";
import { ExerciseEyebrow } from "@/components/exercises/exercise-eyebrow";
import { ExerciseListCard } from "@/components/exercises/exercise-list-card";
import { ExerciseProgress } from "@/components/exercises/exercise-progress";
import { ExerciseSearchControls } from "@/components/exercises/exercise-search-controls";
import { scoreExerciseSession } from "@/lib/exercise-engine";
import { summarizeExerciseListStates } from "@/lib/exercise-list-state";
import {
  countMemberExerciseFavorites,
  getMemberExerciseHistory,
  getMemberExerciseListSessions,
  getMemberInProgressExerciseSessions,
  getPublishedExerciseCategories,
  getPublishedExerciseLists,
} from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";

interface ExercisesPageProperties {
  readonly searchParams: Promise<{
    readonly categoria?: string;
    readonly q?: string;
    readonly estado?: string;
  }>;
}

const historyDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

const scoreToneClass = (answered: number, percentage: number) => {
  if (answered === 0) {
    return "bg-muted text-muted-foreground";
  }
  if (percentage >= 70) {
    return "bg-success/10 text-success";
  }
  if (percentage >= 50) {
    return "bg-warning/10 text-warning";
  }
  return "bg-destructive/10 text-destructive";
};

const shortcutClass =
  "inline-flex h-9 items-center gap-2 rounded-full border bg-card px-3.5 text-foreground text-sm transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const ExercisesPage = async ({ searchParams }: ExercisesPageProperties) => {
  const [memberId, filters] = await Promise.all([
    requireMemberId(),
    searchParams,
  ]);
  const [lists, categories, inProgressSessions, history, favoritesCount] =
    await Promise.all([
      getPublishedExerciseLists(filters.q, filters.categoria),
      getPublishedExerciseCategories(),
      getMemberInProgressExerciseSessions(memberId),
      getMemberExerciseHistory(memberId),
      countMemberExerciseFavorites(memberId),
    ]);
  const listStates = summarizeExerciseListStates(
    await getMemberExerciseListSessions(
      memberId,
      lists.map(({ id }) => id)
    )
  );
  const query = filters.q?.trim() ?? "";
  const isFiltering = Boolean(query || filters.categoria);

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-5 pb-14 md:px-8 md:pt-8 md:pb-20 lg:px-12 lg:pt-12 lg:pb-[120px]">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex flex-col gap-3">
          <ExerciseEyebrow>Prática e revisão</ExerciseEyebrow>
          <h1 className="m-0 font-display text-[40px] leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Exercícios
          </h1>
        </div>
        <nav
          aria-label="Atalhos de exercícios"
          className="flex flex-wrap gap-2"
        >
          <Link className={shortcutClass} href="/exercicios/historico">
            <HistoryIcon aria-hidden="true" className="size-4" />
            Histórico
          </Link>
          <Link className={shortcutClass} href="/exercicios/favoritas">
            <BookmarkIcon aria-hidden="true" className="size-4" />
            Questões salvas
            {favoritesCount > 0 && (
              <span className="text-muted-foreground text-xs">
                {favoritesCount}
              </span>
            )}
          </Link>
        </nav>
      </header>

      {filters.estado === "lista-indisponivel" && (
        <p className="mt-5 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Esta lista não está publicada ou não possui questões disponíveis.
        </p>
      )}

      {inProgressSessions.length > 0 && (
        <section
          aria-labelledby="exercise-resume-title"
          className="mt-6 flex flex-col gap-3 md:mt-8"
        >
          <h2 className="sr-only" id="exercise-resume-title">
            Continue de onde parou
          </h2>
          {inProgressSessions.map((session) => {
            const answered = session.questions.filter(
              ({ answer }) => answer !== null
            ).length;

            return (
              <article
                className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-lg border border-l-[3px] border-l-primary bg-card p-4 md:px-5"
                key={session.id}
              >
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2">
                  <p className="m-0 font-data font-medium text-[10.5px] text-primary uppercase leading-[1.3] tracking-[.1em]">
                    Continue de onde parou
                  </p>
                  <h3 className="font-display text-xl leading-[1.25]">
                    {session.list.title}
                  </h3>
                  <ExerciseProgress
                    className="mt-0"
                    questions={session.questions}
                    showAnswerStatus={false}
                  />
                  <p className="m-0 text-[12.5px] text-muted-foreground">
                    {answered} de {session.questions.length} respondidas
                  </p>
                </div>
                <Button asChild className="h-11 w-full md:w-auto">
                  <IntentLink href={`/exercicios/sessoes/${session.id}`}>
                    <PlayIcon aria-hidden="true" className="size-4" />
                    Retomar
                  </IntentLink>
                </Button>
              </article>
            );
          })}
        </section>
      )}

      <section aria-labelledby="exercise-lists-title" className="mt-8 md:mt-10">
        <ExerciseSearchControls
          categories={categories}
          categorySlug={filters.categoria}
          query={query}
        />

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
          <h2
            className="font-display text-2xl leading-[1.25] tracking-[-0.005em] md:text-[28px]"
            id="exercise-lists-title"
          >
            {isFiltering ? "Resultados" : "Listas para praticar"}
          </h2>
          <p className="m-0 flex items-baseline gap-4 text-muted-foreground text-xs">
            {isFiltering && (
              <Link
                className="font-semibold text-brand-action-text text-sm hover:underline"
                href="/exercicios"
              >
                Limpar filtros
              </Link>
            )}
            <span className="font-mono uppercase tracking-widest">
              {lists.length} {lists.length === 1 ? "lista" : "listas"}
            </span>
          </p>
        </div>

        {lists.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] md:gap-4">
            {lists.map((list) => (
              <ExerciseListCard
                key={list.id}
                list={list}
                state={listStates.get(list.id)}
              />
            ))}
          </div>
        )}
        {!lists.length && isFiltering && (
          <div className="mt-6 flex max-w-[760px] flex-col items-center gap-5 rounded-lg border bg-card p-6 text-center md:flex-row md:p-8 md:text-left">
            <ExerciseEmptyIllustration />
            <div>
              <p className="brand-eyebrow">Nada encontrado</p>
              <h3 className="mt-2 font-display text-2xl">
                Nenhuma lista encontrada para esta busca.
              </h3>
              <p className="mt-2 text-muted-foreground text-sm leading-6">
                Tente outro termo ou escolha outra categoria para ver todas as
                listas.
              </p>
              <Button asChild className="mt-4" variant="outline">
                <Link href="/exercicios">Limpar busca</Link>
              </Button>
            </div>
          </div>
        )}
        {!(lists.length || isFiltering) && (
          <div className="mt-6 rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">Nenhuma lista publicada ainda.</p>
            <p className="mt-2 text-muted-foreground text-sm">
              Aguarde novas listas do professor.
            </p>
          </div>
        )}
      </section>

      <section
        aria-labelledby="history-title"
        className="mt-10 md:mt-12"
        id="historico"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
          <h2
            className="font-display text-2xl leading-[1.25] tracking-[-0.005em] md:text-[28px]"
            id="history-title"
          >
            Últimas sessões
          </h2>
          <Link
            className="inline-flex min-h-11 items-center font-semibold text-brand-action-text text-sm hover:underline"
            href="/exercicios/historico"
          >
            Ver tudo
          </Link>
        </div>
        {history.length ? (
          <ul className="m-0 mt-1 list-none border-foreground border-t p-0">
            {history.map((session) => {
              const score = scoreExerciseSession(
                session.questions.flatMap(({ answer }) =>
                  answer ? [answer] : []
                )
              );
              const question = session.questions[0];
              const isFavorite = session.kind === "FAVORITE";
              const title = isFavorite
                ? (question?.questionVersion?.statement ?? "Questão salva")
                : session.list.title;
              const href =
                isFavorite && question
                  ? `/exercicios/favoritas/${encodeURIComponent(question.questionVersion.question.id)}?sessao=${encodeURIComponent(session.id)}`
                  : `/exercicios/sessoes/${session.id}/resultado`;

              return (
                <li className="border-b" key={session.id}>
                  <Link
                    className="flex items-center gap-3 px-1 py-3.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:gap-4"
                    href={href}
                  >
                    <span className="w-14 shrink-0 font-mono text-muted-foreground text-xs uppercase">
                      {historyDateFormatter.format(
                        session.completedAt ?? session.startedAt
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="line-clamp-1 text-[15px] text-foreground">
                        {title}
                      </span>
                      {isFavorite && (
                        <span className="text-muted-foreground text-xs">
                          Questão salva · prática avulsa
                        </span>
                      )}
                    </span>
                    <span
                      className={`min-w-[52px] shrink-0 rounded-full px-2 py-1 text-center font-mono text-xs ${scoreToneClass(score.answered, score.percentage)}`}
                      title={`${score.correct} de ${score.answered} corretas`}
                    >
                      {score.answered === 0 ? "—" : `${score.percentage}%`}
                    </span>
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-[15px] text-muted-foreground leading-[1.6] md:mt-5">
            Suas sessões concluídas aparecerão aqui.
          </p>
        )}
      </section>
    </main>
  );
};

export default ExercisesPage;

export const metadata: Metadata = { title: "Exercícios | Interprete" };
