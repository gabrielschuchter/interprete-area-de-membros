"use client";

import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  COMMUNITY_SORT_OPTIONS,
  type CommunitySort,
  communityHref,
  parseCommunitySort,
} from "@/lib/community-query";

interface CommunityFeedNavigationProperties {
  readonly query?: string;
  readonly sort: CommunitySort;
  readonly spaceSlug?: string;
  readonly spaces: readonly { readonly slug: string; readonly title: string }[];
}

export const CommunityFeedNavigation = ({
  query,
  sort,
  spaceSlug,
  spaces,
}: CommunityFeedNavigationProperties) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(query ?? "");

  useEffect(() => {
    setDraftQuery(query ?? "");
  }, [query]);

  const applyFilters = (
    next: {
      readonly nextQuery?: string;
      readonly nextSort?: CommunitySort;
      readonly nextSpaceSlug?: string;
    } = {}
  ) =>
    startTransition(() =>
      router.push(
        communityHref({
          query: Object.hasOwn(next, "nextQuery") ? next.nextQuery : draftQuery,
          sort: Object.hasOwn(next, "nextSort") ? next.nextSort : sort,
          spaceSlug: Object.hasOwn(next, "nextSpaceSlug")
            ? next.nextSpaceSlug
            : spaceSlug,
        })
      )
    );

  return (
    <search
      aria-label="Buscar e filtrar publicações"
      className="community-feed-nav"
    >
      <form
        className="community-feed-nav__form"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters({ nextQuery: draftQuery });
        }}
      >
        <label className="community-feed-nav__search">
          <span className="sr-only">Buscar na comunidade</span>
          <SearchIcon
            aria-hidden="true"
            className="community-feed-nav__search-icon"
          />
          <input
            aria-label="Buscar na comunidade"
            disabled={isPending}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Buscar na comunidade"
            type="search"
            value={draftQuery}
          />
        </label>
        <label className="community-feed-nav__select-wrap community-feed-nav__select-wrap--group">
          <span className="sr-only">Filtrar por grupo de estudo</span>
          <select
            aria-label="Filtrar por grupo de estudo"
            disabled={isPending}
            onChange={(event) =>
              applyFilters({
                nextSpaceSlug: event.target.value || undefined,
              })
            }
            value={spaceSlug ?? ""}
          >
            <option value="">Todos os grupos</option>
            {spaces.map((space) => (
              <option key={space.slug} value={space.slug}>
                {space.title}
              </option>
            ))}
          </select>
          <ChevronDownIcon aria-hidden="true" />
        </label>
        <label className="community-feed-nav__select-wrap">
          <span className="sr-only">Ordenar publicações</span>
          <select
            aria-label="Ordenar publicações"
            disabled={isPending}
            onChange={(event) =>
              applyFilters({ nextSort: parseCommunitySort(event.target.value) })
            }
            value={sort}
          >
            {COMMUNITY_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon aria-hidden="true" />
        </label>
      </form>
    </search>
  );
};
