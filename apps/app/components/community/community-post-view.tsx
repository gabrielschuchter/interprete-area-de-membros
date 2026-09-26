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
  setPostStatus,
  softDeleteComment,
  softDeletePost,
  toggleBookmark,
  toggleCommentVote,
  togglePostFeatured,
  togglePostPin,
  togglePostVote,
  toggleTopicFollow,
  toggleTopicMute,
  updateComment,
} from "@/app/(authenticated)/comunidade/actions";
import {
  communityPostHref,
  type getCommunityPostBySlug,
} from "@/lib/community";
import { RichDocument } from "../learning/rich-document";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "../mutations/single-flight-form";
import { CommentComposer } from "./comment-composer";
import { MemberIdentity } from "./member-identity";
import { MentionTextarea } from "./mention-textarea";

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
      className={`${depth === 0 ? "border-border border-l-2 pl-4 sm:pl-6" : "border-border border-t pt-5 pl-4 sm:pl-6"} community-comment scroll-mt-24`}
      id={`comment-${comment.id}`}
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
      {comment.contentJson ? (
        <div className="mt-2">
          <RichDocument
            currentMemberId={memberId}
            value={comment.contentJson}
          />
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap leading-7">{comment.content}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SingleFlightForm action={toggleCommentVote}>
          <input name="commentId" type="hidden" value={comment.id} />
          <input name="postId" type="hidden" value={post.id} />
          <input
            name="spaceSlug"
            type="hidden"
            value={post.space?.slug ?? ""}
          />
          <input
            name="desired"
            type="hidden"
            value={comment.votes.length > 0 ? "off" : "on"}
          />
          <SingleFlightSubmit
            pendingLabel="Salvando…"
            size="sm"
            variant={comment.votes.length > 0 ? "default" : "ghost"}
          >
            <ThumbsUpIcon aria-hidden="true" />{" "}
            {comment.votes.length > 0 ? "Apoiado" : "Apoiar"}
          </SingleFlightSubmit>
        </SingleFlightForm>
        <span className="text-muted-foreground text-xs">
          {replies.length} respostas
        </span>
        {!post.space?.commentsClosed && (
          <details>
            <summary className="cursor-pointer text-muted-foreground text-xs underline underline-offset-4">
              Responder
            </summary>
            <CommentComposer
              ariaLabel={`Responder a ${comment.content.slice(0, 40)}`}
              className="mt-3 grid gap-3"
              parentId={comment.id}
              placeholder="Escreva uma resposta... Use @nome para mencionar alguém."
              postId={post.id}
              spaceSlug={post.space?.slug ?? ""}
            />
          </details>
        )}
        {comment.authorId === memberId && (
          <details>
            <summary className="cursor-pointer text-muted-foreground text-xs underline underline-offset-4">
              Editar
            </summary>
            <SingleFlightForm
              action={updateComment}
              className="mt-3 grid gap-3"
            >
              <input name="commentId" type="hidden" value={comment.id} />
              <input name="postId" type="hidden" value={post.id} />
              <input
                name="spaceSlug"
                type="hidden"
                value={post.space?.slug ?? ""}
              />
              <MentionTextarea
                className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
                defaultDocument={comment.contentJson}
                defaultValue={comment.content}
                name="content"
                required
              />
              <SingleFlightSubmit
                className="w-fit"
                pendingLabel="Salvando…"
                size="sm"
              >
                Salvar resposta
              </SingleFlightSubmit>
            </SingleFlightForm>
          </details>
        )}
        {canDelete && (
          <SingleFlightForm action={softDeleteComment}>
            <input name="commentId" type="hidden" value={comment.id} />
            <input name="postId" type="hidden" value={post.id} />
            <input
              name="spaceSlug"
              type="hidden"
              value={post.space?.slug ?? ""}
            />
            <SingleFlightSubmit
              className="text-muted-foreground"
              pendingLabel="Apagando…"
              size="sm"
              variant="ghost"
            >
              Apagar
            </SingleFlightSubmit>
          </SingleFlightForm>
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
            {post.isFeatured && <Badge>Em destaque</Badge>}
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
              <RichDocument
                currentMemberId={memberId}
                value={post.contentJson}
              />
            ) : (
              <p className="whitespace-pre-wrap text-muted-foreground leading-8">
                {post.content}
              </p>
            )}
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <SingleFlightForm action={togglePostVote}>
              <input name="postId" type="hidden" value={post.id} />
              <input
                name="spaceSlug"
                type="hidden"
                value={post.space?.slug ?? ""}
              />
              <input
                name="desired"
                type="hidden"
                value={post.votes.length > 0 ? "off" : "on"}
              />
              <SingleFlightSubmit
                pendingLabel="Salvando…"
                size="sm"
                variant={post.votes.length > 0 ? "default" : "outline"}
              >
                <ThumbsUpIcon aria-hidden="true" />{" "}
                {post.votes.length > 0 ? "Apoiado" : "Apoiar"}
              </SingleFlightSubmit>
            </SingleFlightForm>
            <SingleFlightForm action={toggleBookmark}>
              <input name="postId" type="hidden" value={post.id} />
              <input
                name="spaceSlug"
                type="hidden"
                value={post.space?.slug ?? ""}
              />
              <input
                name="desired"
                type="hidden"
                value={post.bookmarks.length > 0 ? "off" : "on"}
              />
              <SingleFlightSubmit
                pendingLabel="Salvando…"
                size="sm"
                variant="ghost"
              >
                <BookmarkIcon
                  aria-hidden="true"
                  fill={post.bookmarks.length > 0 ? "currentColor" : "none"}
                />{" "}
                {post.bookmarks.length > 0 ? "Salvo" : "Salvar"}
              </SingleFlightSubmit>
            </SingleFlightForm>
            <SingleFlightForm action={toggleTopicFollow}>
              <input name="postId" type="hidden" value={post.id} />
              <input
                name="spaceSlug"
                type="hidden"
                value={post.space?.slug ?? ""}
              />
              <input
                name="desired"
                type="hidden"
                value={post.followers.length > 0 ? "off" : "on"}
              />
              <SingleFlightSubmit
                pendingLabel="Salvando…"
                size="sm"
                variant="ghost"
              >
                {post.followers.length > 0
                  ? "Seguindo discussão"
                  : "Seguir discussão"}
              </SingleFlightSubmit>
            </SingleFlightForm>
            {post.followers.length > 0 && (
              <SingleFlightForm action={toggleTopicMute}>
                <input name="postId" type="hidden" value={post.id} />
                <input
                  name="spaceSlug"
                  type="hidden"
                  value={post.space?.slug ?? ""}
                />
                <input
                  name="desired"
                  type="hidden"
                  value={post.followers[0]?.mutedAt ? "off" : "on"}
                />
                <SingleFlightSubmit
                  pendingLabel="Salvando…"
                  size="sm"
                  variant="ghost"
                >
                  {post.followers[0]?.mutedAt
                    ? "Ativar atualizações"
                    : "Silenciar discussão"}
                </SingleFlightSubmit>
              </SingleFlightForm>
            )}
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
                <SingleFlightForm action={togglePostPin}>
                  <input name="postId" type="hidden" value={post.id} />
                  <input
                    name="spaceSlug"
                    type="hidden"
                    value={post.space?.slug ?? ""}
                  />
                  <SingleFlightSubmit
                    pendingLabel="Salvando…"
                    size="sm"
                    variant="ghost"
                  >
                    {post.isPinned ? "Desfixar" : "Fixar"}
                  </SingleFlightSubmit>
                </SingleFlightForm>
              )}
              {canStaffManage && (
                <SingleFlightForm action={togglePostFeatured}>
                  <input name="postId" type="hidden" value={post.id} />
                  <input
                    name="spaceSlug"
                    type="hidden"
                    value={post.space?.slug ?? ""}
                  />
                  <SingleFlightSubmit
                    pendingLabel="Salvando…"
                    size="sm"
                    variant="ghost"
                  >
                    {post.isFeatured ? "Retirar destaque" : "Destacar"}
                  </SingleFlightSubmit>
                </SingleFlightForm>
              )}
              <SingleFlightForm action={softDeletePost}>
                <input name="postId" type="hidden" value={post.id} />
                <input
                  name="spaceSlug"
                  type="hidden"
                  value={post.space?.slug ?? ""}
                />
                <SingleFlightSubmit
                  pendingLabel="Apagando…"
                  size="sm"
                  variant="ghost"
                >
                  {canStaffManage && post.authorId !== memberId
                    ? "Remover conteúdo"
                    : "Excluir"}
                </SingleFlightSubmit>
              </SingleFlightForm>
              {post.authorId === memberId && (
                <SingleFlightForm action={setPostStatus}>
                  <input name="postId" type="hidden" value={post.id} />
                  <input
                    name="spaceSlug"
                    type="hidden"
                    value={post.space?.slug ?? ""}
                  />
                  <input name="status" type="hidden" value="ARCHIVED" />
                  <SingleFlightSubmit
                    pendingLabel="Salvando…"
                    size="sm"
                    variant="ghost"
                  >
                    Arquivar
                  </SingleFlightSubmit>
                </SingleFlightForm>
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
          {post.space?.commentsClosed ? (
            <p className="paper-surface mt-5 border p-5 text-muted-foreground sm:p-6">
              Os comentários deste espaço estão fechados pela equipe.
            </p>
          ) : (
            <div className="paper-surface mt-5 border p-5 sm:p-6">
              <CommentComposer
                postId={post.id}
                spaceSlug={post.space?.slug ?? ""}
              />
            </div>
          )}
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
