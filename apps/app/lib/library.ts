import "server-only";

import { ContentStatus, database, LibraryItemKind } from "@repo/database";

interface LibraryFilters {
  readonly category?: string;
  readonly kind?: string;
  readonly page?: number;
  readonly query?: string;
}

const PAGE_SIZE = 24;

export const getLibraryItems = ({
  query,
  kind,
  category,
  page = 1,
}: LibraryFilters = {}) => {
  const currentPage = Number.isInteger(page) && page > 0 ? page : 1;
  const normalizedQuery = query?.trim();
  const validKind = Object.values(LibraryItemKind).includes(
    kind as LibraryItemKind
  )
    ? (kind as LibraryItemKind)
    : undefined;

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
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
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
      },
    })
    .then((rows) => ({
      items: rows.slice(0, PAGE_SIZE),
      page: currentPage,
      hasMore: rows.length > PAGE_SIZE,
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

export const getStaffLibraryItems = async () =>
  database.libraryItem.findMany({
    orderBy: [{ status: "asc" }, { position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      kind: true,
      category: true,
      url: true,
      status: true,
    },
  });
