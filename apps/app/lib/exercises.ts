import "server-only";

import {
  ContentStatus,
  database,
  ExerciseSessionKind,
  ExerciseSessionStatus,
} from "@repo/database";
import {
  decodeExerciseFavoriteCursor,
  encodeExerciseFavoriteCursor,
} from "./exercise-favorite-cursor";
import {
  decodeExerciseHistoryCursor,
  encodeExerciseHistoryCursor,
} from "./exercise-history-cursor";

const publishedListWhere = {
  status: ContentStatus.PUBLISHED,
  bank: { is: { status: ContentStatus.PUBLISHED } },
} as const;

export const getPublishedExerciseLists = (
  query?: string,
  categorySlug?: string
) => {
  const normalizedQuery = query?.trim();
  return database.exerciseList.findMany({
    where: {
      ...publishedListWhere,
      ...(categorySlug
        ? {
            items: {
              some: {
                question: {
                  is: {
                    status: ContentStatus.PUBLISHED,
                    category: { is: { slug: categorySlug } },
                  },
                },
              },
            },
          }
        : {}),
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
                description: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
              {
                bank: {
                  is: {
                    title: {
                      contains: normalizedQuery,
                      mode: "insensitive" as const,
                    },
                  },
                },
              },
              {
                items: {
                  some: {
                    question: {
                      is: {
                        status: ContentStatus.PUBLISHED,
                        OR: [
                          {
                            category: {
                              is: {
                                title: {
                                  contains: normalizedQuery,
                                  mode: "insensitive" as const,
                                },
                              },
                            },
                          },
                          {
                            tags: {
                              has: normalizedQuery.toLocaleLowerCase("pt-BR"),
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ position: "asc" }, { publishedAt: "desc" }, { title: "asc" }],
    take: 60,
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      coverUrl: true,
      bank: { select: { title: true } },
      _count: {
        select: {
          items: {
            where: { question: { is: { status: ContentStatus.PUBLISHED } } },
          },
        },
      },
    },
  });
};

export const getPublishedExerciseCategories = async () =>
  database.exerciseCategory.findMany({
    where: {
      bank: { is: { status: ContentStatus.PUBLISHED } },
      questions: {
        some: {
          status: ContentStatus.PUBLISHED,
          listItems: { some: { list: { is: publishedListWhere } } },
        },
      },
    },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    take: 80,
    select: { id: true, title: true, slug: true },
  });

export const getPublishedExerciseList = async (slug: string) =>
  database.exerciseList.findFirst({
    where: { slug, ...publishedListWhere },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      coverUrl: true,
      bank: { select: { title: true } },
      items: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          question: {
            select: {
              id: true,
              status: true,
              type: true,
              category: { select: { title: true } },
            },
          },
        },
      },
    },
  });

export const getMemberExerciseSession = async (
  memberId: string,
  sessionId: string
) => {
  const session = await database.exerciseSession.findFirst({
    where: {
      id: sessionId,
      memberId,
      status: {
        in: [
          ExerciseSessionStatus.IN_PROGRESS,
          ExerciseSessionStatus.COMPLETED,
        ],
      },
      OR: [
        { status: ExerciseSessionStatus.COMPLETED },
        {
          status: ExerciseSessionStatus.IN_PROGRESS,
          list: { is: publishedListWhere },
        },
      ],
    },
    select: {
      id: true,
      kind: true,
      status: true,
      currentPosition: true,
      startedAt: true,
      completedAt: true,
      list: { select: { title: true, slug: true } },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          questionVersion: {
            select: {
              id: true,
              type: true,
              statement: true,
              explanation: true,
              question: { select: { id: true } },
              options: {
                orderBy: { position: "asc" },
                select: { id: true, label: true, content: true },
              },
            },
          },
          answer: {
            select: {
              selectedOptionIds: true,
              isCorrect: true,
              answeredAt: true,
            },
          },
        },
      },
    },
  });
  if (!session) {
    return null;
  }

  const answeredVersions = session.questions.flatMap(
    ({ answer, questionVersion }) => (answer ? [questionVersion.id] : [])
  );
  const correctOptions = answeredVersions.length
    ? await database.exerciseOption.findMany({
        where: { versionId: { in: answeredVersions }, isCorrect: true },
        select: { id: true, versionId: true },
      })
    : [];
  const correctIdsByVersion = new Map<string, string[]>();
  for (const option of correctOptions) {
    correctIdsByVersion.set(option.versionId, [
      ...(correctIdsByVersion.get(option.versionId) ?? []),
      option.id,
    ]);
  }
  return {
    ...session,
    questions: session.questions.map(({ questionVersion, ...question }) => ({
      ...question,
      questionVersion: {
        ...questionVersion,
        correctOptionIds: question.answer
          ? (correctIdsByVersion.get(questionVersion.id) ?? [])
          : [],
        explanation: question.answer ? questionVersion.explanation : null,
      },
    })),
  };
};

export const getMemberInProgressExerciseSessions = async (memberId: string) =>
  database.exerciseSession.findMany({
    where: {
      memberId,
      kind: ExerciseSessionKind.LIST,
      status: ExerciseSessionStatus.IN_PROGRESS,
      list: { is: publishedListWhere },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      kind: true,
      list: { select: { title: true, slug: true } },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          answer: { select: { isCorrect: true } },
        },
      },
    },
  });

export const getMemberInProgressExerciseSessionForList = (
  memberId: string,
  listId: string
) =>
  database.exerciseSession.findFirst({
    where: {
      memberId,
      listId,
      kind: ExerciseSessionKind.LIST,
      status: ExerciseSessionStatus.IN_PROGRESS,
      list: { is: publishedListWhere },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      questions: {
        orderBy: { position: "asc" },
        select: { id: true, answer: { select: { isCorrect: true } } },
      },
    },
  });

export const getMemberExerciseHistory = async (memberId: string) =>
  database.exerciseSession.findMany({
    where: {
      memberId,
      status: ExerciseSessionStatus.COMPLETED,
    },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    take: 6,
    select: {
      id: true,
      kind: true,
      status: true,
      startedAt: true,
      completedAt: true,
      list: { select: { title: true, slug: true } },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          questionVersion: {
            select: {
              statement: true,
              question: { select: { id: true } },
            },
          },
          answer: { select: { isCorrect: true } },
        },
      },
    },
  });

export const getMemberExerciseHistoryPage = async (
  memberId: string,
  cursorValue?: string,
  direction: "before" | "after" = "after"
) => {
  const cursor = decodeExerciseHistoryCursor(cursorValue);
  const useBefore = Boolean(cursor && direction === "before");
  const comparison = useBefore ? "gt" : "lt";
  const rows = await database.exerciseSession.findMany({
    where: {
      memberId,
      status: ExerciseSessionStatus.COMPLETED,
      completedAt: { not: null },
      ...(cursor
        ? {
            OR: [
              { completedAt: { [comparison]: cursor.completedAt } },
              {
                completedAt: cursor.completedAt,
                id: { [comparison]: cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: useBefore
      ? [{ completedAt: "asc" }, { id: "asc" }]
      : [{ completedAt: "desc" }, { id: "desc" }],
    take: 7,
    select: {
      id: true,
      kind: true,
      startedAt: true,
      completedAt: true,
      list: { select: { title: true, slug: true } },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          questionVersion: {
            select: {
              statement: true,
              question: { select: { id: true } },
            },
          },
          answer: { select: { isCorrect: true } },
        },
      },
    },
  });
  const hasOverflow = rows.length > 6;
  const items = [...(hasOverflow ? rows.slice(0, 6) : rows)];
  if (useBefore) {
    items.reverse();
  }
  const first = items[0];
  const last = items.at(-1);
  const cursorForSession = (session: (typeof items)[number] | undefined) => {
    if (!session?.completedAt) {
      return null;
    }
    return encodeExerciseHistoryCursor({
      completedAt: session.completedAt,
      id: session.id,
    });
  };
  let previousCursor: string | null = null;
  let nextCursor: string | null = null;
  if (useBefore) {
    previousCursor = hasOverflow ? cursorForSession(first) : null;
    nextCursor = cursorForSession(last);
  } else if (cursor) {
    previousCursor = cursorForSession(first);
    nextCursor = hasOverflow ? cursorForSession(last) : null;
  } else if (hasOverflow) {
    nextCursor = cursorForSession(last);
  }
  return {
    items,
    hasPrevious: Boolean(previousCursor),
    previousCursor,
    hasNext: Boolean(nextCursor),
    nextCursor,
  };
};

const publishedExerciseFavoriteWhere = {
  question: {
    is: {
      status: ContentStatus.PUBLISHED,
      bank: { is: { status: ContentStatus.PUBLISHED } },
      listItems: { some: { list: { is: publishedListWhere } } },
    },
  },
} as const;

const exerciseFavoriteSelect = {
  id: true,
  createdAt: true,
  question: {
    select: {
      id: true,
      type: true,
      category: { select: { title: true } },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { statement: true },
      },
      listItems: {
        where: { list: { is: publishedListWhere } },
        orderBy: { position: "asc" },
        take: 1,
        select: {
          position: true,
          list: {
            select: {
              id: true,
              title: true,
              slug: true,
              bank: { select: { title: true } },
            },
          },
        },
      },
    },
  },
} as const;

const EXERCISE_FAVORITES_PAGE_SIZE = 20;

export const getMemberExerciseFavorites = async (
  memberId: string,
  cursorValue?: string,
  direction: "before" | "after" = "after",
  pageSize = EXERCISE_FAVORITES_PAGE_SIZE
) => {
  const cursor = decodeExerciseFavoriteCursor(cursorValue);
  const useBefore = Boolean(cursor && direction === "before");
  const comparison = useBefore ? "gt" : "lt";
  const baseWhere = {
    memberId,
    ...publishedExerciseFavoriteWhere,
  };
  const [rows, totalCount] = await Promise.all([
    database.exerciseQuestionBookmark.findMany({
      where: {
        ...baseWhere,
        ...(cursor
          ? {
              OR: [
                { createdAt: { [comparison]: cursor.createdAt } },
                {
                  createdAt: cursor.createdAt,
                  id: { [comparison]: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [
        { createdAt: useBefore ? "asc" : "desc" },
        { id: useBefore ? "asc" : "desc" },
      ],
      take: pageSize + 1,
      select: exerciseFavoriteSelect,
    }),
    database.exerciseQuestionBookmark.count({ where: baseWhere }),
  ]);
  const hasOverflow = rows.length > pageSize;
  const items = [...rows.slice(0, pageSize)];
  if (useBefore) {
    items.reverse();
  }
  const first = items[0];
  const last = items.at(-1);
  const cursorForFavorite = (favorite: (typeof items)[number] | undefined) =>
    favorite
      ? encodeExerciseFavoriteCursor({
          createdAt: favorite.createdAt,
          id: favorite.id,
        })
      : null;
  let previousCursor: string | null = null;
  let nextCursor: string | null = null;
  if (useBefore) {
    previousCursor = hasOverflow ? cursorForFavorite(first) : null;
    nextCursor = cursorForFavorite(last);
  } else if (cursor) {
    previousCursor = cursorForFavorite(first);
    nextCursor = hasOverflow ? cursorForFavorite(last) : null;
  } else if (hasOverflow) {
    nextCursor = cursorForFavorite(last);
  }
  return {
    items,
    totalCount,
    hasPrevious: Boolean(previousCursor),
    previousCursor,
    hasNext: Boolean(nextCursor),
    nextCursor,
  };
};

export type MemberExerciseFavorite = Awaited<
  ReturnType<typeof getMemberExerciseFavorites>
>["items"][number];

export const getMemberExerciseFavoriteQuestion = (
  memberId: string,
  questionId: string
) =>
  database.exerciseQuestionBookmark.findFirst({
    where: {
      memberId,
      questionId,
      question: {
        is: {
          status: ContentStatus.PUBLISHED,
          bank: { is: { status: ContentStatus.PUBLISHED } },
          listItems: { some: { list: { is: publishedListWhere } } },
        },
      },
    },
    select: {
      id: true,
      question: {
        select: {
          id: true,
          category: { select: { title: true } },
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: {
              id: true,
              type: true,
              version: true,
              statement: true,
              explanation: true,
              options: {
                orderBy: { position: "asc" },
                select: { id: true, label: true, content: true },
              },
            },
          },
          listItems: {
            where: { list: { is: publishedListWhere } },
            orderBy: { position: "asc" },
            take: 1,
            select: {
              position: true,
              list: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  bank: { select: { title: true } },
                },
              },
            },
          },
        },
      },
    },
  });

export const memberCanReadExerciseList = async (
  memberId: string,
  listId: string
) => {
  const list = await database.exerciseList.findFirst({
    where: { id: listId, ...publishedListWhere },
    select: { id: true },
  });
  if (!list) {
    return false;
  }
  return (
    (
      await database.member.findUnique({
        where: { id: memberId },
        select: { deactivatedAt: true },
      })
    )?.deactivatedAt === null
  );
};

export const isActiveExerciseSession = (status: ExerciseSessionStatus) =>
  status === ExerciseSessionStatus.IN_PROGRESS;
