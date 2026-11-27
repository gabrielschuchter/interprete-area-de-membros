import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { ExerciseListCover } from "@/components/exercises/exercise-list-cover";
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
  const isNew = !state || state.kind === "new";

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors focus-within:border-primary hover:border-primary">
      <div className="relative border-[#D9A86B]/60 border-b">
        <ExerciseListCover
          bankTitle={list.bank.title}
          className="h-[104px]"
          coverUrl={list.coverUrl ?? null}
          listSlug={list.slug}
          title={list.title}
        />
        {isNew && (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 rounded-[3px] bg-[#F7C873] px-1.5 py-0.5 font-data font-semibold text-[#410230] text-[10px] uppercase tracking-[.1em]"
          >
            Novo
          </span>
        )}
        {isCompleted && (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 rounded-[3px] bg-[#410230] px-1.5 py-0.5 font-data font-semibold text-[#E9C48E] text-[10px] uppercase tracking-[.1em]"
          >
            ◆ Concluída
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 border-l-[3px] border-l-primary p-4">
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
      </div>
    </article>
  );
};
