import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { ExerciseNotebookCover } from "@/components/exercises/exercise-notebook-cover";
import {
  type ExerciseListState,
  exerciseListStateLabel,
  exerciseListStateProgress,
} from "@/lib/exercise-list-state";

interface ExerciseListCardList {
  readonly _count: { readonly items: number };
  readonly bank: { readonly title: string };
  readonly coverUrl?: string | null;
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

  const kind = state?.kind ?? "new";
  const cta = {
    new: "Começar",
    "in-progress": "Continuar",
    completed: "Refazer",
  }[kind];

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-[translate,border-color] duration-200 focus-within:border-primary hover:-translate-y-[3px] hover:border-primary motion-reduce:transition-none">
      <ExerciseNotebookCover
        bankTitle={list.bank.title}
        coverUrl={list.coverUrl ?? null}
        listSlug={list.slug}
        state={kind}
        title={list.title}
      />
      <div className="flex flex-1 flex-col gap-1.5 px-4 pt-3 pb-3.5">
        <h3 className="font-display font-semibold text-[19px] leading-[1.2]">
          <IntentLink
            className="text-foreground after:absolute after:inset-0 after:rounded-lg hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            href={`/exercicios/listas/${list.slug}`}
          >
            {list.title}
          </IntentLink>
        </h3>
        {list.description && (
          <p className="line-clamp-2 text-[13.5px] text-muted-foreground leading-[1.45]">
            {list.description}
          </p>
        )}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <div
            aria-hidden="true"
            className="h-1 overflow-hidden rounded-sm bg-muted"
          >
            <div
              className={`h-full ${isCompleted ? "bg-success" : "bg-primary"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 flex flex-wrap items-baseline gap-x-2 font-data text-[12.5px] leading-tight">
              <span className={isCompleted ? "font-medium text-success" : ""}>
                {exerciseListStateLabel(state)}
              </span>
              <span className="text-muted-foreground">
                {total} {total === 1 ? "questão" : "questões"}
              </span>
            </p>
            <span
              aria-hidden="true"
              className="inline-flex min-h-9 items-center rounded-[4px] border border-primary px-3 font-medium text-primary text-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
            >
              {cta}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};
