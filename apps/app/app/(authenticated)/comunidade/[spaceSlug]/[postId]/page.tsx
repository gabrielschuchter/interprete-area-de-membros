import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon, MessageCircleIcon, ThumbsUpIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberIdentity } from "@/components/community/member-identity";
import { RichDocument } from "@/components/learning/rich-document";
import { getMemberRole } from "@/lib/authorization";
import { getCommunityPost } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";
import { MemberHeader } from "../../../components/member-header";
import {
  createComment,
  setPostStatus,
  softDeletePost,
  toggleCommentVote,
  togglePostPin,
  togglePostVote,
  updateComment,
} from "../../actions";

interface CommunityPostPageProperties {
  readonly params: Promise<{ spaceSlug: string; postId: string }>;
  readonly searchParams: Promise<{ commentsPage?: string }>;
}

type CommunityComment = NonNullable<
  Awaited<ReturnType<typeof getCommunityPost>>
>["comments"][number];

interface CommentThreadProperties {
  readonly comment: CommunityComment;
  readonly comments: readonly CommunityComment[];
  readonly depth: number;
  readonly memberId: string;
  readonly postId: string;
  readonly spaceSlug: string;
}

const CommentThread = ({
  comment,
  comments,
  postId,
  spaceSlug,
  memberId,
  depth,
}: CommentThreadProperties) => {
  const replies = comments.filter(({ parentId }) => parentId === comment.id);

  return (
    <div
      className={
        depth === 0
          ? "border-border border-l-2 pl-4 sm:pl-6"
          : "border-border border-t pt-5 pl-4 sm:pl-6"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <MemberIdentity
          authorId={comment.authorId}
          compact
          profile={comment.profile ?? undefined}
          showHeadline={false}
        />
        {depth > 0 && <span className="brand-eyebrow">Resposta</span>}
        <span className="text-muted-foreground text-xs">
          · {comment._count.votes} apoios
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap leading-7">{comment.content}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <form action={toggleCommentVote}>
          <input name="commentId" type="hidden" value={comment.id} />
          <input name="postId" type="hidden" value={postId} />
          <input name="spaceSlug" type="hidden" value={spaceSlug} />
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
          {replies.length} respostas
        </span>
        <details>
          <summary className="cursor-pointer text-muted-foreground text-xs underline underline-offset-4">
            Responder
          </summary>
          <form action={createComment} className="mt-3 grid gap-3">
            <input name="postId" type="hidden" value={postId} />
            <input name="spaceSlug" type="hidden" value={spaceSlug} />
            <input name="parentId" type="hidden" value={comment.id} />
            <textarea
              aria-label={`Responder a ${comment.content.slice(0, 40)}`}
              className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
              name="content"
              placeholder="Escreva uma resposta..."
              required
            />
            <Button className="w-fit" size="sm" type="submit">
              Enviar resposta
            </Button>
          </form>
        </details>
        {comment.authorId === memberId && (
          <details>
            <summary className="cursor-pointer text-muted-foreground text-xs underline underline-offset-4">
              Editar
            </summary>
            <form action={updateComment} className="mt-3 grid gap-3">
              <input name="commentId" type="hidden" value={comment.id} />
              <input name="postId" type="hidden" value={postId} />
              <input name="spaceSlug" type="hidden" value={spaceSlug} />
              <textarea
                className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
                defaultValue={comment.content}
                name="content"
                required
              />
              <Button className="w-fit" size="sm" type="submit">
                Salvar resposta
              </Button>
            </form>
          </details>
        )}
      </div>
      {replies.length > 0 && (
        <div className="mt-5 space-y-5">
          {replies.map((reply) => (
            <CommentThread
              comment={reply}
              comments={comments}
              depth={depth + 1}
              key={reply.id}
              memberId={memberId}
              postId={postId}
              spaceSlug={spaceSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CommunityPostPage = async ({
  params,
  searchParams,
}: CommunityPostPageProperties) => {
  const { spaceSlug, postId } = await params;
  const filters = await searchParams;
  const memberId = await requireMemberId();
  const role = await getMemberRole(memberId);
  const commentsPage = Number.parseInt(filters.commentsPage ?? "1", 10);
  const post = await getCommunityPost(
    spaceSlug,
    postId,
    memberId,
    commentsPage
  );

  if (!post) {
    notFound();
  }

  const topLevel = post.comments.filter((comment) => !comment.parentId);
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
              {post._count.comments} respostas
            </span>
            {post.isPinned && <Badge variant="secondary">Fixado</Badge>}
          </div>
          <div className="mt-5">
            <MemberIdentity
              authorId={post.authorId}
              profile={post.profile ?? undefined}
            />
          </div>
          <h1 className="mt-5 max-w-4xl font-display text-5xl leading-[1.02] sm:text-6xl">
            {post.title}
          </h1>
          <div className="lesson-document mt-7 max-w-3xl text-lg">
            {post.contentJson ? (
              <RichDocument value={post.contentJson} />
            ) : (
              <p className="whitespace-pre-wrap text-muted-foreground leading-8">
                {post.content}
              </p>
            )}
          </div>
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
          {(post.authorId === memberId ||
            role === "TEACHER" ||
            role === "ADMIN") && (
            <div className="mt-4 flex flex-wrap gap-3 border-border border-t pt-4">
              {post.authorId === memberId && (
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`/comunidade/${post.space.slug}/${post.id}/editar`}
                  >
                    Editar tópico
                  </Link>
                </Button>
              )}
              <form action={setPostStatus}>
                <input name="postId" type="hidden" value={post.id} />
                <input name="spaceSlug" type="hidden" value={post.space.slug} />
                <input name="status" type="hidden" value="ARCHIVED" />
                <Button size="sm" type="submit" variant="ghost">
                  Arquivar
                </Button>
              </form>
              {(role === "TEACHER" || role === "ADMIN") && (
                <form action={togglePostPin}>
                  <input name="postId" type="hidden" value={post.id} />
                  <input
                    name="spaceSlug"
                    type="hidden"
                    value={post.space.slug}
                  />
                  <Button size="sm" type="submit" variant="ghost">
                    {post.isPinned ? "Desfixar" : "Fixar tópico"}
                  </Button>
                </form>
              )}
              {post.authorId === memberId && (
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
          )}
        </article>
        <section aria-labelledby="comments-heading" className="mt-10">
          <div className="flex items-center justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="comments-heading">
              Discussão
            </h2>
            <span className="flex items-center gap-2 text-muted-foreground text-xs">
              <MessageCircleIcon aria-hidden="true" /> {post._count.comments}
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
                <CommentThread
                  comment={comment}
                  comments={post.comments}
                  depth={0}
                  key={comment.id}
                  memberId={memberId}
                  postId={post.id}
                  spaceSlug={post.space.slug}
                />
              ))
            )}
          </div>
          {(post.commentsPage > 1 || post.hasMoreComments) && (
            <nav
              aria-label="Paginação da discussão"
              className="mt-8 flex flex-wrap justify-between gap-3"
            >
              {post.commentsPage > 1 ? (
                <Button asChild variant="outline">
                  <Link
                    href={`/comunidade/${post.space.slug}/${post.id}?commentsPage=${post.commentsPage - 1}`}
                  >
                    Respostas anteriores
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              {post.hasMoreComments && (
                <Button asChild variant="outline">
                  <Link
                    href={`/comunidade/${post.space.slug}/${post.id}?commentsPage=${post.commentsPage + 1}`}
                  >
                    Mais respostas
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

export default CommunityPostPage;
