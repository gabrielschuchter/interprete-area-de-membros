import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import {
  communityPostHref,
  getStaffCommunityPosts,
  getStaffCommunitySpaces,
} from "@/lib/community";
import {
  createSpace,
  setSpaceStatus,
  softDeletePost,
} from "../../comunidade/actions";

const AdminCommunityPage = async () => {
  const [spaces, posts] = await Promise.all([
    getStaffCommunitySpaces(),
    getStaffCommunityPosts(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4"
        href="/admin"
      >
        ← Área do professor
      </Link>
      <header className="mt-10 max-w-3xl">
        <p className="brand-eyebrow">Professor · comunidade</p>
        <h1 className="mt-4 font-display text-5xl leading-none">
          Cuide da sala sem interromper a conversa.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Crie espaços de discussão e remova apenas o que realmente precisa
          sair. O soft delete preserva o fio da conversa.
        </p>
      </header>
      <section className="paper-surface mt-10 border p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3 border-border border-b pb-4">
          <div>
            <p className="brand-eyebrow">Moderação</p>
            <h2 className="mt-2 font-display text-3xl">Todo o conteúdo</h2>
          </div>
          <span className="font-data text-muted-foreground text-xs">
            {posts.length} itens recentes
          </span>
        </div>
        {posts.length === 0 ? (
          <p className="py-6 text-muted-foreground">
            Ainda não há publicações ou discussões.
          </p>
        ) : (
          <div className="divide-y border-border border-b">
            {posts.map((post) => (
              <div
                className="flex flex-wrap items-center justify-between gap-4 py-4"
                key={post.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
                    <Badge variant="outline">
                      {post.kind === "PUBLICATION" ? "Publicação" : "Discussão"}
                    </Badge>
                    <Badge
                      variant={
                        post.status === "PUBLISHED" ? "default" : "outline"
                      }
                    >
                      {post.status}
                    </Badge>
                    <span>{post.space?.title ?? "Feed geral"}</span>
                  </div>
                  <p className="mt-2 font-medium">{post.title}</p>
                  {post.status === "PUBLISHED" && (
                    <Link
                      className="mt-1 inline-block text-brand-structural text-xs underline underline-offset-4"
                      href={communityPostHref(post)}
                    >
                      Abrir publicação
                    </Link>
                  )}
                </div>
                <form action={softDeletePost}>
                  <input name="postId" type="hidden" value={post.id} />
                  <input
                    name="spaceSlug"
                    type="hidden"
                    value={post.space?.slug ?? ""}
                  />
                  <Button size="sm" type="submit" variant="outline">
                    Remover
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section>
          <h2 className="border-border border-b pb-3 font-display text-3xl">
            Salas e perguntas
          </h2>
          <div className="mt-5 grid gap-5">
            {spaces.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma sala criada.</p>
            ) : (
              spaces.map((space) => (
                <article className="paper-surface border p-6" key={space.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="brand-eyebrow">/{space.slug}</p>
                      <h3 className="mt-2 font-display text-2xl">
                        {space.title}
                      </h3>
                    </div>
                    <Badge
                      variant={
                        space.status === "PUBLISHED" ? "default" : "outline"
                      }
                    >
                      {space.status}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {space.status !== "PUBLISHED" && (
                      <form action={setSpaceStatus}>
                        <input name="spaceId" type="hidden" value={space.id} />
                        <input name="status" type="hidden" value="PUBLISHED" />
                        <Button size="sm" type="submit">
                          Publicar sala
                        </Button>
                      </form>
                    )}
                    {space.status === "PUBLISHED" && (
                      <form action={setSpaceStatus}>
                        <input name="spaceId" type="hidden" value={space.id} />
                        <input name="status" type="hidden" value="ARCHIVED" />
                        <Button size="sm" type="submit" variant="outline">
                          Arquivar sala
                        </Button>
                      </form>
                    )}
                  </div>
                  <div className="mt-5 divide-y border-border border-y">
                    {space.posts.length === 0 ? (
                      <p className="py-4 text-muted-foreground text-sm">
                        Sem posts.
                      </p>
                    ) : (
                      space.posts.map((post) => (
                        <div
                          className="flex items-center justify-between gap-4 py-4"
                          key={post.id}
                        >
                          <div>
                            <p className="font-medium">{post.title}</p>
                            <p className="mt-1 text-muted-foreground text-xs">
                              {post.authorId === "seed:development"
                                ? "Fixture de desenvolvimento"
                                : "Membro"}
                            </p>
                          </div>
                          <form action={softDeletePost}>
                            <input
                              name="postId"
                              type="hidden"
                              value={post.id}
                            />
                            <input
                              name="spaceSlug"
                              type="hidden"
                              value={space.slug}
                            />
                            <Button size="sm" type="submit" variant="outline">
                              Remover
                            </Button>
                          </form>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
        <aside className="paper-surface border p-6 lg:sticky lg:top-24">
          <p className="brand-eyebrow">Novo espaço</p>
          <form action={createSpace} className="mt-5 space-y-4">
            <label className="block" htmlFor="space-title">
              <span className="brand-eyebrow">Título</span>
              <Input className="mt-2" id="space-title" name="title" required />
            </label>
            <label className="block" htmlFor="space-slug">
              <span className="brand-eyebrow">Slug</span>
              <Input className="mt-2" id="space-slug" name="slug" required />
            </label>
            <label className="block" htmlFor="space-description">
              <span className="brand-eyebrow">Descrição</span>
              <Textarea
                className="mt-2 min-h-24"
                id="space-description"
                name="description"
              />
            </label>
            <Button className="w-full" type="submit">
              Salvar como rascunho
            </Button>
          </form>
        </aside>
      </div>
    </main>
  );
};

export default AdminCommunityPage;
