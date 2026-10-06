import Link from "next/link";
import { ExerciseFavoritesGrid } from "@/components/exercises/exercise-favorites-grid";
import { getMemberExerciseFavorites } from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";

const ExerciseFavoritesPage = async () => {
  const memberId = await requireMemberId();
  const favorites = await getMemberExerciseFavorites(memberId);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
        href="/exercicios"
      >
        ← Exercícios
      </Link>
      <header className="mt-8 max-w-3xl">
        <p className="brand-eyebrow">Sua revisão pessoal</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">
          Questões salvas
        </h1>
        <p className="mt-4 text-muted-foreground leading-7">
          Suas favoritas ficam sincronizadas com sua conta. O gabarito e a
          explicação continuam ocultos até você responder à questão.
        </p>
      </header>

      {favorites.length > 0 ? (
        <ExerciseFavoritesGrid items={favorites} />
      ) : (
        <div className="mt-8 rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">Você ainda não salvou questões.</p>
          <p className="mt-2 text-muted-foreground text-sm">
            Durante uma sessão, use “Salvar questão” para encontrá-la aqui.
          </p>
        </div>
      )}
    </main>
  );
};

export default ExerciseFavoritesPage;
