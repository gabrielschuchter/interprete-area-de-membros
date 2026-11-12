import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import {
  type ExerciseListState,
  exerciseListStateLabel,
  exerciseListStateProgress,
} from "@/lib/exercise-list-state";

interface ExerciseListCardList {
  readonly _count: { readonly items: number };
  readonly bank: { readonly title: string };
  readonly description: string | null;
  readonly slug: string;
  readonly title: string;
}

export const ExerciseListCard = ({
  list,
  state,
}: {
  readonly list: ExerciseListCardList;
  readonly state?: ExerciseListState;
}) => {
  const total = list._count.items;
  const progress = exerciseListStateProgress(state);
  const isCompleted = state?.kind === "completed";

  return (
    <article className="relative flex flex-col gap-2.5 rounded-lg border bg-card p-4 transition-colors focus-within:border-primary hover:border-primary">
      <p className="m-0 font-data font-medium text-[10.5px] text-muted-foreground uppercase leading-[1.4] tracking-[.08em]">
        {list.bank.title}
      </p>
      <h3 className="font-display text-lg leading-tight">
        <IntentLink
          className="text-foreground after:absolute after:inset-0 after:rounded-lg hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          href={`/exercicios/listas/${list.slug}`}
        >
          {list.title}
        </IntentLink>
      </h3>
      {list.description && (
        <p className="line-clamp-2 text-muted-foreground text-sm leading-[1.5]">
          {list.description}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-1.5 pt-1.5">
        <div
          aria-hidden="true"
          className="h-1 overflow-hidden rounded-sm bg-muted"
        >
          <div
            className={`h-full ${isCompleted ? "bg-success" : "bg-primary"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="m-0 flex justify-between text-[12.5px] text-muted-foreground">
          <span>
            {total} {total === 1 ? "questão" : "questões"}
          </span>
          <span className={isCompleted ? "font-medium text-success" : ""}>
            {exerciseListStateLabel(state)}
          </span>
        </p>
      </div>
    </article>
  );
};
