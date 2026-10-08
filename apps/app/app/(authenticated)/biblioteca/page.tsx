import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { tracePerformance } from "@repo/observability/performance";
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  FileTextIcon,
  LinkIcon,
  SearchIcon,
} from "lucide-react";
import { Suspense } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { Stagger } from "@/components/motion/motion";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { FilterForm } from "@/components/navigation/filter-form";
import { requireMemberId } from "@/lib/learning";
import { getLibraryCategories, getLibraryItems } from "@/lib/library";
import {
  libraryAccessLabel,
  libraryDifficultyLabel,
  libraryLanguageLabel,
} from "@/lib/library-presentation";
import { openLibraryItem, toggleLibraryBookmark } from "./actions";

interface LibraryPageProperties {
  readonly searchParams: Promise<{
    q?: string;
    kind?: string;
    category?: string;
    language?: string;
    difficulty?: string;
    page?: string;
    sort?: "recent" | "relevant";
  }>;
}

type LibraryFilters = Awaited<LibraryPageProperties["searchParams"]>;

const LibraryCategoryField = async ({
  selectedCategory,
}: {
  readonly selectedCategory?: string;
}) => {
  const categories = await getLibraryCategories();

  return (
    <div className="grid min-w-0 gap-1.5 sm:col-span-2 lg:col-span-3 xl:col-span-4">
      <label
        className="font-medium text-muted-foreground text-xs"
        htmlFor="library-category"
      >
        Categoria
      </label>
      <select
        className="h-11 w-full min-w-0 rounded-sm border bg-transparent px-3 text-sm"
        defaultValue={selectedCategory ?? ""}
        id="library-category"
        name="category"
      >
        <option value="">Todas as categorias</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </div>
  );
};

const LibraryCategoryFallback = ({
  selectedCategory,
}: {
  readonly selectedCategory?: string;
}) => (
  <div className="grid min-w-0 gap-1.5 sm:col-span-2 lg:col-span-3 xl:col-span-4">
    <span className="font-medium text-muted-foreground text-xs">Categoria</span>
    <select
      aria-label="Categoria"
      className="h-11 w-full min-w-0 rounded-sm border bg-transparent px-3 text-sm"
      defaultValue={selectedCategory ?? ""}
      name="category"
    >
      <option value="">Todas as categorias</option>
      {selectedCategory ? (
        <option value={selectedCategory}>{selectedCategory}</option>
      ) : null}
    </select>
  </div>
);

const LibraryItemsSection = async ({
  currentPage,
  filters,
  memberId,
}: {
  readonly currentPage: number;
  readonly filters: LibraryFilters;
  readonly memberId: string;
}) => {
  const { items, hasMore, page } = await tracePerformance(
    "member.route.library.items",
    () =>
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
  const queryString = new URLSearchParams();
  if (filters.q) {
    queryString.set("q", filters.q);
  }
  if (filters.kind) {
    queryString.set("kind", filters.kind);
  }
  if (filters.category) {
    queryString.set("category", filters.category);
  }
  if (filters.language) {
    queryString.set("language", filters.language);
  }
  if (filters.difficulty) {
    queryString.set("difficulty", filters.difficulty);
  }
  if (filters.sort) {
    queryString.set("sort", filters.sort);
  }
  const pageHref = (targetPage: number) => {
    const nextQuery = new URLSearchParams(queryString);
    nextQuery.set("page", String(targetPage));
    return `/biblioteca?${nextQuery.toString()}`;
  };

  return (
    <div data-route-content-ready="library">
      <div className="flex items-end justify-between border-border border-b pb-3">
        <span className="font-data text-muted-foreground text-xs">
          {items.length.toString().padStart(2, "0")} itens
        </span>
      </div>
      {items.length === 0 ? (
        <div className="paper-surface mt-5 border p-8">
          <p className="brand-eyebrow">Nada encontrado</p>
          <h3 className="mt-3 font-display text-3xl">
            A curadoria ainda não encontrou esta combinação.
          </h3>
          <p className="mt-3 text-muted-foreground leading-7">
            Tente outro termo ou remova os filtros para voltar ao arquivo
            completo.
          </p>
          <Button asChild className="mt-5" variant="outline">
            <IntentLink href="/biblioteca">Limpar busca</IntentLink>
          </Button>
        </div>
      ) : (
        <Stagger className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = iconFor(item.kind);
            return (
              <article
                className="motion-card paper-surface flex min-h-56 flex-col border p-5 hover:border-brand-action sm:p-6"
                key={item.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <Badge variant="outline">
                    <Icon aria-hidden="true" /> {labelFor(item.kind)}
                  </Badge>
                  {item.category && (
                    <span className="brand-eyebrow max-w-[48%] break-words text-right leading-tight">
                      {item.category}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-muted-foreground text-xs">
                  <span className="line-clamp-2 min-w-0">
                    {item.year ?? ""}
                    {item.authors ? ` · ${item.authors}` : ""}
                  </span>
                  <SingleFlightForm action={toggleLibraryBookmark}>
                    <input name="itemId" type="hidden" value={item.id} />
                    <input
                      name="desired"
                      type="hidden"
                      value={item.isBookmarked ? "off" : "on"}
                    />
                    <SingleFlightSubmit
                      aria-label={
                        item.isBookmarked
                          ? "Remover dos salvos"
                          : "Salvar na biblioteca"
                      }
                      size="sm"
                      variant="ghost"
                    >
                      {item.isBookmarked ? "Salvo" : "Salvar"}
                    </SingleFlightSubmit>
                  </SingleFlightForm>
                </div>
                <div className="relative mt-4 aspect-[16/9] overflow-hidden border bg-[linear-gradient(135deg,#352832,#74465a_52%,#d2b697)]">
                  {item.coverUrl ? (
                    // Cover URLs are staff-provided HTTPS assets; keep arbitrary hosts outside the Next image optimizer.
                    // biome-ignore lint/performance/noImgElement: editorial cover may be hosted outside configured image domains.
                    <img
                      alt={`Capa: ${item.title}`}
                      className="size-full object-cover"
                      decoding="async"
                      height={360}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      src={item.coverUrl}
                      width={640}
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_70%_15%,rgba(241,215,181,.38),transparent_43%),linear-gradient(135deg,rgba(57,39,48,.96),rgba(117,65,79,.88))]">
                      <Icon
                        aria-hidden="true"
                        className="size-8 text-white/85"
                      />
                    </div>
                  )}
                </div>
                <h3 className="mt-5 break-words font-display text-2xl leading-tight">
                  <IntentLink
                    className="hover:text-brand-structural"
                    href={`/biblioteca/${item.id}`}
                  >
                    {item.title}
                  </IntentLink>
                </h3>
                {item.description && (
                  <p className="mt-3 line-clamp-3 text-muted-foreground text-sm leading-6">
                    {item.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
                  <span>{libraryLanguageLabel(item.language)}</span>
                  <span>{libraryDifficultyLabel(item.difficulty)}</span>
                  <span>{libraryAccessLabel(item.accessType)}</span>
                  {item.version && <span>{item.version}</span>}
                </div>
                {item.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {item.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-auto pt-6">
                  <SingleFlightForm action={openLibraryItem}>
                    <input name="itemId" type="hidden" value={item.id} />
                    <SingleFlightSubmit
                      pendingLabel="Abrindo material…"
                      size="sm"
                    >
                      Abrir material{" "}
                      <ArrowUpRightIcon aria-hidden="true" className="size-4" />
                    </SingleFlightSubmit>
                  </SingleFlightForm>
                </div>
              </article>
            );
          })}
        </Stagger>
      )}
      {items.length > 0 && (page > 1 || hasMore) && (
        <nav
          aria-label="Paginação da biblioteca"
          className="mt-8 flex flex-wrap justify-between gap-3"
        >
          {page > 1 ? (
            <Button asChild variant="outline">
              <IntentLink href={pageHref(page - 1)}>Página anterior</IntentLink>
            </Button>
          ) : (
            <span />
          )}
          {hasMore && (
            <Button asChild variant="outline">
              <IntentLink href={pageHref(page + 1)}>Próxima página</IntentLink>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
};

const LibraryItemsFallback = () => (
  <section
    aria-busy="true"
    aria-label="Carregando materiais"
    className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
  >
    <span className="sr-only">Carregando materiais</span>
    {[0, 1, 2].map((item) => (
      <div
        className="paper-surface min-h-56 animate-pulse border p-5"
        key={item}
      >
        <div className="h-40 rounded-sm bg-muted/70" />
        <div className="mt-5 h-6 w-3/4 rounded-sm bg-muted" />
        <div className="mt-3 h-4 w-full rounded-sm bg-muted/70" />
      </div>
    ))}
  </section>
);

const iconFor = (kind: string) => {
  if (kind === "PDF") {
    return FileTextIcon;
  }
  if (kind === "ARTICLE" || kind === "GUIDE") {
    return BookOpenIcon;
  }
  return LinkIcon;
};

const labelFor = (kind: string) => {
  if (kind === "PDF") {
    return "PDF";
  }
  if (kind === "ARTICLE") {
    return "Artigo";
  }
  if (kind === "GUIDE") {
    return "Guia";
  }
  if (kind === "VIDEO") {
    return "Vídeo";
  }
  return "Link";
};

const LibraryPage = async ({ searchParams }: LibraryPageProperties) => {
  const [filters, memberId] = await Promise.all([
    searchParams,
    requireMemberId(),
  ]);
  const currentPage = Number.parseInt(filters.page ?? "1", 10);
  return (
    <div className="min-h-svh bg-background">
      <main
        className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16"
        data-route-structure-ready="library"
      >
        <a
          className="sr-only rounded-sm bg-background px-3 py-2 text-foreground focus:not-sr-only focus:absolute focus:z-50 focus-visible:outline-2 focus-visible:outline-brand-action focus-visible:outline-offset-2"
          href="#library-heading"
        >
          Pular filtros e ir aos materiais
        </a>
        <header className="max-w-3xl">
          <p className="brand-eyebrow">Arquivo de estudo · curadoria</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 text-balance font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
            Leia um pouco além da aula.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground leading-7 sm:text-lg">
            Materiais selecionados para acompanhar perguntas reais. A biblioteca
            é um arquivo vivo, não uma pasta de downloads.
          </p>
        </header>
        <div className="mt-7">
          <Button asChild variant="outline">
            <IntentLink href="/biblioteca/pessoal">
              Minha biblioteca pessoal
            </IntentLink>
          </Button>
        </div>
        <FilterForm
          action="/biblioteca"
          className="mt-12 grid min-w-0 gap-3 border-border border-y py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12"
        >
          <div className="grid min-w-0 gap-1.5 sm:col-span-2 lg:col-span-3 xl:col-span-4">
            <label
              className="font-medium text-muted-foreground text-xs"
              htmlFor="library-search"
            >
              Buscar materiais
            </label>
            <span className="relative block min-w-0">
              <SearchIcon
                aria-hidden="true"
                className="absolute top-3 left-3 size-4 text-muted-foreground"
              />
              <Input
                className="pl-9"
                defaultValue={filters.q}
                id="library-search"
                name="q"
                placeholder="Buscar por título, tema ou palavra…"
                type="search"
              />
            </span>
          </div>
          <Suspense
            fallback={
              <LibraryCategoryFallback selectedCategory={filters.category} />
            }
          >
            <LibraryCategoryField selectedCategory={filters.category} />
          </Suspense>
          <div className="grid min-w-0 gap-1.5 xl:col-span-2">
            <label
              className="font-medium text-muted-foreground text-xs"
              htmlFor="library-sort"
            >
              Ordenação
            </label>
            <select
              className="h-11 w-full min-w-0 rounded-sm border bg-transparent px-3 text-sm"
              defaultValue={filters.sort ?? "recent"}
              id="library-sort"
              name="sort"
            >
              <option value="recent">Mais recentes</option>
              <option value="relevant">Mais relevantes</option>
            </select>
          </div>
          <Button
            className="h-11 w-full self-end sm:col-span-2 lg:col-span-1 xl:col-span-2"
            type="submit"
          >
            Filtrar
          </Button>
          <div className="grid min-w-0 gap-1.5 xl:col-span-4">
            <label
              className="font-medium text-muted-foreground text-xs"
              htmlFor="library-kind"
            >
              Tipo
            </label>
            <select
              className="h-11 w-full min-w-0 rounded-sm border bg-transparent px-3 text-sm"
              defaultValue={filters.kind ?? ""}
              id="library-kind"
              name="kind"
            >
              <option value="">Todos os tipos</option>
              <option value="ARTICLE">Artigos</option>
              <option value="PDF">PDFs</option>
              <option value="GUIDE">Guias</option>
              <option value="LINK">Links</option>
              <option value="VIDEO">Vídeos</option>
            </select>
          </div>
          <div className="grid min-w-0 gap-1.5 xl:col-span-4">
            <label
              className="font-medium text-muted-foreground text-xs"
              htmlFor="library-language"
            >
              Idioma
            </label>
            <select
              className="h-11 w-full min-w-0 rounded-sm border bg-transparent px-3 text-sm"
              defaultValue={filters.language ?? ""}
              id="library-language"
              name="language"
            >
              <option value="">Todos os idiomas</option>
              <option value="pt">Português</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
          <div className="grid min-w-0 gap-1.5 xl:col-span-4">
            <label
              className="font-medium text-muted-foreground text-xs"
              htmlFor="library-difficulty"
            >
              Nível
            </label>
            <select
              className="h-11 w-full min-w-0 rounded-sm border bg-transparent px-3 text-sm"
              defaultValue={filters.difficulty ?? ""}
              id="library-difficulty"
              name="difficulty"
            >
              <option value="">Todos os níveis</option>
              <option value="INTRODUCTORY">Introdutório</option>
              <option value="INTERMEDIATE">Intermediário</option>
              <option value="ADVANCED">Avançado</option>
            </select>
          </div>
        </FilterForm>
        <section aria-labelledby="library-heading" className="mt-12">
          <div className="flex items-end justify-between border-border border-b pb-3">
            <div>
              <h2 className="font-display text-3xl" id="library-heading">
                Materiais para a mesa
              </h2>
              <p className="mt-2 text-muted-foreground text-sm">
                Relevância combina leitores únicos, aberturas repetidas e itens
                salvos; a busca desempata por correspondência textual.
              </p>
            </div>
          </div>
          <Suspense fallback={<LibraryItemsFallback />}>
            <LibraryItemsSection
              currentPage={currentPage}
              filters={filters}
              memberId={memberId}
            />
          </Suspense>
        </section>
      </main>
    </div>
  );
};

export default LibraryPage;
