import "server-only";

import {
  ContentStatus,
  database,
  LessonAssetKind,
  LessonAssetScope,
} from "@repo/database";
import { getLearningAccessScope, hasLessonAccess } from "./content-access";
import { roomLessonUnlockDate } from "./room-access";

export interface CourseLessonMeta {
  readonly durationSeconds: number | null;
  readonly positionSeconds: number;
  readonly releasesAt: Date | null;
}

// Duration, saved minute and scheduled release of every lesson of a course,
// for the course page. Reads what the Sala already reads; stores nothing.
export const getCourseLessonMeta = async (
  courseId: string,
  memberId: string,
  now = new Date()
): Promise<ReadonlyMap<string, CourseLessonMeta>> => {
  const [scope, modules] = await Promise.all([
    getLearningAccessScope(memberId),
    database.module.findMany({
      where: { courseId, status: ContentStatus.PUBLISHED },
      select: {
        id: true,
        lessons: {
          where: { status: ContentStatus.PUBLISHED },
          select: {
            id: true,
            assets: {
              where: {
                kind: LessonAssetKind.VIDEO,
                scope: LessonAssetScope.GENERAL,
              },
              orderBy: [{ position: "asc" }, { title: "asc" }],
              take: 1,
              select: {
                durationSeconds: true,
                playbackProgress: {
                  where: { memberId },
                  select: { durationSeconds: true, positionSeconds: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);
  const meta = new Map<string, CourseLessonMeta>();
  for (const module of modules) {
    for (const lesson of module.lessons) {
      const asset = lesson.assets[0] ?? null;
      const playback = asset?.playbackProgress[0] ?? null;
      const locked = !hasLessonAccess(scope, courseId, module.id, lesson.id);
      meta.set(lesson.id, {
        durationSeconds:
          asset?.durationSeconds ?? playback?.durationSeconds ?? null,
        positionSeconds: playback?.positionSeconds ?? 0,
        releasesAt: locked
          ? (roomLessonUnlockDate(scope, lesson.id) ?? now)
          : null,
      });
    }
  }
  return meta;
};
