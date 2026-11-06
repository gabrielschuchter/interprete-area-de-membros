"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { cn } from "@repo/design-system/lib/utils";
import { SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { GestaoSearchGroup } from "@/lib/gestao-search";
import { searchGestaoAction } from "./search-actions";

const minLength = 2;
const recentLimit = 8;
const debounceMs = 220;

interface RecentSearch {
  readonly href: string;
  readonly title: string;
}

const recentKey = (memberId: string) =>
  `interprete:gestao:search-recent:v1:${memberId}`;

const readRecent = (memberId: string): RecentSearch[] => {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(recentKey(memberId)) ?? "[]"
    );
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (entry): entry is RecentSearch =>
              typeof entry?.href === "string" &&
              typeof entry?.title === "string" &&
              entry.href.startsWith("/gestao")
          )
          .slice(0, recentLimit)
      : [];
  } catch {
    return [];
  }
};

const writeRecent = (memberId: string, entry: RecentSearch) => {
  try {
    const next = [
      entry,
      ...readRecent(memberId).filter((item) => item.href !== entry.href),
    ].slice(0, recentLimit);
    window.localStorage.setItem(recentKey(memberId), JSON.stringify(next));
  } catch {
    // Recents are a convenience only.
  }
};

interface FlatResult {
  readonly group: string;
  readonly href: string;
  readonly id: string;
  readonly meta: string;
  readonly title: string;
}

interface GestaoSearchDialogProperties {
  readonly memberId: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly returnFocusTo: RefObject<HTMLButtonElement | null>;
}

const GestaoSearchDialog = ({
  memberId,
  onOpenChange,
  open,
  returnFocusTo,
}: GestaoSearchDialogProperties) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<readonly GestaoSearchGroup[]>([]);
  const [searched, setSearched] = useState("");
  const [failed, setFailed] = useState(false);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);

  useEffect(() => {
    if (open) {
      setRecent(readRecent(memberId));
    } else {
      setQuery("");
      setGroups([]);
      setSearched("");
      setFailed(false);
      setActive(0);
    }
  }, [memberId, open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minLength) {
      setGroups([]);
      setSearched("");
      setFailed(false);
      return;
    }
    const current = ++requestId.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const result = await searchGestaoAction(trimmed);
          if (current === requestId.current) {
            setGroups(result);
            setSearched(trimmed);
            setFailed(false);
            setActive(0);
          }
        } catch {
          if (current === requestId.current) {
            setFailed(true);
            setGroups([]);
          }
        }
      });
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query]);

  const flat = useMemo<FlatResult[]>(
    () =>
      groups.flatMap((group) =>
        group.results.map((result) => ({ ...result, group: group.label }))
      ),
    [groups]
  );
  const showingRecent = query.trim().length < minLength;
  const optionCount = showingRecent ? recent.length : flat.length;

  const go = useCallback(
    (href: string, title: string) => {
      writeRecent(memberId, { href, title });
      onOpenChange(false);
      router.push(href);
    },
    [memberId, onOpenChange, router]
  );

  const openActive = () => {
    const entry = showingRecent ? recent[active] : flat[active];
    if (entry) {
      go(entry.href, entry.title);
    } else if (!showingRecent && query.trim().length >= minLength) {
      onOpenChange(false);
      router.push(`/gestao/busca?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      openActive();
      return;
    }
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step !== undefined && optionCount > 0) {
      event.preventDefault();
      setActive((index) => (index + step + optionCount) % optionCount);
    }
  };

  let optionIndex = -1;
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="top-[11vh] max-h-[min(76vh,42rem)] translate-y-0 overflow-hidden rounded-[1.15rem] border-border/70 bg-background/95 p-0 shadow-[var(--shadow-floating)] backdrop-blur-xl duration-[var(--motion-duration-normal)] sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
        overlayClassName="bg-foreground/15 backdrop-blur-[3px]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Buscar em Gestão</DialogTitle>
        <DialogDescription className="sr-only">
          Encontre alunos, turmas, atividades, cursos, aulas, materiais, avisos
          e encontros. Use as setas para escolher e Enter para abrir.
        </DialogDescription>
        <div className="flex items-center gap-3 border-border/70 border-b px-4 py-4 sm:px-6 sm:py-5">
          <SearchIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-brand-dark-amaranth"
          />
          <input
            aria-activedescendant={
              optionCount > 0 ? `gestao-search-option-${active}` : undefined
            }
            aria-controls="gestao-search-listbox"
            aria-expanded={optionCount > 0}
            aria-label="Buscar em Gestão"
            autoComplete="off"
            autoFocus
            className="h-12 min-w-0 flex-1 border-0 bg-transparent px-0 text-base outline-none placeholder:text-muted-foreground sm:text-lg"
            maxLength={120}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Aluno, turma, atividade, curso, material…"
            role="combobox"
            type="search"
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
        <div
          aria-busy={pending}
          className="max-h-[calc(min(76vh,42rem)-6rem)] overflow-y-auto p-3 sm:p-4"
          id="gestao-search-listbox"
          role="listbox"
        >
          {showingRecent ? (
            <>
              <p className="brand-eyebrow px-3 pt-3 pb-1 text-[0.62rem] text-muted-foreground">
                Recentes
              </p>
              {recent.length === 0 ? (
                <p className="px-3 py-8 text-center text-muted-foreground text-sm">
                  Digite ao menos {minLength} letras para buscar.
                </p>
              ) : (
                recent.map((entry, index) => (
                  <button
                    aria-selected={index === active}
                    className={cn(
                      "flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      index === active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/65"
                    )}
                    id={`gestao-search-option-${index}`}
                    key={entry.href}
                    onClick={() => go(entry.href, entry.title)}
                    onMouseEnter={() => setActive(index)}
                    role="option"
                    type="button"
                  >
                    <span>{entry.title}</span>
                  </button>
                ))
              )}
            </>
          ) : null}
          {!showingRecent && failed ? (
            <p
              className="px-3 py-8 text-center text-muted-foreground text-sm"
              role="alert"
            >
              Não foi possível buscar agora. Tente novamente.
            </p>
          ) : null}
          {!(showingRecent || failed) &&
          flat.length === 0 &&
          searched === query.trim() &&
          !pending ? (
            <p className="px-3 py-8 text-center text-muted-foreground text-sm">
              Nada encontrado para “{query.trim()}”.
            </p>
          ) : null}
          {showingRecent || failed
            ? null
            : groups.map((group) => (
                <div key={group.key} role="presentation">
                  <p className="brand-eyebrow px-3 pt-3 pb-1 text-[0.62rem] text-muted-foreground">
                    {group.label}
                  </p>
                  {group.results.map((result) => {
                    optionIndex += 1;
                    const index = optionIndex;
                    return (
                      <button
                        aria-selected={index === active}
                        className={cn(
                          "flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          index === active
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/65"
                        )}
                        id={`gestao-search-option-${index}`}
                        key={result.id}
                        onClick={() => go(result.href, result.title)}
                        onMouseEnter={() => setActive(index)}
                        role="option"
                        type="button"
                      >
                        <span>{result.title}</span>
                        <small className="truncate text-muted-foreground text-xs">
                          {result.meta}
                        </small>
                      </button>
                    );
                  })}
                </div>
              ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GestaoSearchDialog;
