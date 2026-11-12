"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
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

export const exerciseFiltersHref = (query: string, categorySlug?: string) => {
  const parameters = new URLSearchParams();
  if (query.trim()) {
    parameters.set("q", query.trim());
  }
  if (categorySlug) {
    parameters.set("categoria", categorySlug);
  }
  const search = parameters.toString();
  return search ? `/exercicios?${search}` : "/exercicios";
};

const chipClass = (active: boolean) =>
  `inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground hover:border-primary hover:text-primary"
  }`;

export const ExerciseSearchControls = ({
  categories,
  categorySlug,
  query,
}: {
  readonly categories: readonly ExerciseSearchCategory[];
  readonly categorySlug?: string;
  readonly query: string;
}) => {
  const router = useRouter();
  const [typed, setTyped] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryRef = useRef(categorySlug);
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
      router.replace(exerciseFiltersHref(term, categoryRef.current), {
        scroll: false,
      });
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
    <search className="flex flex-col gap-3">
      <form onSubmit={onSubmit}>
        <label className="relative block" htmlFor="exercise-search-query">
          <span className="sr-only">Buscar listas e temas</span>
          <SearchIcon
            aria-hidden="true"
            className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoComplete="off"
            className="h-11 bg-card pl-10"
            id="exercise-search-query"
            name="q"
            onChange={(event) => onChange(event.target.value)}
            placeholder="Buscar listas ou temas"
            type="search"
            value={typed}
          />
        </label>
        {categorySlug && (
          <input name="categoria" type="hidden" value={categorySlug} />
        )}
      </form>
      {categories.length > 0 && (
        <nav aria-label="Categorias" className="flex flex-wrap gap-2">
          <Link
            aria-current={categorySlug ? undefined : "true"}
            className={chipClass(!categorySlug)}
            href={exerciseFiltersHref(typed)}
            prefetch={false}
          >
            Todas
          </Link>
          {categories.map((category) => (
            <Link
              aria-current={category.slug === categorySlug ? "true" : undefined}
              className={chipClass(category.slug === categorySlug)}
              href={exerciseFiltersHref(typed, category.slug)}
              key={category.id}
              prefetch={false}
            >
              {category.title}
            </Link>
          ))}
        </nav>
      )}
    </search>
  );
};
