import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { BookOpenCheckIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { scoreExerciseSession } from "@/lib/exercise-engine";
import {
  getMemberExerciseHistory,
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

const sessionActionLabel = (status: string, hasUnansweredQuestion: boolean) => {
  if (status === "IN_PROGRESS" && hasUnansweredQuestion) {
    return "Retomar";
  }
  if (status === "COMPLETED") {
    return "Rever resultado";
  }
  return "Abrir sessão";
};

const ExercisesPage = async ({ searchParams }: ExercisesPageProperties) => {
  const [memberId, filters] = await Promise.all([
    requireMemberId(),
    searchParams,
  ]);
  const [lists, categories, history] = await Promise.all([
    getPublishedExerciseLists(filters.q, filters.categoria),
    getPublishedExerciseCategories(),
    getMemberExerciseHistory(memberId),
  ]);
  const recentSessions = history.slice(0, 6);

  return (
    <main className="mx-auto w-full max-w-[1360px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <header className="max-w-3xl">
        <p className="brand-eyebrow">Prática · revisão</p>
        <h1 className="mt-4 font-display text-5xl leading-none sm:text-6xl">
          Exercícios
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Resolva questões em listas, acompanhe suas tentativas e retome seu
          estudo entre dispositivos.
        </p>
      </header>

      <section aria-labelledby="exercise-search-title" className="mt-9">
        <h2 className="sr-only" id="exercise-search-title">
          Buscar e filtrar exercícios
        </h2>
        <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative" htmlFor="exercise-search-query">
            <span className="sr-only">Buscar listas e temas</span>
            <SearchIcon
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-9"
              defaultValue={filters.q}
              id="exercise-search-query"
              name="q"
              placeholder="Buscar listas, temas ou categorias"
            />
          </label>
          <label htmlFor="exercise-search-category">
            <span className="sr-only">Categoria</span>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:min-w-48"
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
          </label>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </section>

      {filters.estado === "lista-indisponivel" && (
        <p className="mt-5 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Esta lista não está publicada ou não possui questões disponíveis.
        </p>
      )}

      <section aria-labelledby="exercise-lists-title" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="brand-eyebrow">Acervo ativo</p>
            <h2
              className="mt-2 font-display text-3xl"
              id="exercise-lists-title"
            >
              Listas para praticar
            </h2>
          </div>
          <Link
            className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
            href="#historico"
          >
            Ver histórico recente
          </Link>
          <Link
            className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
            href="/exercicios/favoritas"
          >
            Questões salvas
          </Link>
        </div>
        {lists.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lists.map((list) => (
              <article
                className="flex min-h-64 flex-col overflow-hidden rounded-xl border bg-card"
                key={list.id}
              >
                <div
                  aria-hidden="true"
                  className="relative h-36 bg-muted"
                  style={
                    list.coverUrl
                      ? {
                          backgroundImage: `linear-gradient(0deg, rgb(16 19 18 / 55%), transparent), url("${list.coverUrl}")`,
                          backgroundPosition: "center",
                          backgroundSize: "cover",
                        }
                      : undefined
                  }
                >
                  {!list.coverUrl && (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <BookOpenCheckIcon
                        aria-hidden="true"
                        className="size-9"
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="brand-eyebrow">{list.bank.title}</p>
                  <h3 className="mt-2 font-display text-2xl leading-tight">
                    {list.title}
                  </h3>
                  <p className="mt-3 line-clamp-3 text-muted-foreground text-sm leading-6">
                    {list.description ||
                      "Uma lista de questões para sua revisão."}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                    <Badge variant="outline">
                      {list._count.items}{" "}
                      {list._count.items === 1 ? "questão" : "questões"}
                    </Badge>
                    <Button asChild size="sm">
                      <Link href={`/exercicios/listas/${list.slug}`}>
                        Abrir lista
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">
              Nenhuma lista publicada para este filtro.
            </p>
            <p className="mt-2 text-muted-foreground text-sm">
              Tente outro termo ou aguarde novas listas do professor.
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="history-title" className="mt-14" id="historico">
        <p className="brand-eyebrow">Seu percurso</p>
        <h2 className="mt-2 font-display text-3xl" id="history-title">
          Histórico recente
        </h2>
        {recentSessions.length ? (
          <div className="mt-5 divide-y rounded-xl border bg-card">
            {recentSessions.map((session) => {
              const score = scoreExerciseSession(
                session.questions.flatMap(({ answer }) =>
                  answer ? [answer] : []
                )
              );
              const firstUnanswered = session.questions.findIndex(
                ({ answer }) => !answer
              );
              const href = `/exercicios/sessoes/${session.id}`;
              return (
                <div
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  key={session.id}
                >
                  <div>
                    <p className="font-medium">{session.list.title}</p>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {score.answered} respondidas · {score.correct} corretas ·{" "}
                      {score.percentage}%
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={href}>
                      {sessionActionLabel(session.status, firstUnanswered >= 0)}
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-muted-foreground text-sm">
            Suas sessões concluídas e em andamento aparecerão aqui.
          </p>
        )}
      </section>
    </main>
  );
};

export default ExercisesPage;
