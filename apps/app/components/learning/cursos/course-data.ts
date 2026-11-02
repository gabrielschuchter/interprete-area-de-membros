import type { CourseLessonMeta } from "@/lib/cursos-course";
import type { CourseViewData } from "./course-view";

interface CourseSource {
  readonly coverUrl: string | null;
  readonly description: string | null;
  readonly id?: string;
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

const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const isDone = (lesson: SourceLesson) =>
  lesson.progress.some(({ status }) => status === "COMPLETED");

const hoursLabel = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
};

const releaseLabel = (date: Date) =>
  `libera em ${new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Sao_Paulo",
  })
    .format(date)
    .replace(".", "")}`;

// `returnedSlug` comes from `?r=` when the student comes back from the Sala:
// that lesson is highlighted and its module opens.
export const buildCourseViewData = (
  course: CourseSource,
  returnedSlug?: string | string[],
  meta: ReadonlyMap<string, CourseLessonMeta> = new Map()
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
  const fewModules = course.modules.length <= 2;
  let ordinal = 0;
  let totalSeconds = 0;
  const modules = course.modules.map((module, index) => ({
    completedCount: module.lessons.filter(isDone).length,
    id: module.id,
    lessons: module.lessons.map((lesson) => {
      ordinal += 1;
      const lessonMeta = meta.get(lesson.id);
      const done = isDone(lesson);
      const duration = lessonMeta?.durationSeconds ?? null;
      totalSeconds += duration ?? 0;
      return {
        completed: done,
        description: lesson.description,
        href: `/cursos/${course.slug}/${lesson.slug}`,
        id: lesson.id,
        minutes: duration ? Math.max(1, Math.round(duration / 60)) : null,
        ordinal,
        positionSeconds:
          !done && lessonMeta && lessonMeta.positionSeconds > 0
            ? lessonMeta.positionSeconds
            : null,
        progressPercent:
          !done && duration && lessonMeta && lessonMeta.positionSeconds > 0
            ? Math.min(
                100,
                Math.round((lessonMeta.positionSeconds / duration) * 100)
              )
            : null,
        releaseLabel: lessonMeta?.releasesAt
          ? releaseLabel(lessonMeta.releasesAt)
          : null,
        title: lesson.title,
      };
    }),
    numeral: roman[index] ?? String(index + 1),
    open: fewModules || module.id === openModuleId,
    title: module.title,
  }));
  const next = nextLesson
    ? modules
        .flatMap((module) => module.lessons)
        .find(({ id }) => id === nextLesson.id)
    : undefined;

  return {
    completedLessons: course.progress.completedLessons,
    continueHref: nextLesson
      ? `/cursos/${course.slug}/${nextLesson.slug}`
      : null,
    continueLabel: next
      ? `${course.progress.completedLessons > 0 ? "Continuar na aula" : "Começar na aula"} ${next.ordinal}`
      : "Rever do início",
    continueStoppedAt: next?.positionSeconds ?? null,
    coverUrl: course.coverUrl,
    currentLessonId: next?.id ?? null,
    description: course.description,
    eyebrow: course.learningPath?.title ?? "Curso",
    highlightLessonId: returned?.id ?? null,
    hoursLabel: totalSeconds > 0 ? hoursLabel(totalSeconds) : null,
    id: course.id ?? course.slug,
    modules,
    percentage: course.progress.percentage,
    reviewHref: lessons[0] ? `/cursos/${course.slug}/${lessons[0].slug}` : null,
    title: course.title,
    totalLessons: course.progress.totalLessons,
  };
};

interface PreviewCourseSource {
  readonly coverUrl: string | null;
  readonly description: string | null;
  readonly id: string;
  readonly learningPath: { readonly title: string } | null;
  readonly modules: readonly {
    readonly id: string;
    readonly lessons: readonly {
      readonly description: string | null;
      readonly id: string;
      readonly slug: string;
      readonly status: string;
      readonly title: string;
    }[];
    readonly status: string;
    readonly title: string;
  }[];
  readonly slug: string;
  readonly title: string;
}

/**
 * Dados da tela oficial do curso para a prévia da Gestão: só módulos e aulas
 * publicados (o que o aluno enxerga), sem progresso e sem ações.
 */
export const buildCoursePreviewData = (
  course: PreviewCourseSource
): CourseViewData => {
  const published = course.modules
    .filter((module) => module.status === "PUBLISHED")
    .map((module) => ({
      ...module,
      lessons: module.lessons.filter((lesson) => lesson.status === "PUBLISHED"),
    }));
  const data = buildCourseViewData({
    ...course,
    modules: published.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({ ...lesson, progress: [] })),
    })),
    progress: {
      completedLessons: 0,
      percentage: 0,
      totalLessons: published.reduce(
        (total, module) => total + module.lessons.length,
        0
      ),
    },
  });
  return {
    ...data,
    continueHref: null,
    modules: data.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({ ...lesson, readOnly: true })),
      open: true,
    })),
    reviewHref: null,
  };
};
