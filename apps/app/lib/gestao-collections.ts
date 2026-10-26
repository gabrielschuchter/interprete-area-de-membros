import "server-only";

import {
  CollectionItemType,
  ContentStatus,
  CourseExperience,
  database,
  type Prisma,
} from "@repo/database";
import { collectionCoverPresets } from "@/lib/collection-covers";
import { collectionItemLabel } from "@/lib/content-collections";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  gestaoCollectionItemsPageSize,
  gestaoCollectionsPageSize,
  normalizeGestaoCollectionFilters,
} from "@/lib/gestao-collections-domain";
import { memberAssetUrl } from "@/lib/member-storage";

const collectionItemSelect = {
  id: true,
  itemType: true,
  position: true,
  lesson: {
    select: {
      id: true,
      title: true,
      module: {
        select: { title: true, course: { select: { title: true } } },
      },
    },
  },
  course: { select: { id: true, title: true } },
  exerciseList: {
    select: { id: true, title: true, bank: { select: { title: true } } },
  },
  asset: { select: { id: true, title: true, kind: true } },
  recording: {
    select: {
      id: true,
      originalTitle: true,
      asset: { select: { id: true, title: true, kind: true } },
      group: { select: { legacyStudentName: true } },
    },
  },
  libraryItem: { select: { id: true, title: true, kind: true } },
} as const;

const collectionStatusWhere = (
  status: string
): Prisma.ContentCollectionWhereInput =>
  status === "ALL" ? {} : { status: status as ContentStatus };

const collectionQueryWhere = (
  query: string
): Prisma.ContentCollectionWhereInput =>
  query
    ? {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};

export const getGestaoCollectionsCatalog = async (input: {
  readonly page?: string;
  readonly query?: string;
  readonly status?: string;
}) => {
  await requireGestaoAction("content.manage");
  const filters = normalizeGestaoCollectionFilters(input);
  const where = {
    ...collectionStatusWhere(filters.status),
    ...collectionQueryWhere(filters.query),
  } satisfies Prisma.ContentCollectionWhereInput;
  const total = await database.contentCollection.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / gestaoCollectionsPageSize));
  const page = Math.min(filters.page, pageCount);
  const items = await database.contentCollection.findMany({
    where,
    orderBy: [{ position: "asc" }, { title: "asc" }, { id: "asc" }],
    skip: (page - 1) * gestaoCollectionsPageSize,
    take: gestaoCollectionsPageSize,
    select: {
      id: true,
      title: true,
      slug: true,
      coverUrl: true,
      status: true,
      updatedAt: true,
      availableAt: true,
      expiresAt: true,
      audienceSpace: { select: { title: true } },
      _count: { select: { items: true } },
    },
  });

  return { filters: { ...filters, page }, items, pageCount, total };
};

const labelCollectionItem = (
  item: Prisma.ContentCollectionItemGetPayload<{
    select: typeof collectionItemSelect;
  }>
) => {
  const title =
    item.lesson?.title ??
    item.course?.title ??
    item.exerciseList?.title ??
    item.recording?.originalTitle ??
    item.recording?.asset.title ??
    item.asset?.title ??
    item.libraryItem?.title ??
    "Recurso indisponível";
  const origin =
    item.lesson?.module.course.title ??
    item.exerciseList?.bank.title ??
    item.recording?.group.legacyStudentName ??
    (item.course ? "Percurso de aprendizagem" : null) ??
    (item.libraryItem ? "Biblioteca" : null) ??
    "Origem preservada";
  const kindLabels: Record<CollectionItemType, string> = {
    COURSE: "Curso",
    EXERCISE_LIST: "Lista de exercícios",
    LESSON: "Aula",
    LIBRARY_ITEM: "Material",
    RECORDING: "Gravação",
  };

  return {
    id: item.id,
    itemType: item.itemType,
    label: collectionItemLabel(item),
    origin,
    position: item.position,
    title,
    typeLabel: kindLabels[item.itemType],
  };
};

const baseCollectionSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  coverUrl: true,
  audienceSpaceId: true,
  availableAt: true,
  expiresAt: true,
  status: true,
  position: true,
  updatedAt: true,
  audienceSpace: { select: { title: true } },
  _count: { select: { items: true } },
} as const;

type GestaoCollection = Prisma.ContentCollectionGetPayload<{
  select: typeof baseCollectionSelect;
}>;

const normalizedCollectionPage = (input: string | undefined) => {
  const page = Number(input);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
};

const getCollectionItemWindow = async (
  collection: GestaoCollection | null,
  itemPage: number,
  itemCount: number
) => {
  if (!collection) {
    return { items: [], nextItemId: null, previousItemId: null };
  }
  const skip = (itemPage - 1) * gestaoCollectionItemsPageSize;
  const hasPreviousItem = skip > 0;
  const hasNextItem = skip + gestaoCollectionItemsPageSize < itemCount;
  const itemWindow = await database.contentCollectionItem.findMany({
    where: { collectionId: collection.id },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    skip: Math.max(0, skip - (hasPreviousItem ? 1 : 0)),
    take:
      gestaoCollectionItemsPageSize +
      (hasPreviousItem ? 1 : 0) +
      (hasNextItem ? 1 : 0),
    select: collectionItemSelect,
  });
  const start = hasPreviousItem ? 1 : 0;
  const items = itemWindow.slice(start, start + gestaoCollectionItemsPageSize);
  const nextItemIndex = start + gestaoCollectionItemsPageSize;
  return {
    items,
    nextItemId: hasNextItem ? (itemWindow[nextItemIndex]?.id ?? null) : null,
    previousItemId: hasPreviousItem ? (itemWindow[0]?.id ?? null) : null,
  };
};

export const buildCollectionCoverOptions = (
  coverFiles: readonly {
    readonly id: string;
    readonly storagePath: string | null;
    readonly title: string;
  }[]
) => [
  ...collectionCoverPresets.map((cover) => ({
    id: cover.value,
    label: cover.label,
    url: cover.value,
  })),
  ...coverFiles.flatMap((file) => {
    if (!file.storagePath) {
      return [];
    }
    return [
      {
        id: file.id,
        label: file.title,
        url: memberAssetUrl(file.storagePath),
      },
    ];
  }),
];

export const getGestaoCollectionEditorData = async (input: {
  readonly id?: string;
  readonly itemPage?: string;
}) => {
  await requireGestaoAction("content.manage");
  const requestedItemPage = normalizedCollectionPage(input.itemPage);
  const collection = input.id
    ? await database.contentCollection.findUnique({
        where: { id: input.id },
        select: baseCollectionSelect,
      })
    : null;
  if (input.id && !collection) {
    return null;
  }
  const itemCount = collection?._count.items ?? 0;
  const itemPageCount = Math.max(
    1,
    Math.ceil(itemCount / gestaoCollectionItemsPageSize)
  );
  const itemPage = Math.min(requestedItemPage, itemPageCount);
  const [groups, coverFiles, itemWindow] = await Promise.all([
    database.communitySpace.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 200,
      select: { id: true, title: true },
    }),
    database.libraryItem.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        storagePath: { not: null },
        mimeType: { in: ["image/jpeg", "image/png", "image/webp"] },
      },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 50,
      select: { id: true, title: true, storagePath: true },
    }),
    getCollectionItemWindow(collection, itemPage, itemCount),
  ]);

  return {
    collection,
    covers: buildCollectionCoverOptions(coverFiles),
    groups,
    itemCount,
    itemPage,
    itemPageCount,
    items: itemWindow.items.map(labelCollectionItem),
    nextItemId: itemWindow.nextItemId,
    previousItemId: itemWindow.previousItemId,
    updateVersion: collection?.updatedAt.toISOString() ?? null,
  };
};

export const getGestaoCollectionPreviewData = async (input: {
  readonly id: string;
  readonly page?: string;
}) => {
  await requireGestaoAction("content.manage");
  const collection = await database.contentCollection.findUnique({
    where: { id: input.id },
    select: baseCollectionSelect,
  });
  if (!collection) {
    return null;
  }
  const page = normalizedCollectionPage(input.page);
  const pageCount = Math.max(
    1,
    Math.ceil(collection._count.items / gestaoCollectionItemsPageSize)
  );
  const currentPage = Math.min(page, pageCount);
  const items = await database.contentCollectionItem.findMany({
    where: { collectionId: collection.id },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    skip: (currentPage - 1) * gestaoCollectionItemsPageSize,
    take: gestaoCollectionItemsPageSize,
    select: collectionItemSelect,
  });
  return {
    collection,
    itemCount: collection._count.items,
    items: items.map(labelCollectionItem),
    page: currentPage,
    pageCount,
  };
};

export const getGestaoCollectionResourceSearch = async (input: {
  readonly query: string;
  readonly type: CollectionItemType;
}) => {
  await requireGestaoAction("content.manage");
  const query = input.query.trim().slice(0, 100);
  if (query.length < 2) {
    return [];
  }

  if (input.type === CollectionItemType.LESSON) {
    const rows = await database.lesson.findMany({
      where: {
        module: { course: { experience: CourseExperience.ASYNC } },
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          {
            module: {
              title: { contains: query, mode: "insensitive" },
              course: { experience: CourseExperience.ASYNC },
            },
          },
          {
            module: {
              course: {
                experience: CourseExperience.ASYNC,
                title: { contains: query, mode: "insensitive" },
              },
            },
          },
        ],
      },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        module: {
          select: { title: true, course: { select: { title: true } } },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      label: row.title,
      origin: `${row.module.course.title} · ${row.module.title}`,
    }));
  }

  if (input.type === CollectionItemType.COURSE) {
    const rows = await database.course.findMany({
      where: {
        experience: CourseExperience.ASYNC,
        status: { not: ContentStatus.ARCHIVED },
        title: { contains: query, mode: "insensitive" },
      },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 20,
      select: { id: true, title: true },
    });
    return rows.map((row) => ({
      id: row.id,
      label: row.title,
      origin: "Curso",
    }));
  }

  if (input.type === CollectionItemType.EXERCISE_LIST) {
    const rows = await database.exerciseList.findMany({
      where: {
        status: { not: ContentStatus.ARCHIVED },
        bank: { is: { status: ContentStatus.PUBLISHED } },
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { bank: { is: { title: { contains: query, mode: "insensitive" } } } },
        ],
      },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 20,
      select: { id: true, title: true, bank: { select: { title: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      label: row.title,
      origin: row.bank.title,
    }));
  }

  if (input.type === CollectionItemType.RECORDING) {
    const rows = await database.importedRecording.findMany({
      where: {
        OR: [
          { originalTitle: { contains: query, mode: "insensitive" } },
          { asset: { title: { contains: query, mode: "insensitive" } } },
          {
            group: {
              legacyStudentName: { contains: query, mode: "insensitive" },
            },
          },
        ],
      },
      orderBy: [{ originalTitle: "asc" }, { id: "asc" }],
      take: 20,
      select: {
        id: true,
        originalTitle: true,
        asset: { select: { title: true } },
        group: { select: { legacyStudentName: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      label: row.originalTitle ?? row.asset.title,
      origin: row.group.legacyStudentName,
    }));
  }

  const rows = await database.libraryItem.findMany({
    where: {
      status: { not: ContentStatus.ARCHIVED },
      title: { contains: query, mode: "insensitive" },
    },
    orderBy: [{ title: "asc" }, { id: "asc" }],
    take: 20,
    select: { id: true, title: true, kind: true },
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.title,
    origin: `Biblioteca · ${row.kind}`,
  }));
};

export const validateCollectionAudience = async (spaceId: string | null) =>
  !spaceId ||
  Boolean(
    await database.communitySpace.findFirst({
      where: { id: spaceId, status: ContentStatus.PUBLISHED },
      select: { id: true },
    })
  );

export const collectionItemTypes = Object.values(CollectionItemType);
