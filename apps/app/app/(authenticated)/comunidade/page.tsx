import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { tracePerformance } from "@repo/observability/performance";
import { ArrowRightIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { cache, Suspense } from "react";
import { CommunityEmptyState } from "@/components/community/community-empty-state";
import { CommunityFeedCard } from "@/components/community/community-feed-card";
import { CommunityHero } from "@/components/community/community-hero";
import {
  CommunityFeedNavigation,
  CommunityNavigation,
} from "@/components/community/community-navigation";
import { CommunityRightRail } from "@/components/community/community-right-rail";
import { Stagger } from "@/components/motion/motion";
import { FilterForm } from "@/components/navigation/filter-form";
import {
  getCommunityFeed,
  getCommunityPresenceProfiles,
  getCommunitySpaces,
} from "@/lib/community";
import { communityHref, parseCommunitySort } from "@/lib/community-query";
import { requireMemberId } from "@/lib/learning";
import { getRecentCommunityAnnouncements } from "@/lib/notifications";
import { getOrCreateProfile } from "@/lib/profile";

const whitespacePattern = /\s+/;

const getPageCommunitySpaces = cache((memberId: string) =>
  getCommunitySpaces(memberId)
);

const CommunitySpaceFilterOptions = async ({
  memberId,
  selectedSlug,
}: {
  readonly memberId: string;
  readonly selectedSlug?: string;
}) => {
  const spaces = await getPageCommunitySpaces(memberId);

  return (
    <select
      aria-label="Filtrar por grupo de estudo"
      className="h-10 rounded-sm border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
      defaultValue={selectedSlug ?? ""}
      name="space"
    >
      <option value="">Todos os grupos</option>
      {spaces.map((space) => (
        <option key={space.slug} value={space.slug}>
          {space.title}
        </option>
      ))}
    </select>
  );
};

const CommunitySpaceFilterFallback = ({
  selectedSlug,
}: {
  readonly selectedSlug?: string;
}) => (
  <select
    aria-label="Filtrar por grupo de estudo"
    className="h-10 rounded-sm border bg-background px-3 text-sm"
    defaultValue={selectedSlug ?? ""}
    name="space"
  >
    <option value="">Todos os grupos</option>
    {selectedSlug ? <option value={selectedSlug}>{selectedSlug}</option> : null}
  </select>
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

const CommunityComposer = async ({
  memberId,
}: {
  readonly memberId: string;
}) => {
  const profile = await getOrCreateProfile(memberId);
  const composerInitials = (profile?.displayName ?? "Você")
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <section
      aria-labelledby="community-composer-heading"
      className="community-composer mt-5"
    >
      <div className="community-composer__inner">
        <h2 className="sr-only" id="community-composer-heading">
          Criar uma publicação
        </h2>
        <div className="community-composer__intro">
          <span className="brand-eyebrow">Participe</span>
          <p>
            Compartilhe uma ideia, uma pergunta ou uma referência com a
            comunidade.
          </p>
        </div>
        <Link
          aria-label="Escreva uma publicação"
          className="community-composer__prompt group -m-2 flex min-w-0 items-center gap-3 rounded-sm p-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
          href="/comunidade/novo"
        >
          <Avatar className="size-10 shrink-0">
            {profile?.avatarUrl ? (
              <AvatarImage alt="" src={profile.avatarUrl} />
            ) : null}
            <AvatarFallback className="bg-brand-structural text-primary-foreground text-xs">
              {composerInitials || "V"}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-base text-muted-foreground group-hover:text-foreground">
            Escreva uma publicação...
          </span>
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand-structural"
          />
        </Link>
      </div>
    </section>
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
        <Stagger className="mt-7 grid gap-5">
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
              <Link href={queryString(feed.page - 1)}>Anterior</Link>
            </Button>
          ) : (
            <span />
          )}
          {feed.hasMore && (
            <Button asChild variant="outline">
              <Link href={queryString(feed.page + 1)}>
                Mais conteúdo <ArrowRightIcon aria-hidden="true" />
              </Link>
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
        className="community-shell mx-auto w-full max-w-[1560px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:px-10"
        data-route-structure-ready="community"
      >
        <CommunityHero />

        <Suspense fallback={<CommunityComposerFallback />}>
          <CommunityComposer memberId={memberId} />
        </Suspense>

        <CommunityNavigation active="explore" />

        <div className="community-content-grid mt-8 grid gap-8">
          <section aria-labelledby="feed-heading" className="min-w-0">
            <div className="flex flex-col gap-4 border-border border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="brand-eyebrow">Feed da comunidade</p>
                <h2 className="mt-2 font-display text-3xl" id="feed-heading">
                  O que está sendo pensado
                </h2>
              </div>
            </div>

            <CommunityFeedNavigation
              query={filters.q}
              sort={sort}
              spaceSlug={filters.space}
            />

            <FilterForm
              action="/comunidade"
              className="community-search mt-6 flex flex-col gap-3 sm:flex-row"
            >
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Buscar na comunidade</span>
                <SearchIcon
                  aria-hidden="true"
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  className="h-10 w-full rounded-sm border bg-background pr-3 pl-10 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
                  defaultValue={filters.q ?? ""}
                  name="q"
                  placeholder="Buscar na comunidade"
                />
              </label>
              <Suspense
                fallback={
                  <CommunitySpaceFilterFallback selectedSlug={filters.space} />
                }
              >
                <CommunitySpaceFilterOptions
                  memberId={memberId}
                  selectedSlug={filters.space}
                />
              </Suspense>
              <input name="sort" type="hidden" value={sort} />
              <Button type="submit" variant="outline">
                Buscar
              </Button>
            </FilterForm>

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

          <Suspense fallback={<CommunityRightRailFallback />}>
            <CommunityRightRailData memberId={memberId} />
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default CommunityPage;
