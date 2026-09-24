import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon, MessageCircleIcon, ThumbsUpIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommunityPost } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";
import { MemberHeader } from "../../../components/member-header";
import {
  createComment,
  toggleCommentVote,
  togglePostVote,
} from "../../actions";

interface CommunityPostPageProperties {
  readonly params: Promise<{ spaceSlug: string; postId: string }>;
}

const CommunityPostPage = async ({ params }: CommunityPostPageProperties) => {
  const { spaceSlug, postId } = await params;
  const memberId = await requireMemberId();
  const post = await getCommunityPost(spaceSlug, postId, memberId);

  if (!post) {
    notFound();
  }

  const topLevel = post.comments.filter((comment) => !comment.parentId);
  const repliesFor = (parentId: string) =>
    post.comments.filter((comment) => comment.parentId === parentId);

  return (
    <div className="min-h-svh bg-background">
      <MemberHeader section="Comunidade" />
      <main className="mx-auto w-full max-w-[960px] px-5 py-8 sm:px-8 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href={`/comunidade/${post.space.slug}`}>
            <ArrowLeftIcon aria-hidden="true" /> {post.space.title}
          </Link>
        </Button>
        <article className="mt-8 border-border border-b pb-10">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={post.votes.length > 0 ? "default" : "outline"}>
              <ThumbsUpIcon aria-hidden="true" /> {post._count.votes} apoios
            </Badge>
            <span className="text-muted-foreground text-xs">
              por membro · {post._count.comments} respostas
            </span>
          </div>
          <h1 className="mt-5 max-w-4xl font-display text-5xl leading-[1.02] sm:text-6xl">
            {post.title}
          </h1>
          <p className="mt-7 max-w-3xl whitespace-pre-wrap text-lg text-muted-foreground leading-8">
            {post.content}
          </p>
          <form action={togglePostVote} className="mt-7">
            <input name="postId" type="hidden" value={post.id} />
            <input name="spaceSlug" type="hidden" value={post.space.slug} />
            <Button
              size="sm"
              type="submit"
              variant={post.votes.length > 0 ? "default" : "outline"}
            >
              <ThumbsUpIcon aria-hidden="true" />{" "}
              {post.votes.length > 0 ? "Apoiado" : "Apoiar"}
            </Button>
          </form>
        </article>
        <section aria-labelledby="comments-heading" className="mt-10">
          <div className="flex items-center justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="comments-heading">
              Discussão
            </h2>
            <span className="flex items-center gap-2 text-muted-foreground text-xs">
              <MessageCircleIcon aria-hidden="true" /> {post.comments.length}
            </span>
          </div>
          <form
            action={createComment}
            className="paper-surface mt-5 border p-5 sm:p-6"
          >
            <input name="postId" type="hidden" value={post.id} />
            <input name="spaceSlug" type="hidden" value={post.space.slug} />
            <label className="block" htmlFor="comment-content">
              <span className="brand-eyebrow">Sua contribuição</span>
              <textarea
                className="mt-3 min-h-32 w-full rounded-sm border bg-background px-3 py-3 text-base leading-7 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
                id="comment-content"
                name="content"
                placeholder="Acrescente uma leitura, uma pergunta ou uma referência..."
                required
              />
            </label>
            <div className="mt-4 flex justify-end">
              <Button type="submit">Responder</Button>
            </div>
          </form>
          <div className="mt-8 space-y-5">
            {topLevel.length === 0 ? (
              <p className="text-muted-foreground">
                Ainda não há respostas. A conversa pode começar com você.
              </p>
            ) : (
              topLevel.map((comment) => (
                <div
                  className="border-border border-l-2 pl-4 sm:pl-6"
                  key={comment.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="brand-eyebrow">Membro</span>
                    <span className="text-muted-foreground text-xs">
                      · {comment._count.votes} apoios
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap leading-7">
                    {comment.content}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <form action={toggleCommentVote}>
                      <input
                        name="commentId"
                        type="hidden"
                        value={comment.id}
                      />
                      <input name="postId" type="hidden" value={post.id} />
                      <input
                        name="spaceSlug"
                        type="hidden"
                        value={post.space.slug}
                      />
                      <Button
                        size="sm"
                        type="submit"
                        variant={comment.votes.length > 0 ? "default" : "ghost"}
                      >
                        <ThumbsUpIcon aria-hidden="true" />{" "}
                        {comment.votes.length > 0 ? "Apoiado" : "Apoiar"}
                      </Button>
                    </form>
                    <span className="text-muted-foreground text-xs">
                      {repliesFor(comment.id).length} respostas
                    </span>
                  </div>
                  {repliesFor(comment.id).map((reply) => (
                    <div
                      className="mt-5 border-border border-t pt-5 pl-4 sm:pl-6"
                      key={reply.id}
                    >
                      <span className="brand-eyebrow">Membro · resposta</span>
                      <p className="mt-2 whitespace-pre-wrap leading-7">
                        {reply.content}
                      </p>
                      <form action={toggleCommentVote} className="mt-2">
                        <input
                          name="commentId"
                          type="hidden"
                          value={reply.id}
                        />
                        <input name="postId" type="hidden" value={post.id} />
                        <input
                          name="spaceSlug"
                          type="hidden"
                          value={post.space.slug}
                        />
                        <Button
                          size="sm"
                          type="submit"
                          variant={reply.votes.length > 0 ? "default" : "ghost"}
                        >
                          <ThumbsUpIcon aria-hidden="true" />{" "}
                          {reply.votes.length > 0 ? "Apoiado" : "Apoiar"}
                        </Button>
                      </form>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </section>
        <form
          action={createComment}
          className="mt-8 border-border border-t pt-8"
        >
          <input name="postId" type="hidden" value={post.id} />
          <input name="spaceSlug" type="hidden" value={post.space.slug} />
          <input name="parentId" type="hidden" value={topLevel[0]?.id ?? ""} />
          <input
            aria-label="Responder à primeira contribuição"
            className="h-11 w-full rounded-sm border bg-background px-3 text-sm"
            name="content"
            placeholder="Responder à primeira contribuição..."
            required
          />
          <Button className="mt-3" size="sm" type="submit">
            Enviar resposta
          </Button>
        </form>
      </main>
    </div>
  );
};

export default CommunityPostPage;
