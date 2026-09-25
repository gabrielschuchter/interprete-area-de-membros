import "server-only";

import { ContentStatus, database, ProgressStatus } from "@repo/database";
import { requireSession } from "./authorization";
import {
  filterAccessibleAssets,
  getLearningAccessScope,
  hasCourseAccess,
  hasFullCourseAccess,
  hasLessonAccess,
  hasModuleAccess,
  type LearningAccessScope,
} from "./content-access";
import { calculateLearningProgress } from "./learning-progress";

export const requireMemberId = requireSession;

const published = { status: ContentStatus.PUBLISHED } as const;
const publishedCourse = {
  ...published,
  OR: [{ learningPathId: null }, { learningPath: { is: published } }],
};

const filterCourse = <
  T extends {
    id: string;
    modules: readonly {
      id: string;
      lessons: readonly { id: string }[];
    }[];
  },
>(
  course: T,
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>
) => {
  const fullCourse = hasFullCourseAccess(scope, course.id);

  return {
    ...course,
    modules: course.modules
      .filter(
        (module) =>
          fullCourse ||
          hasModuleAccess(scope, course.id, module.id) ||
          module.lessons.some((lesson) =>
            hasLessonAccess(scope, course.id, module.id, lesson.id)
          )
      )
      .map((module) => ({
        ...module,
        lessons: module.lessons.filter(
          (lesson) =>
            fullCourse ||
            hasModuleAccess(scope, course.id, module.id) ||
            hasLessonAccess(scope, course.id, module.id, lesson.id)
        ),
      })),
  };
};

export const getPublishedLearningPaths = async (
  memberId: string,
  slug?: string,
  accessScope?: LearningAccessScope | Promise<LearningAccessScope>
) => {
  const scopePromise = accessScope
    ? Promise.resolve(accessScope)
    : getLearningAccessScope(memberId);
  const pathsPromise = database.learningPath.findMany({
    where: {
      ...published,
      ...(slug ? { slug } : {}),
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
  const [scope, paths] = await Promise.all([scopePromise, pathsPromise]);

  return paths
    .map((path) => ({
      ...path,
      courses: path.courses
        .filter((course) => hasCourseAccess(scope, course.id))
        .map((course) => {
          const visibleCourse = filterCourse(course, scope);
          const lessons = visibleCourse.modules.flatMap(
            (module) => module.lessons
          );

          return {
            ...visibleCourse,
            progress: calculateLearningProgress(lessons),
            moduleCount: visibleCourse.modules.length,
            lessonCount: lessons.length,
          };
        }),
    }))
    .filter((path) => path.courses.length > 0);
};

export const getHomeLearningSummary = async (
  memberId: string,
  accessScope?: LearningAccessScope | Promise<LearningAccessScope>
) => {
  const scopePromise = accessScope
    ? Promise.resolve(accessScope)
    : getLearningAccessScope(memberId);
  const coursesPromise = database.course.findMany({
    where: {
      ...published,
      learningPath: { is: published },
    },
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
          id: true,
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
  });
  const [scope, courses] = await Promise.all([scopePromise, coursesPromise]);

  return courses
    .filter((course) => hasCourseAccess(scope, course.id))
    .map((course) => {
      const visibleCourse = filterCourse(course, scope);
      const lessons = visibleCourse.modules.flatMap((module) => module.lessons);

      return {
        ...visibleCourse,
        progress: calculateLearningProgress(lessons),
      };
    });
};

export const getPublishedLearningPath = async (
  slug: string,
  memberId: string
) => {
  const [path] = await getPublishedLearningPaths(memberId, slug);

  return path ?? null;
};

export const getPublishedCourse = async (slug: string, memberId: string) => {
  const scope = await getLearningAccessScope(memberId);
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

  if (!(course && hasCourseAccess(scope, course.id))) {
    return null;
  }

  const visibleCourse = filterCourse(course, scope);
  const lessons = visibleCourse.modules.flatMap((module) => module.lessons);

  return {
    ...visibleCourse,
    progress: calculateLearningProgress(lessons),
  };
};

export const getPublishedLesson = async (
  courseSlug: string,
  lessonSlug: string,
  memberId: string
) => {
  const scope = await getLearningAccessScope(memberId);
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
      assets: {
        orderBy: [{ position: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          kind: true,
          scope: true,
          storagePath: true,
          externalUrl: true,
          mimeType: true,
          ownerMemberId: true,
          position: true,
        },
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
          id: true,
          title: true,
          slug: true,
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
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

  const courseId = lesson.module.course.id;
  if (
    !(
      hasLessonAccess(scope, courseId, lesson.module.id, lesson.id) &&
      hasCourseAccess(scope, courseId)
    )
  ) {
    return null;
  }

  const visibleModules = filterCourse(lesson.module.course, scope).modules;
  const siblings = visibleModules.flatMap((module) => module.lessons);
  const currentIndex = siblings.findIndex(({ id }) => id === lesson.id);
  const { module: moduleRelation, assets, ...lessonData } = lesson;

  return {
    ...lessonData,
    assets: filterAccessibleAssets(assets, scope, memberId),
    module: {
      ...moduleRelation,
      course: {
        ...moduleRelation.course,
        modules: visibleModules,
      },
    },
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
