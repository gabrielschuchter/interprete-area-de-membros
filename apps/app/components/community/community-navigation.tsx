import Link from "next/link";
import type { CommunityPostKindValue } from "@/lib/community-post-types";
import {
  COMMUNITY_KIND_FILTER_OPTIONS,
  COMMUNITY_SORT_OPTIONS,
  type CommunitySort,
  communityHref,
} from "@/lib/community-query";

type CommunityPrimarySection = "explore" | "mine" | "saved";

const primaryLinks = [
  { href: "/comunidade", label: "Explorar", value: "explore" },
  {
    href: "/comunidade/meus-topicos",
    label: "Minhas publicações",
    value: "mine",
  },
  { href: "/comunidade/salvos", label: "Salvos", value: "saved" },
] as const;

interface CommunityNavigationProperties {
  readonly active: CommunityPrimarySection;
}

export const CommunityNavigation = ({
  active,
}: CommunityNavigationProperties) => (
  <nav aria-label="Navegação da comunidade" className="community-section-nav">
    <div className="community-section-nav__heading">
      <span className="brand-eyebrow">Comunidade</span>
    </div>
    <div className="community-section-nav__links">
      {primaryLinks.map((link) => (
        <Link
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
        </Link>
      ))}
    </div>
  </nav>
);

interface CommunityFeedNavigationProperties {
  readonly kind?: CommunityPostKindValue;
  readonly query?: string;
  readonly sort: CommunitySort;
  readonly spaceSlug?: string;
}

export const CommunityFeedNavigation = ({
  kind,
  query,
  sort,
  spaceSlug,
}: CommunityFeedNavigationProperties) => (
  <nav aria-label="Descoberta do feed" className="community-feed-nav">
    <div className="community-feed-nav__group community-feed-nav__sort">
      <span className="community-filter-label">Ordenar por</span>
      <div className="community-feed-nav__sort-links">
        {COMMUNITY_SORT_OPTIONS.map((option) => (
          <Link
            aria-current={option.value === sort ? "page" : undefined}
            className={
              option.value === sort
                ? "community-feed-nav__sort-link community-feed-nav__sort-link--active"
                : "community-feed-nav__sort-link"
            }
            href={communityHref({ kind, query, sort: option.value, spaceSlug })}
            key={option.value}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
    <div className="community-feed-nav__group community-feed-nav__kinds">
      <span className="community-filter-label">Formato</span>
      <div className="community-feed-nav__kind-links">
        {COMMUNITY_KIND_FILTER_OPTIONS.map((option) => {
          const isActive =
            option.value === "ALL" ? !kind : option.value === kind;
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "community-feed-nav__kind community-feed-nav__kind--active"
                  : "community-feed-nav__kind"
              }
              href={communityHref({
                kind: option.value === "ALL" ? undefined : option.value,
                query,
                sort,
                spaceSlug,
              })}
              key={option.value}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  </nav>
);
