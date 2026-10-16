import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon, BookmarkIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { CommunityNavigation } from "@/components/community/community-navigation";
import { MemberIdentity } from "@/components/community/member-identity";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { communityPostHref, getSavedCommunityPosts } from "@/lib/community";
import {
  COMMUNITY_KIND_OPTIONS,
  communitySavedHref,
  parseCommunityKind,
} from "@/lib/community-query";
import { requireMemberId } from "@/lib/learning";
import { toggleBookmark } from "../actions";

interface SavedCommunityPageProperties {
  readonly searchParams: Promise<{
    readonly cursor?: string;
    readonly q?: string;
    readonly tipo?: string;
  }>;
}

const SavedCommunityPage = async ({
  searchParams,
}: SavedCommunityPageProperties) => {
  const [memberId, filters] = await Promise.all([
    requireMemberId(),
    searchParams,
  ]);
  const query = filters.q?.trim().slice(0, 100) ?? "";
  const kind = parseCommunityKind(filters.tipo);
  const saved = await getSavedCommunityPosts(memberId, {
    cursor: filters.cursor,
    kind,
    query,
    take: 10,
  });
  const posts = saved.posts;
  const nextHref = saved.nextCursor
    ? communitySavedHref({
        cursor: saved.nextCursor,
        kind,
        query,
      })
    : null;
  const returnTo = communitySavedHref({
    cursor: filters.cursor,
    kind,
    query,
  });

  return (
    <main className="mx-auto min-h-svh w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <CommunityNavigation active="saved" />
      <header className="mt-7 flex flex-col gap-5 border-border border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="brand-eyebrow">Comunidade</p>
          <h1 className="mt-3 font-display text-4xl leading-none sm:text-5xl">
            Salvos
          </h1>
          <p className="mt-3 text-muted-foreground leading-7">
            Publicações que você guardou ficam aqui.
          </p>
        </div>
        <Button asChild className="min-h-11 shrink-0" variant="outline">
          <Link href="/salvos">
            Ver salvos de toda a plataforma{" "}
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </header>

      <search
        aria-label="Buscar publicações salvas"
        className="mt-6 border-b pb-5"
      >
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]"
          method="get"
        >
          <label className="relative min-w-0">
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
              placeholder="Buscar publicações salvas"
              type="search"
            />
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
          <Button className="h-11" type="submit" variant="outline">
            Buscar
          </Button>
        </form>
      </search>

      <p
        aria-live="polite"
        className="mt-4 text-right font-data text-muted-foreground text-xs uppercase tracking-[.08em]"
      >
        {saved.totalCount}{" "}
        {saved.totalCount === 1 ? "ITEM SALVO" : "ITENS SALVOS"}
      </p>

      {posts.length > 0 ? (
        <section aria-label="Publicações salvas" className="mt-8">
          <ul className="divide-y border-border border-y">
            {posts.map((post) => (
              <li key={post.id}>
                <article className="py-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                        <MemberIdentity
                          authorId={post.authorId}
                          compact
                          profile={post.profile ?? undefined}
                          showHeadline={false}
                        />
                        <span>·</span>
                        <span>{post.space?.title ?? "Feed geral"}</span>
                        <span>·</span>
                        <span>{post._count.comments} respostas</span>
                      </div>
                      <h2 className="mt-4 font-display text-2xl">
                        <Link
                          className="hover:text-brand-structural"
                          href={communityPostHref(post, returnTo)}
                        >
                          {post.title}
                        </Link>
                      </h2>
                      <p className="mt-2 line-clamp-2 text-muted-foreground leading-7">
                        {post.subtitle ?? post.excerpt}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <SingleFlightForm
                      action={toggleBookmark}
                      className="shrink-0"
                    >
                      <input name="postId" type="hidden" value={post.id} />
                      <input
                        name="spaceSlug"
                        type="hidden"
                        value={post.space?.slug ?? ""}
                      />
                      <input name="desired" type="hidden" value="off" />
                      <SingleFlightSubmit
                        pendingLabel="Salvando…"
                        size="sm"
                        variant="ghost"
                      >
                        <BookmarkIcon aria-hidden="true" fill="currentColor" />
                        Remover
                      </SingleFlightSubmit>
                    </SingleFlightForm>
                  </div>
                </article>
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
            {query || kind
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
              Carregar mais publicações <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : null}
    </main>
  );
};

export default SavedCommunityPage;
