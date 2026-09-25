import "server-only";

import { ContentStatus, database, ProgressStatus } from "@repo/database";
import { requireSession } from "./authorization";
import { calculateLearningProgress } from "./learning-progress";

export const requireMemberId = requireSession;

const published = { status: ContentStatus.PUBLISHED } as const;
const publishedCourse = {
  ...published,
  OR: [{ learningPathId: null }, { learningPath: { is: published } }],
};

export const getPublishedLearningPaths = async (
  memberId: string,
  slug?: string
) => {
  const paths = await database.learningPath.findMany({
    where: {
      ...published,
      ...(slug ? { slug } : {}),
      courses: { some: published },
    },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      coverUrl: true,
      courses: {
        where: published,
        orderBy: [{ position: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          modules: {
            where: published,
            orderBy: [{ position: "asc" }, { title: "asc" }],
            select: {
              title: true,
              slug: true,
              lessons: {
                where: published,
                orderBy: [{ position: "asc" }, { title: "asc" }],
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  description: true,
                  progress: {
                    where: { memberId },
                    select: { status: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return paths.map((path) => ({
    ...path,
    courses: path.courses.map((course) => {
      const lessons = course.modules.flatMap((module) => module.lessons);

      return {
        ...course,
        progress: calculateLearningProgress(lessons),
        moduleCount: course.modules.length,
        lessonCount: lessons.length,
      };
    }),
  }));
};

export const getPublishedLearningPath = async (
  slug: string,
  memberId: string
) => {
  const [path] = await getPublishedLearningPaths(memberId, slug);

  return path ?? null;
};

export const getPublishedCourse = async (slug: string, memberId: string) => {
  const course = await database.course.findFirst({
    where: { slug, ...publishedCourse },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      learningPath: {
        select: { title: true, slug: true },
      },
      modules: {
        where: published,
        orderBy: [{ position: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          lessons: {
            where: published,
            orderBy: [{ position: "asc" }, { title: "asc" }],
            select: {
              id: true,
              title: true,
              slug: true,
              description: true,
              kind: true,
              progress: {
                where: { memberId },
                select: { status: true },
              },
            },
          },
        },
      },
    },
  });

  if (!course) {
    return null;
  }

  const lessons = course.modules.flatMap((module) => module.lessons);

  return {
    ...course,
    progress: calculateLearningProgress(lessons),
  };
};

export const getPublishedLesson = async (
  courseSlug: string,
  lessonSlug: string,
  memberId: string
) => {
  const lesson = await database.lesson.findFirst({
    where: {
      slug: lessonSlug,
      ...published,
      module: {
        ...published,
        course: { slug: courseSlug, ...publishedCourse },
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      content: true,
      kind: true,
      resources: {
        orderBy: [{ position: "asc" }, { title: "asc" }],
        select: { id: true, title: true, kind: true, url: true },
      },
      activities: {
        where: { status: ContentStatus.PUBLISHED },
        orderBy: [{ position: "asc" }, { title: "asc" }],
        select: { id: true, title: true, slug: true, dueAt: true },
      },
      progress: {
        where: { memberId },
        select: { status: true, completedAt: true },
      },
      module: {
        select: {
          title: true,
          slug: true,
          course: {
            select: {
              title: true,
              slug: true,
              modules: {
                where: published,
                orderBy: [{ position: "asc" }, { title: "asc" }],
                select: {
                  title: true,
                  slug: true,
                  lessons: {
                    where: published,
                    orderBy: [{ position: "asc" }, { title: "asc" }],
                    select: {
                      id: true,
                      title: true,
                      slug: true,
                      position: true,
                      progress: {
                        where: { memberId },
                        select: { status: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!lesson) {
    return null;
  }

  const siblings = lesson.module.course.modules.flatMap(
    (module) => module.lessons
  );
  const currentIndex = siblings.findIndex(({ id }) => id === lesson.id);

  return {
    ...lesson,
    isCompleted: lesson.progress.some(
      ({ status }) => status === ProgressStatus.COMPLETED
    ),
    previousLesson: currentIndex > 0 ? siblings[currentIndex - 1] : null,
    nextLesson:
      currentIndex >= 0 && currentIndex < siblings.length - 1
        ? siblings[currentIndex + 1]
        : null,
  };
};
