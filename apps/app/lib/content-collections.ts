import "server-only";

import {
  type CollectionItemType,
  ContentStatus,
  CourseExperience,
  database,
} from "@repo/database";

export const getAdminCollections = async () =>
  database.contentCollection.findMany({
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      status: true,
      position: true,
      items: {
        orderBy: { position: "asc" },
        select: {
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
          asset: { select: { id: true, title: true, kind: true } },
          libraryItem: { select: { id: true, title: true, kind: true } },
        },
      },
    },
  });

export const getCollectionResources = async () => {
  const [lessons, recordings, libraryItems] = await Promise.all([
    database.lesson.findMany({
      where: {
        module: { course: { experience: CourseExperience.ASYNC } },
      },
      orderBy: [{ module: { course: { title: "asc" } } }, { position: "asc" }],
      select: {
        id: true,
        title: true,
        module: {
          select: { title: true, course: { select: { title: true } } },
        },
      },
      take: 500,
    }),
    database.lessonAsset.findMany({
      where: { importedRecording: { isNot: null } },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        kind: true,
        importedRecording: {
          select: { group: { select: { legacyStudentName: true } } },
        },
      },
      take: 500,
    }),
    database.libraryItem.findMany({
      where: { status: { not: ContentStatus.ARCHIVED } },
      orderBy: [{ status: "asc" }, { title: "asc" }],
      select: { id: true, title: true, kind: true },
      take: 500,
    }),
  ]);

  return { lessons, libraryItems, recordings };
};

export const collectionItemLabel = (item: {
  readonly asset: { readonly kind: string; readonly title: string } | null;
  readonly itemType: CollectionItemType;
  readonly lesson: {
    readonly title: string;
    readonly module: {
      readonly title: string;
      readonly course: { readonly title: string };
    };
  } | null;
  readonly libraryItem: {
    readonly kind: string;
    readonly title: string;
  } | null;
}) => {
  if (item.lesson) {
    return `${item.lesson.module.course.title} · ${item.lesson.title}`;
  }
  if (item.asset) {
    return `${item.asset.kind} · ${item.asset.title}`;
  }
  if (item.libraryItem) {
    return `${item.libraryItem.kind} · ${item.libraryItem.title}`;
  }
  return item.itemType;
};
