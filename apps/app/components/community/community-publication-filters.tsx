"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type PublicationView = "published" | "drafts" | "archived";
type PublicationSort = "recent" | "oldest" | "title";

const searchPlaceholder: Record<PublicationView, string> = {
  archived: "Buscar nas minhas publicações arquivadas",
  drafts: "Buscar nos meus rascunhos",
  published: "Buscar nas minhas publicações",
};

const viewHref = (
  view: PublicationView,
  query: string,
  sort: PublicationSort
) => {
  const params = new URLSearchParams({ status: view });
  if (query.trim()) {
    params.set("q", query.trim());
  }
  if (sort !== "recent") {
    params.set("sort", sort);
  }
  return `/comunidade/minhas-publicacoes?${params.toString()}`;
};

export function CommunityPublicationFilters({
  activeView,
  query,
  sort,
}: {
  readonly activeView: PublicationView;
  readonly query: string;
  readonly sort: PublicationSort;
}) {
  const router = useRouter();
  const [draftQuery, setDraftQuery] = useState(query);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setDraftQuery(query), [query]);

  const navigate = (nextQuery: string, nextSort: PublicationSort) => {
    startTransition(() =>
      router.push(viewHref(activeView, nextQuery, nextSort))
    );
  };

  return (
    <search
      aria-label="Buscar e ordenar publicações"
      className="community-publications-filter-region"
    >
      <form
        className="community-publications-filters"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(draftQuery, sort);
        }}
      >
        <label className="community-publications-search">
          <SearchIcon aria-hidden="true" />
          <span className="sr-only">{searchPlaceholder[activeView]}</span>
          <input
            aria-label={searchPlaceholder[activeView]}
            disabled={isPending}
            maxLength={100}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder={searchPlaceholder[activeView]}
            type="search"
            value={draftQuery}
          />
        </label>
        <label className="community-publications-sort">
          <span className="sr-only">Ordenar por</span>
          <select
            aria-label="Ordenar por"
            disabled={isPending}
            onChange={(event) =>
              navigate(draftQuery, event.target.value as PublicationSort)
            }
            value={sort}
          >
            <option value="recent">Editados há pouco</option>
            <option value="oldest">Editados há muito</option>
            <option value="title">Título A–Z</option>
          </select>
        </label>
      </form>
    </search>
  );
}
