import "server-only";

import {
  ContentStatus,
  database,
  LibraryItemDifficulty,
  LibraryItemKind,
  type Prisma,
} from "@repo/database";
import { requireGestaoAction } from "./gestao-authorization";
import { normalizeGestaoLibraryFilters } from "./gestao-library-domain";

const pageSize = 24;

const libraryWhere = (input: {
  readonly category: string;
  readonly difficulty: string;
  readonly kind: string;
  readonly language: string;
  readonly query: string;
  readonly status: string;
}): Prisma.LibraryItemWhereInput => ({
  ...(input.status === "ALL" ? {} : { status: input.status as ContentStatus }),
  ...(input.kind &&
  Object.values(LibraryItemKind).includes(input.kind as LibraryItemKind)
    ? { kind: input.kind as LibraryItemKind }
    : {}),
  ...(input.category ? { category: input.category } : {}),
  ...(input.language ? { language: { contains: input.language } } : {}),
  ...(input.difficulty &&
  Object.values(LibraryItemDifficulty).includes(
    input.difficulty as LibraryItemDifficulty
  )
    ? { difficulty: input.difficulty as LibraryItemDifficulty }
    : {}),
  ...(input.query
    ? {
        OR: [
          { title: { contains: input.query, mode: "insensitive" } },
          { authors: { contains: input.query, mode: "insensitive" } },
          { doi: { contains: input.query, mode: "insensitive" } },
          { pmid: { contains: input.query, mode: "insensitive" } },
          { tags: { has: input.query.toLocaleLowerCase("pt-BR") } },
        ],
      }
    : {}),
});

export const getGestaoLibraryCatalog = async (input: {
  readonly category?: string;
  readonly difficulty?: string;
  readonly kind?: string;
  readonly language?: string;
  readonly page?: string;
  readonly query?: string;
  readonly status?: string;
  readonly view?: string;
}) => {
  await requireGestaoAction("content.manage");
  const filters = normalizeGestaoLibraryFilters(input);
  const withoutStatus = libraryWhere({ ...filters, status: "ALL" });
  const statusCounts = await database.libraryItem.groupBy({
    by: ["status"],
    where: withoutStatus,
    _count: { _all: true },
  });
  const counts = new Map(
    statusCounts.map(({ status, _count }) => [status, _count._all])
  );
  const where = libraryWhere(filters);
  const total =
    counts.get(filters.status as ContentStatus) ??
    [...counts.values()].reduce((sum, count) => sum + count, 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(filters.page, pageCount);
  const [items, categoryRows, languageRows, collections] = await Promise.all([
    database.libraryItem.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { position: "asc" },
        { title: "asc" },
        { id: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        coverUrl: true,
        kind: true,
        category: true,
        status: true,
        authors: true,
        language: true,
        difficulty: true,
        accessType: true,
      },
    }),
    database.libraryItem.groupBy({
      by: ["category"],
      where: { category: { not: null } },
      orderBy: { category: "asc" },
      take: 100,
    }),
    database.libraryItem.groupBy({
      by: ["language"],
      where: { language: { not: null } },
      orderBy: { language: "asc" },
      take: 50,
    }),
    database.contentCollection.findMany({
      where: { status: { not: ContentStatus.ARCHIVED } },
      orderBy: [{ position: "asc" }, { title: "asc" }],
      take: 100,
      select: { id: true, title: true },
    }),
  ]);

  return {
    categories: categoryRows.flatMap(({ category }) =>
      category ? [category] : []
    ),
    collections,
    counts: {
      all: [...counts.values()].reduce((sum, count) => sum + count, 0),
      archived: counts.get(ContentStatus.ARCHIVED) ?? 0,
      draft: counts.get(ContentStatus.DRAFT) ?? 0,
      published: counts.get(ContentStatus.PUBLISHED) ?? 0,
    },
    filters: { ...filters, page },
    items,
    languages: languageRows.flatMap(({ language }) =>
      language ? [language] : []
    ),
    pageCount,
    total,
  };
};

export const getGestaoLibraryItemForEdit = async (id: string) => {
  await requireGestaoAction("content.manage", { contentId: id });
  return database.libraryItem.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      coverUrl: true,
      kind: true,
      category: true,
      tags: true,
      url: true,
      status: true,
      authors: true,
      year: true,
      language: true,
      difficulty: true,
      accessType: true,
      accessNote: true,
      version: true,
      doi: true,
      pmid: true,
      lessonId: true,
      storagePath: true,
      mimeType: true,
      sizeBytes: true,
    },
  });
};
