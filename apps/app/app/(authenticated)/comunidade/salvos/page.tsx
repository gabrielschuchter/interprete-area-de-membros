import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowRightIcon,
  BookmarkIcon,
  ExternalLinkIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { CommunityFeedCard } from "@/components/community/community-feed-card";
import { CommunityNavigation } from "@/components/community/community-navigation";
import { CommunitySelectSubmitForm } from "@/components/community/community-select-submit-form";
import { getCommunitySpaces, getSavedCommunityPosts } from "@/lib/community";
import {
  COMMUNITY_KIND_OPTIONS,
  COMMUNITY_SORT_OPTIONS,
  communitySavedHref,
  parseCommunityKind,
  parseCommunitySort,
} from "@/lib/community-query";
import { requireMemberId } from "@/lib/learning";

interface SavedCommunityPageProperties {
  readonly searchParams: Promise<{
    readonly cursor?: string;
    readonly q?: string;
    readonly sort?: string;
    readonly space?: string;
    readonly tipo?: string;
  }>;
}

interface SavedCommunityFiltersProperties {
  readonly kind: (typeof COMMUNITY_KIND_OPTIONS)[number]["value"] | undefined;
  readonly query: string;
  readonly sort: (typeof COMMUNITY_SORT_OPTIONS)[number]["value"];
  readonly spaceSlug: string | undefined;
  readonly spaces: readonly { readonly slug: string; readonly title: string }[];
}

const SavedCommunityFilters = ({
  kind,
  query,
  sort,
  spaceSlug,
  spaces,
}: SavedCommunityFiltersProperties) => (
  <CommunitySelectSubmitForm
    className="community-saved-filters grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_176px_120px_136px]"
    method="get"
  >
    <label className="relative min-w-0 sm:col-span-2 lg:col-span-1">
      <span className="sr-only">Buscar nos salvos da comunidade</span>
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        aria-label="Buscar nos salvos da comunidade"
        className="h-11 w-full border bg-background pr-3 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={query}
        name="q"
        placeholder="Buscar na comunidade"
        type="search"
      />
    </label>
    <label>
      <span className="sr-only">Filtrar salvos por grupo</span>
      <select
        aria-label="Filtrar salvos por grupo"
        className="h-11 w-full border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={spaceSlug ?? ""}
        name="space"
      >
        <option value="">Todos os grupos</option>
        {spaces.map((space) => (
          <option key={space.slug} value={space.slug}>
            {space.title}
          </option>
        ))}
      </select>
    </label>
    <label>
      <span className="sr-only">Filtrar salvos por tipo</span>
      <select
        aria-label="Filtrar salvos por tipo"
        className="h-11 w-full border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={kind ?? ""}
        name="tipo"
      >
        <option value="">Tudo</option>
        {COMMUNITY_KIND_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
    <label>
      <span className="sr-only">Ordenar salvos</span>
      <select
        aria-label="Ordenar salvos"
        className="h-11 w-full border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={sort}
        name="sort"
      >
        {COMMUNITY_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  </CommunitySelectSubmitForm>
);

const SavedCommunityPage = async ({
  searchParams,
}: SavedCommunityPageProperties) => {
  const [memberId, filters] = await Promise.all([
    requireMemberId(),
    searchParams,
  ]);
  const spaces = await getCommunitySpaces(memberId);
  const requestedSpaceSlug = filters.space?.trim().slice(0, 100);
  const spaceSlug = spaces.some((space) => space.slug === requestedSpaceSlug)
    ? requestedSpaceSlug
    : undefined;
  const query = filters.q?.trim().slice(0, 100) ?? "";
  const kind = parseCommunityKind(filters.tipo);
  const sort = parseCommunitySort(filters.sort);
  const saved = await getSavedCommunityPosts(memberId, {
    cursor: filters.cursor,
    kind,
    query,
    sort,
    spaceSlug,
    take: 10,
  });
  const nextHref = saved.nextCursor
    ? communitySavedHref({
        cursor: saved.nextCursor,
        kind,
        query,
        sort,
        spaceSlug,
      })
    : null;
  const returnTo = communitySavedHref({
    cursor: filters.cursor,
    kind,
    query,
    sort,
    spaceSlug,
  });
  const savedFilters = (
    <SavedCommunityFilters
      kind={kind}
      query={query}
      sort={sort}
      spaceSlug={spaceSlug}
      spaces={spaces}
    />
  );

  return (
    <div className="community-page min-h-svh bg-background">
      <main className="community-shell community-saved-shell mx-auto w-full">
        <CommunityNavigation active="saved" />
        <header className="community-saved-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h1 className="sr-only font-display text-4xl leading-none sm:text-5xl md:not-sr-only">
              Salvos da comunidade
            </h1>
            <p className="mt-3 hidden text-muted-foreground leading-7 md:block">
              O que você guardou aqui, sem sair da Comunidade.
            </p>
          </div>
          <Button
            asChild
            className="min-h-11 w-full shrink-0 justify-start sm:w-auto"
            variant="outline"
          >
            <Link href="/salvos">
              <BookmarkIcon aria-hidden="true" />
              Ver salvos de toda a plataforma
              <ExternalLinkIcon aria-hidden="true" className="ml-auto" />
            </Link>
          </Button>
        </header>

        <details className="mt-4 border-b pb-3 md:hidden">
          <summary className="cursor-pointer py-2 font-medium text-sm">
            Buscar e filtrar
          </summary>
          <div className="pt-3">{savedFilters}</div>
        </details>
        <search
          aria-label="Buscar publicações salvas"
          className="community-saved-search hidden md:block"
        >
          {savedFilters}
        </search>

        {saved.posts.length > 0 ? (
          <section aria-label="Publicações salvas" className="mt-5">
            <ul className="community-feed-list">
              {saved.posts.map((post) => (
                <li key={post.id}>
                  <CommunityFeedCard
                    post={post}
                    returnTo={returnTo}
                    variant="saved"
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="paper-surface mt-10 border p-8 sm:p-12">
            <BookmarkIcon
              aria-hidden="true"
              className="size-6 text-brand-action-text"
            />
            <h2 className="mt-5 font-display text-3xl">
              {query || kind || spaceSlug
                ? "Nenhuma publicação corresponde aos filtros."
                : "Você ainda não salvou publicações."}
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
              Guarde uma publicação da Comunidade para encontrá-la aqui.
            </p>
            <Button asChild className="mt-6">
              <Link href="/comunidade">Explorar publicações</Link>
            </Button>
          </section>
        )}
        {nextHref ? (
          <div className="mt-8 flex justify-center">
            <Button asChild variant="outline">
              <Link href={nextHref}>
                Carregar mais salvos <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default SavedCommunityPage;
