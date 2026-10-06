import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import {
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
  </nav>
);

interface CommunityFeedNavigationProperties {
  readonly query?: string;
  readonly sort: CommunitySort;
  readonly spaceSlug?: string;
}

export const CommunityFeedNavigation = ({
  query,
  sort,
  spaceSlug,
}: CommunityFeedNavigationProperties) => (
  <nav aria-label="Descoberta do feed" className="community-feed-nav">
    <div className="community-feed-nav__group community-feed-nav__sort">
      <span className="community-filter-label">Ordenar por</span>
      <div className="community-feed-nav__sort-links">
        {COMMUNITY_SORT_OPTIONS.map((option) => (
          <IntentLink
            aria-current={option.value === sort ? "page" : undefined}
            className={
              option.value === sort
                ? "community-feed-nav__sort-link community-feed-nav__sort-link--active"
                : "community-feed-nav__sort-link"
            }
            href={communityHref({ query, sort: option.value, spaceSlug })}
            key={option.value}
          >
            {option.label}
          </IntentLink>
        ))}
      </div>
    </div>
  </nav>
);
