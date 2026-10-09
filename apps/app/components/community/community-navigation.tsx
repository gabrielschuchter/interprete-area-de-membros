"use client";

import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import {
  COMMUNITY_SORT_OPTIONS,
  type CommunitySort,
  communityHref,
  parseCommunitySort,
} from "@/lib/community-query";

type CommunityPrimarySection = "explore" | "mine" | "saved";
type CommunityView = CommunityPrimarySection | "groups";

const primaryLinks = [
  { href: "/comunidade", label: "Explorar", value: "explore" },
  {
    href: "/comunidade/meus-topicos",
    label: "Minhas publicações",
    value: "mine",
  },
  { href: "/comunidade/salvos", label: "Salvos", value: "saved" },
] as const;

const mobileViews: readonly {
  readonly href: string;
  readonly label: string;
  readonly value: CommunityView;
}[] = [
  { href: "/comunidade", label: "Explorar", value: "explore" },
  {
    href: "/comunidade/meus-topicos",
    label: "Minhas publicações",
    value: "mine",
  },
  { href: "/comunidade/salvos", label: "Salvos", value: "saved" },
  { href: "/comunidade/grupos", label: "Grupos de estudo", value: "groups" },
];

interface CommunityNavigationProperties {
  readonly active: CommunityPrimarySection;
  readonly mobileView?: CommunityView;
}

export const CommunityNavigation = ({
  active,
  mobileView = active,
}: CommunityNavigationProperties) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <nav aria-label="Navegação da comunidade" className="community-section-nav">
      <div className="community-section-nav__links community-section-nav__links--desktop">
        {primaryLinks.map((link) => (
          <IntentLink
            aria-current={link.value === active ? "page" : undefined}
            className={
              link.value === active
                ? "community-section-nav__link community-section-nav__link--active"
                : "community-section-nav__link"
            }
            href={link.href}
            key={link.value}
          >
            {link.label}
          </IntentLink>
        ))}
      </div>
      <label className="community-view-select">
        <span className="sr-only">Visão da comunidade</span>
        <select
          aria-label="Visão da comunidade"
          disabled={isPending}
          onChange={(event) => {
            const destination = mobileViews.find(
              ({ value }) => value === event.target.value
            )?.href;
            if (destination) {
              startTransition(() => router.push(destination));
            }
          }}
          value={mobileView}
        >
          {mobileViews.map((view) => (
            <option key={view.value} value={view.value}>
              {view.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="community-view-select__icon"
        />
      </label>
    </nav>
  );
};

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

  const applyFilters = (nextSort: CommunitySort, nextSpaceSlug?: string) => {
    startTransition(() =>
      router.push(
        communityHref({ query, sort: nextSort, spaceSlug: nextSpaceSlug })
      )
    );
  };

  return (
    <fieldset className="community-feed-nav">
      <legend className="sr-only">Filtros do feed</legend>
      <label className="community-feed-nav__select-wrap">
        <span className="sr-only">Filtrar por grupo de estudo</span>
        <select
          aria-label="Filtrar por grupo de estudo"
          disabled={isPending}
          onChange={(event) =>
            applyFilters(sort, event.target.value || undefined)
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
            applyFilters(parseCommunitySort(event.target.value), spaceSlug)
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
    </fieldset>
  );
};
