import { Button } from "@repo/design-system/components/ui/button";
import { tracePerformance } from "@repo/observability/performance";
import { ArrowRightIcon } from "lucide-react";
import { cache, Suspense } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { CommunityComposerPrompt } from "@/components/community/community-composer-prompt";
import { CommunityEmptyState } from "@/components/community/community-empty-state";
import { CommunityFeedCard } from "@/components/community/community-feed-card";
import { CommunityHero } from "@/components/community/community-hero";
import {
  CommunityFeedNavigation,
  CommunityNavigation,
} from "@/components/community/community-navigation";
import { CommunityRightRail } from "@/components/community/community-right-rail";
import { Stagger } from "@/components/motion/motion";
import {
  getCommunityFeed,
  getCommunityPresenceProfiles,
  getCommunitySpaces,
} from "@/lib/community";
import { communityHref, parseCommunitySort } from "@/lib/community-query";
import { requireMemberId } from "@/lib/learning";
import { getRecentCommunityAnnouncements } from "@/lib/notifications";
import { getOrCreateProfile } from "@/lib/profile";

const getPageCommunitySpaces = cache((memberId: string) =>
  getCommunitySpaces(memberId)
);

const CommunityRightRailData = async ({
  memberId,
  query,
  sort,
  spaceSlug,
}: {
  readonly memberId: string;
  readonly query?: string;
  readonly sort: ReturnType<typeof parseCommunitySort>;
  readonly spaceSlug?: string;
}) => {
  const [spaces, profile, announcements, presenceProfiles] =
    await tracePerformance("member.route.community.secondary-data", () =>
      Promise.all([
        getPageCommunitySpaces(memberId),
        getOrCreateProfile(memberId),
        getRecentCommunityAnnouncements(memberId),
        getCommunityPresenceProfiles(memberId),
      ])
    );

  return (
    <CommunityRightRail
      announcements={announcements}
      memberId={memberId}
      presenceProfiles={presenceProfiles}
      profile={profile}
      query={query}
      sort={sort}
      spaceSlug={spaceSlug}
      spaces={spaces}
    />
  );
};

const CommunityFeedNavigationData = async ({
  memberId,
  query,
  sort,
  spaceSlug,
}: {
  readonly memberId: string;
  readonly query?: string;
  readonly sort: ReturnType<typeof parseCommunitySort>;
  readonly spaceSlug?: string;
}) => {
  const spaces = await getPageCommunitySpaces(memberId);
  return (
    <CommunityFeedNavigation
      query={query}
      sort={sort}
      spaceSlug={spaceSlug}
      spaces={spaces.map(({ slug, title }) => ({ slug, title }))}
    />
  );
};

const CommunityFeedContent = async ({
  filters,
  hasDiscoveryFilters,
  memberId,
  page,
  sort,
}: {
  readonly filters: { readonly q?: string; readonly space?: string };
  readonly hasDiscoveryFilters: boolean;
  readonly memberId: string;
  readonly page: number;
  readonly sort: ReturnType<typeof parseCommunitySort>;
}) => {
  const feed = await tracePerformance("member.route.community.feed", () =>
    getCommunityFeed(memberId, {
      query: filters.q,
      sort,
      page,
      spaceSlug: filters.space,
    })
  );
  const queryString = (nextPage: number) =>
    communityHref({
      page: nextPage,
      query: filters.q,
      sort,
      spaceSlug: filters.space,
    });

  return (
    <div data-route-content-ready="community">
      {feed.posts.length === 0 ? (
        <CommunityEmptyState hasFilters={hasDiscoveryFilters} sort={sort} />
      ) : (
        <Stagger className="community-feed-list">
          {feed.posts.map((post) => (
            <CommunityFeedCard key={post.id} post={post} />
          ))}
        </Stagger>
      )}
      {(feed.page > 1 || feed.hasMore) && (
        <nav
          aria-label="Paginação do feed"
          className="mt-8 flex justify-between gap-3"
        >
          {feed.page > 1 ? (
            <Button asChild variant="outline">
              <IntentLink href={queryString(feed.page - 1)}>
                Anterior
              </IntentLink>
            </Button>
          ) : (
            <span />
          )}
          {feed.hasMore && (
            <Button asChild variant="outline">
              <IntentLink href={queryString(feed.page + 1)}>
                Mais conteúdo <ArrowRightIcon aria-hidden="true" />
              </IntentLink>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
};

const CommunityFeedFallback = () => (
  <section
    aria-busy="true"
    aria-label="Carregando publicações"
    className="mt-7 space-y-5"
  >
    <span className="sr-only">Carregando publicações</span>
    {[0, 1, 2].map((item) => (
      <div
        className="h-48 animate-pulse rounded-sm border bg-muted/40"
        key={item}
      />
    ))}
  </section>
);

const CommunityComposerFallback = () => (
  <section
    aria-busy="true"
    aria-label="Carregando campo de publicação"
    className="community-composer mt-5"
  >
    <div className="community-composer__inner">
      <div className="h-3 w-20 animate-pulse rounded-sm bg-muted" />
      <div className="mt-3 h-12 w-full animate-pulse rounded-sm bg-muted" />
    </div>
  </section>
);

const CommunityRightRailFallback = () => (
  <aside
    aria-busy="true"
    aria-label="Carregando contexto da comunidade"
    className="community-right-rail h-fit space-y-6"
  >
    <div className="community-rail__block space-y-3">
      <span className="sr-only">Carregando contexto da comunidade</span>
      <div className="h-3 w-32 animate-pulse rounded-sm bg-muted" />
      <div className="h-12 w-full animate-pulse rounded-sm bg-muted" />
    </div>
    <div className="community-rail__block space-y-3">
      <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-sm bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-sm bg-muted" />
    </div>
  </aside>
);

interface CommunityPageProperties {
  readonly searchParams: Promise<{
    q?: string;
    sort?: string;
    page?: string;
    space?: string;
  }>;
}

const CommunityPage = async ({ searchParams }: CommunityPageProperties) => {
  const [filters, memberId] = await Promise.all([
    searchParams,
    requireMemberId(),
  ]);
  const sort = parseCommunitySort(filters.sort);
  const page = Number.parseInt(filters.page ?? "1", 10);
  const hasDiscoveryFilters = Boolean(
    filters.q || filters.space || sort !== "recent"
  );

  return (
    <div className="community-page min-h-svh bg-background">
      <main
        className="community-shell mx-auto w-full"
        data-route-structure-ready="community"
      >
        <CommunityHero />
        <div className="community-content-grid">
          <div className="community-discovery-toolbar">
            <CommunityNavigation active="explore" />
            <Suspense
              fallback={
                <div aria-busy="true" className="community-feed-nav">
                  <span className="sr-only">Carregando filtros</span>
                  <span className="community-filter-placeholder" />
                  <span className="community-filter-placeholder" />
                </div>
              }
            >
              <CommunityFeedNavigationData
                memberId={memberId}
                query={filters.q}
                sort={sort}
                spaceSlug={filters.space}
              />
            </Suspense>
          </div>
          <Suspense fallback={<CommunityRightRailFallback />}>
            <CommunityRightRailData
              memberId={memberId}
              query={filters.q}
              sort={sort}
              spaceSlug={filters.space}
            />
          </Suspense>
          <Suspense fallback={<CommunityComposerFallback />}>
            <CommunityComposerPrompt memberId={memberId} />
          </Suspense>
          <section
            aria-label="Publicações da comunidade"
            className="community-feed-area min-w-0"
          >
            <Suspense fallback={<CommunityFeedFallback />}>
              <CommunityFeedContent
                filters={{ q: filters.q, space: filters.space }}
                hasDiscoveryFilters={hasDiscoveryFilters}
                memberId={memberId}
                page={page}
                sort={sort}
              />
            </Suspense>
          </section>
        </div>
      </main>
    </div>
  );
};

export default CommunityPage;
