import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowLeftIcon,
  Edit2Icon,
  MessageCircleIcon,
  ThumbsUpIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import {
  softDeleteComment,
  toggleCommentVote,
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
import { CommunityDiscussionFollow } from "./community-discussion-follow";
import { CommunityPostActions } from "./community-post-actions";
import { CommunityPostMenu } from "./community-post-menu";
import { MemberIdentity } from "./member-identity";
import { MentionTextarea } from "./mention-textarea";

type CommunityPost = NonNullable<
  Awaited<ReturnType<typeof getCommunityPostBySlug>>
>;
type CommunityComment = CommunityPost["comments"][number];

const CommentContent = ({
  comment,
  memberId,
}: {
  readonly comment: CommunityComment;
  readonly memberId: string;
}) => {
  if (comment.deletedAt) {
    return null;
  }
  if (comment.contentJson) {
    return (
      <div className="community-comment__content">
        <RichDocument currentMemberId={memberId} value={comment.contentJson} />
      </div>
    );
  }
  return (
    <p className="community-comment__content whitespace-pre-wrap">
      {comment.content}
    </p>
  );
};

interface CommentThreadProperties {
  readonly comment: CommunityComment;
  readonly depth: number;
  readonly memberId: string;
  readonly post: CommunityPost;
  readonly repliesByParent: ReadonlyMap<string, readonly CommunityComment[]>;
  readonly role: string;
}

const CommentControls = ({
  allowReply,
  comment,
  memberId,
  post,
  replies,
  role,
}: Omit<CommentThreadProperties, "depth" | "repliesByParent"> & {
  readonly allowReply: boolean;
  readonly replies: readonly CommunityComment[];
}) => {
  const canDelete =
    !comment.deletedAt &&
    (comment.authorId === memberId || role === "TEACHER" || role === "ADMIN");
  return (
    <div className="community-comment__controls">
      <SingleFlightForm action={toggleCommentVote}>
        <input name="commentId" type="hidden" value={comment.id} />
        <input name="postId" type="hidden" value={post.id} />
        <input name="spaceSlug" type="hidden" value={post.space?.slug ?? ""} />
        <input
          name="desired"
          type="hidden"
          value={comment.votes.length > 0 ? "off" : "on"}
        />
        <SingleFlightSubmit
          aria-label={
            comment.votes.length > 0 ? "Remover apoio" : "Apoiar comentário"
          }
          className="community-comment__vote"
          pendingLabel="Salvando…"
          size="sm"
          variant={comment.votes.length > 0 ? "default" : "ghost"}
        >
          <ThumbsUpIcon aria-hidden="true" />
          {comment.votes.length > 0 ? "Apoiado" : "Apoiar"} ·{" "}
          {comment._count.votes}
        </SingleFlightSubmit>
      </SingleFlightForm>
      <span className="community-comment__reply-count">
        {replies.length} respostas
      </span>
      {allowReply && !(comment.deletedAt || post.space?.commentsClosed) && (
        <details>
          <summary className="community-comment__reply-toggle">
            Responder
          </summary>
          <CommentComposer
            ariaLabel={`Responder a ${(comment.content || "comentário removido").slice(0, 40)}`}
            className="mt-3 grid gap-3"
            parentId={comment.id}
            placeholder="Escreva uma resposta... Use @nome para mencionar alguém."
            postId={post.id}
            spaceSlug={post.space?.slug ?? ""}
          />
        </details>
      )}
      {!comment.deletedAt && comment.authorId === memberId && (
        <details>
          <summary
            aria-label="Editar comentário"
            className="community-comment__edit-toggle"
          >
            <Edit2Icon aria-hidden="true" /> <span>Editar</span>
          </summary>
          <SingleFlightForm action={updateComment} className="mt-3 grid gap-3">
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
            aria-label="Apagar comentário"
            className="community-comment__delete"
            pendingLabel="Apagando…"
            size="sm"
            variant="ghost"
          >
            <Trash2Icon aria-hidden="true" /> <span>Apagar</span>
          </SingleFlightSubmit>
        </SingleFlightForm>
      )}
    </div>
  );
};

const CommentThread = ({
  comment,
  depth,
  memberId,
  post,
  repliesByParent,
  role,
}: CommentThreadProperties) => {
  const replies = repliesByParent.get(comment.id) ?? [];
  return (
    <div
      className={`${depth === 0 ? "community-comment--top-level" : "community-comment--reply"} community-comment scroll-mt-24`}
      id={`comment-${comment.id}`}
    >
      <div className="community-comment__meta">
        {comment.deletedAt ? (
          <span className="text-muted-foreground text-sm italic">
            Comentário removido
          </span>
        ) : (
          <MemberIdentity
            authorId={comment.authorId}
            compact
            profile={comment.profile ?? undefined}
            replyAvatar={depth > 0}
            showHeadline={false}
          />
        )}
        {!comment.deletedAt && (
          <time
            className="community-comment__date"
            dateTime={comment.createdAt.toISOString()}
          >
            {comment.createdAt.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </time>
        )}
        {!comment.deletedAt && (
          <>
            {comment.editedAt && (
              <span className="text-muted-foreground text-xs">· Editado</span>
            )}
            <span className="text-muted-foreground text-xs">
              · {comment._count.votes} apoios
            </span>
          </>
        )}
      </div>
      <CommentContent comment={comment} memberId={memberId} />
      {!comment.deletedAt && (
        <CommentControls
          allowReply={depth === 0}
          comment={comment}
          memberId={memberId}
          post={post}
          replies={replies}
          role={role}
        />
      )}
      {replies.length > 0 && (
        <div className="mt-5 space-y-5">
          {replies.map((reply) => (
            <CommentThread
              comment={reply}
              depth={depth + 1}
              key={reply.id}
              memberId={memberId}
              post={post}
              repliesByParent={repliesByParent}
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
  const repliesByParent = new Map<string, CommunityComment[]>();
  for (const comment of post.comments) {
    if (!comment.parentId) {
      continue;
    }
    const replies = repliesByParent.get(comment.parentId) ?? [];
    replies.push(comment);
    repliesByParent.set(comment.parentId, replies);
  }
  const canStaffManage = role === "TEACHER" || role === "ADMIN";
  const edited = Boolean(post.editedAt);
  const authorRole = post.profile?.member?.role;
  let authorRoleLabel: string | null = null;
  if (authorRole === "ADMIN") {
    authorRoleLabel = "Admin";
  } else if (authorRole === "TEACHER") {
    authorRoleLabel = "Professor";
  }

  return (
    <div className="min-h-svh bg-background">
      <main className="community-post-shell mx-auto w-full">
        <Button asChild className="community-post-back" variant="ghost">
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
        <article className="community-post-article">
          <div className="community-post-meta-row">
            <div className="community-post-meta">
              {post.space && (
                <Link
                  className="community-post-group"
                  href={`/comunidade/${post.space.slug}`}
                >
                  {post.space.title}
                </Link>
              )}
              <time
                dateTime={(post.publishedAt ?? post.createdAt).toISOString()}
              >
                {(post.publishedAt ?? post.createdAt).toLocaleDateString(
                  "pt-BR"
                )}
              </time>
              {edited && <span>· Editado</span>}
            </div>
            {(post.authorId === memberId || canStaffManage) && (
              <CommunityPostMenu
                canModerate={canStaffManage}
                isFeatured={post.isFeatured}
                isPinned={post.isPinned}
                postId={post.id}
                spaceSlug={post.space?.slug ?? ""}
              />
            )}
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
            {authorRoleLabel && (
              <span className="community-post-author__role">
                {authorRoleLabel}
              </span>
            )}
          </div>
          {post.coverUrl && (
            // biome-ignore lint/performance/noImgElement: cover URLs are sanitized user content and may come from hosts not configured for next/image.
            <img
              alt={`Capa: ${post.title}`}
              className="community-post-cover"
              height={630}
              loading="lazy"
              src={post.coverUrl}
              width={1200}
            />
          )}
          <div className="lesson-document community-post-body">
            {post.contentJson ? (
              <RichDocument
                currentMemberId={memberId}
                value={post.contentJson}
              />
            ) : (
              <p className="whitespace-pre-wrap">{post.content}</p>
            )}
          </div>
          {post.tags.length > 0 && (
            <ul
              aria-label="Etiquetas da publicação"
              className="community-post-tags"
            >
              {post.tags.map((tag) => (
                <li key={tag}>#{tag}</li>
              ))}
            </ul>
          )}
          <div className="community-post-actions-bar">
            <CommunityPostActions
              className="community-post-action-buttons"
              detailed
              initialBookmarked={post.bookmarks.length > 0}
              initialVoted={post.votes.length > 0}
              postId={post.id}
              spaceSlug={post.space?.slug ?? ""}
              voteCount={post._count.votes}
            />
            <CommunityDiscussionFollow
              isFollowing={post.followers.length > 0}
              isMuted={Boolean(post.followers[0]?.mutedAt)}
              postId={post.id}
              spaceSlug={post.space?.slug ?? ""}
            />
            <Link
              className="community-post-responses-link"
              href="#comments-heading"
            >
              <MessageCircleIcon aria-hidden="true" />
              <span>{post._count.comments} respostas</span>
            </Link>
          </div>
        </article>

        <section
          aria-labelledby="comments-heading"
          className="community-discussion"
        >
          <div className="community-discussion__heading">
            <h2 className="font-display" id="comments-heading">
              Discussão
            </h2>
            <span className="community-discussion__count">
              <MessageCircleIcon aria-hidden="true" /> {post._count.comments}
            </span>
          </div>
          {post.space?.commentsClosed ? (
            <p className="community-comment-closed">
              Os comentários deste grupo estão fechados pela equipe.
            </p>
          ) : (
            <div className="community-comment-composer-wrap">
              <CommentComposer
                ariaLabel="Comentário"
                className="community-comment-composer"
                helperText="Use @nome para mencionar alguém."
                placeholder="Acrescente uma leitura, uma pergunta ou uma referência…"
                postId={post.id}
                spaceSlug={post.space?.slug ?? ""}
              />
            </div>
          )}
          <div className="community-comment-list">
            {topLevel.length === 0 ? (
              <p className="text-muted-foreground">
                Ainda não há respostas. A conversa pode começar com você.
              </p>
            ) : (
              topLevel.map((comment) => (
                <CommentThread
                  comment={comment}
                  depth={0}
                  key={comment.id}
                  memberId={memberId}
                  post={post}
                  repliesByParent={repliesByParent}
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
