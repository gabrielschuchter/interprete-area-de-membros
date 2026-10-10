import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { ExerciseEmptyIllustration } from "@/components/exercises/exercise-empty-illustration";
import { ExerciseEyebrow } from "@/components/exercises/exercise-eyebrow";
import { ExerciseListCover } from "@/components/exercises/exercise-list-cover";
import { ExerciseProgress } from "@/components/exercises/exercise-progress";
import { scoreExerciseSession } from "@/lib/exercise-engine";
import {
  getMemberExerciseHistory,
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
  year: "numeric",
});

const ExercisesPage = async ({ searchParams }: ExercisesPageProperties) => {
  const [memberId, filters] = await Promise.all([
    requireMemberId(),
    searchParams,
  ]);
  const [lists, categories, inProgressSessions, history] = await Promise.all([
    getPublishedExerciseLists(filters.q, filters.categoria),
    getPublishedExerciseCategories(),
    getMemberInProgressExerciseSessions(memberId),
    getMemberExerciseHistory(memberId),
  ]);
  const recentSessions = history;
  const selectedCategory = categories.find(
    ({ slug }) => slug === filters.categoria
  );
  const isFiltering = Boolean(filters.q?.trim() || filters.categoria);
  const categoryChipHref = filters.q?.trim()
    ? `/exercicios?q=${encodeURIComponent(filters.q.trim())}`
    : "/exercicios";

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-5 pb-14 md:px-8 md:pt-8 md:pb-20 lg:px-12 lg:pt-12 lg:pb-[120px]">
      <header className="flex max-w-[560px] flex-col gap-3 md:gap-3.5">
        <ExerciseEyebrow>Prática · Revisão</ExerciseEyebrow>
        <h1 className="m-0 font-display text-[40px] leading-[1.05] tracking-[-0.02em] md:text-5xl min-[1250px]:text-[3.5rem]">
          Exercícios
        </h1>
        <p className="m-0 text-[15px] text-muted-foreground leading-[1.6] md:text-base">
          Resolva questões em listas, acompanhe suas tentativas e retome seu
          estudo entre dispositivos.
        </p>
      </header>

      <section aria-labelledby="exercise-search-title" className="mt-5 md:mt-8">
        <h2 className="sr-only" id="exercise-search-title">
          Buscar e filtrar exercícios
        </h2>
        <search className="block">
          <form className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_100px] md:gap-3">
            <label className="relative" htmlFor="exercise-search-query">
              <span className="sr-only">Buscar listas e temas</span>
              <SearchIcon
                aria-hidden="true"
                className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="h-12 pl-10"
                defaultValue={filters.q}
                id="exercise-search-query"
                name="q"
                placeholder="Buscar listas, temas ou categorias"
              />
            </label>
            <div className="flex gap-2 md:contents">
              <label
                className="relative flex-[1_1_auto]"
                htmlFor="exercise-search-category"
              >
                <span className="sr-only">Categoria</span>
                <select
                  className={`h-12 w-full appearance-none rounded-md border bg-background py-0 pr-10 pl-3 text-sm ${filters.categoria ? "border-2 border-primary bg-primary/5" : "border-input"}`}
                  defaultValue={filters.categoria ?? ""}
                  id="exercise-search-category"
                  name="categoria"
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.title}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
              </label>
              <Button
                className="h-12 flex-[1_1_auto] md:flex-none"
                type="submit"
              >
                Buscar
              </Button>
            </div>
          </form>
        </search>
      </section>

      {filters.estado === "lista-indisponivel" && (
        <p className="mt-5 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Esta lista não está publicada ou não possui questões disponíveis.
        </p>
      )}

      {inProgressSessions.length > 0 && (
        <section
          aria-labelledby="exercise-resume-title"
          className="mt-10 md:mt-14"
        >
          <ExerciseEyebrow>Seu percurso</ExerciseEyebrow>
          <h2
            className="mt-2 font-display text-2xl leading-[1.25] tracking-[-0.005em] md:mt-[10px] md:text-[28px]"
            id="exercise-resume-title"
          >
            Continue de onde parou
          </h2>
          <div className="mt-5 flex flex-col gap-4">
            {inProgressSessions.map((session) => {
              const href = `/exercicios/sessoes/${session.id}`;

              return (
                <article
                  className="flex w-full max-w-none flex-col gap-3.5 rounded-lg border bg-card p-5 md:max-w-[610px] md:p-6"
                  key={session.id}
                >
                  <p className="m-0 font-data font-medium text-[10.5px] text-primary uppercase leading-[1.3] tracking-[.1em]">
                    Sessão em andamento
                  </p>
                  <h3 className="font-display text-xl leading-[1.25] md:text-2xl">
                    {session.list.title}
                  </h3>
                  <ExerciseProgress
                    captionPlacement="below"
                    className="mt-0"
                    questions={session.questions}
                    showAnswerStatus={false}
                  />
                  <div>
                    <Button
                      asChild
                      className="h-12 w-full md:w-auto"
                      size="default"
                    >
                      <IntentLink href={href}>Retomar tentativa</IntentLink>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section
        aria-labelledby="exercise-lists-title"
        className="mt-10 md:mt-12 min-[1250px]:mt-14"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
          <div className="flex flex-col gap-2 md:gap-[10px]">
            <ExerciseEyebrow>Acervo ativo</ExerciseEyebrow>
            <h2
              className="font-display text-2xl leading-[1.25] tracking-[-0.005em] md:text-[28px]"
              id="exercise-lists-title"
            >
              Listas para praticar
            </h2>
          </div>
          <nav
            aria-label="Atalhos de exercícios"
            className="flex flex-wrap gap-x-6 gap-y-4 font-semibold text-brand-action-text text-sm md:gap-y-2"
          >
            <Link
              className="inline-flex min-h-11 items-center hover:underline"
              href="/exercicios/historico"
            >
              Ver histórico recente
            </Link>
            <Link
              className="inline-flex min-h-11 items-center hover:underline"
              href="/exercicios/favoritas"
            >
              Questões salvas
            </Link>
          </nav>
        </div>
        {isFiltering && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {selectedCategory && (
              <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-primary bg-primary/5 px-3 text-primary text-sm">
                Categoria: {selectedCategory.title}
                <Link
                  aria-label={`Remover filtro ${selectedCategory.title}`}
                  className="grid size-7 place-items-center rounded-sm font-semibold hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={categoryChipHref}
                >
                  ×
                </Link>
              </span>
            )}
            {filters.q?.trim() && (
              <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm">
                Busca: {filters.q.trim()}
              </span>
            )}
            <Link
              className="px-2 font-semibold text-brand-action-text text-sm underline underline-offset-4"
              href="/exercicios"
            >
              Limpar filtros
            </Link>
          </div>
        )}
        {(filters.q?.trim() || filters.categoria) && lists.length > 0 && (
          <p className="mt-6 flex items-center justify-between border-b pb-3 text-sm">
            <span className="font-display font-semibold text-2xl">
              Resultados da busca
            </span>
            <span className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
              {lists.length} {lists.length === 1 ? "lista" : "listas"}
            </span>
          </p>
        )}
        {lists.length > 0 && (
          <div className="mt-3 flex flex-col gap-4 md:mt-6 md:grid md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] md:gap-5">
            {lists.map((list) => (
              <article
                className="flex flex-col overflow-hidden rounded-lg border bg-card"
                key={list.id}
              >
                <ExerciseListCover
                  bankTitle={list.bank.title}
                  className="h-[104px] sm:h-28"
                  coverUrl={list.coverUrl}
                  listSlug={list.slug}
                  title={list.title}
                />
                <div className="flex flex-1 flex-col gap-2.5 p-5">
                  <p className="m-0 font-data font-medium text-[10.5px] text-muted-foreground uppercase leading-[1.4] tracking-[.08em]">
                    {list.bank.title}
                  </p>
                  <h3 className="font-display text-xl leading-tight">
                    <IntentLink
                      className="text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      href={`/exercicios/listas/${list.slug}`}
                    >
                      {list.title}
                    </IntentLink>
                  </h3>
                  {list.description && (
                    <p className="line-clamp-3 text-muted-foreground text-sm leading-[1.55]">
                      {list.description}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2.5">
                    <Badge variant="outline">
                      {list._count.items}{" "}
                      {list._count.items === 1 ? "questão" : "questões"}
                    </Badge>
                    <Button asChild className="h-11" size="default">
                      <IntentLink href={`/exercicios/listas/${list.slug}`}>
                        Abrir lista
                      </IntentLink>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {!lists.length && isFiltering && (
          <div className="mt-7 flex max-w-[760px] flex-col items-center gap-5 rounded-lg border bg-card p-6 text-center md:flex-row md:p-8 md:text-left">
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
            <p className="font-medium">
              Nenhuma lista publicada para este filtro.
            </p>
            <p className="mt-2 text-muted-foreground text-sm">
              Aguarde novas listas do professor.
            </p>
          </div>
        )}
      </section>

      <section
        aria-labelledby="history-title"
        className="mt-10 md:mt-12 min-[1250px]:mt-14"
        id="historico"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
          <div className="flex flex-col gap-2 md:gap-[10px]">
            <ExerciseEyebrow>Seu percurso</ExerciseEyebrow>
            <h2
              className="font-display text-2xl leading-[1.25] tracking-[-0.005em] md:text-[28px]"
              id="history-title"
            >
              Histórico recente
            </h2>
          </div>
          <Link
            className="inline-flex min-h-11 items-center font-semibold text-brand-action-text text-sm hover:underline"
            href="/exercicios/historico"
          >
            Ver tudo
          </Link>
        </div>
        {recentSessions.length ? (
          <div className="mt-3 border-foreground border-t">
            {recentSessions.map((session) => {
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
                <div
                  className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b py-5"
                  key={session.id}
                >
                  <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
                    <p className="m-0 font-data font-medium text-[10.5px] text-muted-foreground uppercase leading-[1.3] tracking-[.1em]">
                      {historyDateFormatter.format(
                        session.completedAt ?? session.startedAt
                      )}
                    </p>
                    <Link
                      className="font-display font-semibold text-[19px] text-foreground leading-[1.3] hover:underline"
                      href={href}
                    >
                      {title}
                    </Link>
                    {isFavorite && (
                      <span className="font-data text-[10.5px] text-muted-foreground uppercase leading-[1.3] tracking-[.1em]">
                        Questão salva · prática avulsa
                      </span>
                    )}
                    <p className="m-0 text-[13.5px] text-muted-foreground leading-[1.4]">
                      {score.correct} de {score.answered} corretas (
                      {score.percentage}%)
                    </p>
                  </div>
                  <div className="w-[180px] max-w-full shrink-0">
                    <ExerciseProgress
                      className="mt-0"
                      questions={session.questions}
                    />
                  </div>
                  <Button asChild className="h-11 px-[22px]" variant="outline">
                    <Link href={href}>
                      {isFavorite ? "Rever resposta" : "Ver resultado"}
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
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
