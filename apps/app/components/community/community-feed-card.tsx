import { ArrowUpRightIcon, MessageCircleIcon, PinIcon } from "lucide-react";
import Link from "next/link";
import { communityPostHref } from "@/lib/community";
import {
  type CommunityMediaItem,
  communityMediaImageUrl,
  normalizeCommunityCoverUrl,
} from "@/lib/community-media";
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
  readonly post: CommunityFeedCardPost;
  readonly spaceSlug?: string;
}

const formatDate = (date: Date) =>
  date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export function CommunityFeedCard({
  post,
  spaceSlug,
}: CommunityFeedCardProperties) {
  const href = communityPostHref(post);
  const actionSpaceSlug = spaceSlug ?? post.space?.slug ?? "";
  const isVoted = post.votes.length > 0;
  const isSaved = post.bookmarks.length > 0;
  const summary = post.subtitle || post.excerpt;
  const media = post.media ?? [];
  const coverUrl = normalizeCommunityCoverUrl(post.coverUrl);
  // Images embedded in the rich document belong to the post body. Only the
  // explicitly stored cover can appear as a visual lead in the feed.
  const feedMedia = media.filter((item) => item.kind !== "image");

  return (
    <article
      className={`community-post-card relative ${post.isPinned ? "community-post-card--pinned" : ""}`}
    >
      {post.isPinned && (
        <div className="community-post-card__pin mb-5 flex items-center gap-2">
          <PinIcon aria-hidden="true" className="size-3.5" />
          <span>Fixado pela equipe</span>
        </div>
      )}

      <header className="relative z-10 flex min-w-0 items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <MemberIdentity
            authorId={post.authorId}
            compact
            profile={post.profile ?? undefined}
            showHeadline={false}
          />
          <div className="min-w-0 text-muted-foreground text-xs leading-5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span aria-hidden="true">·</span>
              {post.space ? (
                <Link
                  className="truncate font-medium hover:text-brand-structural"
                  href={`/comunidade/${post.space.slug}`}
                >
                  {post.space.title}
                </Link>
              ) : (
                <span>Feed geral</span>
              )}
              <span aria-hidden="true">·</span>
              <time
                dateTime={(post.publishedAt ?? post.createdAt).toISOString()}
              >
                {formatDate(post.publishedAt ?? post.createdAt)}
              </time>
            </div>
            <span className="block">{post.readingMinutes} min de leitura</span>
          </div>
        </div>
        <Link
          aria-label={`Abrir publicação: ${post.title}`}
          className="community-post-card__open shrink-0 rounded-sm p-2 text-muted-foreground hover:bg-accent hover:text-brand-structural focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
          href={href}
        >
          <ArrowUpRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </header>

      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          {post.isFeatured && (
            <span className="brand-eyebrow">Em destaque</span>
          )}
        </div>
        <h3 className="mt-3 break-words font-display text-2xl leading-[1.08] tracking-tight sm:text-3xl">
          <Link
            className="after:absolute after:inset-0 after:z-0 hover:text-brand-structural focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
            href={href}
          >
            {post.title}
          </Link>
        </h3>
        {summary && (
          <p className="mt-3 line-clamp-4 max-w-[68ch] text-muted-foreground leading-7">
            {summary}
          </p>
        )}
      </div>

      {coverUrl && (
        // Cover URLs are authorized community assets or sanitized HTTPS URLs.
        // biome-ignore lint/performance/noImgElement: user-provided media may come from hosts not configured for next/image.
        <img
          alt={`Capa: ${post.title}`}
          className="community-post-card__media relative z-10 mt-5 aspect-[16/7] w-full rounded-sm object-cover"
          decoding="async"
          height={420}
          loading="lazy"
          referrerPolicy="no-referrer"
          src={communityMediaImageUrl(coverUrl, "thumb")}
          width={960}
        />
      )}

      {feedMedia.length > 0 && (
        <div className="relative z-10">
          <CommunityMediaGallery items={feedMedia} thumbnail />
        </div>
      )}

      {post.tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
          {post.tags.map((tag) => (
            <li className="text-muted-foreground text-xs" key={tag}>
              #{tag}
            </li>
          ))}
        </ul>
      )}

      <div className="community-post-card__actions relative z-10 mt-5 flex flex-wrap items-center gap-2 border-border border-t pt-4">
        <Link
          className="inline-flex min-h-10 items-center gap-1.5 rounded-sm px-3 text-muted-foreground text-sm hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
          href={`${href}#comments-heading`}
        >
          <MessageCircleIcon aria-hidden="true" className="size-4" />
          <span>{post._count.comments}</span>
          <span>respostas</span>
        </Link>
        <CommunityPostActions
          initialBookmarked={isSaved}
          initialVoted={isVoted}
          postId={post.id}
          spaceSlug={actionSpaceSlug}
          voteCount={post._count.votes}
        />
      </div>
    </article>
  );
}
