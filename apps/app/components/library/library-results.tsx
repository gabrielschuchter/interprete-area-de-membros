import { tracePerformance } from "@repo/observability/performance";
import {
  ClearLibrarySearch,
  type LibraryFilterValues,
  LibraryTitleTranslationToggle,
} from "@/components/library/library-experience";
import { LibraryShelves } from "@/components/library/library-shelves";
import { getLibraryShelfItems } from "@/lib/library";
import { groupLibraryShelves } from "@/lib/library-shelves";

interface LibraryResultsProperties {
  readonly filters: LibraryFilterValues;
  readonly memberId: string;
}

const formatCount = (count: number) => {
  if (count === 0) {
    return "00 ITENS";
  }
  if (count === 1) {
    return "1 ITEM";
  }
  return `${count.toString().padStart(2, "0")} ITENS`;
};

const EmptyLibraryResults = () => (
  <div className="mt-6 flex flex-col items-center gap-6 rounded-lg border border-[#E2D6D1] bg-white p-5 md:flex-row md:gap-10 md:p-10">
    {/* Decorative shelf art is an isolated static SVG document. */}
    {/* biome-ignore lint/performance/noImgElement: local SVG keeps the approved handoff viewBox. */}
    <img
      alt=""
      aria-hidden="true"
      className="h-[120px] w-[220px] shrink-0 object-contain"
      decoding="async"
      height={120}
      src="/library/illustrations/empty-bookshelf.svg"
      width={220}
    />
    <div className="min-w-0">
      <p className="font-data text-[#7A5A69] text-[10px] uppercase tracking-[.14em]">
        Nada encontrado
      </p>
      <h3 className="mt-2 font-display font-semibold text-2xl text-[#40222F] leading-tight md:text-[26px]">
        A curadoria ainda não encontrou esta combinação.
      </h3>
      <p className="mt-3 text-[#7A5A69] text-sm leading-6">
        Tente outro termo ou remova os filtros para voltar ao arquivo completo.
      </p>
      <ClearLibrarySearch />
    </div>
  </div>
);

export const LibraryResults = async ({
  filters,
  memberId,
}: LibraryResultsProperties) => {
  const items = await tracePerformance("member.route.library.items", () =>
    getLibraryShelfItems({
      query: filters.q,
      kind: filters.kind,
      category: filters.category,
      language: filters.language,
      difficulty: filters.difficulty,
      sort: filters.sort,
      memberId,
    })
  );
  const shelves = groupLibraryShelves(items);

  return (
    <div data-route-content-ready="library">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h2
            className="font-display font-semibold text-2xl text-[#40222F] leading-tight md:text-[30px]"
            id="library-results-heading"
            tabIndex={-1}
          >
            Estantes da biblioteca
          </h2>
          <span aria-hidden="true" className="brand-rule mt-2" />
        </div>
        <p
          aria-atomic="true"
          aria-live="polite"
          className="shrink-0 pb-1 font-data text-[#7A5A69] text-[11px] tracking-[.12em]"
        >
          {formatCount(items.length)}
        </p>
      </header>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="max-w-4xl text-[#7A5A69] text-[13px] leading-[1.6] md:text-sm">
          {filters.sort === "relevant"
            ? "Em cada estante, primeiro o que mais gente da turma abriu e salvou."
            : "Em cada estante, os materiais mais recentes aparecem primeiro. Toque num livro para ver os detalhes."}
        </p>
        <LibraryTitleTranslationToggle filters={filters} />
      </div>
      {shelves.length === 0 ? (
        <EmptyLibraryResults />
      ) : (
        <LibraryShelves
          shelves={shelves}
          translateTitles={filters.titulos === "pt"}
        />
      )}
    </div>
  );
};
