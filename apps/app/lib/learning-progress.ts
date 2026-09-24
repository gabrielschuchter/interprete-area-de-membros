export interface LessonProgressSummary {
  readonly status: string;
}

export interface LessonWithProgress {
  readonly progress: readonly LessonProgressSummary[];
}

export const calculateLearningProgress = (
  lessons: readonly LessonWithProgress[]
) => {
  const completedLessons = lessons.filter((lesson) =>
    lesson.progress.some(({ status }) => status === "COMPLETED")
  ).length;

  return {
    completedLessons,
    totalLessons: lessons.length,
    percentage:
      lessons.length === 0
        ? 0
        : Math.round((completedLessons / lessons.length) * 100),
  };
};
