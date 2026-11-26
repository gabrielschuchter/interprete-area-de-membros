import { cn } from "@repo/design-system/lib/utils";
import {
  type CountGoalKind,
  countGoalUnit,
  type KindCounts,
} from "@/lib/study-count-goals-model";

const MONO = "font-data";

export interface WeekProgressProps {
  readonly counts: KindCounts;
  readonly history: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
  }>;
  readonly minutes: number;
  readonly targetMinutes: number | null;
}

interface Tile {
  readonly detail: string;
  readonly label: string;
  readonly unit: string;
  readonly value: string;
}

const countTile = (
  kind: CountGoalKind,
  label: string,
  counts: KindCounts,
  detail: string
): Tile => ({
  detail,
  label,
  unit: countGoalUnit(kind, counts[kind]),
  value: counts[kind].toLocaleString("pt-BR"),
});

export const buildWeekTiles = ({
  counts,
  minutes,
  targetMinutes,
}: Pick<WeekProgressProps, "counts" | "minutes" | "targetMinutes">): Tile[] => [
  {
    label: "Tempo",
    value: minutes.toLocaleString("pt-BR"),
    unit: targetMinutes
      ? `de ${targetMinutes.toLocaleString("pt-BR")} min`
      : "min",
    detail:
      "Vídeo tocando, tempo nas telas de estudo, cronômetro e lançamentos.",
  },
  countTile(
    "LESSONS",
    "Aulas",
    counts,
    "Concluídas ou estudadas por pelo menos 1 min."
  ),
  countTile(
    "READINGS",
    "Leituras",
    counts,
    "Itens da biblioteca com cronômetro de leitura ou 1 min na tela."
  ),
  countTile(
    "EXERCISES",
    "Exercícios",
    counts,
    "Cada questão respondida, mesmo que rápido."
  ),
];

export const WeekProgress = (props: WeekProgressProps) => {
  const tiles = buildWeekTiles(props);
  return (
    <section
      aria-labelledby="week-progress-heading"
      className="mt-6 rounded-lg border border-[#E2D6D1] bg-[#F7F3F1] p-5 sm:p-6"
      data-week-progress
    >
      <p
        className={cn(
          MONO,
          "text-[#7D5A6C] text-[11px] uppercase tracking-[.2em]"
        )}
      >
        Progresso registrado
      </p>
      <h2
        className="mt-2 font-display font-semibold text-2xl text-[#2A0A1A]"
        id="week-progress-heading"
      >
        Esta semana
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            className="flex flex-col gap-1 rounded-md border border-[#E2D6D1] bg-[#FBF8F5] p-4"
            key={tile.label}
          >
            <span className="text-[#7D5A6C] text-sm">{tile.label}</span>
            <span className="font-display font-semibold text-3xl text-[#2A0A1A]">
              {tile.value}{" "}
              <span className="font-normal text-[#7D5A6C] text-sm">
                {tile.unit}
              </span>
            </span>
            <span className="text-[#7D5A6C] text-xs leading-snug">
              {tile.detail}
            </span>
          </div>
        ))}
      </div>
      {props.history.length > 0 ? (
        <p className="mt-4 text-[#7D5A6C] text-xs">
          Histórico total:{" "}
          {props.history
            .map((item) => `${item.count} ${item.label}`)
            .join(" · ")}
          .
        </p>
      ) : null}
    </section>
  );
};
