import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { LibraryHero } from "@/components/library/library-hero";
import { LibraryResultsSkeleton } from "@/components/library/library-results-skeleton";

const FILTER_FIELDS = [
  "Categoria",
  "Tipo",
  "Idioma",
  "Nível",
  "Ordenação",
] as const;

const LibraryLoading = () => (
  <main
    className="mx-auto min-h-full w-full max-w-[1080px] px-5 pt-4 pb-12 md:px-8 md:pt-8 md:pb-16 lg:px-12 lg:pt-10"
    data-route-loading
  >
    <LibraryHero />

    <div
      aria-hidden="true"
      className="mt-3 border-0 bg-transparent p-0 md:mt-8 md:rounded-lg md:border md:border-[#E2D6D1] md:bg-white md:p-5"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 md:gap-3">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <span className="hidden font-medium text-[#7A5A69] text-xs md:block">
            Buscar materiais
          </span>
          <Skeleton className="h-12 w-full border border-[#E2D6D1] bg-white" />
        </div>
        <Skeleton className="h-12 w-28 bg-white md:hidden" />
        <Skeleton className="hidden h-12 w-[88px] bg-[#E2D6D1] md:block" />
      </div>
      <div className="mt-3 hidden gap-3 md:grid md:grid-cols-[repeat(auto-fit,minmax(145px,1fr))] min-[1250px]:grid-cols-5">
        {FILTER_FIELDS.map((label) => (
          <div className="grid min-w-0 gap-1.5" key={label}>
            <span className="font-medium text-[#7A5A69] text-xs">{label}</span>
            <Skeleton className="h-12 w-full border border-[#E2D6D1] bg-white" />
          </div>
        ))}
      </div>
    </div>

    <section
      aria-label="Carregando resultados da Biblioteca"
      className="mt-10 scroll-mt-24 md:mt-14"
    >
      <header className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-[#40222F] leading-tight md:text-[30px]">
            Materiais para a mesa
          </h2>
          <span aria-hidden="true" className="brand-rule mt-2" />
        </div>
        <Skeleton className="mb-1 h-3 w-16 bg-[#E2D6D1]" />
      </header>
      <p className="mt-3 max-w-4xl text-[#7A5A69] text-[13px] leading-[1.6] md:text-sm">
        Relevância combina leitores únicos, aberturas repetidas e itens salvos;
        a busca desempata por correspondência textual.
      </p>
      <LibraryResultsSkeleton />
    </section>
  </main>
);

export default LibraryLoading;
