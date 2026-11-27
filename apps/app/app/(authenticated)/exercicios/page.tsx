import { Button } from "@repo/design-system/components/ui/button";
import {
  BookmarkIcon,
  ChevronRightIcon,
  HistoryIcon,
  PlayIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
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

const historyDayFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const historyMonthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: "America/Sao_Paulo",
});

const ringColor = (answered: number, percentage: number) => {
  if (answered === 0) {
    return "#dcd0cf";
  }
  if (percentage >= 70) {
    return "var(--success, #2f7d4f)";
  }
  if (percentage >= 50) {
    return "#D9A86B";
  }
  return "#C8333F";
};

const SessionBubbles = ({
  questions,
}: {
  readonly questions: readonly { readonly answer: unknown }[];
}) => {
  const nextIndex = questions.findIndex(({ answer }) => answer === null);
  const answered = questions.filter(({ answer }) => answer !== null).length;
  return (
    <ol
      aria-label={`${answered} de ${questions.length} questões respondidas`}
      className="m-0 flex list-none flex-wrap gap-1.5 p-0"
    >
      {questions.map((question, index) => {
        let tone = "border-[#dcd0cf] bg-transparent text-muted-foreground";
        if (question.answer !== null) {
          tone = "border-primary bg-primary text-primary-foreground";
        } else if (index === nextIndex) {
          tone =
            "border-[#8C1535] bg-[#F7C873]/40 text-primary motion-safe:animate-pulse";
        }
        return (
          <li
            aria-hidden="true"
            className={`flex size-7 items-center justify-center rounded-full border font-data text-[11px] ${tone}`}
            // biome-ignore lint/suspicious/noArrayIndexKey: posições fixas da sessão
            key={index}
          >
            {index + 1}
          </li>
        );
      })}
    </ol>
  );
};

const shortcutClass =
  "inline-flex h-10 items-center gap-2 rounded-full border border-[#E9C48E]/50 bg-white/10 px-4 text-[#F7F3F1] text-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C873]";

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
  const compactHero = inProgressSessions.length >= 3;

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-5 pb-14 md:px-8 md:pt-8 md:pb-20 lg:px-12 lg:pt-12 lg:pb-[120px]">
      <header
        className={`relative overflow-hidden rounded-lg bg-[linear-gradient(120deg,#410230,#560A2A_55%,#7A1230)] text-[#F7F3F1] ${compactHero ? "p-5 md:p-6" : "p-6 md:p-10"}`}
      >
        <Image
          alt=""
          aria-hidden="true"
          className={`pointer-events-none absolute right-0 bottom-0 hidden h-full w-auto object-contain object-right-bottom opacity-95 md:block ${compactHero ? "max-h-[170px]" : ""}`}
          height={560}
          src="/exercises/hero-lousa.svg"
          unoptimized
          width={520}
        />
        <div className="relative flex max-w-[560px] flex-col gap-3">
          <ExerciseEyebrow>Prática e revisão</ExerciseEyebrow>
          <h1
            className={`m-0 font-display leading-[1.05] tracking-[-0.02em] ${compactHero ? "text-4xl" : "text-[40px] md:text-5xl"}`}
          >
            Exercícios
          </h1>
          {!compactHero && (
            <p className="m-0 max-w-[460px] text-[#F7F3F1]/80 text-[15px] leading-[1.6]">
              {inProgressSessions.length > 0
                ? "Retome a folha aberta ou escolha uma nova lista para praticar."
                : "Nenhuma folha aberta ainda. Escolha uma lista abaixo para começar a praticar."}
            </p>
          )}
          <nav
            aria-label="Atalhos de exercícios"
            className="mt-1 flex flex-wrap gap-2"
          >
            <Link className={shortcutClass} href="/exercicios/historico">
              <HistoryIcon aria-hidden="true" className="size-4" />
              Histórico
            </Link>
            <Link className={shortcutClass} href="/exercicios/favoritas">
              <BookmarkIcon aria-hidden="true" className="size-4" />
              Questões salvas
              {favoritesCount > 0 && (
                <span className="text-[#E9C48E] text-xs">{favoritesCount}</span>
              )}
            </Link>
          </nav>
        </div>
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
                className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-lg border border-l-[3px] border-l-primary bg-[repeating-linear-gradient(transparent,transparent_27px,#E2D6D1_28px)] bg-card p-4 md:px-5"
                key={session.id}
              >
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2">
                  <p className="m-0 font-data font-medium text-[10.5px] text-primary uppercase leading-[1.3] tracking-[.1em]">
                    Continue de onde parou
                  </p>
                  <h3 className="font-display text-xl leading-[1.25]">
                    {session.list.title}
                  </h3>
                  {session.questions.length > 30 ? (
                    <ExerciseProgress
                      className="mt-0"
                      questions={session.questions}
                      showAnswerStatus={false}
                    />
                  ) : (
                    <SessionBubbles questions={session.questions} />
                  )}
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
                    <span className="flex w-12 shrink-0 flex-col items-center rounded-[4px] border border-[#D9A86B]/70 bg-card py-1 font-data uppercase leading-none">
                      <span className="font-semibold text-base text-foreground">
                        {historyDayFormatter.format(
                          session.completedAt ?? session.startedAt
                        )}
                      </span>
                      <span className="mt-0.5 text-[10px] text-muted-foreground tracking-[.08em]">
                        {historyMonthFormatter
                          .format(session.completedAt ?? session.startedAt)
                          .replace(".", "")}
                      </span>
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
                      className="flex size-12 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(${ringColor(score.answered, score.percentage)} ${score.answered === 0 ? 0 : score.percentage}%, #E2D6D1 0)`,
                      }}
                      title={`${score.correct} de ${score.answered} corretas`}
                    >
                      <span className="flex size-[38px] items-center justify-center rounded-full bg-background font-data text-foreground text-xs">
                        {score.answered === 0 ? "—" : `${score.percentage}%`}
                      </span>
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
