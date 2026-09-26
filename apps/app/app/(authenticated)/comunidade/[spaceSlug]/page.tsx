import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusIcon,
  ThumbsUpIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberIdentity } from "@/components/community/member-identity";
import { communityPostHref, getCommunitySpace } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";
import { togglePostVote } from "../actions";

interface CommunitySpacePageProperties {
  readonly params: Promise<{ spaceSlug: string }>;
  readonly searchParams: Promise<{ page?: string }>;
}

const CommunitySpacePage = async ({
  params,
  searchParams,
}: CommunitySpacePageProperties) => {
  const { spaceSlug } = await params;
  const filters = await searchParams;
  const memberId = await requireMemberId();
  const page = Number.parseInt(filters.page ?? "1", 10);
  const space = await getCommunitySpace(spaceSlug, memberId, page);

  if (!space) {
    notFound();
  }

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href="/comunidade">
            <ArrowLeftIcon aria-hidden="true" /> Todas as salas
          </Link>
        </Button>
        <header className="mt-8 flex flex-col justify-between gap-6 border-border border-b pb-8 md:flex-row md:items-end">
          <div>
            <p className="brand-eyebrow">Espaço de estudo · /{space.slug}</p>
            <h1 className="mt-4 font-display text-5xl leading-none sm:text-6xl">
              {space.title}
            </h1>
            {space.description && (
              <p className="mt-4 max-w-2xl text-muted-foreground leading-7">
                {space.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {space.commentsClosed && (
              <Badge variant="outline">Comentários fechados</Badge>
            )}
            <Button asChild>
              <Link href={`/comunidade/${space.slug}/novo`}>
                <PlusIcon aria-hidden="true" /> Criar aqui
              </Link>
            </Button>
          </div>
        </header>
        <section aria-labelledby="posts-heading" className="mt-10">
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="posts-heading">
              Conteúdo recente
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              Página {space.page}
            </span>
          </div>
          {space.posts.length === 0 ? (
            <div className="paper-surface mt-5 border p-8">
              <p className="text-muted-foreground">
                Este espaço ainda não tem conteúdo. Seja a primeira pessoa a
                escrever.
              </p>
            </div>
          ) : (
            <div className="mt-5 divide-y border-border border-y">
              {space.posts.map((post) => (
                <article className="py-6" key={post.id}>
                  <div className="flex items-start gap-4">
                    <form action={togglePostVote} className="pt-1">
                      <input name="postId" type="hidden" value={post.id} />
                      <input
                        name="spaceSlug"
                        type="hidden"
                        value={space.slug}
                      />
                      <Button
                        aria-label={
                          post.votes.length > 0
                            ? "Remover apoio"
                            : "Apoiar conteúdo"
                        }
                        size="sm"
                        type="submit"
                        variant={post.votes.length > 0 ? "default" : "ghost"}
                      >
                        <ThumbsUpIcon aria-hidden="true" /> {post._count.votes}
                      </Button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                        <MemberIdentity
                          authorId={post.authorId}
                          compact
                          profile={post.profile ?? undefined}
                          showHeadline={false}
                        />
                        <span>·</span>
                        <span>
                          {(
                            post.publishedAt ?? post.createdAt
                          ).toLocaleDateString("pt-BR")}
                        </span>
                        {post.isPinned && (
                          <Badge variant="secondary">Fixado</Badge>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {post.kind === "PUBLICATION"
                            ? "Publicação"
                            : "Discussão"}
                        </Badge>
                        <h3 className="font-display text-2xl leading-tight">
                          <Link
                            className="hover:text-brand-structural"
                            href={communityPostHref(post)}
                          >
                            {post.title}
                          </Link>
                        </h3>
                      </div>
                      <p className="mt-3 line-clamp-3 text-muted-foreground leading-7">
                        {post.subtitle ?? post.excerpt}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-4 text-muted-foreground text-xs">
                        <span>{post._count.comments} respostas</span>
                        <span>{post.readingMinutes} min de leitura</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {(space.page > 1 || space.hasMorePosts) && (
            <nav
              aria-label="Paginação do espaço"
              className="mt-8 flex justify-between gap-3"
            >
              {space.page > 1 ? (
                <Button asChild variant="outline">
                  <Link
                    href={`/comunidade/${space.slug}?page=${space.page - 1}`}
                  >
                    Anterior
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              {space.hasMorePosts && (
                <Button asChild variant="outline">
                  <Link
                    href={`/comunidade/${space.slug}?page=${space.page + 1}`}
                  >
                    Mais conteúdo <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </nav>
          )}
        </section>
      </main>
    </div>
  );
};

export default CommunitySpacePage;
