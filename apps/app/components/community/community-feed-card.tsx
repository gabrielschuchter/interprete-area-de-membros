import { MessageCircleIcon, PinIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { communityPostHref } from "@/lib/community";
import {
  type CommunityMediaItem,
  communityMediaImageUrl,
  normalizeCommunityCoverUrl,
} from "@/lib/community-media";
import { CommunityCoverImage } from "./community-cover-image";
import { CommunityMediaGallery } from "./community-media-card";
import { CommunityPostActions } from "./community-post-actions";
import { MemberIdentity } from "./member-identity";

interface CommunityFeedProfile {
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
  readonly headline: string | null;
  readonly member?: { readonly role: "MEMBER" | "TEACHER" | "ADMIN" };
  readonly username: string;
}

export interface CommunityFeedCardPost {
  readonly _count: { readonly comments: number; readonly votes: number };
  readonly authorId: string;
  readonly bookmarks: readonly { readonly id: string }[];
  readonly coverUrl?: string | null;
  readonly createdAt: Date;
  readonly excerpt: string;
  readonly id: string;
  readonly isFeatured?: boolean;
  readonly isPinned: boolean;
  readonly media?: readonly CommunityMediaItem[];
  readonly profile?: CommunityFeedProfile | null;
  readonly publishedAt: Date | null;
  readonly readingMinutes: number;
  readonly slug: string | null;
  readonly space: { readonly slug: string; readonly title: string } | null;
  readonly subtitle: string | null;
  readonly tags: readonly string[];
  readonly title: string;
  readonly votes: readonly { readonly id: string }[];
}

interface CommunityFeedCardProperties {
  readonly managementActions?: ReactNode;
  readonly post: CommunityFeedCardPost;
  readonly spaceSlug?: string;
}

const formatDate = (date: Date) =>
  date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export function CommunityFeedCard({
  managementActions,
  post,
  spaceSlug,
}: CommunityFeedCardProperties) {
  const href = communityPostHref(post);
  const actionSpaceSlug = spaceSlug ?? post.space?.slug ?? "";
  const isVoted = post.votes.length > 0;
  const isSaved = post.bookmarks.length > 0;
  const summary = post.subtitle || post.excerpt;
  const coverUrl = normalizeCommunityCoverUrl(post.coverUrl);
  const media = post.media ?? [];
  // Inline images belong to the rich document; only the explicit cover is a
  // thumbnail. Other existing media remains available through its attachment.
  const feedMedia = media.filter((item) => item.kind !== "image");
  const commentCount = post._count.comments;

  return (
    <article
      className={`community-post-card relative ${post.isPinned ? "community-post-card--pinned" : ""}`}
    >
      {post.isPinned ? (
        <div className="community-post-card__pin">
          <PinIcon aria-hidden="true" className="size-3.5" />
          <span>Fixado</span>
        </div>
      ) : null}

      <header className="community-post-card__meta relative z-10">
        <MemberIdentity
          authorId={post.authorId}
          compact
          feedAvatar
          profile={post.profile ?? undefined}
          showHeadline={false}
        />
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        {post.space ? (
          <IntentLink
            className="community-post-card__space"
            href={`/comunidade/${post.space.slug}`}
          >
            {post.space.title}
          </IntentLink>
        ) : (
          <span className="community-post-card__space">Feed geral</span>
        )}
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <time
          className="text-muted-foreground"
          dateTime={(post.publishedAt ?? post.createdAt).toISOString()}
        >
          {formatDate(post.publishedAt ?? post.createdAt)}
        </time>
      </header>

      <div className="community-post-card__content">
        <div className="community-post-card__copy">
          <h2 className="community-post-card__title">
            <IntentLink
              className="after:absolute after:inset-0 after:z-0 focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
              href={href}
            >
              {post.title}
            </IntentLink>
          </h2>
          {summary ? (
            <p className="community-post-card__excerpt">{summary}</p>
          ) : null}
        </div>
        {coverUrl ? (
          <CommunityCoverImage
            alt={`Capa: ${post.title}`}
            className="community-post-card__media relative z-10"
            height={100}
            loading="lazy"
            src={communityMediaImageUrl(coverUrl, "thumb")}
            width={148}
          />
        ) : null}
      </div>

      {post.tags.length > 0 ? (
        <ul className="community-post-card__tags relative z-10">
          {post.tags.map((tag) => (
            <li key={tag}>#{tag}</li>
          ))}
        </ul>
      ) : null}

      {feedMedia.length > 0 ? (
        <div className="community-post-card__attachments relative z-10">
          <CommunityMediaGallery items={feedMedia} thumbnail />
        </div>
      ) : null}

      <div className="community-post-card__actions relative z-10">
        <IntentLink
          className="community-post-card__replies"
          href={`${href}#comments-heading`}
        >
          <MessageCircleIcon aria-hidden="true" className="size-4" />
          <span>
            {commentCount} {commentCount === 1 ? "resposta" : "respostas"}
          </span>
        </IntentLink>
        <CommunityPostActions
          className="community-post-card__member-actions"
          initialBookmarked={isSaved}
          initialVoted={isVoted}
          postId={post.id}
          spaceSlug={actionSpaceSlug}
          voteCount={post._count.votes}
        />
        {managementActions ? (
          <div className="community-post-card__management">
            {managementActions}
          </div>
        ) : null}
      </div>
    </article>
  );
}
