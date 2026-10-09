import { Badge } from "@repo/design-system/components/ui/badge";
import { tracePerformance } from "@repo/observability/performance";
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  FileTextIcon,
  Link2Icon,
  PlayCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { LibraryBookmarkButton } from "@/components/library/library-bookmark-button";
import { LibraryCover } from "@/components/library/library-cover";
import {
  ClearLibrarySearch,
  type LibraryFilterValues,
  LibraryPagination,
} from "@/components/library/library-experience";
import { getLibraryItems } from "@/lib/library";
import {
  libraryAccessLabel,
  libraryDifficultyLabel,
  libraryLanguageLabel,
} from "@/lib/library-presentation";

interface LibraryResultsProperties {
  readonly currentPage: number;
  readonly filters: LibraryFilterValues;
  readonly memberId: string;
}

const KIND_PRESENTATION = {
  ARTICLE: { icon: BookOpenIcon, label: "Artigo" },
  PDF: { icon: FileTextIcon, label: "PDF" },
  GUIDE: { icon: BookOpenIcon, label: "Guia" },
  LINK: { icon: Link2Icon, label: "Link" },
  VIDEO: { icon: PlayCircleIcon, label: "Vídeo" },
} as const;

const formatCount = (count: number) => {
  if (count === 0) {
    return "00 ITENS";
  }
  if (count === 1) {
    return "1 ITEM";
  }
  return `${count.toString().padStart(2, "0")} ITENS`;
};

const LibraryMaterialCard = ({
  item,
}: {
  readonly item: Awaited<ReturnType<typeof getLibraryItems>>["items"][number];
}) => {
  const presentation = KIND_PRESENTATION[item.kind];
  const Icon = presentation.icon;
  const source = [item.year, item.authors].filter(Boolean).join(" · ");

  return (
    <article className="flex min-w-0 gap-[14px] rounded-lg border border-[#E2D6D1] bg-white p-4 md:gap-5 md:p-5">
      <LibraryCover
        category={item.category}
        coverUrl={item.coverUrl}
        title={item.title}
      />
      <div className="flex min-h-[146px] min-w-0 flex-1 flex-col">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Badge className="h-6 shrink-0 gap-1.5 rounded border border-[#E2D6D1] bg-white px-2 font-semibold text-[#8C1535] text-xs">
              <Icon aria-hidden="true" className="size-[13px]" />
              {presentation.label}
            </Badge>
            {item.category && (
              <span className="min-w-0 break-words font-data text-[#7A5A69] text-[10px] uppercase leading-[1.5] tracking-[.08em]">
                {item.category}
              </span>
            )}
          </div>
          {source && (
            <p className="mt-2 text-[#7A5A69] text-xs leading-[1.45]">
              {source}
            </p>
          )}
          <h3 className="mt-1.5 break-words font-display font-semibold text-[#40222F] text-[18px] leading-[1.25] md:text-[19px]">
            <Link
              className="transition-colors hover:text-[#8C1535] focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2"
              href={`/biblioteca/${item.id}`}
              prefetch={false}
            >
              {item.title}
            </Link>
          </h3>
          {item.description && (
            <p className="mt-1.5 line-clamp-2 text-[#7A5A69] text-sm leading-[1.55]">
              {item.description}
            </p>
          )}
          <p className="mt-2 text-[#7A5A69] text-xs leading-[1.5]">
            {libraryLanguageLabel(item.language)} ·{" "}
            {libraryDifficultyLabel(item.difficulty)}
            {item.accessType ? ` · ${libraryAccessLabel(item.accessType)}` : ""}
          </p>
          {item.version && (
            <p className="mt-0.5 text-[#7A5A69] text-xs leading-[1.5]">
              {item.version}
            </p>
          )}
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.tags.slice(0, 3).map((tag) => (
                <Badge
                  className="h-6 rounded-sm border-0 bg-[#F1EBE8] px-2 font-data font-normal text-[#40222F] text-[10px]"
                  key={tag}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1.5">
          <a
            aria-label={`Abrir material: ${item.title}, em nova aba`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border-2 border-[#8C1535] bg-[#8C1535] px-4 font-semibold text-sm text-white transition-colors hover:bg-[#6f102b] focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2"
            href={`/biblioteca/abrir/${item.id}`}
            rel="noopener noreferrer"
            target="_blank"
            title="Abre em nova aba"
          >
            Abrir material
            <ArrowUpRightIcon aria-hidden="true" className="size-4" />
          </a>
          <LibraryBookmarkButton
            initialSaved={item.isBookmarked}
            targetId={item.id}
            targetType="LIBRARY_ITEM"
          />
        </div>
      </div>
    </article>
  );
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
  currentPage,
  filters,
  memberId,
}: LibraryResultsProperties) => {
  const result = await tracePerformance("member.route.library.items", () =>
    getLibraryItems({
      query: filters.q,
      kind: filters.kind,
      category: filters.category,
      language: filters.language,
      difficulty: filters.difficulty,
      page: currentPage,
      sort: filters.sort,
      memberId,
    })
  );

  return (
    <div data-route-content-ready="library">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h2
            className="font-display font-semibold text-2xl text-[#40222F] leading-tight md:text-[30px]"
            id="library-results-heading"
            tabIndex={-1}
          >
            Materiais para a mesa
          </h2>
          <span aria-hidden="true" className="brand-rule mt-2" />
        </div>
        <p
          aria-atomic="true"
          aria-live="polite"
          className="shrink-0 pb-1 font-data text-[#7A5A69] text-[11px] tracking-[.12em]"
        >
          {formatCount(result.totalCount)}
        </p>
      </header>
      <p className="mt-3 max-w-4xl text-[#7A5A69] text-[13px] leading-[1.6] md:text-sm">
        Relevância combina leitores únicos, aberturas repetidas e itens salvos;
        a busca desempata por correspondência textual.
      </p>
      {result.items.length === 0 ? (
        <EmptyLibraryResults />
      ) : (
        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] gap-4">
          {result.items.map((item) => (
            <LibraryMaterialCard item={item} key={item.id} />
          ))}
        </div>
      )}
      <LibraryPagination
        currentPage={result.page}
        filters={filters}
        hasMore={result.hasMore}
      />
    </div>
  );
};
