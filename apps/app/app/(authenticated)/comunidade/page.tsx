import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowRightIcon,
  BookmarkIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { CommunityFeedCard } from "@/components/community/community-feed-card";
import { CommunityHero } from "@/components/community/community-hero";
import { CommunityRightRail } from "@/components/community/community-right-rail";
import { Stagger } from "@/components/motion/motion";
import { getCommunityFeed, getCommunitySpaces } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";
import { getRecentCommunityAnnouncements } from "@/lib/notifications";
import { getOrCreateProfile } from "@/lib/profile";

const whitespacePattern = /\s+/;

interface CommunityPageProperties {
  readonly searchParams: Promise<{
    q?: string;
    sort?: string;
    page?: string;
    space?: string;
  }>;
}

const CommunityPage = async ({ searchParams }: CommunityPageProperties) => {
  const filters = await searchParams;
  const memberId = await requireMemberId();
  const sort = filters.sort === "popular" ? "popular" : "recent";
  const page = Number.parseInt(filters.page ?? "1", 10);
  const [spaces, feed, profile, announcements] = await Promise.all([
    getCommunitySpaces(),
    getCommunityFeed(memberId, {
      query: filters.q,
      sort,
      page,
      spaceSlug: filters.space,
    }),
    getOrCreateProfile(memberId, false),
    getRecentCommunityAnnouncements(memberId),
  ]);

  const composerInitials = (profile?.displayName ?? "Você")
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const queryString = (nextPage: number) => {
    const params = new URLSearchParams();
    if (filters.q) {
      params.set("q", filters.q);
    }
    if (sort === "popular") {
      params.set("sort", sort);
    }
    if (filters.space) {
      params.set("space", filters.space);
    }
    params.set("page", String(nextPage));
    return `/comunidade?${params.toString()}`;
  };

  return (
    <div className="community-page min-h-svh bg-background">
      <main className="community-shell mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:px-10">
        <CommunityHero />

        <section
          aria-labelledby="community-composer-heading"
          className="community-composer mt-5"
        >
          <div className="p-4 sm:p-5">
            <h2 className="sr-only" id="community-composer-heading">
              Criar uma publicação
            </h2>
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
            <div className="mt-4 flex flex-col gap-3 border-border border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm">
                Use o editor existente para publicar uma ideia ou abrir uma
                discussão.
              </p>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button asChild className="shrink-0">
                  <Link href="/comunidade/novo">
                    <PlusIcon aria-hidden="true" /> Criar conteúdo
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/comunidade/meus-topicos">
                    Minhas publicações
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/comunidade/salvos">
                    <BookmarkIcon aria-hidden="true" /> Salvos
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="community-content-grid mt-8 grid gap-8 xl:grid-cols-[minmax(0,780px)_minmax(280px,320px)] xl:justify-between xl:gap-8">
          <section aria-labelledby="feed-heading" className="min-w-0">
            <div className="flex flex-col gap-4 border-border border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="brand-eyebrow">Feed da comunidade</p>
                <h2 className="mt-2 font-display text-3xl" id="feed-heading">
                  O que está sendo pensado
                </h2>
              </div>
              <div className="flex gap-2 text-sm">
                <Link
                  className={
                    sort === "recent"
                      ? "font-medium text-brand-structural"
                      : "text-muted-foreground"
                  }
                  href={`/comunidade${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ""}`}
                >
                  Recentes
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link
                  className={
                    sort === "popular"
                      ? "font-medium text-brand-structural"
                      : "text-muted-foreground"
                  }
                  href={`/comunidade?sort=popular${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`}
                >
                  Populares
                </Link>
              </div>
            </div>

            <form className="mt-5 flex flex-col gap-3 sm:flex-row" method="get">
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
                  placeholder="Buscar publicações, discussões ou autores"
                />
              </label>
              <select
                aria-label="Filtrar por espaço"
                className="h-10 rounded-sm border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
                defaultValue={filters.space ?? ""}
                name="space"
              >
                <option value="">Todos os espaços</option>
                {spaces.map((space) => (
                  <option key={space.slug} value={space.slug}>
                    {space.title}
                  </option>
                ))}
              </select>
              <input name="sort" type="hidden" value={sort} />
              <Button type="submit" variant="outline">
                Buscar
              </Button>
            </form>

            {feed.posts.length === 0 ? (
              <div className="paper-surface mt-6 border p-8 sm:p-12">
                <p className="brand-eyebrow">Nenhum conteúdo encontrado</p>
                <h3 className="mt-4 font-display text-3xl">
                  A primeira ideia pode começar aqui.
                </h3>
                <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
                  Tente outra busca ou escreva uma publicação para colocar uma
                  ideia em movimento.
                </p>
                <Button asChild className="mt-6">
                  <Link href="/comunidade/novo">
                    <PlusIcon aria-hidden="true" /> Criar conteúdo
                  </Link>
                </Button>
              </div>
            ) : (
              <Stagger className="mt-6 divide-y border-border border-y">
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
          </section>

          <CommunityRightRail
            announcements={announcements}
            profile={profile}
            spaces={spaces}
          />
        </div>
      </main>
    </div>
  );
};

export default CommunityPage;
