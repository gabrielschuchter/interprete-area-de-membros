import "server-only";
import { ContentStatus, database, type Prisma } from "@repo/database";
import { communityPostHref } from "./community";
import type {
  GestaoPublicationMark,
  GestaoPublicationTab,
} from "./gestao-publications-domain";

const pageSize = 20;

export interface GestaoPublicationRow {
  readonly authorName: string;
  readonly createdAt: Date;
  readonly href: string;
  readonly id: string;
  readonly isFeatured: boolean;
  readonly isPinned: boolean;
  readonly spaceSlug: string;
  readonly spaceTitle: string;
  readonly status: "ARCHIVED" | "PUBLISHED";
  readonly title: string;
}

interface ListInput {
  readonly mark: GestaoPublicationMark | null;
  readonly page: string | undefined;
  readonly query: string | undefined;
  readonly space: string | undefined;
  readonly tab: GestaoPublicationTab;
}

const feedValue = "feed";

const buildWhere = (input: ListInput): Prisma.CommunityPostWhereInput => {
  const needle = input.query?.trim().slice(0, 120);
  const spaceFilter: Prisma.CommunityPostWhereInput = (() => {
    if (!input.space) {
      return {};
    }
    return input.space === feedValue
      ? { spaceId: null }
      : { spaceId: input.space };
  })();
  return {
    deletedAt: null,
    status:
      input.tab === "archived"
        ? ContentStatus.ARCHIVED
        : ContentStatus.PUBLISHED,
    ...spaceFilter,
    ...(needle ? { title: { contains: needle, mode: "insensitive" } } : {}),
    ...(input.mark === "fixada" ? { isPinned: true } : {}),
    ...(input.mark === "destaque" ? { isFeatured: true } : {}),
  };
};

export const getGestaoPublicationList = async (input: ListInput) => {
  const where = buildWhere(input);
  const [total, published, archived, spaces] = await Promise.all([
    input.tab === "reported"
      ? Promise.resolve(0)
      : database.communityPost.count({ where }),
    database.communityPost.count({
      where: { deletedAt: null, status: ContentStatus.PUBLISHED },
    }),
    database.communityPost.count({
      where: { deletedAt: null, status: ContentStatus.ARCHIVED },
    }),
    database.communitySpace.findMany({
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 200,
      select: { id: true, title: true },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number.parseInt(input.page ?? "1", 10);
  const page = Math.min(
    pageCount,
    Number.isFinite(requested) && requested > 0 ? requested : 1
  );
  const posts =
    input.tab === "reported"
      ? []
      : await database.communityPost.findMany({
          where,
          orderBy: [
            { isPinned: "desc" },
            { publishedAt: { sort: "desc", nulls: "last" } },
            { createdAt: "desc" },
            { id: "desc" },
          ],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            title: true,
            slug: true,
            authorId: true,
            status: true,
            isPinned: true,
            isFeatured: true,
            publishedAt: true,
            createdAt: true,
            space: { select: { title: true, slug: true } },
          },
        });
  const authors = posts.length
    ? await database.member.findMany({
        where: { id: { in: [...new Set(posts.map((post) => post.authorId))] } },
        select: { id: true, displayName: true },
      })
    : [];
  const authorNames = new Map(
    authors.map((author) => [author.id, author.displayName ?? "Membro"])
  );
  const rows = posts.map(
    (post): GestaoPublicationRow => ({
      authorName: authorNames.get(post.authorId) ?? "Membro",
      createdAt: post.publishedAt ?? post.createdAt,
      href: communityPostHref(post),
      id: post.id,
      isFeatured: post.isFeatured,
      isPinned: post.isPinned,
      spaceSlug: post.space?.slug ?? "",
      spaceTitle: post.space?.title ?? "Feed geral",
      status: post.status === ContentStatus.ARCHIVED ? "ARCHIVED" : "PUBLISHED",
      title: post.title,
    })
  );
  return {
    counts: { archived, published },
    page,
    pageCount,
    pageSize,
    rows,
    spaces,
    total,
  };
};
