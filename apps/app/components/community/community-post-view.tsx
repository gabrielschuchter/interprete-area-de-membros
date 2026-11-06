import { Button } from "@repo/design-system/components/ui/button";
import {
  Edit2Icon,
  MoreHorizontalIcon,
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
import { communityCoverFramingFromRecord } from "@/lib/community-cover";
import { RichDocument } from "../learning/rich-document";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "../mutations/single-flight-form";
import { CommentComposer } from "./comment-composer";
import { CommunityCommentDialog } from "./community-comment-dialog";
import { CommunityDiscussionFollow } from "./community-discussion-follow";
import { CommunityPostActions } from "./community-post-actions";
import { CommunityPostHeader } from "./community-post-header";
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
  readonly currentProfile: {
    readonly avatarUrl: string | null;
    readonly displayName: string | null;
    readonly username: string;
  } | null;
  readonly depth: number;
  readonly memberId: string;
  readonly post: CommunityPost;
  readonly repliesByParent: ReadonlyMap<string, readonly CommunityComment[]>;
  readonly role: string;
}

const CommentControls = ({
  allowReply,
  comment,
  currentProfile,
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
        {replies.length} {replies.length === 1 ? "resposta" : "respostas"}
      </span>
      {allowReply && !(comment.deletedAt || post.space?.commentsClosed) && (
        <CommunityCommentDialog
          currentProfile={currentProfile}
          postId={post.id}
          replyContext={{
            authorName:
              comment.profile?.displayName ??
              comment.profile?.username ??
              "membro",
            content: comment.content.slice(0, 240),
            deleted: Boolean(comment.deletedAt),
            parentId: comment.id,
          }}
          spaceSlug={post.space?.slug ?? ""}
        />
      )}
      {(canDelete || (!comment.deletedAt && comment.authorId === memberId)) && (
        <details className="community-comment__options">
          <summary aria-label="Opções do comentário">
            <MoreHorizontalIcon aria-hidden="true" />
          </summary>
          <div
            aria-label="Opções do comentário"
            className="community-comment__options-menu"
            role="menu"
          >
            {!comment.deletedAt && comment.authorId === memberId && (
              <details className="community-comment__edit-panel">
                <summary role="menuitem">
                  <Edit2Icon aria-hidden="true" /> Editar
                </summary>
                <SingleFlightForm action={updateComment} className="grid gap-3">
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
                    postId={post.id}
                    required
                  />
                  <SingleFlightSubmit
                    className="w-fit"
                    pendingLabel="Salvando…"
                    size="sm"
                  >
                    Salvar edição
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
                  className="community-comment__options-delete"
                  pendingLabel="Apagando…"
                  role="menuitem"
                  size="sm"
                  variant="ghost"
                >
                  <Trash2Icon aria-hidden="true" /> Apagar
                </SingleFlightSubmit>
              </SingleFlightForm>
            )}
          </div>
        </details>
      )}
    </div>
  );
};

const CommentThread = ({
  comment,
  currentProfile,
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
            returnTo={communityPostHref(post)}
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
          currentProfile={currentProfile}
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
              currentProfile={currentProfile}
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
  readonly currentProfile: {
    readonly avatarUrl: string | null;
    readonly displayName: string | null;
    readonly username: string;
  } | null;
  readonly memberId: string;
  readonly post: CommunityPost;
  readonly role: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this shared reader intentionally composes the complete post and discussion workflow in one accessible page.
export function CommunityPostView({
  backHref,
  backLabel,
  memberId,
  currentProfile,
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
  const backTarget =
    backHref ??
    (post.space ? `/comunidade/grupos/${post.space.slug}` : "/comunidade");

  return (
    <div className="cp-page">
      <main>
        <CommunityPostHeader
          author={post.profile ?? undefined}
          authorId={post.authorId}
          backHref={backTarget}
          backLabel={backLabel ?? post.space?.title ?? "Comunidade"}
          coverAlt={post.coverAltText || `Capa: ${post.title}`}
          coverFraming={communityCoverFramingFromRecord(post)}
          coverUrl={post.coverUrl}
          date={post.publishedAt ?? post.createdAt}
          edited={edited}
          menu={
            post.authorId === memberId || canStaffManage ? (
              <CommunityPostMenu
                canModerate={canStaffManage}
                isFeatured={post.isFeatured}
                isPinned={post.isPinned}
                postId={post.id}
                spaceSlug={post.space?.slug ?? ""}
              />
            ) : null
          }
          returnTo={href}
          subtitle={post.subtitle}
          title={post.title}
        />
        <div className="cp-column">
          <article className="cp-article">
            <div className="cp-actions">
              <CommunityPostActions
                className="cp-actions__buttons"
                detailed
                initialBookmarked={post.bookmarks.length > 0}
                initialVoted={post.votes.length > 0}
                postId={post.id}
                sharePath={communityPostHref(post)}
                spaceSlug={post.space?.slug ?? ""}
                voteCount={post._count.votes}
              />
              <CommunityDiscussionFollow
                isFollowing={post.followers.length > 0}
                isMuted={Boolean(post.followers[0]?.mutedAt)}
                postId={post.id}
                spaceSlug={post.space?.slug ?? ""}
              />
              <Link className="cp-actions__responses" href="#comments-heading">
                {post._count.comments}{" "}
                {post._count.comments === 1 ? "resposta" : "respostas"}
              </Link>
            </div>
            <div className="lesson-document community-post-body cp-body">
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
              <ul aria-label="Etiquetas da publicação" className="cp-tags">
                {post.tags.map((tag) => (
                  <li key={tag}>#{tag}</li>
                ))}
              </ul>
            )}
          </article>

          <section
            aria-labelledby="comments-heading"
            className="community-discussion cp-discussion"
          >
            <div className="cp-discussion__heading">
              <h2 id="comments-heading">Discussão</h2>
              <span className="cp-discussion__count">
                {post._count.comments}
              </span>
            </div>
            {post.space?.commentsClosed ? (
              <p className="community-comment-closed">
                Os comentários deste grupo estão fechados pela equipe.
              </p>
            ) : (
              <div className="cp-composer">
                <CommentComposer
                  ariaLabel="Comentário"
                  className="community-comment-composer cp-composer__form"
                  currentProfile={currentProfile}
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
                    currentProfile={currentProfile}
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
                    <Link
                      href={`${href}?commentsPage=${post.commentsPage - 1}`}
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
                      href={`${href}?commentsPage=${post.commentsPage + 1}`}
                    >
                      Mais respostas
                    </Link>
                  </Button>
                )}
              </nav>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
