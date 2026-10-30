import "server-only";

import {
  ContentStatus,
  CourseExperience,
  database,
  MemberRole,
} from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import { getMemberRole } from "@/lib/authorization";
import { communityPostHref } from "@/lib/community";
import {
  communityPostAudienceWhere,
  communitySpaceAudienceWhere,
} from "@/lib/community-space-rules";
import {
  getLearningAccessScope,
  hasCourseAccess,
  hasLessonAccess,
  hasModuleAccess,
} from "@/lib/content-access";
import { buildLibraryItemAccessWhere } from "@/lib/library";

export type GlobalSearchResultType =
  | "path"
  | "course"
  | "module"
  | "lesson"
  | "activity"
  | "recording"
  | "community"
  | "community-comment"
  | "community-space"
  | "library"
  | "profile"
  | "planner-task"
  | "planner-event"
  | "planner-goal"
  | "note";

export type GlobalSearchArea =
  | "Estudar"
  | "Comunidade"
  | "Planejamento"
  | "Ferramentas";

export interface GlobalSearchResult {
  readonly area?: GlobalSearchArea;
  readonly context: string | null;
  readonly href: string;
  readonly id: string;
  readonly section?: string;
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
  experience: CourseExperience.ASYNC,
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

const resultArea: Record<
  GlobalSearchResultType,
  { area: GlobalSearchArea; section: string }
> = {
  path: { area: "Estudar", section: "Cursos" },
  course: { area: "Estudar", section: "Cursos" },
  module: { area: "Estudar", section: "Cursos" },
  lesson: { area: "Estudar", section: "Cursos" },
  activity: { area: "Estudar", section: "Atividades" },
  recording: { area: "Comunidade", section: "Encontros" },
  community: { area: "Comunidade", section: "Publicações" },
  "community-comment": { area: "Comunidade", section: "Publicações" },
  "community-space": { area: "Comunidade", section: "Grupos de estudo" },
  library: { area: "Estudar", section: "Biblioteca" },
  profile: { area: "Comunidade", section: "Pessoas" },
  "planner-task": { area: "Planejamento", section: "Tarefas" },
  "planner-event": { area: "Planejamento", section: "Calendário" },
  "planner-goal": { area: "Planejamento", section: "Metas" },
  note: { area: "Ferramentas", section: "Notas" },
};

const result = (
  id: string,
  title: string,
  type: GlobalSearchResultType,
  typeLabel: string,
  context: string | null,
  href: string
): GlobalSearchResult => ({
  id,
  title,
  type,
  typeLabel,
  context,
  href,
  ...resultArea[type],
});

export const searchGlobal = async (memberId: string, rawQuery: string) => {
  const query = normalizeSearchQuery(rawQuery);
  if (query.length < 2) {
    return [] satisfies GlobalSearchResult[];
  }

  const [scope, role] = await Promise.all([
    getLearningAccessScope(memberId),
    getMemberRole(memberId),
  ]);
  const canModeratePrivateGroups =
    role === MemberRole.ADMIN || role === MemberRole.TEACHER;
  const resultsPromise = tracePerformance("member.search.query-fanout", () =>
    Promise.all([
      tracePerformance("member.search.paths", () =>
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
              where: { ...published, experience: CourseExperience.ASYNC },
              select: { id: true },
            },
          },
        })
      ),
      tracePerformance("member.search.courses", () =>
        database.course.findMany({
          where: {
            AND: [
              publishedCourse,
              {
                OR: [
                  { title: contains(query) },
                  { description: contains(query) },
                ],
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
        })
      ),
      tracePerformance("member.search.modules", () =>
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
        })
      ),
      tracePerformance("member.search.lessons", () =>
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
        })
      ),
      tracePerformance("member.search.activities", () =>
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
                        module: {
                          is: { ...published, course: { is: published } },
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
          orderBy: [
            { dueAt: { sort: "asc", nulls: "last" } },
            { title: "asc" },
          ],
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
        })
      ),
      tracePerformance("member.search.recordings", () =>
        database.importedRecording.findMany({
          where: {
            group: scope.fullAccess ? undefined : { memberId },
            OR: [
              { originalTitle: contains(query) },
              { asset: { title: contains(query) } },
              { legacyLesson: { title: contains(query) } },
              { group: { legacyStudentName: contains(query) } },
            ],
          },
          orderBy: [{ meetingDate: "desc" }, { id: "desc" }],
          take: MAX_RESULTS_PER_TYPE,
          select: {
            id: true,
            originalTitle: true,
            meetingDate: true,
            legacyLesson: { select: { title: true } },
            group: {
              select: {
                id: true,
                legacyStudentName: true,
                legacyModule: {
                  select: { title: true, course: { select: { title: true } } },
                },
              },
            },
            asset: { select: { id: true, title: true } },
          },
        })
      ),
      tracePerformance("member.search.community-posts", () =>
        database.communityPost.findMany({
          where: {
            status: ContentStatus.PUBLISHED,
            deletedAt: null,
            ...communityPostAudienceWhere(memberId, canModeratePrivateGroups),
            AND: [
              {
                OR: [
                  { title: contains(query) },
                  { content: contains(query) },
                  { excerpt: contains(query) },
                  { space: { is: { title: contains(query) } } },
                ],
              },
            ],
          },
          orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
          take: MAX_RESULTS_PER_TYPE,
          select: {
            id: true,
            title: true,
            slug: true,
            content: true,
            excerpt: true,
            space: { select: { title: true, slug: true } },
          },
        })
      ),
      tracePerformance("member.search.community-comments", () =>
        database.communityComment.findMany({
          where: {
            content: contains(query),
            deletedAt: null,
            post: {
              is: {
                status: ContentStatus.PUBLISHED,
                deletedAt: null,
                ...communityPostAudienceWhere(
                  memberId,
                  canModeratePrivateGroups
                ),
              },
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: MAX_RESULTS_PER_TYPE,
          select: {
            id: true,
            content: true,
            post: {
              select: {
                title: true,
                slug: true,
                id: true,
                space: { select: { title: true, slug: true } },
              },
            },
          },
        })
      ),
      tracePerformance("member.search.community-spaces", () =>
        database.communitySpace.findMany({
          where: {
            status: ContentStatus.PUBLISHED,
            ...communitySpaceAudienceWhere(memberId, canModeratePrivateGroups),
            OR: [{ title: contains(query) }, { description: contains(query) }],
          },
          orderBy: [{ position: "asc" }, { title: "asc" }],
          take: MAX_RESULTS_PER_TYPE,
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
          },
        })
      ),
      tracePerformance("member.search.library", () =>
        database.libraryItem.findMany({
          where: {
            AND: [
              published,
              buildLibraryItemAccessWhere(scope),
              {
                OR: [
                  { title: contains(query) },
                  { description: contains(query) },
                  { category: contains(query) },
                ],
              },
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
        })
      ),
      tracePerformance("member.search.profiles", () =>
        database.profile.findMany({
          where: {
            showInDirectory: true,
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
        })
      ),
    ])
  );
  const personalResultsPromise = Promise.all([
    database.plannerTask.findMany({
      where: {
        memberId,
        parentTaskId: null,
        deletedAt: null,
        OR: [{ title: contains(query) }, { description: contains(query) }],
      },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: MAX_RESULTS_PER_TYPE,
      select: { id: true, title: true, description: true, dueAt: true },
    }),
    database.plannerEvent.findMany({
      where: {
        memberId,
        deletedAt: null,
        OR: [{ title: contains(query) }, { description: contains(query) }],
      },
      orderBy: [{ startsAt: "asc" }, { updatedAt: "desc" }],
      take: MAX_RESULTS_PER_TYPE,
      select: { id: true, title: true, description: true, startsAt: true },
    }),
    database.studyGoal.findMany({
      where: { memberId },
      select: { id: true, period: true, targetMinutes: true },
      orderBy: { period: "asc" },
    }),
  ]);
  const [resultGroups, personalResults] = await Promise.all([
    resultsPromise,
    personalResultsPromise,
  ]);
  const [
    paths,
    courses,
    modules,
    lessons,
    activities,
    recordings,
    posts,
    comments,
    spaces,
    library,
    profiles,
  ] = resultGroups;
  const [plannerTasks, plannerEvents, goals] = personalResults;

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
        `/cursos/trilhas/${path.slug}`
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
        `/cursos/${course.slug}`
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
        `/cursos/${module.course.slug}`
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
        `/cursos/${lesson.module.course.slug}/${lesson.slug}`
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
  const recordingResults = recordings.map((recording) =>
    result(
      recording.id,
      recording.originalTitle ?? recording.asset.title,
      "recording",
      "Gravação",
      `${recording.group.legacyModule.course.title} · ${recording.group.legacyModule.title}`,
      `/encontros/gravacoes?asset=${encodeURIComponent(recording.asset.id)}#asset-${encodeURIComponent(recording.asset.id)}`
    )
  );
  const communityResults = posts.map((post) =>
    result(
      post.id,
      post.title,
      "community",
      "Comunidade",
      `${post.space?.title ?? "Feed geral"} · ${preview(post.excerpt ?? post.content) ?? "Discussão"}`,
      communityPostHref(post)
    )
  );
  const communityCommentResults = comments.map((comment) =>
    result(
      comment.id,
      preview(comment.content) ?? "Comentário",
      "community-comment",
      "Comentário",
      `${comment.post.title} · ${comment.post.space?.title ?? "Feed geral"}`,
      `${communityPostHref(comment.post)}?commentId=${encodeURIComponent(comment.id)}`
    )
  );
  const communitySpaceResults = spaces.map((space) =>
    result(
      space.id,
      space.title,
      "community-space",
      "Espaço",
      preview(space.description),
      `/comunidade/${space.slug}`
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
  const plannerTaskResults = plannerTasks.map((task) =>
    result(
      task.id,
      task.title,
      "planner-task",
      "Tarefa",
      task.dueAt
        ? `Prazo ${task.dueAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${preview(task.description) ?? "Tarefa pessoal"}`
        : preview(task.description),
      `/planejamento?view=calendar&task=${encodeURIComponent(task.id)}`
    )
  );
  const plannerEventResults = plannerEvents.map((event) =>
    result(
      event.id,
      event.title,
      "planner-event",
      "Evento",
      `${event.startsAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${preview(event.description) ?? "Evento pessoal"}`,
      `/planejamento?view=calendar&event=${encodeURIComponent(event.id)}`
    )
  );
  const plannerGoalResults = query.toLocaleLowerCase("pt-BR").includes("meta")
    ? goals.map((goal) =>
        result(
          goal.id,
          goal.period === "WEEKLY" ? "Meta semanal" : "Meta mensal",
          "planner-goal",
          "Meta",
          `${goal.targetMinutes} minutos de estudo`,
          "/planejamento?view=goals"
        )
      )
    : [];

  const byArea = {
    Estudar: [
      ...pathResults,
      ...courseResults,
      ...moduleResults,
      ...lessonResults,
      ...activityResults,
      ...libraryResults,
    ].slice(0, 12),
    Comunidade: [
      ...recordingResults,
      ...communityResults,
      ...communityCommentResults,
      ...communitySpaceResults,
      ...profileResults,
    ].slice(0, 6),
    Planejamento: [
      ...plannerGoalResults,
      ...plannerTaskResults,
      ...plannerEventResults,
    ].slice(0, 4),
  };
  return [
    ...byArea.Estudar,
    ...byArea.Comunidade,
    ...byArea.Planejamento,
  ].slice(0, MAX_RESULTS);
};
