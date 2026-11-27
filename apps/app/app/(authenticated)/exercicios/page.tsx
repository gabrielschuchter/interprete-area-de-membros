import { Button } from "@repo/design-system/components/ui/button";
import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { ExerciseEmptyIllustration } from "@/components/exercises/exercise-empty-illustration";
import { ExercisesHero } from "@/components/exercises/exercise-hero";
import { ExerciseListCard } from "@/components/exercises/exercise-list-card";
import { ExerciseProgress } from "@/components/exercises/exercise-progress";
import { ExerciseSearchControls } from "@/components/exercises/exercise-search-controls";
import { ExerciseSheetsRail } from "@/components/exercises/exercise-sheets-rail";
import { scoreExerciseSession } from "@/lib/exercise-engine";
import { summarizeExerciseListStates } from "@/lib/exercise-list-state";
import {
  countMemberExerciseFavorites,
  getExerciseListVolumes,
  getMemberBookmarkedExerciseListIds,
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
    readonly salvas?: string;
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
      className="m-0 flex list-none flex-wrap gap-2 p-0"
    >
      {questions.map((question, index) => {
        let tone = "border-[#a68f99] bg-card text-primary";
        if (question.answer !== null) {
          tone = "border-primary bg-primary text-[#F1EBE8]";
        } else if (index === nextIndex) {
          tone = "exercise-next-bubble border-[#D9A86B] bg-card text-primary";
        }
        return (
          <li
            aria-hidden="true"
            className={`box-border flex size-7 items-center justify-center rounded-full border-[1.5px] font-data text-[11px] ${tone}`}
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

const ExercisesPage = async ({ searchParams }: ExercisesPageProperties) => {
  const [memberId, filters] = await Promise.all([
    requireMemberId(),
    searchParams,
  ]);
  const [
    allLists,
    categories,
    inProgressSessions,
    history,
    favoritesCount,
    savedListIds,
    listVolumes,
  ] = await Promise.all([
    getPublishedExerciseLists(filters.q, filters.categoria),
    getPublishedExerciseCategories(),
    getMemberInProgressExerciseSessions(memberId),
    getMemberExerciseHistory(memberId),
    countMemberExerciseFavorites(memberId),
    getMemberBookmarkedExerciseListIds(memberId),
    getExerciseListVolumes(),
  ]);
  const savedOnly = filters.salvas === "1";
  const lists = savedOnly
    ? allLists.filter(({ id }) => savedListIds.has(id))
    : allLists;
  const listStates = summarizeExerciseListStates(
    await getMemberExerciseListSessions(
      memberId,
      lists.map(({ id }) => id)
    )
  );
  const query = filters.q?.trim() ?? "";
  const isFiltering = Boolean(query || filters.categoria || savedOnly);
  const emptyTitle =
    savedOnly && !query
      ? "Você ainda não salvou nenhuma lista."
      : "Nenhuma lista encontrada para esta busca.";
  const emptyHint =
    savedOnly && !query
      ? "Toque no marcador de uma lista para guardá-la aqui."
      : "Tente outro termo ou escolha outra categoria para ver todas as listas.";
  const firstSession = inProgressSessions[0];

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-5 pb-24 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12">
      <ExercisesHero
        favoritesCount={favoritesCount}
        firstSession={firstSession}
        sessionCount={inProgressSessions.length}
      />

      {filters.estado === "lista-indisponivel" && (
        <p className="mt-5 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Esta lista não está publicada ou não possui questões disponíveis.
        </p>
      )}

      {inProgressSessions.length > 0 && (
        <section
          aria-labelledby="exercise-resume-title"
          className="mt-10 flex flex-col gap-4 md:mt-14"
        >
          <div
            aria-hidden="true"
            className="flex items-center gap-3 font-data text-[11px] text-muted-foreground tracking-[.2em]"
          >
            NA CARTEIRA
            <span className="h-px flex-1 bg-border" />
          </div>
          <h2
            className="m-0 font-display font-semibold text-2xl leading-[1.2] tracking-[-.01em]"
            id="exercise-resume-title"
          >
            Continue de onde parou
          </h2>
          <ExerciseSheetsRail label="folhas em andamento">
            {inProgressSessions.map((session, index) => {
              const answered = session.questions.filter(
                ({ answer }) => answer !== null
              ).length;
              const next = Math.min(answered + 1, session.questions.length);

              return (
                <article
                  className="group/sheet relative flex min-h-[244px] flex-1 rotate-[var(--tilt)] flex-col gap-3 rounded-[4px] border bg-[repeating-linear-gradient(180deg,transparent_0_27px,#ece2df_27px_28px)] bg-card py-5 pr-5 pl-[46px] transition-[translate,rotate,border-color] duration-200 ease-[cubic-bezier(.2,0,0,1)] focus-within:-translate-y-2 focus-within:rotate-0 focus-within:border-primary hover:-translate-y-2 hover:rotate-0 hover:border-primary motion-reduce:transition-none md:py-[22px]"
                  key={session.id}
                  style={
                    {
                      "--tilt": index % 2 === 0 ? "-1.2deg" : "1deg",
                    } as CSSProperties
                  }
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-[30px] w-px bg-[#E2565A]"
                  />
                  {session.list.bank?.title && (
                    <p className="m-0 font-data text-[#8C1535] text-[11px] uppercase tracking-[.2em]">
                      {session.list.bank.title}
                    </p>
                  )}
                  <h3 className="font-display font-semibold text-xl leading-[1.2]">
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
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
                    <p className="m-0 font-data text-[13px] text-muted-foreground">
                      {answered} de {session.questions.length} respondidas
                    </p>
                    <Button asChild className="h-11 rounded-[4px]">
                      <IntentLink href={`/exercicios/sessoes/${session.id}`}>
                        Retomar na questão {next}{" "}
                        <span
                          aria-hidden="true"
                          className="transition-transform group-hover/sheet:translate-x-0.5"
                        >
                          →
                        </span>
                      </IntentLink>
                    </Button>
                  </div>
                </article>
              );
            })}
          </ExerciseSheetsRail>
        </section>
      )}

      <section
        aria-labelledby="exercise-lists-title"
        className="mt-10 scroll-mt-20 md:mt-14"
        id="listas"
      >
        <ExerciseSearchControls
          categories={categories}
          categorySlug={filters.categoria}
          heading={
            <div className="flex flex-col gap-2">
              <p className="m-0 font-data text-[11px] text-muted-foreground uppercase tracking-[.2em]">
                {lists.length} {lists.length === 1 ? "lista" : "listas"}
              </p>
              <h2
                className="font-display font-semibold text-2xl leading-[1.2] tracking-[-.01em]"
                id="exercise-lists-title"
              >
                Escolha um caderno
              </h2>
            </div>
          }
          query={query}
          savedCount={savedListIds.size}
          savedOnly={savedOnly}
        />

        {lists.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:gap-5">
            {lists.map((list) => (
              <ExerciseListCard
                key={list.id}
                list={list}
                saved={savedListIds.has(list.id)}
                state={listStates.get(list.id)}
                volume={listVolumes.get(list.slug)}
              />
            ))}
          </div>
        )}
        {!lists.length && isFiltering && (
          <div className="mt-6 flex max-w-[760px] flex-col items-center gap-5 rounded-lg border bg-card p-6 text-center md:flex-row md:p-8 md:text-left">
            <ExerciseEmptyIllustration />
            <div>
              <p className="brand-eyebrow">Nada encontrado</p>
              <h3 className="mt-2 font-display font-semibold text-2xl leading-[1.2] tracking-[-.01em]">
                {emptyTitle}
              </h3>
              <p className="mt-2 text-muted-foreground text-sm leading-6">
                {emptyHint}
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
        className="mt-10 md:mt-14"
        id="historico"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
          <h2
            className="font-display font-semibold text-2xl leading-[1.2] tracking-[-.01em]"
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
                      <span className="mt-0.5 text-[11px] text-muted-foreground tracking-[.08em]">
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
