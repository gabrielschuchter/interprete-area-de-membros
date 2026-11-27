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
  const answered = state?.kind === "in-progress" ? state.answered : 0;
  const cta = {
    new: "Começar",
    "in-progress": "Continuar",
    completed: "Refazer",
  }[kind];

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors focus-within:border-primary hover:border-primary">
      <ExerciseNotebookCover
        answered={answered}
        bankTitle={list.bank.title}
        coverUrl={list.coverUrl ?? null}
        listSlug={list.slug}
        state={kind}
        title={list.title}
        total={total}
      />
      <div className="flex flex-1 flex-col gap-2 px-[18px] pt-4 pb-[18px]">
        <p className="m-0 font-data font-medium text-[11px] text-muted-foreground uppercase leading-[1.4] tracking-[.16em]">
          {list.bank.title}
        </p>
        <h3 className="font-display font-semibold text-xl leading-[1.2]">
          <IntentLink
            className="text-foreground after:absolute after:inset-0 after:rounded-lg hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            href={`/exercicios/listas/${list.slug}`}
          >
            {list.title}
          </IntentLink>
        </h3>
        {list.description && (
          <p className="line-clamp-2 text-muted-foreground text-sm leading-[1.45]">
            {list.description}
          </p>
        )}
        <div className="mt-auto flex flex-col gap-2 pt-3">
          <div
            aria-hidden="true"
            className="h-1 overflow-hidden rounded-sm bg-muted"
          >
            <div
              className={`h-full ${isCompleted ? "bg-success" : "bg-primary"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-border border-t pt-3">
            <p className="m-0 flex flex-col font-data text-[13px] leading-tight">
              <span className={isCompleted ? "font-medium text-success" : ""}>
                {exerciseListStateLabel(state)}
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                {total} {total === 1 ? "questão" : "questões"}
              </span>
            </p>
            <span
              aria-hidden="true"
              className="inline-flex min-h-10 items-center rounded-[4px] border border-primary px-3.5 font-medium text-primary text-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
            >
              {cta}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};
