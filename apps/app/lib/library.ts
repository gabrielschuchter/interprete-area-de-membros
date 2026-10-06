import "server-only";

import {
  ContentStatus,
  database,
  LibraryBookmarkTargetType,
  LibraryItemDifficulty,
  LibraryItemKind,
  type Prisma,
} from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import {
  getLearningAccessScope,
  hasCourseAccess,
  hasLessonAccess,
  hasModuleAccess,
} from "./content-access";
import { LIBRARY_PAGE_SIZE, pageLibraryRows } from "./library-pagination";
import { libraryPopularityScore, librarySearchScore } from "./library-ranking";

interface LibraryFilters {
  readonly category?: string;
  readonly difficulty?: string;
  readonly kind?: string;
  readonly language?: string;
  readonly memberId: string;
  readonly page?: number;
  readonly query?: string;
  readonly sort?: "recent" | "relevant";
}

const PAGE_SIZE = LIBRARY_PAGE_SIZE;
const MAX_RELEVANCE_CANDIDATES = 500;
type LibraryAccessScope = Awaited<ReturnType<typeof getLearningAccessScope>>;

const buildLibraryWhere = ({
  category,
  difficulty,
  kind,
  language,
  query,
}: Pick<
  LibraryFilters,
  "category" | "difficulty" | "kind" | "language" | "query"
>) => {
  const normalizedQuery = query?.trim();
  const validKind = Object.values(LibraryItemKind).includes(
    kind as LibraryItemKind
  )
    ? (kind as LibraryItemKind)
    : undefined;
  const normalizedLanguage = language?.trim().toLowerCase();
  const validLanguage = ["en", "pt", "es"].includes(normalizedLanguage ?? "")
    ? normalizedLanguage
    : undefined;
  const validDifficulty = Object.values(LibraryItemDifficulty).includes(
    difficulty as LibraryItemDifficulty
  )
    ? (difficulty as LibraryItemDifficulty)
    : undefined;
  const where = {
    status: ContentStatus.PUBLISHED,
    ...(validKind ? { kind: validKind } : {}),
    ...(validLanguage
      ? { language: { contains: validLanguage, mode: "insensitive" as const } }
      : {}),
    ...(validDifficulty ? { difficulty: validDifficulty } : {}),
    ...(category ? { category } : {}),
    ...(normalizedQuery
      ? {
          OR: [
            {
              title: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              authors: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              description: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            { tags: { has: normalizedQuery.toLowerCase() } },
          ],
        }
      : {}),
  } satisfies Prisma.LibraryItemWhereInput;

  return { normalizedQuery, where };
};

const buildLessonAccessWhere = (
  scope: LibraryAccessScope
): Prisma.LibraryItemWhereInput => {
  const publishedLesson: Prisma.LessonWhereInput = {
    status: ContentStatus.PUBLISHED,
    module: {
      is: {
        status: ContentStatus.PUBLISHED,
        course: { is: { status: ContentStatus.PUBLISHED } },
      },
    },
  };
  if (scope.fullAccess) {
    return {
      OR: [{ lessonId: null }, { lesson: { is: publishedLesson } }],
    };
  }

  const accessibleLessons: Prisma.LibraryItemWhereInput[] = [
    { lessonId: null },
  ];
  if (scope.lessonIds.size > 0) {
    accessibleLessons.push({
      lesson: {
        is: {
          ...publishedLesson,
          id: { in: [...scope.lessonIds] },
        },
      },
    });
  }
  if (scope.moduleIds.size > 0) {
    accessibleLessons.push({
      lesson: {
        is: {
          ...publishedLesson,
          moduleId: { in: [...scope.moduleIds] },
        },
      },
    });
  }
  if (scope.fullCourseIds.size > 0) {
    accessibleLessons.push({
      lesson: {
        is: {
          ...publishedLesson,
          module: {
            is: {
              status: ContentStatus.PUBLISHED,
              courseId: { in: [...scope.fullCourseIds] },
              course: { is: { status: ContentStatus.PUBLISHED } },
            },
          },
        },
      },
    });
  }
  return { OR: accessibleLessons };
};

const hasLinkedLessonAccess = (
  lesson: {
    id: string;
    moduleId: string;
    module: {
      courseId: string;
      course: { status: ContentStatus };
      status: ContentStatus;
    };
    status: ContentStatus;
  },
  scope: LibraryAccessScope
) =>
  lesson.status === ContentStatus.PUBLISHED &&
  lesson.module.status === ContentStatus.PUBLISHED &&
  lesson.module.course.status === ContentStatus.PUBLISHED &&
  hasLessonAccess(scope, lesson.module.courseId, lesson.moduleId, lesson.id);

export const getLibraryItems = async ({
  query,
  kind,
  category,
  language,
  difficulty,
  page = 1,
  sort = "recent",
  memberId,
}: LibraryFilters) => {
  const currentPage = Number.isInteger(page) && page > 0 ? page : 1;
  const normalizedSort = sort === "relevant" ? "relevant" : "recent";
  const { normalizedQuery, where } = buildLibraryWhere({
    category,
    difficulty,
    kind,
    language,
    query,
  });
  const scope = await getLearningAccessScope(memberId);
  const pageOffset = (currentPage - 1) * PAGE_SIZE;
  const rowLimit: number =
    normalizedSort === "relevant" ? MAX_RELEVANCE_CANDIDATES : PAGE_SIZE + 1;
  const lessonAccessWhere = buildLessonAccessWhere(scope);
  const rows = await tracePerformance("member.library.items-query", () =>
    database.libraryItem.findMany({
      where: { AND: [where, lessonAccessWhere] },
      orderBy:
        normalizedSort === "relevant"
          ? [
              { views: { _count: "desc" } },
              { bookmarks: { _count: "desc" } },
              { createdAt: "desc" },
            ]
          : [{ createdAt: "desc" }, { id: "desc" }],
      take: rowLimit,
      ...(normalizedSort === "recent" ? { skip: pageOffset } : {}),
      select: {
        id: true,
        title: true,
        description: true,
        coverUrl: true,
        kind: true,
        category: true,
        tags: true,
        url: true,
        authors: true,
        year: true,
        language: true,
        difficulty: true,
        accessType: true,
        accessNote: true,
        version: true,
        linkCheckedAt: true,
        doi: true,
        pmid: true,
        storagePath: true,
        mimeType: true,
        createdAt: true,
        lesson: {
          select: {
            id: true,
            title: true,
            status: true,
            moduleId: true,
            module: {
              select: {
                status: true,
                courseId: true,
                course: { select: { status: true } },
              },
            },
          },
        },
        _count: { select: { views: true, bookmarks: true } },
        bookmarks: { where: { memberId }, select: { id: true } },
      },
    })
  );
  const accessibleRows = rows.filter(
    (row) => !row.lesson || hasLinkedLessonAccess(row.lesson, scope)
  );
  const repeatViews =
    normalizedSort === "relevant" && accessibleRows.length > 0
      ? await tracePerformance("member.library.repeat-view-counts", () =>
          database.libraryItemView.groupBy({
            by: ["itemId"],
            where: { itemId: { in: accessibleRows.map(({ id }) => id) } },
            _sum: { openCount: true },
          })
        )
      : [];
  const repeatViewCounts = new Map(
    repeatViews.map((view) => [view.itemId, view._sum.openCount ?? 0])
  );
  const orderedRows =
    normalizedSort === "relevant"
      ? [...accessibleRows].sort((left, right) => {
          const popularityDifference =
            libraryPopularityScore({
              bookmarks: left._count.bookmarks,
              openCount: repeatViewCounts.get(left.id) ?? 0,
              uniqueVisitors: left._count.views,
            }) -
            libraryPopularityScore({
              bookmarks: right._count.bookmarks,
              openCount: repeatViewCounts.get(right.id) ?? 0,
              uniqueVisitors: right._count.views,
            });
          if (popularityDifference !== 0) {
            return -popularityDifference;
          }
          const searchDifference =
            librarySearchScore(right, normalizedQuery ?? "") -
            librarySearchScore(left, normalizedQuery ?? "");
          return (
            searchDifference ||
            right.createdAt.valueOf() - left.createdAt.valueOf()
          );
        })
      : accessibleRows;
  const { hasMore, items: pageItems } = pageLibraryRows(
    orderedRows,
    currentPage,
    {
      pageSize: PAGE_SIZE,
      rowsAlreadyOffset: normalizedSort === "recent",
    }
  );

  return {
    items: pageItems.map((row) => ({
      ...row,
      isBookmarked: row.bookmarks.length > 0,
      bookmarks: undefined,
    })),
    page: currentPage,
    hasMore,
    sort: normalizedSort,
  };
};

export const getLibraryCategories = async () => {
  const rows = await tracePerformance("member.library.categories", () =>
    database.libraryItem.findMany({
      where: { status: ContentStatus.PUBLISHED, category: { not: null } },
      distinct: ["category"],
      orderBy: { category: "asc" },
      select: { category: true },
    })
  );
  return rows.flatMap((row) => (row.category ? [row.category] : []));
};

export const getPublishedLibraryItem = async (id: string, memberId: string) => {
  const item = await database.libraryItem.findFirst({
    where: { id, status: ContentStatus.PUBLISHED },
    select: {
      id: true,
      title: true,
      description: true,
      coverUrl: true,
      kind: true,
      category: true,
      tags: true,
      url: true,
      authors: true,
      year: true,
      language: true,
      difficulty: true,
      accessType: true,
      accessNote: true,
      version: true,
      linkCheckedAt: true,
      doi: true,
      pmid: true,
      storagePath: true,
      lesson: {
        select: {
          id: true,
          title: true,
          status: true,
          moduleId: true,
          module: {
            select: {
              status: true,
              courseId: true,
              course: { select: { status: true } },
            },
          },
        },
      },
      activities: { select: { id: true, title: true } },
      mimeType: true,
      createdAt: true,
      bookmarks: { where: { memberId }, select: { id: true } },
    },
  });
  if (!item?.lesson) {
    return item;
  }
  const lesson = item.lesson;
  const scope = await getLearningAccessScope(memberId);
  return lesson.status === ContentStatus.PUBLISHED &&
    lesson.module.status === ContentStatus.PUBLISHED &&
    lesson.module.course.status === ContentStatus.PUBLISHED &&
    hasLessonAccess(scope, lesson.module.courseId, lesson.moduleId, lesson.id)
    ? item
    : null;
};

export const hasPublishedLibraryItemAccess = async (
  id: string,
  memberId: string
) => {
  const item = await database.libraryItem.findFirst({
    where: { id, status: ContentStatus.PUBLISHED },
    select: {
      id: true,
      lesson: {
        select: {
          id: true,
          status: true,
          moduleId: true,
          module: {
            select: {
              status: true,
              courseId: true,
              course: { select: { status: true } },
            },
          },
        },
      },
    },
  });
  if (!item) {
    return false;
  }
  if (!item.lesson) {
    return true;
  }
  const lesson = item.lesson;
  if (
    lesson.status !== ContentStatus.PUBLISHED ||
    lesson.module.status !== ContentStatus.PUBLISHED ||
    lesson.module.course.status !== ContentStatus.PUBLISHED
  ) {
    return false;
  }
  const scope = await getLearningAccessScope(memberId);
  return hasLessonAccess(
    scope,
    lesson.module.courseId,
    lesson.moduleId,
    lesson.id
  );
};

export const getMemberLearningBookmarkKeys = async (memberId: string) => {
  const bookmarks = await database.libraryBookmark.findMany({
    where: { memberId },
    select: {
      targetType: true,
      itemId: true,
      courseId: true,
      moduleId: true,
      lessonId: true,
      assetId: true,
    },
  });
  return new Set(
    bookmarks.flatMap((bookmark) => {
      const id =
        bookmark.itemId ??
        bookmark.courseId ??
        bookmark.moduleId ??
        bookmark.lessonId ??
        bookmark.assetId;
      return id ? [`${bookmark.targetType}:${id}`] : [];
    })
  );
};

const personalBookmarkSelect = {
  id: true,
  targetType: true,
  createdAt: true,
  item: {
    select: {
      id: true,
      title: true,
      description: true,
      coverUrl: true,
      status: true,
      lesson: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          moduleId: true,
          module: {
            select: {
              status: true,
              courseId: true,
              course: { select: { status: true } },
            },
          },
        },
      },
    },
  },
  course: {
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      coverUrl: true,
      status: true,
    },
  },
  module: {
    select: {
      id: true,
      title: true,
      status: true,
      courseId: true,
      course: {
        select: { slug: true, title: true, status: true, coverUrl: true },
      },
    },
  },
  lesson: {
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      status: true,
      moduleId: true,
      module: {
        select: {
          status: true,
          courseId: true,
          course: {
            select: {
              slug: true,
              title: true,
              status: true,
              coverUrl: true,
            },
          },
        },
      },
    },
  },
  asset: {
    select: {
      id: true,
      title: true,
      lessonId: true,
      lesson: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          moduleId: true,
          module: {
            select: {
              status: true,
              courseId: true,
              course: {
                select: {
                  slug: true,
                  title: true,
                  status: true,
                  coverUrl: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.LibraryBookmarkSelect;

const fetchPersonalLibraryBookmarks = (memberId: string) =>
  database.libraryBookmark.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
    select: personalBookmarkSelect,
  });

type PersonalLibraryBookmark = Awaited<
  ReturnType<typeof fetchPersonalLibraryBookmarks>
>[number];

export interface PersonalLibraryCard {
  coverUrl: string | null;
  description: string | null;
  href: string;
  id: string;
  label: string;
  savedAt: Date;
  title: string;
}

const bookmarkCard = (
  bookmark: PersonalLibraryBookmark,
  values: Omit<PersonalLibraryCard, "id" | "savedAt">
): PersonalLibraryCard => ({
  id: bookmark.id,
  savedAt: bookmark.createdAt,
  ...values,
});

const itemBookmarkCard = (
  bookmark: PersonalLibraryBookmark,
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>
): PersonalLibraryCard | null => {
  const item = bookmark.item;
  if (!item || item.status !== ContentStatus.PUBLISHED) {
    return null;
  }
  const lesson = item.lesson;
  if (
    lesson &&
    (lesson.status !== ContentStatus.PUBLISHED ||
      lesson.module.status !== ContentStatus.PUBLISHED ||
      lesson.module.course.status !== ContentStatus.PUBLISHED ||
      !hasLessonAccess(
        scope,
        lesson.module.courseId,
        lesson.moduleId,
        lesson.id
      ))
  ) {
    return null;
  }
  return bookmarkCard(bookmark, {
    title: item.title,
    description: item.description,
    coverUrl: item.coverUrl,
    href: `/biblioteca/${item.id}`,
    label: "Material",
  });
};

const courseBookmarkCard = (
  bookmark: PersonalLibraryBookmark,
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>
): PersonalLibraryCard | null => {
  const course = bookmark.course;
  if (
    !course ||
    course.status !== ContentStatus.PUBLISHED ||
    !hasCourseAccess(scope, course.id)
  ) {
    return null;
  }
  return bookmarkCard(bookmark, {
    title: course.title,
    description: course.description,
    coverUrl: course.coverUrl,
    href: `/aprender/cursos/${course.slug}`,
    label: "Curso",
  });
};

const moduleBookmarkCard = (
  bookmark: PersonalLibraryBookmark,
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>
): PersonalLibraryCard | null => {
  const module = bookmark.module;
  if (
    !module ||
    module.status !== ContentStatus.PUBLISHED ||
    module.course.status !== ContentStatus.PUBLISHED ||
    !hasModuleAccess(scope, module.courseId, module.id)
  ) {
    return null;
  }
  return bookmarkCard(bookmark, {
    title: module.title,
    description: module.course.title,
    coverUrl: module.course.coverUrl,
    href: `/aprender/cursos/${module.course.slug}`,
    label: "Módulo",
  });
};

const lessonBookmarkCard = (
  bookmark: PersonalLibraryBookmark,
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>
): PersonalLibraryCard | null => {
  const lesson = bookmark.lesson;
  if (
    !lesson ||
    lesson.status !== ContentStatus.PUBLISHED ||
    lesson.module.status !== ContentStatus.PUBLISHED ||
    lesson.module.course.status !== ContentStatus.PUBLISHED ||
    !hasLessonAccess(scope, lesson.module.courseId, lesson.moduleId, lesson.id)
  ) {
    return null;
  }
  return bookmarkCard(bookmark, {
    title: lesson.title,
    description: lesson.description,
    coverUrl: lesson.module.course.coverUrl,
    href: `/aprender/cursos/${lesson.module.course.slug}/${lesson.slug}`,
    label: "Aula",
  });
};

const assetBookmarkCard = (
  bookmark: PersonalLibraryBookmark,
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>
): PersonalLibraryCard | null => {
  const asset = bookmark.asset;
  const lesson = asset?.lesson;
  if (
    !(asset && lesson) ||
    lesson.status !== ContentStatus.PUBLISHED ||
    lesson.module.status !== ContentStatus.PUBLISHED ||
    lesson.module.course.status !== ContentStatus.PUBLISHED ||
    !hasLessonAccess(scope, lesson.module.courseId, lesson.moduleId, lesson.id)
  ) {
    return null;
  }
  return bookmarkCard(bookmark, {
    title: asset.title,
    description: lesson.title,
    coverUrl: lesson.module.course.coverUrl,
    href: `/aprender/cursos/${lesson.module.course.slug}/${lesson.slug}`,
    label: "Material de aula",
  });
};

const getPersonalBookmarkCard = (
  bookmark: PersonalLibraryBookmark,
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>
): PersonalLibraryCard | null => {
  switch (bookmark.targetType) {
    case LibraryBookmarkTargetType.LIBRARY_ITEM:
      return itemBookmarkCard(bookmark, scope);
    case LibraryBookmarkTargetType.COURSE:
      return courseBookmarkCard(bookmark, scope);
    case LibraryBookmarkTargetType.MODULE:
      return moduleBookmarkCard(bookmark, scope);
    case LibraryBookmarkTargetType.LESSON:
      return lessonBookmarkCard(bookmark, scope);
    case LibraryBookmarkTargetType.ASSET:
      return assetBookmarkCard(bookmark, scope);
    default:
      return null;
  }
};

export const getPersonalLibraryItems = async (memberId: string) => {
  const [scope, bookmarks] = await Promise.all([
    getLearningAccessScope(memberId),
    fetchPersonalLibraryBookmarks(memberId),
  ]);
  return bookmarks.flatMap((bookmark) => {
    const card = getPersonalBookmarkCard(bookmark, scope);
    return card ? [card] : [];
  });
};

export const getStaffLibraryItems = async (requestedPage = 1) => {
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 10_000)
      : 1;
  const rows = await database.libraryItem.findMany({
    orderBy: [
      { status: "asc" },
      { position: "asc" },
      { title: "asc" },
      { id: "asc" },
    ],
    skip: (page - 1) * LIBRARY_PAGE_SIZE,
    take: LIBRARY_PAGE_SIZE + 1,
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
      linkCheckedAt: true,
      doi: true,
      pmid: true,
      storagePath: true,
      lesson: { select: { id: true, title: true } },
      activities: { select: { id: true, title: true } },
      mimeType: true,
      sizeBytes: true,
    },
  });

  return {
    ...pageLibraryRows(rows, page, {
      pageSize: LIBRARY_PAGE_SIZE,
      rowsAlreadyOffset: true,
    }),
    page,
  };
};
