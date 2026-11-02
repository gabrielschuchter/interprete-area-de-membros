import "server-only";

import {
  database,
  libraryCatalogCategories,
  StudyActivityKind,
  StudyGoalPeriod,
} from "@repo/database";
import { z } from "zod";

/**
 * Divisão das metas de estudo por tema.
 *
 * Os temas são as categorias da Biblioteca, as mesmas que o membro escolhe
 * como interesses no on-boarding. O tempo estudado é atribuído a um tema pela
 * categoria do material: curso da aula, item da Biblioteca ou categoria mais
 * frequente das questões da lista de exercícios. Tempo sem categoria
 * reconhecida fica em "Sem tema" e continua contando para a meta total.
 */

const MAX_TOPICS = 8;

export interface StudyGoalTopicRow {
  readonly minutesStudied: number;
  readonly sharePercent: number;
  readonly targetMinutes: number;
  readonly topic: string;
}

export interface StudyGoalTopicPeriod {
  readonly topics: readonly StudyGoalTopicRow[];
  readonly unassignedMinutes: number;
}

export interface StudyGoalTopicOverview {
  readonly catalog: readonly string[];
  readonly interests: readonly string[];
  readonly periods: Partial<Record<StudyGoalPeriod, StudyGoalTopicPeriod>>;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

const catalogByKey = new Map<string, string>(
  libraryCatalogCategories.map((category) => [normalize(category), category])
);

/** Tema do catálogo correspondente a uma categoria livre, se houver. */
export const catalogTopicFor = (value: string | null | undefined) =>
  value ? (catalogByKey.get(normalize(value)) ?? null) : null;

/**
 * Divide 100% igualmente entre os temas, sem frações. O resto vai para os
 * primeiros temas da lista, que segue a ordem de escolha do membro.
 */
export const allocateTopicsEvenly = (topics: readonly string[]) => {
  const unique = [...new Set(topics)].slice(0, MAX_TOPICS);
  if (unique.length === 0) {
    return [];
  }
  const base = Math.floor(100 / unique.length);
  const remainder = 100 - base * unique.length;
  return unique.map((topic, index) => ({
    topic,
    sharePercent: base + (index < remainder ? 1 : 0),
  }));
};

const topicInputSchema = z.object({
  period: z.nativeEnum(StudyGoalPeriod),
  topics: z
    .array(
      z.object({
        topic: z.string().trim().min(1).max(120),
        sharePercent: z.number().int().min(1).max(100),
      })
    )
    .max(MAX_TOPICS),
});

export const saveStudyGoalTopics = (memberId: string, input: unknown) => {
  const parsed = topicInputSchema.parse(input);
  const topics = parsed.topics.map((row) => ({
    ...row,
    topic: catalogTopicFor(row.topic),
  }));
  if (topics.some((row) => row.topic === null)) {
    throw new Error("Escolha temas da lista de interesses.");
  }
  if (new Set(topics.map((row) => row.topic)).size !== topics.length) {
    throw new Error("Cada tema pode aparecer uma vez.");
  }
  const total = topics.reduce((sum, row) => sum + row.sharePercent, 0);
  if (total > 100) {
    throw new Error("A soma das partes não pode passar de 100%.");
  }
  return database.$transaction(async (transaction) => {
    const goal = await transaction.studyGoal.findUnique({
      where: { memberId_period: { memberId, period: parsed.period } },
      select: { id: true },
    });
    if (!goal) {
      throw new Error("Defina a meta antes de dividi-la por tema.");
    }
    await transaction.studyGoalTopic.deleteMany({ where: { goalId: goal.id } });
    if (topics.length > 0) {
      await transaction.studyGoalTopic.createMany({
        data: topics.map((row) => ({
          goalId: goal.id,
          topic: row.topic as string,
          sharePercent: row.sharePercent,
        })),
      });
    }
    return { goalId: goal.id, topics: topics.length };
  });
};

const mostFrequent = (values: readonly (string | null)[]) => {
  const counts = new Map<string, number>();
  for (const value of values) {
    const topic = catalogTopicFor(value);
    if (topic) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [topic, count] of counts) {
    if (count > bestCount) {
      best = topic;
      bestCount = count;
    }
  }
  return best;
};

/** Tema de cada sessão de estudo, pela categoria do material estudado. */
const resolveSessionTopics = async (
  sessions: readonly {
    readonly activityKind: StudyActivityKind;
    readonly id: string;
    readonly resourceId: string | null;
  }[]
) => {
  const idsOf = (kind: StudyActivityKind) => [
    ...new Set(
      sessions
        .filter((session) => session.activityKind === kind)
        .map((session) => session.resourceId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const lessonIds = idsOf(StudyActivityKind.LESSON);
  const libraryIds = idsOf(StudyActivityKind.LIBRARY_ITEM);
  const exerciseSessionIds = idsOf(StudyActivityKind.EXERCISE);
  const [lessons, libraryItems, exerciseSessions] = await Promise.all([
    lessonIds.length
      ? database.lesson.findMany({
          where: { id: { in: lessonIds } },
          select: {
            id: true,
            module: {
              select: { course: { select: { category: true, tags: true } } },
            },
          },
        })
      : [],
    libraryIds.length
      ? database.libraryItem.findMany({
          where: { id: { in: libraryIds } },
          select: { id: true, category: true },
        })
      : [],
    exerciseSessionIds.length
      ? database.exerciseSession.findMany({
          where: { id: { in: exerciseSessionIds } },
          select: {
            id: true,
            list: {
              select: {
                items: {
                  take: 200,
                  select: {
                    question: {
                      select: { category: { select: { title: true } } },
                    },
                  },
                },
              },
            },
          },
        })
      : [],
  ]);
  const byResource = new Map<string, string | null>();
  for (const lesson of lessons) {
    const course = lesson.module.course;
    byResource.set(
      `${StudyActivityKind.LESSON}:${lesson.id}`,
      catalogTopicFor(course.category) ??
        course.tags.map(catalogTopicFor).find(Boolean) ??
        null
    );
  }
  for (const item of libraryItems) {
    byResource.set(
      `${StudyActivityKind.LIBRARY_ITEM}:${item.id}`,
      catalogTopicFor(item.category)
    );
  }
  for (const session of exerciseSessions) {
    byResource.set(
      `${StudyActivityKind.EXERCISE}:${session.id}`,
      mostFrequent(
        session.list.items.map((item) => item.question.category?.title ?? null)
      )
    );
  }
  return new Map(
    sessions.map((session) => [
      session.id,
      byResource.get(`${session.activityKind}:${session.resourceId}`) ?? null,
    ])
  );
};

const minutesByTopic = async (
  memberId: string,
  start: Date,
  end: Date,
  topicOfSession: (sessionId: string) => string | null
) => {
  const grouped = await database.studyActivityInterval.groupBy({
    by: ["sessionId"],
    where: { memberId, isPlayback: false, startedAt: { gte: start, lt: end } },
    _sum: { seconds: true },
  });
  const seconds = new Map<string | null, number>();
  for (const row of grouped) {
    const topic = topicOfSession(row.sessionId);
    seconds.set(topic, (seconds.get(topic) ?? 0) + (row._sum.seconds ?? 0));
  }
  return seconds;
};

export const getStudyGoalTopicOverview = async (
  memberId: string,
  goals: readonly {
    readonly id: string;
    readonly period: StudyGoalPeriod;
    readonly targetMinutes: number;
  }[],
  windows: {
    readonly monthEnd: Date;
    readonly monthStart: Date;
    readonly weekEnd: Date;
    readonly weekStart: Date;
  }
): Promise<StudyGoalTopicOverview> => {
  const [profile, savedTopics] = await Promise.all([
    database.profile.findUnique({
      where: { clerkUserId: memberId },
      select: { interests: true },
    }),
    goals.length
      ? database.studyGoalTopic.findMany({
          where: { goalId: { in: goals.map((goal) => goal.id) } },
          orderBy: [{ sharePercent: "desc" }, { topic: "asc" }],
          select: { goalId: true, topic: true, sharePercent: true },
        })
      : [],
  ]);
  const interests = (profile?.interests ?? [])
    .map(catalogTopicFor)
    .filter((topic): topic is string => Boolean(topic));
  const overview: StudyGoalTopicOverview = {
    catalog: [...libraryCatalogCategories],
    interests: [...new Set(interests)],
    periods: {},
  };
  if (savedTopics.length === 0) {
    return overview;
  }

  const rangeStart =
    windows.weekStart < windows.monthStart
      ? windows.weekStart
      : windows.monthStart;
  const rangeEnd =
    windows.weekEnd > windows.monthEnd ? windows.weekEnd : windows.monthEnd;
  const sessions = await database.studyTrackingSession.findMany({
    where: {
      memberId,
      intervals: {
        some: {
          isPlayback: false,
          startedAt: { gte: rangeStart, lt: rangeEnd },
        },
      },
    },
    select: { id: true, activityKind: true, resourceId: true },
    take: 2000,
  });
  const sessionTopics = await resolveSessionTopics(sessions);
  const topicOf = (sessionId: string) => sessionTopics.get(sessionId) ?? null;
  const periods: Partial<Record<StudyGoalPeriod, StudyGoalTopicPeriod>> = {};
  await Promise.all(
    goals.map(async (goal) => {
      const rows = savedTopics.filter((row) => row.goalId === goal.id);
      if (rows.length === 0) {
        return;
      }
      const weekly = goal.period === StudyGoalPeriod.WEEKLY;
      const seconds = await minutesByTopic(
        memberId,
        weekly ? windows.weekStart : windows.monthStart,
        weekly ? windows.weekEnd : windows.monthEnd,
        topicOf
      );
      const chosen = new Set(rows.map((row) => row.topic));
      let unassigned = 0;
      for (const [topic, value] of seconds) {
        if (!(topic && chosen.has(topic))) {
          unassigned += value;
        }
      }
      periods[goal.period] = {
        topics: rows.map((row) => ({
          topic: row.topic,
          sharePercent: row.sharePercent,
          targetMinutes: Math.round(
            (goal.targetMinutes * row.sharePercent) / 100
          ),
          minutesStudied: Math.floor((seconds.get(row.topic) ?? 0) / 60),
        })),
        unassignedMinutes: Math.floor(unassigned / 60),
      };
    })
  );
  return { ...overview, periods };
};
