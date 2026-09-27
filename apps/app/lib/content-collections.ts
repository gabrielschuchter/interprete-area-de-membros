import "server-only";

import {
  type CollectionItemType,
  ContentStatus,
  CourseExperience,
  database,
  MemberRole,
  type Prisma,
} from "@repo/database";
import { getMemberRole } from "./authorization";
import { getLearningAccessScope, hasLessonAccess } from "./content-access";

const collectionItemSelect = {
  id: true,
  itemType: true,
  position: true,
  lesson: {
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      status: true,
      module: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              experience: true,
            },
          },
        },
      },
    },
  },
  recording: {
    select: {
      id: true,
      originalTitle: true,
      meetingDate: true,
      group: {
        select: {
          id: true,
          memberId: true,
          legacyStudentName: true,
        },
      },
      asset: {
        select: {
          id: true,
          title: true,
          kind: true,
          mimeType: true,
          durationSeconds: true,
        },
      },
      legacyLesson: { select: { id: true, title: true } },
    },
  },
  // `asset` is kept only for collection rows written before the explicit
  // ImportedRecording relation existed. New writes use `recording`.
  asset: {
    select: {
      id: true,
      title: true,
      kind: true,
      importedRecording: {
        select: {
          id: true,
          originalTitle: true,
          meetingDate: true,
          group: {
            select: {
              id: true,
              memberId: true,
              legacyStudentName: true,
            },
          },
          legacyLesson: { select: { id: true, title: true } },
        },
      },
    },
  },
  libraryItem: {
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      status: true,
      url: true,
    },
  },
} as const;

const collectionSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  status: true,
  position: true,
  items: {
    orderBy: { position: "asc" as const },
    select: collectionItemSelect,
  },
} as const;

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
          recording: {
            select: {
              id: true,
              originalTitle: true,
              asset: { select: { id: true, title: true, kind: true } },
              group: { select: { legacyStudentName: true } },
            },
          },
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
    database.importedRecording.findMany({
      orderBy: [
        { group: { legacyStudentName: "asc" } },
        { originalTitle: "asc" },
      ],
      select: {
        id: true,
        originalTitle: true,
        asset: { select: { title: true, kind: true } },
        group: { select: { legacyStudentName: true } },
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
  readonly recording?: {
    readonly asset: {
      readonly kind: string;
      readonly title: string;
    };
    readonly group: { readonly legacyStudentName: string };
    readonly originalTitle: string | null;
  } | null;
}) => {
  if (item.lesson) {
    return `${item.lesson.module.course.title} · ${item.lesson.title}`;
  }
  if (item.asset) {
    return `${item.asset.kind} · ${item.asset.title}`;
  }
  if (item.recording) {
    return `${item.recording.group.legacyStudentName} · ${item.recording.originalTitle ?? item.recording.asset.title}`;
  }
  if (item.libraryItem) {
    return `${item.libraryItem.kind} · ${item.libraryItem.title}`;
  }
  return item.itemType;
};

type CollectionWithItems = Prisma.ContentCollectionGetPayload<{
  select: typeof collectionSelect;
}>;

const resolveLegacyRecording = (item: CollectionWithItems["items"][number]) =>
  item.recording ?? item.asset?.importedRecording ?? null;

export const collectionItemHref = (
  item: CollectionWithItems["items"][number]
) => {
  if (item.lesson) {
    return `/aprender/cursos/${item.lesson.module.course.slug}/${item.lesson.slug}`;
  }

  if (item.recording) {
    return `/encontros/gravacoes?asset=${encodeURIComponent(item.recording.asset.id)}`;
  }

  if (item.asset?.importedRecording) {
    return `/encontros/gravacoes?asset=${encodeURIComponent(item.asset.id)}`;
  }

  if (item.libraryItem) {
    return `/biblioteca/${item.libraryItem.id}`;
  }

  return null;
};

export const canReadCollectionItem = (
  item: CollectionWithItems["items"][number],
  memberId: string,
  fullAccess: boolean,
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>
) => {
  if (item.itemType === "LESSON") {
    const lesson = item.lesson;
    if (!lesson) {
      return false;
    }
    const course = lesson.module.course;
    return (
      course.status === ContentStatus.PUBLISHED &&
      course.experience === CourseExperience.ASYNC &&
      lesson.module.status === ContentStatus.PUBLISHED &&
      lesson.status === ContentStatus.PUBLISHED &&
      hasLessonAccess(scope, course.id, lesson.module.id, lesson.id)
    );
  }

  if (item.itemType === "RECORDING") {
    const recording = resolveLegacyRecording(item);
    return Boolean(
      recording && (fullAccess || recording.group.memberId === memberId)
    );
  }

  return (
    item.itemType === "LIBRARY_ITEM" &&
    item.libraryItem?.status === ContentStatus.PUBLISHED
  );
};

const filterCollectionForMember = (
  collection: CollectionWithItems,
  memberId: string,
  fullAccess: boolean,
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>
) => ({
  ...collection,
  items: collection.items.filter((item) =>
    canReadCollectionItem(item, memberId, fullAccess, scope)
  ),
});

/**
 * Returns only published, authorized collection resources. Recording access
 * is resolved through ImportedRecordingGroup.memberId, never through the
 * legacy student label or the underlying LessonAsset alone.
 */
export const getPublishedCollectionForMember = async (
  slug: string,
  memberId: string
) => {
  const [collection, role, scope] = await Promise.all([
    database.contentCollection.findUnique({
      where: { slug, status: ContentStatus.PUBLISHED },
      select: collectionSelect,
    }),
    getMemberRole(memberId),
    getLearningAccessScope(memberId),
  ]);

  if (!collection) {
    return null;
  }

  return filterCollectionForMember(
    collection,
    memberId,
    role === MemberRole.ADMIN || role === MemberRole.TEACHER,
    scope
  );
};

export const getPublishedCollectionsForMember = async (
  memberId: string,
  take = 20
) => {
  const [collections, role, scope] = await Promise.all([
    database.contentCollection.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: [{ position: "asc" }, { title: "asc" }],
      take: Math.min(Math.max(take, 1), 50),
      select: collectionSelect,
    }),
    getMemberRole(memberId),
    getLearningAccessScope(memberId),
  ]);
  const fullAccess = role === MemberRole.ADMIN || role === MemberRole.TEACHER;

  return collections
    .map((collection) =>
      filterCollectionForMember(collection, memberId, fullAccess, scope)
    )
    .filter((collection) => collection.items.length > 0);
};
