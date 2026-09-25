"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { cn } from "@repo/design-system/lib/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookOpenIcon,
  ClipboardCheckIcon,
  CornerDownLeftIcon,
  Layers3Icon,
  LibraryIcon,
  MessageCircleIcon,
  PlayCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import type { GlobalSearchResult } from "@/lib/global-search";

interface GlobalSearchProperties {
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}

type SearchState = "idle" | "loading" | "ready" | "error";

interface SearchResponse {
  readonly error?: string;
  readonly results?: GlobalSearchResult[];
}

const resultIcons = {
  path: BookOpenIcon,
  course: BookOpenIcon,
  module: Layers3Icon,
  lesson: PlayCircleIcon,
  activity: ClipboardCheckIcon,
  community: MessageCircleIcon,
  library: LibraryIcon,
  profile: UserRoundIcon,
} as const;

const focusInput = (inputRef: RefObject<HTMLInputElement | null>) => {
  inputRef.current?.focus();
};

export const GlobalSearch = ({
  open,
  onOpenChange,
}: GlobalSearchProperties) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [state, setState] = useState<SearchState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setResults([]);
    setActiveIndex(-1);
    setState("idle");
    setErrorMessage("");

    const focusTimer = window.setTimeout(() => focusInput(inputRef), 30);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setResults([]);
      setActiveIndex(-1);
      setState("idle");
      setErrorMessage("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("loading");
      setErrorMessage("");

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(normalizedQuery)}&retry=${retryToken}`,
          {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          }
        );
        const payload = (await response.json()) as SearchResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Busca indisponível.");
        }

        const nextResults = payload.results ?? [];
        setResults(nextResults);
        setActiveIndex(nextResults.length > 0 ? 0 : -1);
        setState("ready");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setResults([]);
        setActiveIndex(-1);
        setState("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível realizar a busca agora."
        );
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query, retryToken]);

  const selectResult = (searchResult: GlobalSearchResult) => {
    onOpenChange(false);
    router.push(searchResult.href);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        results.length > 0
          ? (current + 1 + results.length) % results.length
          : -1
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        results.length > 0
          ? (current - 1 + results.length) % results.length
          : -1
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const selected = results[activeIndex];
      if (selected) {
        selectResult(selected);
      }
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="top-[11vh] max-h-[min(76vh,42rem)] translate-y-0 overflow-hidden rounded-[1.15rem] border-border/70 bg-background/95 p-0 shadow-[var(--shadow-floating)] backdrop-blur-xl duration-200 sm:max-w-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusInput(inputRef);
        }}
        overlayClassName="bg-foreground/15 backdrop-blur-[3px]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Buscar no Interprete</DialogTitle>
        <DialogDescription className="sr-only">
          Pesquise cursos, aulas, atividades, discussões, materiais e pessoas.
        </DialogDescription>

        <div className="flex items-center gap-3 border-border/70 border-b px-4 py-4 sm:px-6 sm:py-5">
          <SearchIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-brand-dark-amaranth"
          />
          <Input
            aria-activedescendant={
              activeIndex >= 0
                ? `global-search-result-${results[activeIndex]?.id}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls="global-search-results"
            aria-label="Buscar no Interprete"
            autoComplete="off"
            className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 sm:text-lg"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Buscar no Interprete..."
            ref={inputRef}
            role="combobox"
            value={query}
          />
          <DialogClose asChild>
            <Button
              aria-label="Fechar busca"
              className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <XIcon aria-hidden="true" />
            </Button>
          </DialogClose>
        </div>

        <div className="max-h-[calc(min(76vh,42rem)-9.25rem)] overflow-y-auto p-3 sm:p-4">
          {state === "idle" && (
            <div className="px-3 py-10 text-center sm:py-14">
              <p className="brand-eyebrow text-brand-dark-amaranth/75">
                Busca global
              </p>
              <p className="mt-2 text-muted-foreground text-sm">
                Digite para encontrar conteúdos, discussões e pessoas.
              </p>
            </div>
          )}

          {state === "loading" && (
            <div aria-live="polite" className="space-y-2">
              <span className="sr-only">Buscando</span>
              {[0, 1, 2].map((item) => (
                <div
                  className="flex animate-pulse items-center gap-3 rounded-lg px-3 py-3"
                  key={item}
                >
                  <div className="size-9 rounded-md bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-2/5 rounded bg-muted" />
                    <div className="h-2.5 w-3/5 rounded bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {state === "error" && (
            <div className="px-3 py-10 text-center" role="alert">
              <p className="text-muted-foreground text-sm">{errorMessage}</p>
              <Button
                className="mt-4"
                onClick={() => setRetryToken((value) => value + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCwIcon aria-hidden="true" /> Tentar novamente
              </Button>
            </div>
          )}

          {state === "ready" && results.length === 0 && (
            <div aria-live="polite" className="px-3 py-10 text-center">
              <p className="font-display text-lg">
                Nenhum resultado encontrado.
              </p>
              <p className="mt-1 text-muted-foreground text-sm">
                Tente outros termos ou uma busca mais curta.
              </p>
            </div>
          )}

          {state === "ready" && results.length > 0 && (
            <div
              aria-label="Resultados da busca"
              className="space-y-1"
              id="global-search-results"
              role="listbox"
            >
              {results.map((searchResult, index) => {
                const Icon = resultIcons[searchResult.type];
                const isActive = index === activeIndex;

                return (
                  <Link
                    aria-selected={isActive}
                    className={cn(
                      "group flex items-start gap-3 rounded-lg px-3 py-3 transition-[background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/65"
                    )}
                    href={searchResult.href}
                    id={`global-search-result-${searchResult.id}`}
                    key={`${searchResult.type}-${searchResult.id}`}
                    onClick={() => onOpenChange(false)}
                    onMouseEnter={() => setActiveIndex(index)}
                    role="option"
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/70 text-brand-dark-amaranth">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-medium text-sm">
                          {searchResult.title}
                        </span>
                        <span className="brand-eyebrow text-[0.62rem] text-muted-foreground">
                          {searchResult.typeLabel}
                        </span>
                      </span>
                      {searchResult.context && (
                        <span className="mt-1 block truncate text-muted-foreground text-xs">
                          {searchResult.context}
                        </span>
                      )}
                    </span>
                    {isActive && (
                      <CornerDownLeftIcon
                        aria-hidden="true"
                        className="mt-1 size-4 shrink-0 text-muted-foreground"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden items-center justify-between border-border/70 border-t px-5 py-3 text-[0.68rem] text-muted-foreground sm:flex">
          <span>Pesquise em toda a área de membros</span>
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <ArrowUpIcon aria-hidden="true" className="size-3" />
              <ArrowDownIcon aria-hidden="true" className="size-3" />
              navegar
            </span>
            <span className="inline-flex items-center gap-1">
              <CornerDownLeftIcon aria-hidden="true" className="size-3" />
              abrir
            </span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
