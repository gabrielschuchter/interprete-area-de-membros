"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { useSidebar } from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { LibraryHero } from "@/components/library/library-hero";

export interface LibraryFilterValues {
  readonly category: string;
  readonly difficulty: string;
  readonly kind: string;
  readonly language: string;
  readonly q: string;
  readonly sort: "recent" | "relevant";
}

type FocusTarget = "chips" | "results";
type FilterName = keyof Omit<LibraryFilterValues, "q" | "sort">;

interface LibraryExperienceProperties {
  readonly categories: readonly string[];
  readonly children: ReactNode;
  readonly initialFilters: LibraryFilterValues;
}

const DEFAULT_FILTERS: LibraryFilterValues = {
  category: "",
  difficulty: "",
  kind: "",
  language: "",
  q: "",
  sort: "recent",
};
const SCROLLABLE_OVERFLOW_PATTERN = /(auto|scroll)/;

const CATEGORY_OPTIONS = (categories: readonly string[]) => [
  { label: "Todas as categorias", value: "" },
  ...categories.map((category) => ({ label: category, value: category })),
];

const TYPE_OPTIONS = [
  { label: "Todos os tipos", value: "" },
  { label: "Artigos", value: "ARTICLE" },
  { label: "PDFs", value: "PDF" },
  { label: "Guias", value: "GUIDE" },
  { label: "Links", value: "LINK" },
  { label: "Vídeos", value: "VIDEO" },
];

const LANGUAGE_OPTIONS = [
  { label: "Todos os idiomas", value: "" },
  { label: "Português", value: "pt" },
  { label: "English", value: "en" },
  { label: "Español", value: "es" },
];

const DIFFICULTY_OPTIONS = [
  { label: "Todos os níveis", value: "" },
  { label: "Introdutório", value: "INTRODUCTORY" },
  { label: "Intermediário", value: "INTERMEDIATE" },
  { label: "Avançado", value: "ADVANCED" },
];

const SORT_OPTIONS = [
  { label: "Mais recentes", value: "recent" },
  { label: "Mais relevantes", value: "relevant" },
];

const LibraryNavigationContext = createContext<
  ((href: string, focusTarget?: FocusTarget) => void) | null
>(null);

export const useLibraryNavigation = () => {
  const navigate = useContext(LibraryNavigationContext);
  if (!navigate) {
    throw new Error("Library navigation is only available inside the library.");
  }
  return navigate;
};

const makeHref = (filters: LibraryFilterValues) => {
  const params = new URLSearchParams();
  if (filters.q.trim()) {
    params.set("q", filters.q.trim());
  }
  if (filters.kind) {
    params.set("kind", filters.kind);
  }
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.language) {
    params.set("language", filters.language);
  }
  if (filters.difficulty) {
    params.set("difficulty", filters.difficulty);
  }
  if (filters.sort !== "recent") {
    params.set("sort", filters.sort);
  }
  const query = params.toString();
  return query ? `/biblioteca?${query}` : "/biblioteca";
};

const valuesFromSearch = (search: string): LibraryFilterValues => {
  const params = new URLSearchParams(search);
  return {
    category: params.get("category") ?? "",
    difficulty: params.get("difficulty") ?? "",
    kind: params.get("kind") ?? "",
    language: params.get("language") ?? "",
    q: params.get("q") ?? "",
    sort: params.get("sort") === "relevant" ? "relevant" : "recent",
  };
};

const FilterField = ({
  className,
  compact = false,
  id,
  label,
  onChange,
  options,
  value,
}: {
  readonly className?: string;
  readonly compact?: boolean;
  readonly id: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  readonly value: string;
}) => (
  <div className={cn("grid min-w-0 gap-1.5", className)}>
    <label
      className={cn("font-medium text-[#7A5A69] text-xs", compact && "sr-only")}
      htmlFor={id}
    >
      {label}
    </label>
    <select
      className={cn(
        cn(
          "min-w-0 rounded-md border bg-white px-3 text-[#40222F] text-sm outline-none transition-colors focus-visible:border-[#8C1535] focus-visible:ring-2 focus-visible:ring-[#8C1535]/30",
          compact ? "h-11" : "h-12"
        ),
        value && "border-2 border-[#8C1535] bg-[#FBF3F4] font-medium"
      )}
      id={id}
      onChange={(event) => onChange(event.currentTarget.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const ActiveFilterChips = ({
  applied,
  onClear,
  onRemove,
}: {
  readonly applied: LibraryFilterValues;
  readonly onClear: () => void;
  readonly onRemove: (name: FilterName) => void;
}) => {
  const chips: readonly {
    readonly label: string;
    readonly name: FilterName;
    readonly value: string;
  }[] = [
    ...(applied.category
      ? [
          {
            label: "Categoria",
            name: "category" as const,
            value: applied.category,
          },
        ]
      : []),
    ...(applied.kind
      ? [
          {
            label: "Tipo",
            name: "kind" as const,
            value:
              TYPE_OPTIONS.find((option) => option.value === applied.kind)
                ?.label ?? applied.kind,
          },
        ]
      : []),
    ...(applied.language
      ? [
          {
            label: "Idioma",
            name: "language" as const,
            value:
              LANGUAGE_OPTIONS.find(
                (option) => option.value === applied.language
              )?.label ?? applied.language,
          },
        ]
      : []),
    ...(applied.difficulty
      ? [
          {
            label: "Nível",
            name: "difficulty" as const,
            value:
              DIFFICULTY_OPTIONS.find(
                (option) => option.value === applied.difficulty
              )?.label ?? applied.difficulty,
          },
        ]
      : []),
  ];

  if (chips.length === 0) {
    return null;
  }

  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-2 md:mt-5"
      data-active-chips
      tabIndex={-1}
    >
      <span className="mr-1 hidden font-semibold text-[#7A5A69] text-xs md:inline">
        Filtros ativos
      </span>
      {chips.map((chip) => (
        <span
          className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-md border border-[#8C1535] bg-[#8C1535]/[.06] pr-1 pl-3 font-medium text-[#8C1535] text-[13px]"
          key={chip.name}
        >
          <span className="min-w-0 truncate md:hidden">{chip.value}</span>
          <span className="hidden min-w-0 truncate md:inline">
            {chip.label}: {chip.value}
          </span>
          <button
            aria-label={`Remover filtro ${chip.label}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-sm hover:bg-[#8C1535]/10 focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-1"
            onClick={() => onRemove(chip.name)}
            type="button"
          >
            <XIcon aria-hidden="true" className="size-4" />
          </button>
        </span>
      ))}
      <button
        className="min-h-11 px-2 font-semibold text-[#8C1535] text-[13px] hover:underline focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2"
        onClick={onClear}
        type="button"
      >
        Limpar filtros
      </button>
    </div>
  );
};

const FiltersTrigger = ({
  activeCount,
  onOpen,
}: {
  readonly activeCount: number;
  readonly onOpen: (trigger: HTMLButtonElement) => void;
}) => (
  <Button
    aria-haspopup="dialog"
    aria-label={activeCount > 0 ? `Filtros, ${activeCount} ativos` : "Filtros"}
    className={cn(
      "h-12 shrink-0 gap-2 border-[#E2D6D1] bg-white px-3 text-[#8C1535] md:min-w-[100px]",
      activeCount > 0 && "border-2 border-[#8C1535]"
    )}
    onClick={(event) => onOpen(event.currentTarget)}
    variant="outline"
  >
    <SlidersHorizontalIcon aria-hidden="true" className="size-4" />
    <span>Filtros</span>
    {activeCount > 0 && (
      <span className="grid size-5 place-items-center rounded-full bg-[#8C1535] text-[11px] text-white">
        {activeCount}
      </span>
    )}
  </Button>
);

const FilterDialogContent = ({
  categories,
  filters,
  onApply,
  onChange,
  onClear,
  onCloseAutoFocus,
}: {
  readonly categories: readonly string[];
  readonly filters: LibraryFilterValues;
  readonly onApply: () => void;
  readonly onChange: (name: keyof LibraryFilterValues, value: string) => void;
  readonly onClear: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}) => {
  const id = useId().replaceAll(":", "");
  const fields = [
    {
      label: "Categoria",
      name: "category" as const,
      options: CATEGORY_OPTIONS(categories),
    },
    { label: "Tipo", name: "kind" as const, options: TYPE_OPTIONS },
    { label: "Idioma", name: "language" as const, options: LANGUAGE_OPTIONS },
    {
      label: "Nível",
      name: "difficulty" as const,
      options: DIFFICULTY_OPTIONS,
    },
  ];

  return (
    <DialogContent
      aria-modal="true"
      className="fixed inset-x-0 top-auto bottom-0 left-0 grid max-h-[88svh] max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-t-xl rounded-b-none border-x-0 border-b-0 bg-white p-0 md:inset-x-auto md:top-[72px] md:right-8 md:bottom-auto md:left-auto md:max-h-[min(80vh,36rem)] md:w-[452px] md:translate-x-0 md:translate-y-0 md:rounded-lg md:border md:p-5 min-[1250px]:hidden"
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        document.getElementById(`${id}-category`)?.focus();
      }}
      overlayClassName="bg-[#40222F]/50 min-[1250px]:hidden"
      showCloseButton={false}
    >
      <div className="border-[#E2D6D1] border-b px-5 pt-3 pb-4 md:border-0 md:p-0">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#BFA9A3] md:hidden"
        />
        <div className="flex items-center justify-between">
          <DialogTitle className="font-display text-2xl text-[#40222F]">
            Filtros
          </DialogTitle>
          <DialogClose asChild>
            <Button
              aria-label="Fechar filtros"
              className="size-11 text-[#7A5A69]"
              size="icon"
              variant="ghost"
            >
              <XIcon aria-hidden="true" className="size-5" />
            </Button>
          </DialogClose>
        </div>
      </div>
      <div className="grid min-h-0 grid-cols-1 content-start gap-3 overflow-y-auto px-5 py-4 md:grid-cols-2 md:gap-x-3 md:gap-y-3 md:p-0 md:pt-5">
        {fields.map((field) => (
          <FilterField
            id={`${id}-${field.name}`}
            key={field.name}
            label={field.label}
            onChange={(value) => onChange(field.name, value)}
            options={field.options}
            value={filters[field.name]}
          />
        ))}
        <div className="md:col-span-2">
          <FilterField
            id={`${id}-sort`}
            label="Ordenação"
            onChange={(value) => onChange("sort", value)}
            options={SORT_OPTIONS}
            value={filters.sort}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-[#E2D6D1] border-t px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:border-0 md:p-0 md:pt-4">
        <button
          className="min-h-11 px-2 font-semibold text-[#8C1535] text-sm"
          onClick={onClear}
          type="button"
        >
          Limpar filtros
        </button>
        <Button className="min-h-11 flex-1 md:flex-none" onClick={onApply}>
          Aplicar filtros
        </Button>
      </div>
    </DialogContent>
  );
};

const LibrarySearch = ({
  compact = false,
  filters,
  inputId,
  onQueryChange,
  onSubmit,
  submitLabel,
  hideSubmitOnMobile = false,
}: {
  readonly compact?: boolean;
  readonly filters: LibraryFilterValues;
  readonly inputId: string;
  readonly onQueryChange: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly submitLabel: string;
  readonly hideSubmitOnMobile?: boolean;
}) => (
  <search aria-label="Buscar na biblioteca">
    <form
      className={cn("flex min-w-0 items-end gap-3", compact && "items-center")}
      onSubmit={onSubmit}
    >
      <div className="grid min-w-0 flex-1 gap-1.5">
        {compact ? (
          <label className="sr-only" htmlFor={inputId}>
            Buscar materiais
          </label>
        ) : (
          <>
            <label className="sr-only md:hidden" htmlFor={inputId}>
              Buscar materiais
            </label>
            <label
              className="hidden font-medium text-[#7A5A69] text-xs md:block"
              htmlFor={`${inputId}-desktop`}
            >
              Buscar materiais
            </label>
          </>
        )}
        <span className="relative block min-w-0">
          <SearchIcon
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9b7b89]"
          />
          {compact ? (
            <Input
              autoComplete="off"
              className="h-12 border-[#E2D6D1] bg-white pl-10 text-sm placeholder:text-[#9b7b89] focus-visible:border-[#8C1535] focus-visible:ring-[#8C1535]/25"
              id={inputId}
              onChange={(event) => onQueryChange(event.currentTarget.value)}
              placeholder="Buscar por título ou tema"
              type="search"
              value={filters.q}
            />
          ) : (
            <>
              <Input
                autoComplete="off"
                className="hidden h-12 border-[#E2D6D1] bg-white pl-10 text-sm placeholder:text-[#9b7b89] focus-visible:border-[#8C1535] focus-visible:ring-[#8C1535]/25 md:block"
                id={`${inputId}-desktop`}
                onChange={(event) => onQueryChange(event.currentTarget.value)}
                placeholder="Buscar por título, tema ou palavra…"
                type="search"
                value={filters.q}
              />
              <Input
                autoComplete="off"
                className="h-12 border-[#E2D6D1] bg-white pl-10 text-sm placeholder:text-[#9b7b89] focus-visible:border-[#8C1535] focus-visible:ring-[#8C1535]/25 md:hidden"
                id={inputId}
                onChange={(event) => onQueryChange(event.currentTarget.value)}
                placeholder="Buscar por título ou tema"
                type="search"
                value={filters.q}
              />
            </>
          )}
        </span>
      </div>
      <Button
        className={cn(
          "h-12 min-w-[88px] px-5",
          hideSubmitOnMobile && "max-md:hidden"
        )}
        type="submit"
      >
        {submitLabel}
      </Button>
    </form>
  </search>
);

export const LibraryExperience = ({
  categories,
  initialFilters,
  children,
}: LibraryExperienceProperties) => {
  const { isMobile, state: sidebarState } = useSidebar();
  const fixedBarLeft = sidebarState === "collapsed" ? 48 : 256;
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = useId().replaceAll(":", "");
  const signature = searchParams?.toString() ?? "";
  const applied = useMemo(
    () => ({ ...DEFAULT_FILTERS, ...valuesFromSearch(signature) }),
    [signature]
  );
  const [draft, setDraft] = useState<LibraryFilterValues>(() => ({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fixedBarVisible, setFixedBarVisible] = useState(false);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const lastFilterTrigger = useRef<HTMLButtonElement | null>(null);
  const openFilters = (trigger: HTMLButtonElement) => {
    lastFilterTrigger.current = trigger;
    setFiltersOpen(true);
  };
  const activeFilterCount = [
    applied.category,
    applied.kind,
    applied.language,
    applied.difficulty,
  ].filter(Boolean).length;

  const navigateToResults = useCallback(
    (href: string, focusTarget: FocusTarget = "results") => {
      pendingFocus.current = focusTarget;
      router.push(href, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    const next = valuesFromSearch(signature);
    setDraft(next);
    const focusTarget = pendingFocus.current;
    pendingFocus.current = null;
    if (!focusTarget) {
      return;
    }
    requestAnimationFrame(() => {
      const target =
        focusTarget === "chips"
          ? document.querySelector<HTMLElement>("[data-active-chips]")
          : document.getElementById("library-results-heading");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  }, [signature]);

  useEffect(() => {
    const target = filterPanelRef.current;
    if (!target) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setFixedBarVisible(entry.boundingClientRect.bottom <= 64);
      },
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const applyFilters = (
    next: LibraryFilterValues,
    focusTarget: FocusTarget
  ) => {
    navigateToResults(makeHref(next), focusTarget);
    setFiltersOpen(false);
  };

  const submitQuery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyFilters(draft, "results");
  };

  const updateDraft = (name: keyof LibraryFilterValues, value: string) => {
    const normalizedValue =
      name === "sort" && value !== "relevant" ? "recent" : value;
    setDraft((current) => ({
      ...current,
      [name]: normalizedValue,
    }));
  };

  const removeFilter = (name: FilterName) => {
    const next = { ...applied, [name]: "" };
    applyFilters(next, "chips");
  };

  const clearFilters = () => {
    setDraft((current) => ({
      ...current,
      category: "",
      difficulty: "",
      kind: "",
      language: "",
      sort: "recent",
    }));
  };

  const clearAppliedFilters = () => {
    applyFilters(
      {
        ...applied,
        category: "",
        difficulty: "",
        kind: "",
        language: "",
        sort: "recent",
      },
      "chips"
    );
  };

  const renderFields = (suffix: string, compact = false) => {
    const fields = [
      {
        label: "Categoria",
        name: "category" as const,
        options: CATEGORY_OPTIONS(categories),
      },
      { label: "Tipo", name: "kind" as const, options: TYPE_OPTIONS },
      { label: "Idioma", name: "language" as const, options: LANGUAGE_OPTIONS },
      {
        label: "Nível",
        name: "difficulty" as const,
        options: DIFFICULTY_OPTIONS,
      },
      { label: "Ordenação", name: "sort" as const, options: SORT_OPTIONS },
    ];
    return fields.map((field) => (
      <FilterField
        className={compact ? "min-w-0" : undefined}
        compact={compact}
        id={`${id}-${suffix}-${field.name}`}
        key={field.name}
        label={field.label}
        onChange={(value) => updateDraft(field.name, value)}
        options={field.options}
        value={draft[field.name]}
      />
    ));
  };

  return (
    <Dialog onOpenChange={setFiltersOpen} open={filtersOpen}>
      <LibraryNavigationContext.Provider value={navigateToResults}>
        <main
          className="mx-auto w-full min-w-0 max-w-[1080px] px-5 pt-4 pb-12 md:px-8 md:pt-8 md:pb-16 lg:px-12 lg:pt-10"
          data-route-structure-ready="library"
        >
          <div
            aria-hidden={!fixedBarVisible}
            className={cn(
              "fixed top-16 z-40",
              fixedBarVisible ? "visible" : "pointer-events-none invisible"
            )}
            inert={!fixedBarVisible}
            style={{
              left: isMobile ? 0 : fixedBarLeft,
              right: 0,
            }}
          >
            <div
              className={cn(
                "pointer-events-auto border-[#E2D6D1] border-b bg-[#F1EBE8]/95 px-3 py-2 shadow-[0_8px_18px_rgba(64,34,47,.12)] backdrop-blur-sm transition-[opacity,transform] duration-[180ms] sm:px-5",
                fixedBarVisible
                  ? "translate-y-0 opacity-100"
                  : "-translate-y-full opacity-0"
              )}
            >
              <search
                aria-label="Buscar materiais e filtrar"
                className="hidden min-[1250px]:block"
              >
                <form
                  className="mx-auto flex max-w-[984px] items-center gap-2"
                  onSubmit={submitQuery}
                >
                  <label
                    className="sr-only"
                    htmlFor={`${id}-fixed-search-wide`}
                  >
                    Buscar materiais
                  </label>
                  <span className="relative min-w-0 flex-1">
                    <SearchIcon
                      aria-hidden="true"
                      className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9b7b89]"
                    />
                    <Input
                      className="h-11 border-[#E2D6D1] bg-white pl-9 text-sm"
                      id={`${id}-fixed-search-wide`}
                      onChange={(event) =>
                        updateDraft("q", event.currentTarget.value)
                      }
                      placeholder="Buscar por título ou tema"
                      type="search"
                      value={draft.q}
                    />
                  </span>
                  <div className="w-[150px]">
                    {renderFields("fixed-wide", true)[0]}
                  </div>
                  <div className="w-[100px]">
                    {renderFields("fixed-wide", true)[1]}
                  </div>
                  <div className="w-[110px]">
                    {renderFields("fixed-wide", true)[2]}
                  </div>
                  <div className="w-[100px]">
                    {renderFields("fixed-wide", true)[3]}
                  </div>
                  <div className="w-[140px]">
                    {renderFields("fixed-wide", true)[4]}
                  </div>
                  <Button className="h-11 px-5" type="submit">
                    Filtrar
                  </Button>
                </form>
              </search>

              <search
                aria-label="Buscar materiais e filtrar"
                className="block min-[1250px]:hidden"
              >
                <form
                  className="mx-auto flex max-w-[984px] items-center gap-2"
                  onSubmit={submitQuery}
                >
                  <label
                    className="sr-only"
                    htmlFor={`${id}-fixed-search-compact`}
                  >
                    Buscar materiais
                  </label>
                  <span className="relative min-w-0 flex-1">
                    <SearchIcon
                      aria-hidden="true"
                      className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9b7b89]"
                    />
                    <Input
                      className="h-11 border-[#E2D6D1] bg-white pl-9 text-sm max-md:h-11"
                      id={`${id}-fixed-search-compact`}
                      onChange={(event) =>
                        updateDraft("q", event.currentTarget.value)
                      }
                      placeholder="Buscar materiais"
                      type="search"
                      value={draft.q}
                    />
                  </span>
                  <div className="hidden md:block min-[1250px]:hidden">
                    <FiltersTrigger
                      activeCount={activeFilterCount}
                      onOpen={openFilters}
                    />
                  </div>
                  <div className="hidden w-[140px] md:block min-[1250px]:hidden">
                    {renderFields("fixed-compact", true)[4]}
                  </div>
                  <Button
                    className="hidden h-11 px-5 md:inline-flex"
                    type="submit"
                  >
                    Filtrar
                  </Button>
                  <div className="md:hidden">
                    <FiltersTrigger
                      activeCount={activeFilterCount}
                      onOpen={openFilters}
                    />
                  </div>
                </form>
              </search>
            </div>
          </div>
          <a
            className="sr-only rounded-sm bg-white px-3 py-2 text-[#40222F] focus:not-sr-only focus:absolute focus:z-50 focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2"
            href="#library-results-heading"
          >
            Pular busca e filtros e ir aos materiais
          </a>
          <LibraryHero />

          <div
            className="mt-3 border-0 bg-transparent p-0 md:mt-8 md:rounded-lg md:border md:border-[#E2D6D1] md:bg-white md:p-5"
            ref={filterPanelRef}
          >
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 md:gap-3">
              <LibrarySearch
                filters={draft}
                hideSubmitOnMobile
                inputId={`${id}-panel-search`}
                onQueryChange={(q) => updateDraft("q", q)}
                onSubmit={submitQuery}
                submitLabel="Filtrar"
              />
              <div className="md:hidden">
                <FiltersTrigger
                  activeCount={activeFilterCount}
                  onOpen={openFilters}
                />
              </div>
            </div>
            <div className="mt-3 hidden gap-3 md:grid md:grid-cols-[repeat(auto-fit,minmax(145px,1fr))] min-[1250px]:grid-cols-[1.25fr_repeat(4,minmax(0,1fr))]">
              {renderFields("panel")}
            </div>
          </div>

          <ActiveFilterChips
            applied={applied}
            onClear={clearAppliedFilters}
            onRemove={removeFilter}
          />

          <section
            aria-label="Resultados da Biblioteca"
            className="mt-10 scroll-mt-24 md:mt-14"
            id="library-results"
          >
            {children}
          </section>

          <BackToTop visible={fixedBarVisible} />
          <FilterDialogContent
            categories={categories}
            filters={draft}
            onApply={() => applyFilters(draft, "results")}
            onChange={updateDraft}
            onClear={clearFilters}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              lastFilterTrigger.current?.focus();
            }}
          />
        </main>
      </LibraryNavigationContext.Provider>
    </Dialog>
  );
};

const BackToTop = ({ visible }: { readonly visible: boolean }) => {
  if (!visible) {
    return null;
  }
  return (
    <button
      aria-label="Voltar ao topo"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-12 place-items-center rounded-full bg-[#8C1535] text-white shadow-[var(--shadow-floating)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2 md:right-6 md:bottom-6"
      onClick={() => {
        const main = document.querySelector<HTMLElement>(
          '[data-route-structure-ready="library"]'
        );
        let parent = main?.parentElement ?? null;
        while (parent && parent !== document.body) {
          const style = window.getComputedStyle(parent);
          if (
            SCROLLABLE_OVERFLOW_PATTERN.test(style.overflowY) &&
            parent.scrollHeight > parent.clientHeight
          ) {
            parent.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
            });
            return;
          }
          parent = parent.parentElement;
        }
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        });
      }}
      type="button"
    >
      <ArrowUpIcon aria-hidden="true" className="size-5" />
    </button>
  );
};

export const LibraryPagination = ({
  currentPage,
  hasMore,
  filters,
}: {
  readonly currentPage: number;
  readonly hasMore: boolean;
  readonly filters: LibraryFilterValues;
}) => {
  const navigate = useLibraryNavigation();
  if (currentPage <= 1 && !hasMore) {
    return null;
  }
  const hrefForPage = (page: number) => {
    const params = new URLSearchParams(makeHref(filters).split("?")[1] ?? "");
    params.set("page", String(page));
    return `/biblioteca?${params.toString()}`;
  };
  return (
    <nav
      aria-label="Paginação da biblioteca"
      className="mt-8 flex flex-wrap items-center justify-between gap-3"
    >
      {currentPage > 1 ? (
        <Button
          className="h-11 border-2 border-[#8C1535] bg-transparent text-[#8C1535]"
          onClick={() => navigate(hrefForPage(currentPage - 1))}
          variant="outline"
        >
          <ArrowLeftIcon aria-hidden="true" /> Página anterior
        </Button>
      ) : null}
      {hasMore && (
        <Button
          className="ml-auto h-11 border-2 border-[#8C1535] bg-transparent text-[#8C1535] max-md:w-full"
          onClick={() => navigate(hrefForPage(currentPage + 1))}
          variant="outline"
        >
          <ArrowRightIcon aria-hidden="true" /> Próxima página
        </Button>
      )}
    </nav>
  );
};

export const ClearLibrarySearch = () => {
  const navigate = useLibraryNavigation();
  return (
    <Button
      className="mt-5 h-11 border-2 border-[#8C1535] bg-transparent text-[#8C1535]"
      onClick={() => navigate("/biblioteca", "results")}
      variant="outline"
    >
      Limpar busca
    </Button>
  );
};
