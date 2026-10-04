import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { getMemberExerciseFavorites } from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";
import { toggleExerciseFavorite } from "../actions";

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

      {favorites.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {favorites.map((favorite) => {
            const question = favorite.question;
            const list = question.listItems[0]?.list;
            return (
              <article
                className="flex flex-col rounded-xl border bg-card p-5 sm:p-6"
                key={favorite.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {question.category && (
                    <Badge variant="outline">{question.category.title}</Badge>
                  )}
                  <Badge variant="secondary">
                    {question.type === "MULTIPLE_CHOICE"
                      ? "Múltipla escolha"
                      : "Escolha única"}
                  </Badge>
                </div>
                <p className="mt-4 whitespace-pre-wrap font-display text-xl leading-relaxed">
                  {question.versions[0]?.statement ??
                    "Esta questão não está mais disponível."}
                </p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
                  <span className="text-muted-foreground text-sm">
                    {list ? `Lista: ${list.title}` : "Lista indisponível"}
                  </span>
                  <div className="flex items-center gap-2">
                    {list && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/exercicios/listas/${list.slug}`}>
                          Praticar
                        </Link>
                      </Button>
                    )}
                    <form action={toggleExerciseFavorite}>
                      <input name="action" type="hidden" value="remove" />
                      <input
                        name="questionId"
                        type="hidden"
                        value={question.id}
                      />
                      <Button size="sm" type="submit" variant="ghost">
                        Remover
                      </Button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
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
