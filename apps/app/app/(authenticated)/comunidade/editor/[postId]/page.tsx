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
    getCommunitySpaces(memberId),
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
        <main className="community-post-shell mx-auto w-full">
          <Button asChild className="community-post-back" variant="ghost">
            <Link href={`/comunidade/editor/${post.id}`}>
              <ArrowLeftIcon aria-hidden="true" /> Voltar para a edição
            </Link>
          </Button>
          <article className="community-post-article community-post-preview">
            <div className="community-post-meta-row">
              <div className="community-post-meta">
                {post.space && (
                  <span className="community-post-group">
                    {post.space.title}
                  </span>
                )}
                <time
                  dateTime={(post.publishedAt ?? post.createdAt).toISOString()}
                >
                  {(post.publishedAt ?? post.createdAt).toLocaleDateString(
                    "pt-BR"
                  )}
                </time>
              </div>
              <span className="community-post-preview-label">
                Pré-visualização
              </span>
            </div>
            <h1 className="community-post-title">{post.title}</h1>
            {post.subtitle && (
              <p className="community-post-subtitle">{post.subtitle}</p>
            )}
            <div className="community-post-author">
              <MemberIdentity
                authorId={post.authorId}
                compact
                profile={post.profile ?? undefined}
                showHeadline={false}
              />
            </div>
            {post.coverUrl && (
              // biome-ignore lint/performance/noImgElement: cover URLs are sanitized user content and may come from hosts not configured for next/image.
              <img
                alt=""
                className="community-post-cover"
                height={630}
                src={post.coverUrl}
                width={1200}
              />
            )}
            <div className="lesson-document community-post-body">
              <RichDocument value={document} />
            </div>
          </article>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <main className="community-editor-shell mx-auto w-full">
        <h1 className="sr-only">Escrever publicação</h1>
        <CommunityComposer
          backHref={backHref}
          initialContent={document}
          initialCoverUrl={post.coverUrl}
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
