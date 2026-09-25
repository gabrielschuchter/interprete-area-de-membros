import { Button } from "@repo/design-system/components/ui/button";
import type { JSONContent } from "@tiptap/core";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityComposer } from "@/components/community/community-composer";
import { MemberIdentity } from "@/components/community/member-identity";
import { RichDocument } from "@/components/learning/rich-document";
import {
  communityPostHref,
  getCommunityEditorPost,
  getCommunitySpaces,
} from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

interface CommunityEditorPageProperties {
  readonly params: Promise<{ postId: string }>;
  readonly searchParams: Promise<{ preview?: string }>;
}

const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const CommunityEditorPage = async ({
  params,
  searchParams,
}: CommunityEditorPageProperties) => {
  const { postId } = await params;
  const filters = await searchParams;
  const memberId = await requireMemberId();
  const [post, spaces] = await Promise.all([
    getCommunityEditorPost(postId, memberId),
    getCommunitySpaces(),
  ]);

  if (!post) {
    notFound();
  }

  const document = (post.contentJson as JSONContent | null) ?? emptyDocument;
  const backHref =
    post.status === "PUBLISHED"
      ? communityPostHref(post)
      : "/comunidade/meus-topicos";

  if (filters.preview === "1") {
    return (
      <div className="min-h-svh bg-background">
        <main className="mx-auto w-full max-w-[960px] px-5 py-8 sm:px-8 lg:py-14">
          <Button asChild className="-ml-3" variant="ghost">
            <Link href={`/comunidade/editor/${post.id}`}>
              <ArrowLeftIcon aria-hidden="true" /> Voltar para a edição
            </Link>
          </Button>
          <article className="mx-auto mt-10 max-w-3xl">
            <p className="brand-eyebrow">
              Pré-visualização ·{" "}
              {post.kind === "PUBLICATION" ? "publicação" : "discussão"}
            </p>
            <div className="mt-6">
              <MemberIdentity
                authorId={post.authorId}
                profile={post.profile ?? undefined}
              />
            </div>
            <h1 className="mt-6 font-display text-5xl leading-[1.02] sm:text-7xl">
              {post.title}
            </h1>
            {post.subtitle && (
              <p className="mt-5 text-muted-foreground text-xl leading-8 sm:text-2xl">
                {post.subtitle}
              </p>
            )}
            {post.coverUrl && (
              // biome-ignore lint/performance/noImgElement: cover URLs are sanitized user content and may come from hosts not configured for next/image.
              <img
                alt=""
                className="mt-8 max-h-[30rem] w-full rounded-sm border object-cover"
                height={630}
                src={post.coverUrl}
                width={1200}
              />
            )}
            <div className="lesson-document mt-9 text-lg">
              <RichDocument value={document} />
            </div>
          </article>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href={backHref}>
            <ArrowLeftIcon aria-hidden="true" /> Voltar
          </Link>
        </Button>
        <header className="mt-8 max-w-3xl">
          <p className="brand-eyebrow">
            {post.status === "DRAFT" ? "Rascunho privado" : "Edição"} ·{" "}
            {post.kind === "PUBLICATION" ? "publicação" : "discussão"}
          </p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
            {post.status === "DRAFT"
              ? "Escreva com calma. A comunidade espera por boas perguntas."
              : "Dê mais nitidez ao que você publicou."}
          </h1>
          <p className="mt-5 max-w-2xl text-muted-foreground leading-7">
            {post.status === "DRAFT"
              ? "Este rascunho só fica visível para você até o momento em que decidir publicar."
              : "Alterações são salvas somente quando você confirmar. A publicação continua disponível no mesmo endereço."}
          </p>
        </header>
        <CommunityComposer
          initialContent={document}
          initialCoverUrl={post.coverUrl}
          initialKind={post.kind}
          initialSpaceId={post.space?.id ?? null}
          initialSpaceSlug={post.space?.slug ?? null}
          initialSubtitle={post.subtitle}
          initialTags={post.tags}
          initialTitle={post.title}
          postId={post.id}
          spaces={spaces.map(({ id, slug, title }) => ({ id, slug, title }))}
          status={post.status}
        />
      </main>
    </div>
  );
};

export default CommunityEditorPage;
