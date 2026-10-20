"use client";

import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState, useTransition } from "react";

export type CommunityGroupScope = "all" | "mine" | "discover";

interface CommunityGroupFiltersProperties {
  readonly initialQuery: string;
  readonly initialScope: CommunityGroupScope;
}

const hrefFor = (query: string, scope: CommunityGroupScope) => {
  const params = new URLSearchParams();
  const normalizedQuery = query.trim().slice(0, 100);

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }
  if (scope !== "all") {
    params.set("scope", scope);
  }

  const search = params.toString();
  return search ? `/comunidade/grupos?${search}` : "/comunidade/grupos";
};

export const CommunityGroupFilters = ({
  initialQuery,
  initialScope,
}: CommunityGroupFiltersProperties) => {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState(initialScope);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setQuery(initialQuery);
    setScope(initialScope);
  }, [initialQuery, initialScope]);

  const navigate = (nextQuery: string, nextScope: CommunityGroupScope) =>
    startTransition(() => router.push(hrefFor(nextQuery, nextScope)));

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(query, scope);
  };

  return (
    <div className="mt-7">
      <form
        aria-label="Buscar e filtrar grupos de estudo"
        className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]"
        onSubmit={submitSearch}
      >
        <label className="relative block min-w-0">
          <span className="sr-only">Buscar grupos de estudo</span>
          <SearchIcon
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            aria-label="Buscar grupos de estudo"
            className="h-12 w-full rounded-sm border border-border bg-background pr-3 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isPending}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar grupos"
            type="search"
            value={query}
          />
        </label>
        <label className="relative block min-w-0">
          <span className="sr-only">Filtrar grupos</span>
          <select
            aria-label="Filtrar grupos"
            className="h-12 w-full appearance-none rounded-sm border border-border bg-background px-3 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isPending}
            onChange={(event) => {
              const nextScope = event.target.value as CommunityGroupScope;
              setScope(nextScope);
              navigate(query, nextScope);
            }}
            value={scope}
          >
            <option value="all">Todos os grupos</option>
            <option value="mine">Meus grupos</option>
            <option value="discover">Descobrir grupos públicos</option>
          </select>
          <ChevronDownIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </label>
        <button className="sr-only" disabled={isPending} type="submit">
          Buscar grupos
        </button>
      </form>
      <p aria-live="polite" className="sr-only">
        {isPending ? "Atualizando grupos" : ""}
      </p>
    </div>
  );
};
