import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { ArrowLeftIcon, SaveIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopicEditor } from "@/components/community/topic-editor";
import { getMemberRole } from "@/lib/authorization";
import { requireMemberId } from "@/lib/learning";
import { MemberHeader } from "../../../../components/member-header";
import { updatePost } from "../../../actions";

interface EditTopicPageProperties {
  readonly params: Promise<{ spaceSlug: string; postId: string }>;
}

const EditTopicPage = async ({ params }: EditTopicPageProperties) => {
  const { spaceSlug, postId } = await params;
  const memberId = await requireMemberId();
  await getMemberRole(memberId);
  const post = await database.communityPost.findFirst({
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
      status: true,
      space: { select: { slug: true, title: true } },
    },
  });

  if (!post) {
    notFound();
  }

  const fallbackDocument = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: post.content }] },
    ],
  };
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
          <div className="flex flex-wrap justify-end gap-3 border-border border-t pt-6">
            <Button asChild variant="ghost">
              <Link href={`/comunidade/${post.space.slug}/${post.id}`}>
                Cancelar
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
