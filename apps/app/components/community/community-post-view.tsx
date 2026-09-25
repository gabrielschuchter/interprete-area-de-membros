import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowLeftIcon,
  BookmarkIcon,
  MessageCircleIcon,
  PinIcon,
  ThumbsUpIcon,
} from "lucide-react";
import Link from "next/link";
import {
  createComment,
  setPostStatus,
  softDeleteComment,
  softDeletePost,
  toggleBookmark,
  toggleCommentVote,
  togglePostPin,
  togglePostVote,
  updateComment,
} from "@/app/(authenticated)/comunidade/actions";
import {
  communityPostHref,
  type getCommunityPostBySlug,
} from "@/lib/community";
import { RichDocument } from "../learning/rich-document";
import { MemberIdentity } from "./member-identity";

type CommunityPost = NonNullable<
  Awaited<ReturnType<typeof getCommunityPostBySlug>>
>;

interface CommentThreadProperties {
  readonly comment: CommunityPost["comments"][number];
  readonly comments: readonly CommunityPost["comments"][number][];
  readonly depth: number;
  readonly memberId: string;
  readonly post: CommunityPost;
  readonly role: string;
}

const CommentThread = ({
  comment,
  comments,
  depth,
  memberId,
  post,
  role,
}: CommentThreadProperties) => {
  const replies = comments.filter(({ parentId }) => parentId === comment.id);
  const canDelete =
    comment.authorId === memberId || role === "TEACHER" || role === "ADMIN";

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
          <input name="postId" type="hidden" value={post.id} />
          <input
            name="spaceSlug"
            type="hidden"
            value={post.space?.slug ?? ""}
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
          {replies.length} respostas
        </span>
        <details>
          <summary className="cursor-pointer text-muted-foreground text-xs underline underline-offset-4">
            Responder
          </summary>
          <form action={createComment} className="mt-3 grid gap-3">
            <input name="postId" type="hidden" value={post.id} />
            <input
              name="spaceSlug"
              type="hidden"
              value={post.space?.slug ?? ""}
            />
            <input name="parentId" type="hidden" value={comment.id} />
            <textarea
              aria-label={`Responder a ${comment.content.slice(0, 40)}`}
              className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
              name="content"
              placeholder="Escreva uma resposta... Use @nome para mencionar alguém."
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
              <input name="postId" type="hidden" value={post.id} />
              <input
                name="spaceSlug"
                type="hidden"
                value={post.space?.slug ?? ""}
              />
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
        {canDelete && (
          <form action={softDeleteComment}>
            <input name="commentId" type="hidden" value={comment.id} />
            <input name="postId" type="hidden" value={post.id} />
            <input
              name="spaceSlug"
              type="hidden"
              value={post.space?.slug ?? ""}
            />
            <Button
              className="text-muted-foreground"
              size="sm"
              type="submit"
              variant="ghost"
            >
              Apagar
            </Button>
          </form>
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
              post={post}
              role={role}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface CommunityPostViewProperties {
  readonly backHref?: string;
  readonly backLabel?: string;
  readonly memberId: string;
  readonly post: CommunityPost;
  readonly role: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this shared reader intentionally composes the complete post and discussion workflow in one accessible page.
export function CommunityPostView({
  backHref,
  backLabel,
  memberId,
  post,
  role,
}: CommunityPostViewProperties) {
  const href = communityPostHref(post);
  const topLevel = post.comments.filter((comment) => !comment.parentId);
  const canStaffManage = role === "TEACHER" || role === "ADMIN";
  const edited = post.updatedAt.valueOf() > post.createdAt.valueOf() + 60_000;

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[960px] px-5 py-8 sm:px-8 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link
            href={
              backHref ??
              (post.space ? `/comunidade/${post.space.slug}` : "/comunidade")
            }
          >
            <ArrowLeftIcon aria-hidden="true" />{" "}
            {backLabel ?? post.space?.title ?? "Comunidade"}
          </Link>
        </Button>
        <article className="mt-8 border-border border-b pb-10">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={post.votes.length > 0 ? "default" : "outline"}>
              <ThumbsUpIcon aria-hidden="true" /> {post._count.votes} apoios
            </Badge>
            <Badge variant="secondary">
              {post.kind === "PUBLICATION" ? "Publicação" : "Discussão"}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {post._count.comments} respostas
            </span>
            {post.isPinned && (
              <Badge variant="secondary">
                <PinIcon aria-hidden="true" /> Fixado
              </Badge>
            )}
          </div>
          <div className="mt-5">
            <MemberIdentity
              authorId={post.authorId}
              profile={post.profile ?? undefined}
            />
          </div>
          <h1 className="mt-5 max-w-4xl font-display text-5xl leading-[1.02] sm:text-7xl">
            {post.title}
          </h1>
          {post.subtitle && (
            <p className="mt-5 max-w-3xl text-muted-foreground text-xl leading-8 sm:text-2xl">
              {post.subtitle}
            </p>
          )}
          {post.coverUrl && (
            // biome-ignore lint/performance/noImgElement: cover URLs are sanitized user content and may come from hosts not configured for next/image.
            <img
              alt=""
              className="mt-8 max-h-[34rem] w-full rounded-sm border object-cover"
              height={630}
              loading="lazy"
              src={post.coverUrl}
              width={1200}
            />
          )}
          <div className="mt-7 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
            <time dateTime={(post.publishedAt ?? post.createdAt).toISOString()}>
              {(post.publishedAt ?? post.createdAt).toLocaleDateString("pt-BR")}
            </time>
            {edited && <span>· Editado</span>}
            <span>· {post.readingMinutes} min de leitura</span>
          </div>
          <div className="lesson-document mt-8 max-w-3xl text-lg">
            {post.contentJson ? (
              <RichDocument value={post.contentJson} />
            ) : (
              <p className="whitespace-pre-wrap text-muted-foreground leading-8">
                {post.content}
              </p>
            )}
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <form action={togglePostVote}>
              <input name="postId" type="hidden" value={post.id} />
              <input
                name="spaceSlug"
                type="hidden"
                value={post.space?.slug ?? ""}
              />
              <Button
                size="sm"
                type="submit"
                variant={post.votes.length > 0 ? "default" : "outline"}
              >
                <ThumbsUpIcon aria-hidden="true" />{" "}
                {post.votes.length > 0 ? "Apoiado" : "Apoiar"}
              </Button>
            </form>
            <form action={toggleBookmark}>
              <input name="postId" type="hidden" value={post.id} />
              <input
                name="spaceSlug"
                type="hidden"
                value={post.space?.slug ?? ""}
              />
              <Button size="sm" type="submit" variant="ghost">
                <BookmarkIcon
                  aria-hidden="true"
                  fill={post.bookmarks.length > 0 ? "currentColor" : "none"}
                />{" "}
                {post.bookmarks.length > 0 ? "Salvo" : "Salvar"}
              </Button>
            </form>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span className="text-muted-foreground text-xs" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
          {(post.authorId === memberId || canStaffManage) && (
            <div className="mt-5 flex flex-wrap gap-3 border-border border-t pt-5">
              {post.authorId === memberId && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/comunidade/editor/${post.id}`}>Editar</Link>
                </Button>
              )}
              {canStaffManage && (
                <form action={togglePostPin}>
                  <input name="postId" type="hidden" value={post.id} />
                  <input
                    name="spaceSlug"
                    type="hidden"
                    value={post.space?.slug ?? ""}
                  />
                  <Button size="sm" type="submit" variant="ghost">
                    {post.isPinned ? "Desfixar" : "Fixar"}
                  </Button>
                </form>
              )}
              <form action={softDeletePost}>
                <input name="postId" type="hidden" value={post.id} />
                <input
                  name="spaceSlug"
                  type="hidden"
                  value={post.space?.slug ?? ""}
                />
                <Button size="sm" type="submit" variant="ghost">
                  {canStaffManage && post.authorId !== memberId
                    ? "Remover conteúdo"
                    : "Excluir"}
                </Button>
              </form>
              {post.authorId === memberId && (
                <form action={setPostStatus}>
                  <input name="postId" type="hidden" value={post.id} />
                  <input
                    name="spaceSlug"
                    type="hidden"
                    value={post.space?.slug ?? ""}
                  />
                  <input name="status" type="hidden" value="ARCHIVED" />
                  <Button size="sm" type="submit" variant="ghost">
                    Arquivar
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
            <input
              name="spaceSlug"
              type="hidden"
              value={post.space?.slug ?? ""}
            />
            <label className="block" htmlFor="comment-content">
              <span className="brand-eyebrow">Sua contribuição</span>
              <textarea
                className="mt-3 min-h-32 w-full rounded-sm border bg-background px-3 py-3 text-base leading-7 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
                id="comment-content"
                name="content"
                placeholder="Acrescente uma leitura, uma pergunta ou uma referência... Use @nome para mencionar alguém."
                required
              />
            </label>
            <div className="mt-4 flex justify-end">
              <Button type="submit">Comentar</Button>
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
                  post={post}
                  role={role}
                />
              ))
            )}
          </div>
          {(post.commentsPage > 1 || post.hasMoreComments) && (
            <nav
              aria-label="Paginação da discussão"
              className="mt-8 flex justify-between gap-3"
            >
              {post.commentsPage > 1 ? (
                <Button asChild variant="outline">
                  <Link href={`${href}?commentsPage=${post.commentsPage - 1}`}>
                    Respostas anteriores
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              {post.hasMoreComments && (
                <Button asChild variant="outline">
                  <Link href={`${href}?commentsPage=${post.commentsPage + 1}`}>
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
}
