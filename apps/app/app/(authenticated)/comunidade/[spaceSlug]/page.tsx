import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityFeedCard } from "@/components/community/community-feed-card";
import { getCommunitySpace } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

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
                <CommunityFeedCard
                  key={post.id}
                  post={post}
                  spaceSlug={space.slug}
                />
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
