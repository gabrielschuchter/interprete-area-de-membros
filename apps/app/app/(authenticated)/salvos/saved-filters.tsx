"use client";

import { useRouter } from "next/navigation";

export type SavedContentFilter =
  | "todos"
  | "aulas"
  | "materiais"
  | "questoes"
  | "comunidade";

const filters: readonly {
  readonly id: SavedContentFilter;
  readonly label: string;
}[] = [
  { id: "todos", label: "Todos" },
  { id: "aulas", label: "Aulas" },
  { id: "materiais", label: "Materiais" },
  { id: "questoes", label: "Questões" },
  { id: "comunidade", label: "Comunidade" },
];

interface SavedFiltersProperties {
  readonly counts: Readonly<Record<SavedContentFilter, number>>;
  readonly selected: SavedContentFilter;
}

export const SavedFilters = ({ counts, selected }: SavedFiltersProperties) => {
  const router = useRouter();

  const change = (nextFilter: SavedContentFilter) => {
    const query = new URLSearchParams();
    if (nextFilter !== "todos") {
      query.set("tipo", nextFilter);
    }
    const suffix = query.toString();
    router.push(`/salvos${suffix ? `?${suffix}` : ""}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-3 border-[#E2D6D1] border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
      <nav
        aria-label="Filtrar salvos por tipo"
        className="hidden flex-wrap gap-2 sm:flex"
      >
        {filters.map((filter) => {
          const active = selected === filter.id;
          return (
            <button
              aria-label={`${filter.label} ${counts[filter.id]}`}
              aria-pressed={active}
              className={
                active
                  ? "inline-flex min-h-10 items-center gap-2 rounded-md border border-[#8C1535] bg-[#F1EBE8] px-4 font-semibold text-[#8C1535] text-sm"
                  : "inline-flex min-h-10 items-center gap-2 rounded-md border border-[#E2D6D1] bg-white px-4 text-[#40222F] text-sm hover:bg-[#F8F3F1]"
              }
              key={filter.id}
              onClick={() => change(filter.id)}
              type="button"
            >
              {filter.label}
              <span className="font-data text-xs">{counts[filter.id]}</span>
            </button>
          );
        })}
      </nav>

      <label className="flex min-h-11 flex-col gap-1 sm:hidden">
        <span className="sr-only">Tipo de conteúdo salvo</span>
        <select
          aria-label="Tipo de conteúdo salvo"
          className="h-11 w-full rounded-md border border-[#E2D6D1] bg-white px-3 text-[#40222F] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C1535]"
          onChange={(event) => change(event.target.value as SavedContentFilter)}
          value={selected}
        >
          {filters.map((filter) => (
            <option key={filter.id} value={filter.id}>
              {filter.label} ({counts[filter.id]})
            </option>
          ))}
        </select>
      </label>

      <label className="hidden min-h-11 items-center gap-2 text-[#7A5A69] text-sm sm:flex">
        <select
          aria-label="Ordenar salvos"
          className="h-10 w-full min-w-44 rounded-md border border-[#E2D6D1] bg-white px-3 text-[#40222F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C1535] disabled:cursor-default disabled:opacity-100 sm:w-auto"
          disabled
          value="recentes"
        >
          <option value="recentes">Mais recentes</option>
        </select>
      </label>
    </div>
  );
};
