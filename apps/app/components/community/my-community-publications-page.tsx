import { ContentStatus } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { FileTextIcon } from "lucide-react";
import Link from "next/link";
import { CommunityCoverImage } from "@/components/community/community-cover-image";
import { CommunityDeleteUndoToast } from "@/components/community/community-delete-undo-toast";
import { CommunityFeedCard } from "@/components/community/community-feed-card";
import { CommunityNavigation } from "@/components/community/community-navigation";
import { CommunityPostMenu } from "@/components/community/community-post-menu";
import { CommunityPublicationFilters } from "@/components/community/community-publication-filters";
import { CommunityPublicationViewSelector } from "@/components/community/community-publication-view-selector";
import { CommunityPublishDraftButton } from "@/components/community/community-publish-draft-button";
import { getMemberRole } from "@/lib/authorization";
import {
  type CommunityPublicationSort,
  getMyCommunityPublicationCounts,
  getMyCommunityPublicationPage,
} from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

type PublicationView = "published" | "drafts" | "archived";
const publicationViewLabels: Record<PublicationView, string> = {
  archived: "Arquivadas",
  drafts: "Rascunhos",
  published: "Publicadas",
};
type MyCommunityPost = Awaited<
  ReturnType<typeof getMyCommunityPublicationPage>
>["posts"][number];

interface MyCommunityPageProperties {
  readonly searchParams: Promise<{
    cursor?: string;
    q?: string;
    sort?: string;
    status?: string;
    undoPost?: string;
    undoUntil?: string;
  }>;
}

const statusForView = (view: PublicationView) => {
  if (view === "drafts") {
    return ContentStatus.DRAFT;
  }
  if (view === "archived") {
    return ContentStatus.ARCHIVED;
  }
  return ContentStatus.PUBLISHED;
};

const emptyCopy = (view: PublicationView, query: string) => {
  if (query) {
    return "Nenhuma publicação encontrada com esse termo.";
  }
  if (view === "drafts") {
    return "Você ainda não tem rascunhos.";
  }
  if (view === "archived") {
    return "Você ainda não tem publicações arquivadas.";
  }
  return "Você ainda não tem publicações publicadas.";
};

const viewHref = (
  view: PublicationView,
  query: string,
  sort: CommunityPublicationSort
) => {
  const params = new URLSearchParams({ status: view });
  if (query) {
    params.set("q", query);
  }
  if (sort !== "recent") {
    params.set("sort", sort);
  }
  return `/comunidade/minhas-publicacoes?${params.toString()}`;
};

const formatRelativeEditDate = (date: Date) => {
  const elapsedMs = Math.max(0, Date.now() - date.getTime());
  if (elapsedMs < 60_000) {
    return "Editado agora";
  }
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 60) {
    return `Editado há ${elapsedMinutes} min`;
  }
  const elapsedHours = Math.floor(elapsedMs / 3_600_000);
  if (elapsedHours < 24) {
    return `Editado há ${elapsedHours} ${elapsedHours === 1 ? "hora" : "horas"}`;
  }
  const elapsedDays = Math.floor(elapsedMs / 86_400_000);
  if (elapsedDays === 1) {
    return "Editado ontem";
  }
  return `Editado há ${elapsedDays} dias`;
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
        returnTo={returnTo}
      />
    );
  }

  return (
    <article className="community-my-publication-card" key={post.id}>
      <header className="community-my-publication-card__meta">
        <Badge variant={post.status === "DRAFT" ? "outline" : "secondary"}>
          {post.status === "DRAFT" ? "Rascunho" : "Arquivada"}
        </Badge>
        <span
          aria-hidden="true"
          className="community-my-publication-card__meta-separator"
        >
          ·
        </span>
        <span className="community-my-publication-card__space">
          {post.space?.title ?? "Feed geral"}
        </span>
        <span
          aria-hidden="true"
          className="community-my-publication-card__meta-separator community-my-publication-card__meta-separator--space"
        >
          ·
        </span>
        <time dateTime={post.updatedAt.toISOString()}>
          {formatRelativeEditDate(post.updatedAt)}
        </time>
      </header>
      <div className="community-my-publication-card__body">
        <div className="community-my-publication-card__copy">
          <h2>
            <Link href={editHref}>{post.title}</Link>
          </h2>
          {post.subtitle || post.excerpt ? (
            <p>{post.subtitle || post.excerpt}</p>
          ) : null}
          {post.tags.length > 0 ? (
            <ul
              aria-label="Assuntos"
              className="community-my-publication-card__tags"
            >
              {post.tags.map((tag) => (
                <li key={tag}>#{tag}</li>
              ))}
            </ul>
          ) : null}
        </div>
        {post.coverUrl ? (
          <CommunityCoverImage
            alt={post.coverAltText || `Capa: ${post.title}`}
            className="community-my-publication-card__cover"
            height={100}
            src={post.coverUrl}
            width={148}
          />
        ) : null}
      </div>
      <div className="community-my-publication-card__actions">
        {post.status === "DRAFT" ? (
          <Button
            asChild
            className="community-my-publication-edit-button"
            size="sm"
          >
            <Link href={editHref}>Continuar editando</Link>
          </Button>
        ) : (
          <CommunityPublishDraftButton
            buttonLabel="Restaurar"
            editHref={editHref}
            postId={post.id}
            spaceSlug={post.space?.slug ?? ""}
          />
        )}
        {postMenu}
      </div>
    </article>
  );
};

const MyCommunityPage = async ({ searchParams }: MyCommunityPageProperties) => {
  const filters = await searchParams;
  const activeView: PublicationView =
    filters.status === "drafts" || filters.status === "archived"
      ? filters.status
      : "published";
  const sort: CommunityPublicationSort =
    filters.sort === "oldest" || filters.sort === "title"
      ? filters.sort
      : "recent";
  const query = filters.q?.trim().slice(0, 100) ?? "";
  const memberId = await requireMemberId();
  const [page, counts, role] = await Promise.all([
    getMyCommunityPublicationPage(memberId, {
      cursor: filters.cursor,
      query,
      sort,
      status: statusForView(activeView),
    }),
    getMyCommunityPublicationCounts(memberId),
    getMemberRole(memberId),
  ]);
  const canModerate = role === "ADMIN" || role === "TEACHER";
  const returnTo = viewHref(activeView, query, sort);
  const undoUntil = Number(filters.undoUntil);
  const showUndo =
    Boolean(filters.undoPost) &&
    Number.isFinite(undoUntil) &&
    undoUntil > Date.now();

  return (
    <div className="community-page min-h-svh bg-background">
      <main
        className="community-shell community-my-publications-shell mx-auto w-full"
        data-route-structure-ready="community"
      >
        <div className="community-my-publications-nav">
          <CommunityNavigation active="mine" />
        </div>
        <header className="community-my-publications-header">
          <div>
            <h1>Minhas publicações</h1>
            <p>
              Tudo o que você escreveu na Comunidade. Rascunhos são só seus: não
              aparecem no feed, nos grupos nem na busca.
            </p>
          </div>
        </header>
        <nav
          aria-label="Situação das publicações"
          className="community-publications-tabs"
        >
          {(
            [
              ["published", "Publicadas", counts.published],
              ["drafts", "Rascunhos", counts.drafts],
              ["archived", "Arquivadas", counts.archived],
            ] as const
          ).map(([view, label, count]) => (
            <Link
              aria-current={activeView === view ? "page" : undefined}
              className={
                activeView === view
                  ? "community-publications-tab is-active"
                  : "community-publications-tab"
              }
              href={viewHref(view, query, sort)}
              key={view}
            >
              {label} <span>{count}</span>
            </Link>
          ))}
        </nav>
        <CommunityPublicationViewSelector
          activeView={activeView}
          counts={counts}
          query={query}
          sort={sort}
        />
        <CommunityPublicationFilters
          activeView={activeView}
          query={query}
          sort={sort}
        />
        <section
          aria-label={publicationViewLabels[activeView]}
          className="community-my-publications-list"
          data-route-content-ready="community"
        >
          {page.posts.length === 0 ? (
            <div className="community-my-publications-empty">
              <FileTextIcon aria-hidden="true" />
              <h2>{emptyCopy(activeView, query)}</h2>
              <p>
                {activeView === "drafts"
                  ? "Abra uma publicação para continuar escrevendo quando quiser."
                  : "As publicações e os rascunhos que você criar aparecerão aqui."}
              </p>
            </div>
          ) : (
            <div className="community-feed-list">
              {page.posts.map((post) => (
                <MyCommunityPublicationItem
                  canModerate={canModerate}
                  key={post.id}
                  post={post}
                  returnTo={returnTo}
                />
              ))}
            </div>
          )}
          {page.nextCursor ? (
            <div className="community-publications-pagination">
              <Button asChild variant="outline">
                <Link
                  href={`${returnTo}&cursor=${encodeURIComponent(page.nextCursor)}`}
                >
                  Carregar mais
                </Link>
              </Button>
            </div>
          ) : null}
        </section>
      </main>
      {showUndo ? (
        <CommunityDeleteUndoToast
          deletedAt={new Date(undoUntil - 8000).toISOString()}
          postId={filters.undoPost as string}
          undoUntil={undoUntil}
        />
      ) : null}
    </div>
  );
};

export default MyCommunityPage;
