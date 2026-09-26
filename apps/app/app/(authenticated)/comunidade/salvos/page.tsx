import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon, BookmarkIcon } from "lucide-react";
import Link from "next/link";
import { MemberIdentity } from "@/components/community/member-identity";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { communityPostHref, getSavedCommunityPosts } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";
import { toggleBookmark } from "../actions";

const SavedCommunityPage = async () => {
  const memberId = await requireMemberId();
  const posts = await getSavedCommunityPosts(memberId);

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href="/comunidade">
            <ArrowLeftIcon aria-hidden="true" /> Comunidade
          </Link>
        </Button>
        <header className="mt-8 max-w-3xl">
          <p className="brand-eyebrow">Caderno de leitura</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
            Salvos.
          </h1>
          <p className="mt-5 text-muted-foreground leading-7">
            Guarde publicações e discussões para voltar a elas quando tiver
            tempo de ler com atenção.
          </p>
        </header>
        {posts.length === 0 ? (
          <div className="paper-surface mt-10 border p-8 sm:p-12">
            <BookmarkIcon
              aria-hidden="true"
              className="size-6 text-brand-action"
            />
            <h2 className="mt-5 font-display text-3xl">
              Nenhuma leitura foi salva.
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground leading-7">
              Quando um conteúdo merecer uma segunda leitura, use Salvar para
              encontrá-lo aqui.
            </p>
            <Button asChild className="mt-6">
              <Link href="/comunidade">Explorar a comunidade</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 divide-y border-border border-y">
            {posts.map((post) => (
              <article className="py-6" key={post.id}>
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
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {post.kind === "PUBLICATION"
                          ? "Publicação"
                          : "Discussão"}
                      </Badge>
                      <h2 className="font-display text-2xl">
                        <Link
                          className="hover:text-brand-structural"
                          href={communityPostHref(post)}
                        >
                          {post.title}
                        </Link>
                      </h2>
                    </div>
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
                      <BookmarkIcon aria-hidden="true" fill="currentColor" />{" "}
                      Remover
                    </SingleFlightSubmit>
                  </SingleFlightForm>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SavedCommunityPage;
