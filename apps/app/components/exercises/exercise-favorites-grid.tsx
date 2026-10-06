import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { toggleExerciseFavorite } from "@/app/(authenticated)/exercicios/actions";
import type { MemberExerciseFavorite } from "@/lib/exercises";

interface ExerciseFavoritesGridProperties {
  readonly items: readonly MemberExerciseFavorite[];
}

export const ExerciseFavoritesGrid = ({
  items,
}: ExerciseFavoritesGridProperties) => (
  <ul className="mt-8 grid gap-4 md:grid-cols-2">
    {items.map((favorite) => {
      const question = favorite.question;
      const list = question.listItems[0]?.list;
      return (
        <li key={favorite.id}>
          <article className="flex h-full flex-col rounded-xl border bg-card p-5 sm:p-6">
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
                  <input name="questionId" type="hidden" value={question.id} />
                  <Button size="sm" type="submit" variant="ghost">
                    Remover
                  </Button>
                </form>
              </div>
            </div>
          </article>
        </li>
      );
    })}
  </ul>
);
