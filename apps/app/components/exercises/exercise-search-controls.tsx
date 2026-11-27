"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { BookmarkIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { startTransition, useEffect, useRef, useState } from "react";
import {
  LIBRARY_AUTO_SEARCH_DELAY_MS,
  libraryAutoSearchTarget,
} from "@/lib/library-auto-search";

interface ExerciseSearchCategory {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

export const exerciseFiltersHref = (
  query: string,
  categorySlug?: string,
  savedOnly = false
) => {
  const parameters = new URLSearchParams();
  if (query.trim()) {
    parameters.set("q", query.trim());
  }
  if (categorySlug) {
    parameters.set("categoria", categorySlug);
  }
  if (savedOnly) {
    parameters.set("salvas", "1");
  }
  const search = parameters.toString();
  return search ? `/exercicios?${search}` : "/exercicios";
};

const chipClass = (active: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-md px-4 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    active
      ? "bg-primary text-primary-foreground"
      : "bg-[#e7dedc] text-primary hover:bg-[#dcd0cf]"
  }`;

const TabDot = ({ active }: { readonly active: boolean }) => (
  <span
    aria-hidden="true"
    className={`size-2 rounded-full ${active ? "bg-[#F7C873]" : "bg-[#8C1535]"}`}
  />
);

export const ExerciseSearchControls = ({
  categories,
  heading,
  savedCount = 0,
  savedOnly = false,
  categorySlug,
  query,
}: {
  readonly categories: readonly ExerciseSearchCategory[];
  readonly categorySlug?: string;
  readonly heading?: ReactNode;
  readonly savedCount?: number;
  readonly savedOnly?: boolean;
  readonly query: string;
}) => {
  const router = useRouter();
  const [typed, setTyped] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryRef = useRef(categorySlug);
  const savedRef = useRef(savedOnly);
  savedRef.current = savedOnly;
  const queryRef = useRef(query);
  const typedRef = useRef(typed);
  categoryRef.current = categorySlug;
  queryRef.current = query;
  typedRef.current = typed;

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  // Se a busca mudou por fora (ex.: "Limpar filtros"), acompanha a URL, mas
  // sem atropelar o que a pessoa ainda está digitando.
  useEffect(() => {
    if (!timer.current && typedRef.current.trim() !== query.trim()) {
      setTyped(query);
    }
  }, [query]);

  const go = (term: string) => {
    startTransition(() => {
      router.replace(
        exerciseFiltersHref(term, categoryRef.current, savedRef.current),
        {
          scroll: false,
        }
      );
    });
  };

  const onChange = (value: string) => {
    setTyped(value);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      const target = libraryAutoSearchTarget(value, queryRef.current);
      if (target !== null) {
        go(target);
      }
    }, LIBRARY_AUTO_SEARCH_DELAY_MS);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    go(typed);
  };

  return (
    <search className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        {heading}
        <form className="flex-[0_1_320px]" onSubmit={onSubmit}>
          <label className="relative block" htmlFor="exercise-search-query">
            <span className="sr-only">Buscar listas e temas</span>
            <SearchIcon
              aria-hidden="true"
              className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoComplete="off"
              className="h-11 border-[#b8a5aa] bg-card pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
              id="exercise-search-query"
              name="q"
              onChange={(event) => onChange(event.target.value)}
              placeholder="Buscar listas ou temas"
              type="search"
              value={typed}
            />
            {typed && (
              <button
                aria-label="Limpar busca"
                className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-[4px] text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  if (timer.current) {
                    clearTimeout(timer.current);
                    timer.current = null;
                  }
                  setTyped("");
                  go("");
                }}
                type="button"
              >
                <XIcon aria-hidden="true" className="size-4" />
              </button>
            )}
          </label>
          {categorySlug && (
            <input name="categoria" type="hidden" value={categorySlug} />
          )}
          {savedOnly && <input name="salvas" type="hidden" value="1" />}
        </form>
      </div>
      {(categories.length > 0 || savedCount > 0 || savedOnly) && (
        <nav
          aria-label="Categorias"
          className="flex gap-1 overflow-x-auto border-primary border-b-[3px]"
        >
          <Link
            aria-current={categorySlug || savedOnly ? undefined : "true"}
            className={chipClass(!(categorySlug || savedOnly))}
            href={exerciseFiltersHref(typed)}
            prefetch={false}
            scroll={false}
          >
            <TabDot active={!(categorySlug || savedOnly)} />
            Todas
          </Link>
          {categories.map((category) => {
            const active = !savedOnly && category.slug === categorySlug;
            return (
              <Link
                aria-current={active ? "true" : undefined}
                className={chipClass(active)}
                href={exerciseFiltersHref(typed, category.slug)}
                key={category.id}
                prefetch={false}
                scroll={false}
              >
                <TabDot active={active} />
                {category.title}
              </Link>
            );
          })}
          {(savedCount > 0 || savedOnly) && (
            <Link
              aria-current={savedOnly ? "true" : undefined}
              className={`${chipClass(savedOnly)} ml-auto`}
              href={exerciseFiltersHref(typed, undefined, true)}
              prefetch={false}
              scroll={false}
            >
              <BookmarkIcon aria-hidden="true" className="size-3.5" />
              Listas salvas
              <span className="font-data text-xs opacity-80">{savedCount}</span>
            </Link>
          )}
        </nav>
      )}
    </search>
  );
};
