import { Button } from "@repo/design-system/components/ui/button";
import { LockKeyholeIcon } from "lucide-react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { startExerciseFavoriteSession } from "@/app/(authenticated)/exercicios/actions";
import type { MemberExerciseFavorite } from "@/lib/exercises";
import { ExerciseFavoriteControl } from "./exercise-favorite-control";

interface ExerciseFavoritesGridProperties {
  readonly items: readonly MemberExerciseFavorite[];
  readonly showHeader?: boolean;
  readonly totalCount?: number;
}

export const ExerciseFavoritesGrid = ({
  items,
  showHeader = true,
  totalCount = items.length,
}: ExerciseFavoritesGridProperties) => (
  <>
    {showHeader && (
      <div className="mt-6 flex items-center justify-between border-b pb-3 md:mt-8">
        <p className="font-semibold text-sm">Favoritas</p>
        <p className="font-data text-[12px] text-muted-foreground uppercase leading-none tracking-[.08em]">
          {totalCount} questões salvas
        </p>
      </div>
    )}
    <ul className="divide-y">
      {items.map((favorite) => {
        const question = favorite.question;
        const listItem = question.listItems[0];
        const list = listItem?.list;
        return (
          <li key={favorite.id}>
            <article className="py-5 md:py-6">
              <p className="brand-eyebrow">
                Questão {listItem ? listItem.position + 1 : "salva"} ·{" "}
                {list?.bank.title ?? "Lista indisponível"}
                {list ? ` | ${list.title}` : ""}
              </p>
              <h2 className="mt-3 whitespace-pre-wrap font-display font-semibold text-[18px] leading-[1.35] md:text-[21px]">
                <IntentLink
                  className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={`/exercicios/favoritas/${encodeURIComponent(question.id)}`}
                >
                  {question.versions[0]?.statement ??
                    "Esta questão não está mais disponível."}
                </IntentLink>
              </h2>
              <p className="mt-3 flex items-start gap-2 text-[12.5px] text-muted-foreground leading-[1.4]">
                <LockKeyholeIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                Gabarito e explicação aparecem depois que você responder.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <form action={startExerciseFavoriteSession}>
                  <input name="questionId" type="hidden" value={question.id} />
                  <Button className="h-11" disabled={!list} type="submit">
                    Responder
                  </Button>
                </form>
                <ExerciseFavoriteControl
                  className="h-11 px-2 text-sm"
                  initialBookmarked
                  questionId={question.id}
                />
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  </>
);
