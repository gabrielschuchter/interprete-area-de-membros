import { ContentStatus } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { FileTextIcon } from "lucide-react";
import Link from "next/link";
import { CommunityComposerPrompt } from "@/components/community/community-composer-prompt";
import { CommunityCoverImage } from "@/components/community/community-cover-image";
import { CommunityFeedCard } from "@/components/community/community-feed-card";
import { CommunityHero } from "@/components/community/community-hero";
import { CommunityNavigation } from "@/components/community/community-navigation";
import { CommunityPostMenu } from "@/components/community/community-post-menu";
import { CommunityPublishDraftButton } from "@/components/community/community-publish-draft-button";
import { CommunityRightRail } from "@/components/community/community-right-rail";
import { getMemberRole } from "@/lib/authorization";
import {
  getCommunityPresenceProfiles,
  getCommunitySpaces,
  getMyCommunityPosts,
} from "@/lib/community";
import { requireMemberId } from "@/lib/learning";
import { getRecentCommunityAnnouncements } from "@/lib/notifications";
import { getOrCreateProfile } from "@/lib/profile";

const statusLabel = (status: string) => {
  if (status === "DRAFT") {
    return "Rascunho";
  }
  if (status === "ARCHIVED") {
    return "Arquivado";
  }
  return "Publicado";
};

const formatDate = (date: Date) =>
  date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

interface MyCommunityPageProperties {
  readonly searchParams: Promise<{ status?: string }>;
}

const publicationViews = [
  { label: "Todas", value: "all" },
  { label: "Publicadas", value: "published" },
  { label: "Rascunhos", value: "drafts" },
  { label: "Arquivadas", value: "archived" },
] as const;

type PublicationView = (typeof publicationViews)[number]["value"];
type MyCommunityPost = Awaited<ReturnType<typeof getMyCommunityPosts>>[number];

const isPublicationView = (value?: string): value is PublicationView =>
  publicationViews.some((view) => view.value === value);

const statusForPublicationView = (view: PublicationView) => {
  switch (view) {
    case "published":
      return ContentStatus.PUBLISHED;
    case "drafts":
      return ContentStatus.DRAFT;
    case "archived":
      return ContentStatus.ARCHIVED;
    default:
      return undefined;
  }
};

const emptyPublicationCopy = (view: PublicationView) => {
  switch (view) {
    case "published":
      return "Você ainda não tem publicações publicadas.";
    case "drafts":
      return "Você ainda não tem publicações em rascunho.";
    case "archived":
      return "Você ainda não tem publicações arquivadas.";
    default:
      return "Você ainda não publicou nada.";
  }
};

const MyCommunityPublicationItem = ({
  canModerate,
  post,
  returnTo,
}: {
  readonly canModerate: boolean;
  readonly post: MyCommunityPost;
  readonly returnTo: string;
}) => {
  const editHref = `/comunidade/editor/${post.id}?from=${encodeURIComponent(returnTo)}`;
  const postMenu = (
    <CommunityPostMenu
      canModerate={canModerate}
      isFeatured={post.isFeatured}
      isPinned={post.isPinned}
      postId={post.id}
      returnTo={returnTo}
      spaceSlug={post.space?.slug ?? ""}
      status={post.status}
    />
  );

  if (post.status === "PUBLISHED") {
    return (
      <CommunityFeedCard
        key={post.id}
        managementActions={postMenu}
        post={post}
      />
    );
  }

  return (
    <article
      className="community-post-card community-my-post-card"
      key={post.id}
    >
      <header className="community-post-card__meta">
        <Badge variant={post.status === "DRAFT" ? "outline" : "default"}>
          {statusLabel(post.status)}
        </Badge>
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <span className="community-post-card__space">
          {post.space?.title ?? "Feed geral"}
        </span>
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <time dateTime={post.updatedAt.toISOString()}>
          {formatDate(post.updatedAt)}
        </time>
      </header>
      <div className="community-post-card__content">
        <div className="community-post-card__copy">
          <h3 className="community-post-card__title">
            <Link
              className="focus-visible:underline focus-visible:outline-none"
              href={editHref}
            >
              {post.title}
            </Link>
          </h3>
          {post.subtitle || post.excerpt ? (
            <p className="community-post-card__excerpt">
              {post.subtitle || post.excerpt}
            </p>
          ) : null}
        </div>
        {post.coverUrl ? (
          <CommunityCoverImage
            alt={`Capa: ${post.title}`}
            className="community-post-card__media relative z-10"
            height={100}
            src={post.coverUrl}
            width={148}
          />
        ) : null}
      </div>
      <div className="community-post-card__actions">
        {post.status === "DRAFT" || post.status === "ARCHIVED" ? (
          <>
            {postMenu}
            <CommunityPublishDraftButton
              confirmGroupMention={post.status === "DRAFT"}
              editHref={editHref}
              postId={post.id}
              spaceSlug={post.space?.slug ?? ""}
            />
          </>
        ) : null}
      </div>
    </article>
  );
};

const MyCommunityPage = async ({ searchParams }: MyCommunityPageProperties) => {
  const filters = await searchParams;
  const activeView = isPublicationView(filters.status) ? filters.status : "all";
  const selectedStatus = statusForPublicationView(activeView);
  const memberId = await requireMemberId();
  const [posts, spaces, profile, announcements, presenceProfiles, role] =
    await Promise.all([
      getMyCommunityPosts(memberId, selectedStatus),
      getCommunitySpaces(memberId),
      getOrCreateProfile(memberId),
      getRecentCommunityAnnouncements(memberId),
      getCommunityPresenceProfiles(memberId),
      getMemberRole(memberId),
    ]);
  const canModerate = role === "ADMIN" || role === "TEACHER";

  return (
    <div className="community-page min-h-svh bg-background">
      <main
        className="community-shell mx-auto w-full"
        data-route-structure-ready="community"
      >
        <CommunityHero />
        <div className="community-content-grid">
          <div className="community-discovery-toolbar">
            <CommunityNavigation active="mine" />
          </div>
          <CommunityRightRail
            announcements={announcements}
            memberId={memberId}
            presenceProfiles={presenceProfiles}
            profile={profile}
            spaces={spaces}
          />
          <CommunityComposerPrompt
            memberId={memberId}
            returnTo={`/comunidade/minhas-publicacoes?status=${activeView}`}
          />
          <section
            aria-labelledby="my-community-posts-heading"
            className="community-feed-area min-w-0"
            data-route-content-ready="community"
          >
            <h2 className="sr-only" id="my-community-posts-heading">
              Minhas publicações
            </h2>
            <nav
              aria-label="Filtrar minhas publicações"
              className="mb-5 flex flex-wrap gap-2 border-border border-b pb-4"
            >
              {publicationViews.map((view) => (
                <Link
                  aria-current={activeView === view.value ? "page" : undefined}
                  className={
                    activeView === view.value
                      ? "rounded-full bg-brand-structural px-4 py-2 font-medium text-sm text-white"
                      : "rounded-full border px-4 py-2 text-muted-foreground text-sm hover:text-foreground"
                  }
                  href={
                    view.value === "all"
                      ? "/comunidade/minhas-publicacoes"
                      : `/comunidade/minhas-publicacoes?status=${view.value}`
                  }
                  key={view.value}
                >
                  {view.label}
                </Link>
              ))}
            </nav>
            {posts.length === 0 ? (
              <div className="community-my-posts-empty">
                <FileTextIcon
                  aria-hidden="true"
                  className="size-6 text-brand-action-text"
                />
                <h3 className="mt-5 font-display text-3xl">
                  {emptyPublicationCopy(activeView)}
                </h3>
                <p className="mt-3 max-w-xl text-muted-foreground leading-7">
                  Comece por uma pergunta curta ou escreva uma publicação mais
                  elaborada.
                </p>
              </div>
            ) : (
              <div className="community-feed-list">
                {posts.map((post) => (
                  <MyCommunityPublicationItem
                    canModerate={canModerate}
                    key={post.id}
                    post={post}
                    returnTo={`/comunidade/minhas-publicacoes?status=${activeView}`}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default MyCommunityPage;
