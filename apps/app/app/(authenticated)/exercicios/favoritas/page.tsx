import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExerciseEmptyIllustration } from "@/components/exercises/exercise-empty-illustration";
import { ExerciseEyebrow } from "@/components/exercises/exercise-eyebrow";
import { ExerciseFavoritesGrid } from "@/components/exercises/exercise-favorites-grid";
import { getMemberExerciseFavorites } from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";

interface ExerciseFavoritesPageProperties {
  readonly searchParams: Promise<{
    readonly cursor?: string;
    readonly direcao?: string;
  }>;
}

const ExerciseFavoritesPage = async ({
  searchParams,
}: ExerciseFavoritesPageProperties) => {
  const [memberId, query] = await Promise.all([
    requireMemberId(),
    searchParams,
  ]);
  const direction = query.direcao === "antes" ? "before" : "after";
  const favorites = await getMemberExerciseFavorites(
    memberId,
    query.cursor,
    direction
  );
  let favoritesContent: ReactNode;

  if (favorites.items.length > 0) {
    favoritesContent = (
      <>
        <ExerciseFavoritesGrid
          items={favorites.items}
          totalCount={favorites.totalCount}
        />
        {(favorites.hasPrevious || favorites.hasNext) && (
          <nav
            aria-label="Paginação das questões salvas"
            className="mt-6 flex max-w-[820px] flex-wrap justify-between gap-3"
          >
            {favorites.hasPrevious && favorites.previousCursor ? (
              <Button asChild className="h-11" variant="outline">
                <Link
                  href={`/exercicios/favoritas?cursor=${encodeURIComponent(favorites.previousCursor)}&direcao=antes`}
                >
                  ← Mais recentes
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {favorites.hasNext && favorites.nextCursor && (
              <Button asChild className="h-11" variant="outline">
                <Link
                  href={`/exercicios/favoritas?cursor=${encodeURIComponent(favorites.nextCursor)}&direcao=depois`}
                >
                  Mais antigas →
                </Link>
              </Button>
            )}
          </nav>
        )}
      </>
    );
  } else if (favorites.totalCount > 0) {
    favoritesContent = (
      <section
        aria-live="polite"
        className="mt-6 flex max-w-[760px] flex-wrap items-center gap-x-10 gap-y-7 rounded-lg border bg-card p-6 md:mt-6 md:p-10"
      >
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
          <h2 className="m-0 font-display font-semibold text-2xl leading-[1.2] md:text-[28px]">
            Esta página da lista ficou desatualizada.
          </h2>
          <p className="m-0 text-[15px] text-muted-foreground leading-[1.6]">
            Algumas questões foram removidas dos favoritos. Volte às questões
            salvas mais recentes para continuar.
          </p>
          <Button asChild className="mt-1 h-12 w-fit px-6" variant="outline">
            <Link href="/exercicios/favoritas">Ver questões salvas</Link>
          </Button>
        </div>
      </section>
    );
  } else {
    favoritesContent = (
      <section className="mt-6 flex max-w-[760px] flex-wrap items-center gap-x-10 gap-y-7 rounded-lg border bg-card p-6 md:mt-6 md:p-10">
        <ExerciseEmptyIllustration />
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
          <h2 className="m-0 font-display font-semibold text-2xl leading-[1.2] md:text-[28px]">
            Você ainda não salvou questões.
          </h2>
          <p className="m-0 text-[15px] text-muted-foreground leading-[1.6]">
            Durante uma sessão, use “Salvar questão” para encontrá-la aqui.
          </p>
          <Button asChild className="mt-1 h-12 w-fit px-6">
            <Link href="/exercicios">Explorar listas</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-3 pb-14 md:px-8 md:pt-12 md:pb-[120px] lg:px-12">
      <div className="max-w-[820px]">
        <header className="flex flex-col gap-3.5">
          <Link
            className="hidden min-h-11 items-center gap-2 text-muted-foreground text-sm hover:text-foreground md:inline-flex"
            href="/exercicios"
          >
            <span aria-hidden="true">←</span> Exercícios
          </Link>
          <ExerciseEyebrow className="mt-0">
            Sua revisão pessoal
          </ExerciseEyebrow>
          <h1 className="m-0 font-display font-semibold text-4xl leading-[1.05] tracking-[-.02em] md:text-[52px]">
            Questões salvas
          </h1>
          <p className="m-0 max-w-[620px] text-[15px] text-muted-foreground leading-[1.6] md:text-base">
            Suas favoritas ficam sincronizadas com sua conta. O gabarito e a
            explicação continuam ocultos até você responder à questão.
          </p>
        </header>

        {favoritesContent}
      </div>
    </main>
  );
};

export default ExerciseFavoritesPage;
