import { ExerciseListCover } from "./exercise-list-cover";

/** Capa do card: a capa da coleção com a fita de progresso e os selos por cima. */
export const ExerciseNotebookCover = ({
  answered,
  bankTitle,
  coverUrl,
  listSlug,
  state,
  title,
  total,
}: {
  readonly answered: number;
  readonly bankTitle: string;
  readonly coverUrl: string | null;
  readonly listSlug: string;
  readonly state: "new" | "in-progress" | "completed";
  readonly title: string;
  readonly total: number;
}) => {
  const ribbon = 26 + Math.round((answered / Math.max(total, 1)) * 40);

  return (
    <span className="relative block overflow-hidden">
      <ExerciseListCover
        bankTitle={bankTitle}
        coverUrl={coverUrl}
        listSlug={listSlug}
        title={title}
      />
      {state === "in-progress" && (
        <span
          aria-hidden="true"
          className="absolute top-0 right-3 w-4 bg-[#C8333F] [clip-path:polygon(0_0,100%_0,100%_100%,50%_80%,0_100%)]"
          style={{ height: `${ribbon}%` }}
        />
      )}
      {state === "new" && (
        <span
          aria-hidden="true"
          className="absolute top-2.5 right-5 rotate-[8deg] border-2 border-[#F7C873] bg-[#1a0612]/45 px-2 py-0.5 font-data text-[#F7C873] text-[10px] tracking-[.2em]"
        >
          NOVO
        </span>
      )}
      {state === "completed" && (
        <span
          aria-hidden="true"
          className="absolute top-2.5 right-5 rotate-[8deg] border-2 border-[#F7C873] bg-[#1a0612]/60 px-2 py-0.5 font-data text-[#F7C873] text-[10px] tracking-[.15em]"
        >
          ◆ CONCLUÍDA
        </span>
      )}
    </span>
  );
};
