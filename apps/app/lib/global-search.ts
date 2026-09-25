import "server-only";

import { ContentStatus, database } from "@repo/database";
import {
  getLearningAccessScope,
  hasCourseAccess,
  hasLessonAccess,
  hasModuleAccess,
} from "@/lib/content-access";

export type GlobalSearchResultType =
  | "path"
  | "course"
  | "module"
  | "lesson"
  | "activity"
  | "community"
  | "library"
  | "profile";

export interface GlobalSearchResult {
  readonly context: string | null;
  readonly href: string;
  readonly id: string;
  readonly title: string;
  readonly type: GlobalSearchResultType;
  readonly typeLabel: string;
}

const MAX_QUERY_LENGTH = 80;
const MAX_RESULTS_PER_TYPE = 8;
const MAX_RESULTS = 24;
const published = { status: ContentStatus.PUBLISHED } as const;
const publishedCourse = {
  ...published,
  OR: [{ learningPathId: null }, { learningPath: { is: published } }],
};

export const normalizeSearchQuery = (value: string) =>
  value.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);

const contains = (query: string) => ({
  contains: query,
  mode: "insensitive" as const,
});

const preview = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}…` : normalized;
};

const result = (
  id: string,
  title: string,
  type: GlobalSearchResultType,
  typeLabel: string,
  context: string | null,
  href: string
): GlobalSearchResult => ({ id, title, type, typeLabel, context, href });

export const searchGlobal = async (memberId: string, rawQuery: string) => {
  const query = normalizeSearchQuery(rawQuery);
  if (query.length < 2) {
    return [] satisfies GlobalSearchResult[];
  }

  const scopePromise = getLearningAccessScope(memberId);
  const resultsPromise = Promise.all([
    database.learningPath.findMany({
      where: {
        ...published,
        OR: [{ title: contains(query) }, { description: contains(query) }],
      },
      orderBy: [{ position: "asc" }, { title: "asc" }],
      take: MAX_RESULTS_PER_TYPE,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        courses: {
          where: published,
          select: { id: true },
        },
      },
    }),
    database.course.findMany({
      where: {
        AND: [
          publishedCourse,
          {
            OR: [{ title: contains(query) }, { description: contains(query) }],
          },
        ],
      },
      orderBy: [{ position: "asc" }, { title: "asc" }],
      take: MAX_RESULTS_PER_TYPE,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        learningPath: { select: { title: true } },
      },
    }),
    database.module.findMany({
      where: {
        ...published,
        OR: [{ title: contains(query) }],
        course: { is: publishedCourse },
      },
      orderBy: [{ position: "asc" }, { title: "asc" }],
      take: MAX_RESULTS_PER_TYPE,
      select: {
        id: true,
        title: true,
        slug: true,
        course: { select: { id: true, title: true, slug: true } },
      },
    }),
    database.lesson.findMany({
      where: {
        ...published,
        OR: [{ title: contains(query) }, { description: contains(query) }],
        module: {
          is: {
            ...published,
            course: { is: publishedCourse },
          },
        },
      },
      orderBy: [{ position: "asc" }, { title: "asc" }],
      take: MAX_RESULTS_PER_TYPE,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        module: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    }),
    database.activity.findMany({
      where: {
        ...published,
        AND: [
          {
            OR: [
              { title: contains(query) },
              { prompt: contains(query) },
              { instructions: contains(query) },
            ],
          },
          {
            OR: [{ courseId: null }, { course: { is: published } }],
          },
          {
            OR: [
              { lessonId: null },
              {
                lesson: {
                  is: {
                    ...published,
                    module: { is: { ...published, course: { is: published } } },
                  },
                },
              },
            ],
          },
        ],
      },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { title: "asc" }],
      take: MAX_RESULTS_PER_TYPE,
      select: {
        id: true,
        title: true,
        slug: true,
        prompt: true,
        courseId: true,
        lessonId: true,
        course: { select: { title: true } },
        lesson: {
          select: {
            title: true,
            module: { select: { id: true, courseId: true } },
          },
        },
      },
    }),
    database.communityPost.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
        space: { is: { status: ContentStatus.PUBLISHED } },
        OR: [
          { title: contains(query) },
          { content: contains(query) },
          { space: { is: { title: contains(query) } } },
        ],
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: MAX_RESULTS_PER_TYPE,
      select: {
        id: true,
        title: true,
        content: true,
        space: { select: { title: true, slug: true } },
      },
    }),
    database.libraryItem.findMany({
      where: {
        ...published,
        OR: [
          { title: contains(query) },
          { description: contains(query) },
          { category: contains(query) },
        ],
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      take: MAX_RESULTS_PER_TYPE,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
      },
    }),
    database.profile.findMany({
      where: {
        OR: [
          { username: contains(query.toLowerCase()) },
          { displayName: contains(query) },
          { headline: contains(query) },
        ],
      },
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
      take: MAX_RESULTS_PER_TYPE,
      select: {
        clerkUserId: true,
        username: true,
        displayName: true,
        headline: true,
      },
    }),
  ]);
  const [
    scope,
    [paths, courses, modules, lessons, activities, posts, library, profiles],
  ] = await Promise.all([scopePromise, resultsPromise]);

  const pathResults = paths
    .filter((path) =>
      path.courses.some((course) => hasCourseAccess(scope, course.id))
    )
    .map((path) =>
      result(
        path.id,
        path.title,
        "path",
        "Trilha",
        preview(path.description),
        `/aprender/trilhas/${path.slug}`
      )
    );
  const courseResults = courses
    .filter((course) => hasCourseAccess(scope, course.id))
    .map((course) =>
      result(
        course.id,
        course.title,
        "course",
        "Curso",
        course.learningPath?.title ?? preview(course.description),
        `/aprender/cursos/${course.slug}`
      )
    );
  const moduleResults = modules
    .filter((module) => hasModuleAccess(scope, module.course.id, module.id))
    .map((module) =>
      result(
        module.id,
        module.title,
        "module",
        "Módulo",
        module.course.title,
        `/aprender/cursos/${module.course.slug}`
      )
    );
  const lessonResults = lessons
    .filter((lesson) =>
      hasLessonAccess(
        scope,
        lesson.module.course.id,
        lesson.module.id,
        lesson.id
      )
    )
    .map((lesson) =>
      result(
        lesson.id,
        lesson.title,
        "lesson",
        "Aula",
        `${lesson.module.course.title} · ${lesson.module.title}`,
        `/aprender/cursos/${lesson.module.course.slug}/${lesson.slug}`
      )
    );
  const activityResults = activities
    .filter((activity) => {
      if (activity.lesson) {
        return hasLessonAccess(
          scope,
          activity.lesson.module.courseId,
          activity.lesson.module.id,
          activity.lessonId ?? ""
        );
      }
      return !activity.courseId || hasCourseAccess(scope, activity.courseId);
    })
    .map((activity) =>
      result(
        activity.id,
        activity.title,
        "activity",
        "Atividade",
        activity.course?.title ?? preview(activity.prompt),
        `/atividades/${activity.slug}`
      )
    );
  const communityResults = posts.map((post) =>
    result(
      post.id,
      post.title,
      "community",
      "Comunidade",
      `${post.space.title} · ${preview(post.content) ?? "Discussão"}`,
      `/comunidade/${post.space.slug}/${post.id}`
    )
  );
  const libraryResults = library.map((item) =>
    result(
      item.id,
      item.title,
      "library",
      "Biblioteca",
      item.category ?? preview(item.description),
      `/biblioteca/${item.id}`
    )
  );
  const profileResults = profiles.map((profile) =>
    result(
      profile.clerkUserId,
      profile.displayName || `@${profile.username}`,
      "profile",
      "Pessoa",
      profile.headline
        ? `@${profile.username} · ${profile.headline}`
        : `@${profile.username}`,
      `/membros/${profile.username}`
    )
  );

  return [
    ...pathResults,
    ...courseResults,
    ...moduleResults,
    ...lessonResults,
    ...activityResults,
    ...communityResults,
    ...libraryResults,
    ...profileResults,
  ].slice(0, MAX_RESULTS);
};
