import "server-only";

import { ContentStatus, database, ExerciseSessionStatus } from "@repo/database";

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
      _count: { select: { items: true } },
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
      list: { is: publishedListWhere },
    },
    select: {
      id: true,
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
      status: ExerciseSessionStatus.IN_PROGRESS,
      list: { is: publishedListWhere },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      list: { select: { title: true, slug: true } },
      questions: {
        select: { answer: { select: { isCorrect: true } } },
      },
    },
  });

export const getMemberExerciseHistory = async (memberId: string) =>
  database.exerciseSession.findMany({
    where: {
      memberId,
      status: ExerciseSessionStatus.COMPLETED,
      list: { is: publishedListWhere },
    },
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      list: { select: { title: true, slug: true } },
      questions: {
        select: { answer: { select: { isCorrect: true } } },
      },
    },
  });

export const getMemberExerciseFavorites = async (memberId: string) =>
  database.exerciseQuestionBookmark.findMany({
    where: {
      memberId,
      question: {
        is: {
          status: ContentStatus.PUBLISHED,
          bank: { is: { status: ContentStatus.PUBLISHED } },
          listItems: { some: { list: { is: publishedListWhere } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
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
            select: { list: { select: { title: true, slug: true } } },
          },
        },
      },
    },
  });

export type MemberExerciseFavorite = Awaited<
  ReturnType<typeof getMemberExerciseFavorites>
>[number];

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
