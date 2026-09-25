import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon, FileTextIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { getMyCommunityPosts } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";
import { MemberHeader } from "../../components/member-header";
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

const MyTopicsPage = async () => {
  const memberId = await requireMemberId();
  const posts = await getMyCommunityPosts(memberId);

  return (
    <div className="min-h-svh bg-background">
      <MemberHeader section="Comunidade" />
      <main className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button asChild className="-ml-3" variant="ghost">
            <Link href="/comunidade">
              <ArrowLeftIcon aria-hidden="true" /> Comunidade
            </Link>
          </Button>
          <Button asChild>
            <Link href="/comunidade/novo">
              <PlusIcon aria-hidden="true" /> Criar tópico
            </Link>
          </Button>
        </div>
        <header className="mt-8 max-w-3xl">
          <p className="brand-eyebrow">Caderno de publicações</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
            Meus tópicos.
          </h1>
          <p className="mt-5 text-muted-foreground leading-7">
            Rascunhos, perguntas publicadas e conversas que você decidiu
            guardar.
          </p>
        </header>
        {posts.length === 0 ? (
          <div className="paper-surface mt-10 border p-8 sm:p-12">
            <FileTextIcon
              aria-hidden="true"
              className="size-6 text-brand-action"
            />
            <h2 className="mt-5 font-display text-3xl">
              Seu caderno está em branco.
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground leading-7">
              Quando uma pergunta aparecer, você pode escrevê-la aqui e voltar a
              ela depois.
            </p>
            <Button asChild className="mt-6">
              <Link href="/comunidade/novo">
                <PlusIcon aria-hidden="true" /> Criar primeiro tópico
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 divide-y border-border border-y">
            {posts.map((post) => (
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
                      <span className="text-muted-foreground text-xs">
                        {post.space.title}
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
                            ? `/comunidade/${post.space.slug}/${post.id}`
                            : `/comunidade/${post.space.slug}/${post.id}/editar`
                        }
                      >
                        {post.title}
                      </Link>
                    </h2>
                    <p className="mt-2 line-clamp-2 text-muted-foreground leading-7">
                      {post.content}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/comunidade/${post.space.slug}/${post.id}/editar`}
                      >
                        Editar
                      </Link>
                    </Button>
                    {post.status !== "PUBLISHED" && (
                      <form action={setPostStatus}>
                        <input name="postId" type="hidden" value={post.id} />
                        <input
                          name="spaceSlug"
                          type="hidden"
                          value={post.space.slug}
                        />
                        <input name="status" type="hidden" value="PUBLISHED" />
                        <Button size="sm" type="submit">
                          Publicar
                        </Button>
                      </form>
                    )}
                    {post.status === "PUBLISHED" && (
                      <form action={setPostStatus}>
                        <input name="postId" type="hidden" value={post.id} />
                        <input
                          name="spaceSlug"
                          type="hidden"
                          value={post.space.slug}
                        />
                        <input name="status" type="hidden" value="ARCHIVED" />
                        <Button size="sm" type="submit" variant="ghost">
                          Arquivar
                        </Button>
                      </form>
                    )}
                    {post.status !== "ARCHIVED" && (
                      <form action={softDeletePost}>
                        <input name="postId" type="hidden" value={post.id} />
                        <input
                          name="spaceSlug"
                          type="hidden"
                          value={post.space.slug}
                        />
                        <Button size="sm" type="submit" variant="ghost">
                          Excluir
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyTopicsPage;
