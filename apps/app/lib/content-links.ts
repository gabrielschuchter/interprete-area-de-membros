import "server-only";

import { ContentStatus, database, Prisma } from "@repo/database";
import { getLearningAccessScope } from "./content-access";
import { type LinkRef, linkColumn, linkColumns } from "./content-links-model";
import { publishedListWhere } from "./exercises";
import { buildLibraryItemAccessWhere } from "./library";

const sideExists = async ({ id, side }: LinkRef) => {
  const where = { id };
  const select = { id: true } as const;
  if (side === "lesson") {
    return Boolean(await database.lesson.findUnique({ where, select }));
  }
  if (side === "exerciseList") {
    return Boolean(await database.exerciseList.findUnique({ where, select }));
  }
  return Boolean(await database.libraryItem.findUnique({ where, select }));
};

export type AddContentLinkResult =
  | { readonly ok: true }
  | { readonly message: string; readonly ok: false };

/** Cria o vínculo; repetir um vínculo que já existe não dá erro. */
export const addContentLink = async (
  a: LinkRef,
  b: LinkRef
): Promise<AddContentLinkResult> => {
  const columns = linkColumns(a, b);
  if (!columns) {
    return {
      ok: false,
      message: "Escolha dois conteúdos de tipos diferentes.",
    };
  }
  const [aExists, bExists] = await Promise.all([sideExists(a), sideExists(b)]);
  if (!(aExists && bExists)) {
    return { ok: false, message: "Um dos conteúdos não existe mais." };
  }
  try {
    await database.contentLink.create({ data: columns });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: true };
    }
    throw error;
  }
  return { ok: true };
};

export const removeContentLink = async (linkId: string) => {
  const { count } = await database.contentLink.deleteMany({
    where: { id: linkId },
  });
  return count > 0;
};

export interface LinkedLesson {
  readonly courseId: string;
  readonly id: string;
  readonly label: string;
  readonly linkId: string;
}
export interface LinkedExerciseList {
  readonly id: string;
  readonly linkId: string;
  readonly published: boolean;
  readonly title: string;
}
export interface LinkedLibraryItem {
  readonly id: string;
  /** Vínculo antigo, feito no cadastro do material (campo "Aula relacionada"). */
  readonly legacy: boolean;
  readonly linkId: string | null;
  readonly published: boolean;
  readonly title: string;
}
export interface LinkedContent {
  readonly exerciseLists: readonly LinkedExerciseList[];
  readonly lessons: readonly (LinkedLesson & { readonly legacy: boolean })[];
  readonly libraryItems: readonly LinkedLibraryItem[];
}

const lessonSelect = {
  id: true,
  title: true,
  module: {
    select: {
      courseId: true,
      title: true,
      course: { select: { title: true } },
    },
  },
} as const;

const lessonLabel = (lesson: {
  module: { course: { title: string }; title: string };
  title: string;
}) =>
  `${lesson.module.course.title} · ${lesson.module.title} · ${lesson.title}`;

/** Conteúdos já vinculados a um conteúdo, para o editor da gestão. */
export const getLinkedContent = async (
  source: LinkRef
): Promise<LinkedContent> => {
  const rows = await database.contentLink.findMany({
    where: { [linkColumn[source.side]]: source.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      lesson: { select: lessonSelect },
      exerciseList: {
        select: { id: true, title: true, status: true },
      },
      libraryItem: { select: { id: true, title: true, status: true } },
    },
  });

  const lessons: (LinkedLesson & { legacy: boolean })[] = [];
  const exerciseLists: LinkedExerciseList[] = [];
  const libraryItems: LinkedLibraryItem[] = [];
  for (const row of rows) {
    if (row.lesson && source.side !== "lesson") {
      lessons.push({
        courseId: row.lesson.module.courseId,
        id: row.lesson.id,
        label: lessonLabel(row.lesson),
        legacy: false,
        linkId: row.id,
      });
    }
    if (row.exerciseList && source.side !== "exerciseList") {
      exerciseLists.push({
        id: row.exerciseList.id,
        linkId: row.id,
        published: row.exerciseList.status === ContentStatus.PUBLISHED,
        title: row.exerciseList.title,
      });
    }
    if (row.libraryItem && source.side !== "libraryItem") {
      libraryItems.push({
        id: row.libraryItem.id,
        legacy: false,
        linkId: row.id,
        published: row.libraryItem.status === ContentStatus.PUBLISHED,
        title: row.libraryItem.title,
      });
    }
  }

  // Vínculo antigo aula ↔ material (campo `lessonId` do material).
  if (source.side === "lesson") {
    const legacy = await database.libraryItem.findMany({
      where: { lessonId: source.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true, status: true },
    });
    for (const item of legacy) {
      if (!libraryItems.some(({ id }) => id === item.id)) {
        libraryItems.push({
          id: item.id,
          legacy: true,
          linkId: null,
          published: item.status === ContentStatus.PUBLISHED,
          title: item.title,
        });
      }
    }
  }
  if (source.side === "libraryItem") {
    const item = await database.libraryItem.findUnique({
      where: { id: source.id },
      select: { lesson: { select: lessonSelect } },
    });
    if (item?.lesson && !lessons.some(({ id }) => id === item.lesson?.id)) {
      lessons.push({
        courseId: item.lesson.module.courseId,
        id: item.lesson.id,
        label: lessonLabel(item.lesson),
        legacy: true,
        linkId: "",
      });
    }
  }
  return { exerciseLists, lessons, libraryItems };
};

export interface LinkOption {
  readonly id: string;
  readonly label: string;
}
export interface LinkOptions {
  readonly exerciseLists: readonly LinkOption[];
  readonly lessons: readonly LinkOption[];
  readonly libraryItems: readonly LinkOption[];
}

const draftSuffix = (status: ContentStatus) =>
  status === ContentStatus.PUBLISHED ? "" : " (não publicado)";

/** Tudo o que pode ser vinculado, para os seletores da gestão. */
export const getLinkOptions = async (): Promise<LinkOptions> => {
  const [lessons, lists, items] = await Promise.all([
    database.lesson.findMany({
      orderBy: [
        { module: { course: { title: "asc" } } },
        { module: { position: "asc" } },
        { position: "asc" },
      ],
      select: { ...lessonSelect, status: true },
    }),
    database.exerciseList.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, status: true },
    }),
    database.libraryItem.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, status: true },
    }),
  ]);
  return {
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      label: `${lessonLabel(lesson)}${draftSuffix(lesson.status)}`,
    })),
    exerciseLists: lists.map((list) => ({
      id: list.id,
      label: `${list.title}${draftSuffix(list.status)}`,
    })),
    libraryItems: items.map((item) => ({
      id: item.id,
      label: `${item.title}${draftSuffix(item.status)}`,
    })),
  };
};

export interface LessonPractice {
  readonly exerciseLists: readonly {
    readonly bankTitle: string;
    readonly id: string;
    readonly questionCount: number;
    readonly slug: string;
    readonly title: string;
  }[];
  readonly libraryItems: readonly {
    readonly id: string;
    readonly kind: string;
    readonly title: string;
  }[];
}

const keepOrder = <T extends { id: string }>(
  ids: readonly string[],
  rows: T[]
) => ids.flatMap((id) => rows.filter((row) => row.id === id));

/**
 * "Continue praticando": listas e materiais vinculados à aula, só os que o
 * aluno pode abrir (publicados e dentro do acesso dele), na ordem em que o
 * professor vinculou.
 */
export const getLessonPractice = async (
  memberId: string,
  lessonId: string
): Promise<LessonPractice> => {
  const [links, legacyItems] = await Promise.all([
    database.contentLink.findMany({
      where: { lessonId },
      orderBy: { createdAt: "asc" },
      select: { exerciseListId: true, libraryItemId: true },
    }),
    database.libraryItem.findMany({
      where: { lessonId },
      select: { id: true },
    }),
  ]);
  const listIds = links.flatMap(({ exerciseListId }) =>
    exerciseListId ? [exerciseListId] : []
  );
  const itemIds = [
    ...new Set([
      ...links.flatMap(({ libraryItemId }) =>
        libraryItemId ? [libraryItemId] : []
      ),
      ...legacyItems.map(({ id }) => id),
    ]),
  ];
  if (listIds.length === 0 && itemIds.length === 0) {
    return { exerciseLists: [], libraryItems: [] };
  }

  const scope =
    itemIds.length > 0 ? await getLearningAccessScope(memberId) : null;
  const [lists, items] = await Promise.all([
    listIds.length > 0
      ? database.exerciseList.findMany({
          where: { id: { in: listIds }, ...publishedListWhere },
          select: {
            id: true,
            slug: true,
            title: true,
            bank: { select: { title: true } },
            _count: {
              select: {
                items: {
                  where: {
                    question: { is: { status: ContentStatus.PUBLISHED } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    scope
      ? database.libraryItem.findMany({
          where: {
            AND: [
              { id: { in: itemIds }, status: ContentStatus.PUBLISHED },
              buildLibraryItemAccessWhere(scope),
            ],
          },
          select: { id: true, kind: true, title: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    exerciseLists: keepOrder(listIds, lists)
      .filter((list) => list._count.items > 0)
      .map((list) => ({
        bankTitle: list.bank.title,
        id: list.id,
        questionCount: list._count.items,
        slug: list.slug,
        title: list.title,
      })),
    libraryItems: keepOrder(itemIds, items).map((item) => ({
      id: item.id,
      kind: String(item.kind),
      title: item.title,
    })),
  };
};
