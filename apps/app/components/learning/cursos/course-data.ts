import type { CourseViewData } from "./course-view";

interface CourseSource {
  readonly coverUrl: string | null;
  readonly description: string | null;
  readonly learningPath: { readonly title: string } | null;
  readonly modules: readonly {
    readonly id: string;
    readonly lessons: readonly {
      readonly description: string | null;
      readonly id: string;
      readonly progress: readonly { readonly status: string }[];
      readonly slug: string;
      readonly title: string;
    }[];
    readonly title: string;
  }[];
  readonly progress: {
    readonly completedLessons: number;
    readonly percentage: number;
    readonly totalLessons: number;
  };
  readonly slug: string;
  readonly title: string;
}

type SourceLesson = CourseSource["modules"][number]["lessons"][number];

const isDone = (lesson: SourceLesson) =>
  lesson.progress.some(({ status }) => status === "COMPLETED");

// `returnedSlug` comes from `?r=` when the student comes back from the Sala:
// that lesson is highlighted and its module opens.
export const buildCourseViewData = (
  course: CourseSource,
  returnedSlug?: string | string[]
): CourseViewData => {
  const lessons = course.modules.flatMap((module) => module.lessons);
  const nextLesson = lessons.find((lesson) => !isDone(lesson));
  const returned =
    typeof returnedSlug === "string"
      ? lessons.find(({ slug }) => slug === returnedSlug)
      : undefined;
  const focusId = (returned ?? nextLesson)?.id;
  const openModuleId =
    course.modules.find(({ lessons: moduleLessons }) =>
      moduleLessons.some(({ id }) => id === focusId)
    )?.id ?? course.modules[0]?.id;
  let ordinal = 0;

  return {
    completedLessons: course.progress.completedLessons,
    continueHref: nextLesson
      ? `/cursos/${course.slug}/${nextLesson.slug}`
      : null,
    continueLabel:
      course.progress.completedLessons > 0
        ? "Continuar aula"
        : "Começar primeira aula",
    coverUrl: course.coverUrl,
    description: course.description,
    eyebrow: course.learningPath?.title ?? "Curso",
    highlightLessonId: returned?.id ?? null,
    modules: course.modules.map((module) => ({
      completedCount: module.lessons.filter(isDone).length,
      id: module.id,
      lessons: module.lessons.map((lesson) => {
        ordinal += 1;
        return {
          completed: isDone(lesson),
          description: lesson.description,
          href: `/cursos/${course.slug}/${lesson.slug}`,
          id: lesson.id,
          ordinal,
          title: lesson.title,
        };
      }),
      open: module.id === openModuleId,
      title: module.title,
    })),
    percentage: course.progress.percentage,
    title: course.title,
    totalLessons: course.progress.totalLessons,
  };
};
