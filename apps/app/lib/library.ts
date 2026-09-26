import "server-only";

import {
  ContentStatus,
  database,
  LibraryItemKind,
  type Prisma,
} from "@repo/database";

interface LibraryFilters {
  readonly category?: string;
  readonly kind?: string;
  readonly memberId: string;
  readonly page?: number;
  readonly query?: string;
  readonly sort?: "recent" | "title" | "year";
}

const PAGE_SIZE = 24;

export const getLibraryItems = ({
  query,
  kind,
  category,
  page = 1,
  sort = "recent",
  memberId,
}: LibraryFilters) => {
  const currentPage = Number.isInteger(page) && page > 0 ? page : 1;
  const normalizedQuery = query?.trim();
  const validKind = Object.values(LibraryItemKind).includes(
    kind as LibraryItemKind
  )
    ? (kind as LibraryItemKind)
    : undefined;
  const orderBy: Prisma.LibraryItemOrderByWithRelationInput[] = (() => {
    if (sort === "title") {
      return [{ title: "asc" }, { position: "asc" }];
    }
    if (sort === "year") {
      return [{ year: "desc" }, { position: "asc" }];
    }
    return [{ position: "asc" }, { createdAt: "desc" }];
  })();

  return database.libraryItem
    .findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        ...(validKind ? { kind: validKind } : {}),
        ...(category ? { category } : {}),
        ...(normalizedQuery
          ? {
              OR: [
                { title: { contains: normalizedQuery, mode: "insensitive" } },
                { authors: { contains: normalizedQuery, mode: "insensitive" } },
                {
                  description: {
                    contains: normalizedQuery,
                    mode: "insensitive",
                  },
                },
                { tags: { has: normalizedQuery.toLowerCase() } },
              ],
            }
          : {}),
      },
      orderBy,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        category: true,
        tags: true,
        url: true,
        authors: true,
        year: true,
        doi: true,
        pmid: true,
        storagePath: true,
        mimeType: true,
        lesson: { select: { id: true, title: true } },
        bookmarks: { where: { memberId }, select: { id: true } },
      },
    })
    .then((rows) => ({
      items: rows.slice(0, PAGE_SIZE).map((row) => ({
        ...row,
        isBookmarked: Array.isArray(row.bookmarks) && row.bookmarks.length > 0,
        bookmarks: undefined,
      })),
      page: currentPage,
      hasMore: rows.length > PAGE_SIZE,
      sort,
    }));
};

export const getLibraryCategories = async () => {
  const rows = await database.libraryItem.findMany({
    where: { status: ContentStatus.PUBLISHED, category: { not: null } },
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
  });
  return rows.flatMap((row) => (row.category ? [row.category] : []));
};

export const getPublishedLibraryItem = async (id: string, memberId: string) =>
  database.libraryItem.findFirst({
    where: { id, status: ContentStatus.PUBLISHED },
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      category: true,
      tags: true,
      url: true,
      authors: true,
      year: true,
      doi: true,
      pmid: true,
      storagePath: true,
      lesson: { select: { id: true, title: true } },
      activities: { select: { id: true, title: true } },
      mimeType: true,
      createdAt: true,
      bookmarks: { where: { memberId }, select: { id: true } },
    },
  });

export const getStaffLibraryItems = async () =>
  database.libraryItem.findMany({
    orderBy: [{ status: "asc" }, { position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      category: true,
      tags: true,
      url: true,
      status: true,
      authors: true,
      year: true,
      doi: true,
      pmid: true,
      storagePath: true,
      lesson: { select: { id: true, title: true } },
      activities: { select: { id: true, title: true } },
      mimeType: true,
      sizeBytes: true,
    },
  });
