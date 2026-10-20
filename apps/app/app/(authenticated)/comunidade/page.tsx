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
import {
  communityHref,
  parseCommunityKind,
  parseCommunitySort,
} from "@/lib/community-query";
import { requireMemberId } from "@/lib/learning";
import { getRecentCommunityAnnouncements } from "@/lib/notifications";
import { getOrCreateProfile } from "@/lib/profile";

const getPageCommunitySpaces = cache((memberId: string) =>
  getCommunitySpaces(memberId)
);

const CommunityRightRailData = async ({
  memberId,
}: {
  readonly memberId: string;
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
      spaces={spaces}
    />
  );
};

const CommunityFeedNavigationData = async ({
  kind,
  memberId,
  query,
  sort,
  spaceSlug,
}: {
  readonly kind?: ReturnType<typeof parseCommunityKind>;
  readonly memberId: string;
  readonly query?: string;
  readonly sort: ReturnType<typeof parseCommunitySort>;
  readonly spaceSlug?: string;
}) => {
  const spaces = await getPageCommunitySpaces(memberId);
  return (
    <CommunityFeedNavigation
      kind={kind}
      query={query}
      sort={sort}
      spaceSlug={spaceSlug}
      spaces={spaces.map(({ slug, title }) => ({ slug, title }))}
    />
  );
};

const CommunityFeedContent = async ({
  cursor,
  filters,
  hasDiscoveryFilters,
  memberId,
  sort,
}: {
  readonly cursor?: string;
  readonly filters: {
    readonly kind?: ReturnType<typeof parseCommunityKind>;
    readonly q?: string;
    readonly space?: string;
  };
  readonly hasDiscoveryFilters: boolean;
  readonly memberId: string;
  readonly sort: ReturnType<typeof parseCommunitySort>;
}) => {
  const feed = await tracePerformance("member.route.community.feed", () =>
    getCommunityFeed(memberId, {
      query: filters.q,
      sort,
      cursor,
      kind: filters.kind,
      spaceSlug: filters.space,
    })
  );
  const queryString = (nextCursor: string | undefined) =>
    communityHref({
      cursor: nextCursor,
      kind: filters.kind,
      query: filters.q,
      sort,
      spaceSlug: filters.space,
    });

  return (
    <div data-route-content-ready="community">
      {feed.posts.length === 0 ? (
        <CommunityEmptyState
          hasFilters={hasDiscoveryFilters}
          query={filters.q}
          sort={sort}
        />
      ) : (
        <Stagger className="community-feed-list">
          {feed.posts.map((post) => (
            <CommunityFeedCard
              key={post.id}
              post={post}
              returnTo={communityHref({
                cursor,
                kind: filters.kind,
                query: filters.q,
                sort,
                spaceSlug: filters.space,
              })}
              variant="explore"
            />
          ))}
        </Stagger>
      )}
      {feed.hasMore && feed.nextCursor ? (
        <nav
          aria-label="Paginação do feed"
          className="mt-8 flex justify-center"
        >
          <Button asChild variant="outline">
            <IntentLink href={queryString(feed.nextCursor)}>
              Carregar mais publicações <ArrowRightIcon aria-hidden="true" />
            </IntentLink>
          </Button>
        </nav>
      ) : null}
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
    cursor?: string;
    q?: string;
    sort?: string;
    tipo?: string;
    space?: string;
  }>;
}

const CommunityPage = async ({ searchParams }: CommunityPageProperties) => {
  const [filters, memberId] = await Promise.all([
    searchParams,
    requireMemberId(),
  ]);
  const sort = parseCommunitySort(filters.sort);
  const kind = parseCommunityKind(filters.tipo);
  const hasDiscoveryFilters = Boolean(
    filters.q || kind || filters.space || sort !== "recent"
  );

  return (
    <div className="community-page min-h-svh bg-background">
      <main
        className="community-shell mx-auto w-full"
        data-route-structure-ready="community"
      >
        <CommunityNavigation active="explore" />
        <div className="community-content-grid community-content-grid--explore">
          <CommunityHero />
          <Suspense
            fallback={
              <div aria-busy="true" className="community-feed-nav">
                <span className="sr-only">Carregando filtros</span>
                {[0, 1, 2, 3].map((item) => (
                  <span className="community-filter-placeholder" key={item} />
                ))}
              </div>
            }
          >
            <CommunityFeedNavigationData
              kind={kind}
              memberId={memberId}
              query={filters.q}
              sort={sort}
              spaceSlug={filters.space}
            />
          </Suspense>
          <Suspense fallback={<CommunityRightRailFallback />}>
            <CommunityRightRailData memberId={memberId} />
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
                cursor={filters.cursor}
                filters={{ kind, q: filters.q, space: filters.space }}
                hasDiscoveryFilters={hasDiscoveryFilters}
                memberId={memberId}
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
