"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { SearchIcon } from "lucide-react";
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
        className="gestao-search-dialog"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Buscar em Gestão</DialogTitle>
        <DialogDescription className="sr-only">
          Encontre alunos, turmas, atividades, cursos, aulas, materiais, avisos
          e encontros. Use as setas para escolher e Enter para abrir.
        </DialogDescription>
        <div className="gestao-search-field">
          <SearchIcon aria-hidden="true" />
          <input
            aria-activedescendant={
              optionCount > 0 ? `gestao-search-option-${active}` : undefined
            }
            aria-controls="gestao-search-listbox"
            aria-expanded={optionCount > 0}
            aria-label="Buscar em Gestão"
            autoComplete="off"
            autoFocus
            maxLength={120}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Aluno, turma, atividade, curso, material…"
            role="combobox"
            type="search"
            value={query}
          />
        </div>
        <div
          aria-busy={pending}
          className="gestao-search-results"
          id="gestao-search-listbox"
          role="listbox"
        >
          {showingRecent ? (
            <>
              <p className="gestao-search-heading">Recentes</p>
              {recent.length === 0 ? (
                <p className="gestao-search-empty">
                  Digite ao menos {minLength} letras para buscar.
                </p>
              ) : (
                recent.map((entry, index) => (
                  <button
                    aria-selected={index === active}
                    className="gestao-search-option"
                    data-active={String(index === active)}
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
            <p className="gestao-search-empty" role="alert">
              Não foi possível buscar agora. Tente novamente.
            </p>
          ) : null}
          {!(showingRecent || failed) &&
          flat.length === 0 &&
          searched === query.trim() &&
          !pending ? (
            <p className="gestao-search-empty">
              Nada encontrado para “{query.trim()}”.
            </p>
          ) : null}
          {showingRecent || failed
            ? null
            : groups.map((group) => (
                <div key={group.key} role="presentation">
                  <p className="gestao-search-heading">{group.label}</p>
                  {group.results.map((result) => {
                    optionIndex += 1;
                    const index = optionIndex;
                    return (
                      <button
                        aria-selected={index === active}
                        className="gestao-search-option"
                        data-active={String(index === active)}
                        id={`gestao-search-option-${index}`}
                        key={result.id}
                        onClick={() => go(result.href, result.title)}
                        onMouseEnter={() => setActive(index)}
                        role="option"
                        type="button"
                      >
                        <span>{result.title}</span>
                        <small>{result.meta}</small>
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
