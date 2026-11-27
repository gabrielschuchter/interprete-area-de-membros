import { ChevronDownIcon } from "lucide-react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { ExerciseListBookmarkButton } from "@/components/exercises/exercise-list-bookmark-button";
import { ExerciseNotebookCover } from "@/components/exercises/exercise-notebook-cover";
import {
  type ExerciseListState,
  exerciseListStateLabel,
  exerciseListStateProgress,
} from "@/lib/exercise-list-state";
import { exerciseListTags } from "@/lib/exercise-list-tags";

interface ExerciseListCardList {
  readonly _count: { readonly items: number };
  readonly bank: { readonly title: string };
  readonly coverUrl?: string | null;
  readonly description: string | null;
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

const ExerciseListTopics = ({
  description,
}: {
  readonly description: string;
}) => {
  const tags = exerciseListTags(description);
  return (
    <details className="group/topics relative z-10 text-sm">
      <summary className="flex min-h-8 w-fit cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        Temas
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 transition-transform group-open/topics:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      {tags ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0 pt-1">
          {tags.map((tag) => (
            <li
              className="rounded-[4px] border bg-muted/50 px-2 py-0.5 text-muted-foreground text-xs"
              key={tag}
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : (
        <p className="pt-1 text-muted-foreground leading-[1.45]">
          {description}
        </p>
      )}
    </details>
  );
};

export const ExerciseListCard = ({
  list,
  saved = false,
  state,
  volume,
}: {
  readonly list: ExerciseListCardList;
  readonly saved?: boolean;
  readonly state?: ExerciseListState;
  readonly volume?: number;
}) => {
  const total = list._count.items;
  const progress = exerciseListStateProgress(state);
  const isCompleted = state?.kind === "completed";

  const questionsLabel = `${total} ${total === 1 ? "questão" : "questões"}`;
  // Em andamento já traz o total ("6 de 10"): basta acrescentar "questões".
  const countLabel =
    state?.kind === "in-progress" ? "questões" : questionsLabel;

  const kind = state?.kind ?? "new";
  const cta = {
    new: "Começar",
    "in-progress": "Continuar",
    completed: "Refazer",
  }[kind];

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-[translate,border-color] duration-200 focus-within:border-primary hover:-translate-y-[3px] hover:border-primary motion-reduce:transition-none">
      <ExerciseListBookmarkButton
        initialSaved={saved}
        listId={list.id}
        title={list.title}
      />
      <ExerciseNotebookCover
        bankTitle={list.bank.title}
        coverUrl={list.coverUrl ?? null}
        listSlug={list.slug}
        state={kind}
        title={list.title}
        volume={volume}
      />
      <div className="flex flex-1 flex-col gap-1.5 px-4 pt-3 pb-3.5">
        <h3 className="font-display font-semibold text-lg leading-[1.2]">
          <IntentLink
            className="text-foreground after:absolute after:inset-0 after:rounded-lg hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            href={`/exercicios/listas/${list.slug}`}
          >
            {list.title}
          </IntentLink>
        </h3>
        {list.description && (
          <ExerciseListTopics description={list.description} />
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
            <p className="m-0 flex flex-wrap items-baseline gap-x-2 font-data text-[13px] leading-tight">
              <span className={isCompleted ? "font-medium text-success" : ""}>
                {exerciseListStateLabel(state)}
              </span>
              <span className="text-muted-foreground">{countLabel}</span>
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
