"use client";

import { ChevronDownIcon, SearchIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import {
  COMMUNITY_KIND_OPTIONS,
  COMMUNITY_SORT_OPTIONS,
  type CommunityKind,
  type CommunitySort,
  communityHref,
  parseCommunityKind,
  parseCommunitySort,
} from "@/lib/community-query";

import { type CommunityView, communityViews } from "./community-views";

const CommunityViewPickerFallback = () => {
  const pathname = usePathname();
  const activeView =
    communityViews.find(
      (view) =>
        pathname === view.href ||
        (view.href !== "/comunidade" && pathname.startsWith(`${view.href}/`))
    ) ?? communityViews[0];

  return (
    <div className="community-view-picker">
      <button
        aria-label={`Visão da comunidade: ${activeView.label}`}
        className="community-view-trigger"
        disabled
        type="button"
      >
        <span>{activeView.label}</span>
        <ChevronDownIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
};
const CommunityViewPicker = dynamic(() => import("./community-view-picker"), {
  loading: CommunityViewPickerFallback,
});

interface CommunityNavigationProperties {
  readonly active: CommunityView;
}

export const CommunityNavigation = ({
  active,
}: CommunityNavigationProperties) => {
  const activeView =
    communityViews.find((view) => view.value === active) ?? communityViews[0];

  return (
    <nav aria-label="Navegação da comunidade" className="community-section-nav">
      <div className="community-section-nav__links community-section-nav__links--desktop">
        {communityViews.map((view) => (
          <IntentLink
            aria-current={view.value === active ? "page" : undefined}
            className={
              view.value === active
                ? "community-section-nav__link community-section-nav__link--active"
                : "community-section-nav__link"
            }
            href={view.href}
            key={view.value}
          >
            {view.label}
          </IntentLink>
        ))}
      </div>
      <CommunityViewPicker activeView={activeView} />
    </nav>
  );
};

interface CommunityFeedNavigationProperties {
  readonly kind?: CommunityKind;
  readonly query?: string;
  readonly sort: CommunitySort;
  readonly spaceSlug?: string;
  readonly spaces: readonly { readonly slug: string; readonly title: string }[];
}

export const CommunityFeedNavigation = ({
  kind,
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
      readonly nextKind?: CommunityKind;
      readonly nextQuery?: string;
      readonly nextSort?: CommunitySort;
      readonly nextSpaceSlug?: string;
    } = {}
  ) =>
    startTransition(() =>
      router.push(
        communityHref({
          kind: Object.hasOwn(next, "nextKind") ? next.nextKind : kind,
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
          <span className="sr-only">Filtrar por tipo de publicação</span>
          <select
            aria-label="Filtrar por tipo de publicação"
            disabled={isPending}
            onChange={(event) =>
              applyFilters({ nextKind: parseCommunityKind(event.target.value) })
            }
            value={kind ?? ""}
          >
            <option value="">Tudo</option>
            {COMMUNITY_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
