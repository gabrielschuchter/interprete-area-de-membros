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

export interface CursosResume {
  readonly courseSlug: string;
  readonly courseTitle: string;
  readonly href: string;
  readonly lessonOrdinal: number;
  readonly lessonTitle: string;
  readonly moduleTitle: string;
  readonly positionSeconds: number;
  readonly progressPercent: number | null;
}

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
        where: {
          kind: LessonAssetKind.VIDEO,
          scope: LessonAssetScope.GENERAL,
        },
        orderBy: [{ position: "asc" }, { title: "asc" }],
        take: 1,
        select: {
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
                  lessons: {
                    where: published,
                    orderBy: [{ position: "asc" }, { title: "asc" }],
                    select: { id: true },
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
    const ordinal =
      course.modules
        .flatMap((module) => module.lessons)
        .findIndex((item) => item.id === lesson.id) + 1;

    return {
      courseSlug: course.slug,
      courseTitle: course.title,
      href: `/cursos/${encodeURIComponent(course.slug)}/${encodeURIComponent(lesson.slug)}`,
      lessonOrdinal: Math.max(1, ordinal),
      lessonTitle: lesson.title,
      moduleTitle: lesson.module.title,
      positionSeconds: playback?.positionSeconds ?? 0,
      progressPercent:
        playback?.durationSeconds && playback.durationSeconds > 0
          ? Math.min(
              100,
              Math.round(
                (playback.positionSeconds / playback.durationSeconds) * 100
              )
            )
          : null,
    };
  }

  return null;
};
