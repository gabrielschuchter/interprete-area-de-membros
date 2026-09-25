import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { ArrowLeftIcon, EyeIcon, SaveIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopicDraftComposer } from "@/components/community/topic-draft-composer";
import { TopicEditor } from "@/components/community/topic-editor";
import { RichDocument } from "@/components/learning/rich-document";
import { getMemberRole } from "@/lib/authorization";
import { getCommunitySpaces } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";
import { MemberHeader } from "../../../../components/member-header";
import { updatePost } from "../../../actions";

interface EditTopicPageProperties {
  readonly params: Promise<{ spaceSlug: string; postId: string }>;
  readonly searchParams: Promise<{ preview?: string }>;
}

const EditTopicPage = async ({
  params,
  searchParams,
}: EditTopicPageProperties) => {
  const { spaceSlug, postId } = await params;
  const filters = await searchParams;
  const memberId = await requireMemberId();
  await getMemberRole(memberId);
  const [post, spaces] = await Promise.all([
    database.communityPost.findFirst({
      where: {
        id: postId,
        authorId: memberId,
        deletedAt: null,
        space: { slug: spaceSlug, status: "PUBLISHED" },
      },
      select: {
        id: true,
        title: true,
        content: true,
        contentJson: true,
        tags: true,
        status: true,
        space: { select: { id: true, slug: true, title: true } },
      },
    }),
    getCommunitySpaces(),
  ]);

  if (!post) {
    notFound();
  }

  const fallbackDocument = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: post.content }] },
    ],
  };

  if (filters.preview === "1") {
    return (
      <div className="min-h-svh bg-background">
        <MemberHeader section="Comunidade" />
        <main className="mx-auto w-full max-w-[920px] px-5 py-8 sm:px-8 lg:py-14">
          <Button asChild className="-ml-3" variant="ghost">
            <Link href={`/comunidade/${post.space.slug}/${post.id}/editar`}>
              <ArrowLeftIcon aria-hidden="true" /> Voltar para a edição
            </Link>
          </Button>
          <article className="mt-10 max-w-3xl">
            <p className="brand-eyebrow">
              Pré-visualização · {post.space.title}
            </p>
            <h1 className="mt-5 font-display text-5xl leading-none sm:text-6xl">
              {post.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span className="text-muted-foreground text-xs" key={tag}>
                  #{tag}
                </span>
              ))}
            </div>
            <div className="lesson-document mt-8 text-lg">
              {post.contentJson ? (
                <RichDocument value={post.contentJson} />
              ) : (
                <p className="whitespace-pre-wrap text-muted-foreground leading-8">
                  {post.content}
                </p>
              )}
            </div>
          </article>
        </main>
      </div>
    );
  }

  if (post.status === "DRAFT") {
    return (
      <div className="min-h-svh bg-background">
        <MemberHeader section="Comunidade" />
        <main className="mx-auto w-full max-w-[920px] px-5 py-8 sm:px-8 lg:py-14">
          <Button asChild className="-ml-3" variant="ghost">
            <Link href="/comunidade/meus-topicos">
              <ArrowLeftIcon aria-hidden="true" /> Meus tópicos
            </Link>
          </Button>
          <header className="mt-8 max-w-3xl">
            <p className="brand-eyebrow">Rascunho · {post.space.title}</p>
            <span aria-hidden="true" className="brand-rule mt-4" />
            <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
              Continue pensando em público.
            </h1>
          </header>
          <TopicDraftComposer
            initialContent={
              (post.contentJson as Parameters<
                typeof TopicEditor
              >[0]["defaultValue"]) ?? fallbackDocument
            }
            initialTags={post.tags}
            initialTitle={post.title}
            postId={post.id}
            spaceId={post.space.id}
            spaceSlug={post.space.slug}
            spaces={spaces.map(({ id, slug, title }) => ({ id, slug, title }))}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <MemberHeader section="Comunidade" />
      <main className="mx-auto w-full max-w-[920px] px-5 py-8 sm:px-8 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href={`/comunidade/${post.space.slug}/${post.id}`}>
            <ArrowLeftIcon aria-hidden="true" /> Voltar para o tópico
          </Link>
        </Button>
        <header className="mt-8">
          <p className="brand-eyebrow">{post.space.title} · edição</p>
          <h1 className="mt-4 font-display text-5xl leading-none">
            Dê mais nitidez à sua pergunta.
          </h1>
        </header>
        <form
          action={updatePost}
          className="paper-surface mt-10 space-y-7 border p-5 sm:p-9"
        >
          <input name="postId" type="hidden" value={post.id} />
          <input name="spaceSlug" type="hidden" value={post.space.slug} />
          <label className="block" htmlFor="edit-topic-title">
            <span className="brand-eyebrow">Título</span>
            <Input
              className="mt-2 h-12 font-display text-xl"
              defaultValue={post.title}
              id="edit-topic-title"
              name="title"
              required
            />
          </label>
          <div className="block">
            <span className="brand-eyebrow">Texto</span>
            <div className="mt-3">
              <TopicEditor
                defaultValue={
                  (post.contentJson as Parameters<
                    typeof TopicEditor
                  >[0]["defaultValue"]) ?? fallbackDocument
                }
              />
            </div>
          </div>
          <label className="block" htmlFor="edit-topic-tags">
            <span className="brand-eyebrow">Tags</span>
            <Input
              className="mt-2"
              defaultValue={post.tags.join(", ")}
              id="edit-topic-tags"
              name="tags"
              placeholder="epidemiologia, causalidade"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-3 border-border border-t pt-6">
            <Button asChild variant="ghost">
              <Link href={`/comunidade/${post.space.slug}/${post.id}`}>
                Cancelar
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/comunidade/${post.space.slug}/${post.id}/editar?preview=1`}
              >
                <EyeIcon aria-hidden="true" /> Pré-visualizar
              </Link>
            </Button>
            <Button name="status" type="submit" value={post.status}>
              <SaveIcon aria-hidden="true" /> Salvar alterações
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default EditTopicPage;
