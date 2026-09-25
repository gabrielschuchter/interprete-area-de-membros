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
import { getCommunitySpace } from "@/lib/community";
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
            <p className="brand-eyebrow">Sala de discussão · /{space.slug}</p>
            <h1 className="mt-4 font-display text-5xl leading-none sm:text-6xl">
              {space.title}
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground leading-7">
              {space.description}
            </p>
          </div>
          <Button asChild>
            <Link href={`/comunidade/${space.slug}/novo`}>
              <PlusIcon aria-hidden="true" /> Nova pergunta
            </Link>
          </Button>
        </header>
        <section aria-labelledby="posts-heading" className="mt-10">
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="posts-heading">
              Perguntas recentes
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              Página {space.page}
            </span>
          </div>
          {space.posts.length === 0 ? (
            <div className="paper-surface mt-5 border p-8">
              <p className="text-muted-foreground">
                Esta sala ainda não tem perguntas. Seja a primeira pessoa a
                abrir uma investigação.
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
                            : "Apoiar pergunta"
                        }
                        size="sm"
                        type="submit"
                        variant={post.votes.length > 0 ? "default" : "ghost"}
                      >
                        <ThumbsUpIcon aria-hidden="true" /> {post._count.votes}
                      </Button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <MemberIdentity
                          authorId={post.authorId}
                          compact
                          profile={post.profile ?? undefined}
                          showHeadline={false}
                        />
                        {post.isPinned && (
                          <span className="brand-eyebrow text-brand-action">
                            Fixado
                          </span>
                        )}
                        <span className="text-muted-foreground text-xs">
                          · {post._count.comments} respostas
                        </span>
                      </div>
                      <h3 className="mt-3 font-display text-2xl">
                        <Link
                          className="hover:text-brand-structural"
                          href={`/comunidade/${space.slug}/${post.id}`}
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 line-clamp-3 text-muted-foreground leading-7">
                        {post.content}
                      </p>
                      <Link
                        className="mt-4 inline-flex items-center gap-2 font-medium text-brand-structural text-sm"
                        href={`/comunidade/${space.slug}/${post.id}`}
                      >
                        Ler thread{" "}
                        <ArrowRightIcon aria-hidden="true" className="size-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {(space.page > 1 || space.hasMorePosts) && (
            <nav
              aria-label="Paginação da sala"
              className="mt-8 flex flex-wrap justify-between gap-3"
            >
              {space.page > 1 ? (
                <Button asChild variant="outline">
                  <Link
                    href={`/comunidade/${space.slug}?page=${space.page - 1}`}
                  >
                    Página anterior
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
                    Próxima página
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
