import "server-only";

import {
  ContentStatus,
  CourseExperience,
  database,
  LessonAssetKind,
  LessonAssetScope,
  ProgressStatus,
  StudyActivityKind,
} from "@repo/database";
import { getLearningAccessScope } from "./content-access";
import { classifyRoomLessonAccess } from "./room-access";

const published = { status: ContentStatus.PUBLISHED } as const;

export interface CursosResumeNext {
  readonly href: string;
  readonly minutes: number | null;
  readonly ordinal: number;
  readonly title: string;
}

export interface CursosResume {
  readonly completedLessons: number;
  readonly courseId: string;
  readonly courseSlug: string;
  readonly courseTitle: string;
  readonly href: string;
  readonly lessonDurationSeconds: number | null;
  readonly lessonOrdinal: number;
  readonly lessonTitle: string;
  readonly moduleOrdinal: number;
  readonly moduleTitle: string;
  readonly next: readonly CursosResumeNext[];
  readonly positionSeconds: number;
  readonly progressPercent: number | null;
  readonly totalLessons: number;
}

const firstVideo = {
  where: { kind: LessonAssetKind.VIDEO, scope: LessonAssetScope.GENERAL },
  orderBy: [{ position: "asc" as const }, { title: "asc" as const }],
  take: 1,
};

// "Retomar": the lesson the member studied last that is still open and not
// done, with the minute where the video stopped. Reads PlaybackProgress as it
// is; nothing is stored for this block.
export const getCursosResume = async (
  memberId: string
): Promise<CursosResume | null> => {
  const [scope, sessions] = await Promise.all([
    getLearningAccessScope(memberId),
    database.studyTrackingSession.findMany({
      where: {
        memberId,
        activityKind: StudyActivityKind.LESSON,
        resourceId: { not: null },
      },
      orderBy: { lastHeartbeatAt: "desc" },
      distinct: ["resourceId"],
      take: 8,
      select: { resourceId: true },
    }),
  ]);
  const ids = sessions.flatMap(({ resourceId }) =>
    resourceId ? [resourceId] : []
  );
  if (ids.length === 0) {
    return null;
  }
  const lessons = await database.lesson.findMany({
    where: {
      id: { in: ids },
      ...published,
      module: {
        ...published,
        course: {
          ...published,
          experience: CourseExperience.ASYNC,
          OR: [{ learningPathId: null }, { learningPath: { is: published } }],
        },
      },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      progress: { where: { memberId }, select: { status: true } },
      assets: {
        ...firstVideo,
        select: {
          durationSeconds: true,
          playbackProgress: {
            where: { memberId },
            select: { durationSeconds: true, positionSeconds: true },
          },
        },
      },
      module: {
        select: {
          id: true,
          title: true,
          course: {
            select: {
              id: true,
              slug: true,
              title: true,
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
                      slug: true,
                      title: true,
                      progress: {
                        where: { memberId },
                        select: { status: true },
                      },
                      assets: {
                        ...firstVideo,
                        select: { durationSeconds: true },
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
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));

  for (const id of ids) {
    const lesson = byId.get(id);
    if (!lesson) {
      continue;
    }
    const course = lesson.module.course;
    const done = lesson.progress.some(
      ({ status }) => status === ProgressStatus.COMPLETED
    );
    const open =
      classifyRoomLessonAccess(scope, {
        courseId: course.id,
        lessonId: lesson.id,
        moduleId: lesson.module.id,
      }) === "open";
    if (done || !open) {
      continue;
    }
    const playback = lesson.assets[0]?.playbackProgress[0] ?? null;
    const visible = course.modules
      .map((module) => ({
        ...module,
        lessons: module.lessons.filter(
          (item) =>
            classifyRoomLessonAccess(scope, {
              courseId: course.id,
              lessonId: item.id,
              moduleId: module.id,
            }) !== "forbidden"
        ),
      }))
      .filter((module) => module.lessons.length > 0);
    const all = visible.flatMap((module) => module.lessons);
    const index = all.findIndex((item) => item.id === lesson.id);
    const isDone = (item: (typeof all)[number]) =>
      item.progress.some(({ status }) => status === ProgressStatus.COMPLETED);
    const durationSeconds =
      lesson.assets[0]?.durationSeconds ?? playback?.durationSeconds ?? null;
    const next = all
      .slice(index + 1)
      .filter((item) => !isDone(item))
      .slice(0, 2)
      .map((item) => {
        const seconds = item.assets[0]?.durationSeconds ?? null;
        return {
          href: `/cursos/${encodeURIComponent(course.slug)}/${encodeURIComponent(item.slug)}`,
          minutes: seconds ? Math.max(1, Math.round(seconds / 60)) : null,
          ordinal: all.indexOf(item) + 1,
          title: item.title,
        };
      });

    return {
      completedLessons: all.filter(isDone).length,
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      href: `/cursos/${encodeURIComponent(course.slug)}/${encodeURIComponent(lesson.slug)}`,
      lessonDurationSeconds: durationSeconds,
      lessonOrdinal: Math.max(1, index + 1),
      lessonTitle: lesson.title,
      moduleOrdinal:
        Math.max(
          0,
          visible.findIndex(({ id: moduleId }) => moduleId === lesson.module.id)
        ) + 1,
      moduleTitle: lesson.module.title,
      next,
      positionSeconds: playback?.positionSeconds ?? 0,
      progressPercent:
        durationSeconds && durationSeconds > 0 && playback
          ? Math.min(
              100,
              Math.round((playback.positionSeconds / durationSeconds) * 100)
            )
          : null,
      totalLessons: all.length,
    };
  }

  return null;
};
