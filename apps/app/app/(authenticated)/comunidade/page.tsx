import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowRightIcon,
  MessageCircleIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  ThumbsUpIcon,
} from "lucide-react";
import Link from "next/link";
import { MemberIdentity } from "@/components/community/member-identity";
import { getCommunityFeed, getCommunitySpaces } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";
import { MemberHeader } from "../components/member-header";
import { togglePostVote } from "./actions";

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
  const [spaces, feed] = await Promise.all([
    getCommunitySpaces(),
    getCommunityFeed(memberId, {
      query: filters.q,
      sort,
      page,
      spaceSlug: filters.space,
    }),
  ]);

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
    <div className="min-h-svh bg-background">
      <MemberHeader section="Comunidade" />
      <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <header className="flex flex-col justify-between gap-7 border-border border-b pb-8 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="brand-eyebrow">
              Sala de discussão · pensamento em público
            </p>
            <span aria-hidden="true" className="brand-rule mt-4" />
            <h1 className="mt-6 font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
              Perguntas melhores começam em companhia.
            </h1>
            <p className="mt-6 max-w-2xl text-base text-muted-foreground leading-7 sm:text-lg">
              Um lugar para compartilhar dúvidas, ler outras perspectivas e
              construir raciocínios sem transformar conversa em ruído.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/comunidade/novo">
              <PlusIcon aria-hidden="true" /> Criar tópico
            </Link>
          </Button>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section aria-labelledby="feed-heading">
            <div className="flex flex-col gap-4 border-border border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="brand-eyebrow">Feed da comunidade</p>
                <h2 className="mt-2 font-display text-3xl" id="feed-heading">
                  O que está sendo investigado
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
                  placeholder="Buscar por título, texto ou autor"
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
                <p className="brand-eyebrow">Nenhum tópico encontrado</p>
                <h3 className="mt-4 font-display text-3xl">
                  A primeira pergunta pode começar aqui.
                </h3>
                <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
                  Tente outra busca ou abra um tópico para colocar uma dúvida em
                  movimento.
                </p>
                <Button asChild className="mt-6">
                  <Link href="/comunidade/novo">
                    <PlusIcon aria-hidden="true" /> Criar tópico
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-6 divide-y border-border border-y">
                {feed.posts.map((post) => (
                  <article className="py-6" key={post.id}>
                    <div className="flex gap-4">
                      <form
                        action={togglePostVote}
                        className="hidden shrink-0 pt-1 sm:block"
                      >
                        <input name="postId" type="hidden" value={post.id} />
                        <input
                          name="spaceSlug"
                          type="hidden"
                          value={post.space.slug}
                        />
                        <Button
                          aria-label={
                            post.votes.length > 0
                              ? "Remover apoio"
                              : "Apoiar tópico"
                          }
                          size="sm"
                          type="submit"
                          variant={post.votes.length > 0 ? "default" : "ghost"}
                        >
                          <ThumbsUpIcon aria-hidden="true" />{" "}
                          {post._count.votes}
                        </Button>
                      </form>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground text-xs">
                          <MemberIdentity
                            authorId={post.authorId}
                            compact
                            profile={post.profile ?? undefined}
                            showHeadline={false}
                          />
                          <span>·</span>
                          <Link
                            className="hover:text-brand-structural"
                            href={`/comunidade/${post.space.slug}`}
                          >
                            {post.space.title}
                          </Link>
                          <span>·</span>
                          <time dateTime={post.createdAt.toISOString()}>
                            {post.createdAt.toLocaleDateString("pt-BR")}
                          </time>
                        </div>
                        <div className="mt-4 flex items-start gap-3">
                          {post.isPinned && (
                            <PinIcon
                              aria-label="Fixado"
                              className="mt-1 size-4 shrink-0 text-brand-action"
                            />
                          )}
                          <h3 className="font-display text-2xl leading-tight">
                            <Link
                              className="hover:text-brand-structural"
                              href={`/comunidade/${post.space.slug}/${post.id}`}
                            >
                              {post.title}
                            </Link>
                          </h3>
                        </div>
                        <p className="mt-3 line-clamp-3 text-muted-foreground leading-7">
                          {post.content}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-muted-foreground text-xs">
                          <span className="inline-flex items-center gap-1.5">
                            <MessageCircleIcon
                              aria-hidden="true"
                              className="size-3.5"
                            />{" "}
                            {post._count.comments} respostas
                          </span>
                          <span className="sm:hidden">
                            {post._count.votes} apoios
                          </span>
                          {post.profile?.headline && (
                            <span>{post.profile.headline}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
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
                      Mais tópicos <ArrowRightIcon aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </nav>
            )}
          </section>

          <aside className="h-fit">
            <div className="flex items-end justify-between border-border border-b pb-4">
              <div>
                <p className="brand-eyebrow">Salas abertas</p>
                <h2 className="mt-2 font-display text-2xl">
                  Espaços de estudo
                </h2>
              </div>
              <Badge variant="outline">{spaces.length}</Badge>
            </div>
            <div className="divide-y border-border border-b">
              {spaces.map((space) => (
                <Link
                  className="group block py-4"
                  href={`/comunidade/${space.slug}`}
                  key={space.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium group-hover:text-brand-structural">
                      {space.title}
                    </span>
                    <ArrowRightIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
                    />
                  </div>
                  <span className="mt-1 block text-muted-foreground text-xs">
                    {space._count.posts} tópicos
                  </span>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default CommunityPage;
