import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { FileTextIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { CommunityNavigation } from "@/components/community/community-navigation";
import { CommunityPublishDraftButton } from "@/components/community/community-publish-draft-button";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { communityPostHref, getMyCommunityPosts } from "@/lib/community";
import { communityPostKindLabel } from "@/lib/community-post-types";
import { requireMemberId } from "@/lib/learning";
import { setPostStatus, softDeletePost } from "../actions";

const statusLabel = (status: string) => {
  if (status === "DRAFT") {
    return "Rascunho";
  }
  if (status === "ARCHIVED") {
    return "Arquivado";
  }
  return "Publicado";
};

const MyCommunityPage = async () => {
  const memberId = await requireMemberId();
  const posts = await getMyCommunityPosts(memberId);

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <CommunityNavigation active="mine" />
        <div className="mt-4 flex justify-end">
          <Button asChild>
            <Link href="/comunidade/novo">
              <PlusIcon aria-hidden="true" /> Criar conteúdo
            </Link>
          </Button>
        </div>
        <header className="mt-8 max-w-3xl">
          <p className="brand-eyebrow">Caderno de escrita</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
            Minhas publicações.
          </h1>
          <p className="mt-5 text-muted-foreground leading-7">
            Rascunhos, textos publicados e discussões que você decidiu construir
            aqui.
          </p>
        </header>
        {posts.length === 0 ? (
          <div className="paper-surface mt-10 border p-8 sm:p-12">
            <FileTextIcon
              aria-hidden="true"
              className="size-6 text-brand-action"
            />
            <h2 className="mt-5 font-display text-3xl">
              Você ainda não publicou nada.
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground leading-7">
              Comece por uma pergunta curta ou escreva uma publicação mais
              elaborada.
            </p>
            <Button asChild className="mt-6">
              <Link href="/comunidade/novo">
                <PlusIcon aria-hidden="true" /> Criar sua primeira publicação
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 divide-y border-border border-y">
            {posts.map((post) => {
              const editHref = `/comunidade/editor/${post.id}`;
              return (
                <article className="py-6" key={post.id}>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            post.status === "PUBLISHED" ? "default" : "outline"
                          }
                        >
                          {statusLabel(post.status)}
                        </Badge>
                        <Badge variant="outline">
                          {communityPostKindLabel(post.kind)}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {post.space?.title ?? "Feed geral"}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          · {post._count.comments} respostas
                        </span>
                      </div>
                      <h2 className="mt-3 font-display text-2xl">
                        <Link
                          className="hover:text-brand-structural"
                          href={
                            post.status === "PUBLISHED"
                              ? communityPostHref(post)
                              : editHref
                          }
                        >
                          {post.title}
                        </Link>
                      </h2>
                      <p className="mt-2 line-clamp-2 text-muted-foreground leading-7">
                        {post.subtitle ?? post.excerpt}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={editHref}>Editar</Link>
                      </Button>
                      {post.status === "DRAFT" && (
                        <CommunityPublishDraftButton
                          editHref={editHref}
                          postId={post.id}
                          spaceSlug={post.space?.slug ?? ""}
                        />
                      )}
                      {post.status === "PUBLISHED" && (
                        <SingleFlightForm action={setPostStatus}>
                          <input name="postId" type="hidden" value={post.id} />
                          <input
                            name="spaceSlug"
                            type="hidden"
                            value={post.space?.slug ?? ""}
                          />
                          <input name="status" type="hidden" value="ARCHIVED" />
                          <SingleFlightSubmit size="sm" variant="ghost">
                            Arquivar
                          </SingleFlightSubmit>
                        </SingleFlightForm>
                      )}
                      {post.status !== "ARCHIVED" && (
                        <SingleFlightForm action={softDeletePost}>
                          <input name="postId" type="hidden" value={post.id} />
                          <input
                            name="spaceSlug"
                            type="hidden"
                            value={post.space?.slug ?? ""}
                          />
                          <SingleFlightSubmit size="sm" variant="ghost">
                            Excluir
                          </SingleFlightSubmit>
                        </SingleFlightForm>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyCommunityPage;
