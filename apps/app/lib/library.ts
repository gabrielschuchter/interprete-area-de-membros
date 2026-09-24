import "server-only";

import { ContentStatus, database, LibraryItemKind } from "@repo/database";

interface LibraryFilters {
  readonly category?: string;
  readonly kind?: string;
  readonly query?: string;
}

export const getLibraryItems = ({
  query,
  kind,
  category,
}: LibraryFilters = {}) => {
  const normalizedQuery = query?.trim();
  const validKind = Object.values(LibraryItemKind).includes(
    kind as LibraryItemKind
  )
    ? (kind as LibraryItemKind)
    : undefined;

  return database.libraryItem.findMany({
    where: {
      status: ContentStatus.PUBLISHED,
      ...(validKind ? { kind: validKind } : {}),
      ...(category ? { category } : {}),
      ...(normalizedQuery
        ? {
            OR: [
              { title: { contains: normalizedQuery, mode: "insensitive" } },
              {
                description: { contains: normalizedQuery, mode: "insensitive" },
              },
              { tags: { has: normalizedQuery.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take: 80,
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      category: true,
      tags: true,
      url: true,
    },
  });
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
