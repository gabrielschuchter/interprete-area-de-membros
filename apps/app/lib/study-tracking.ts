import "server-only";

import {
  BadgeCriterion,
  ContentStatus,
  database,
  ExerciseSessionStatus,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
  type Prisma,
  StudyActivityKind,
} from "@repo/database";
import { evaluateMemberBadges } from "./badges";
import {
  getAccessibleRecording,
  getLearningAccessScope,
  hasLessonAccess,
} from "./content-access";
import { hasPublishedLibraryItemAccess } from "./library";

export interface StudyHeartbeatInput {
  readonly active: boolean;
  readonly activityKind: StudyActivityKind;
  readonly clientSessionId: string;
  readonly isPlayback: boolean;
  readonly resourceId: string | null;
  readonly sequence: number;
}

const hasResourceAccess = async (
  memberId: string,
  activityKind: StudyActivityKind,
  resourceId: string | null
) => {
  if (!resourceId) {
    return false;
  }

  switch (activityKind) {
    case StudyActivityKind.LESSON: {
      const lesson = await database.lesson.findFirst({
        where: {
          id: resourceId,
          status: ContentStatus.PUBLISHED,
          module: {
            is: {
              status: ContentStatus.PUBLISHED,
              course: {
                is: {
                  status: ContentStatus.PUBLISHED,
                  experience: "ASYNC",
                  OR: [
                    { learningPathId: null },
                    {
                      learningPath: { is: { status: ContentStatus.PUBLISHED } },
                    },
                  ],
                },
              },
            },
          },
        },
        select: {
          id: true,
          moduleId: true,
          module: { select: { courseId: true } },
        },
      });
      if (!lesson) {
        return false;
      }
      const scope = await getLearningAccessScope(memberId);
      return hasLessonAccess(
        scope,
        lesson.module.courseId,
        lesson.moduleId,
        lesson.id
      );
    }
    case StudyActivityKind.RECORDING:
      return (await getAccessibleRecording(resourceId, memberId)) !== null;
    case StudyActivityKind.LIBRARY_ITEM:
      return hasPublishedLibraryItemAccess(resourceId, memberId);
    case StudyActivityKind.EXERCISE:
      return (
        (await database.exerciseSession.findFirst({
          where: {
            id: resourceId,
            memberId,
            status: {
              in: [
                ExerciseSessionStatus.IN_PROGRESS,
                ExerciseSessionStatus.COMPLETED,
              ],
            },
            list: {
              is: {
                status: ContentStatus.PUBLISHED,
                bank: { is: { status: ContentStatus.PUBLISHED } },
              },
            },
          },
          select: { id: true },
        })) !== null
      );
    case StudyActivityKind.ACTIVITY: {
      const activity = await database.activity.findFirst({
        where: { id: resourceId, status: ContentStatus.PUBLISHED },
        select: { id: true },
      });
      const assignment = await database.activityAssignment.findFirst({
        where: {
          memberId,
          targetType: LearningAssignmentTargetType.ACTIVITY,
          targetId: resourceId,
          status: {
            in: [
              LearningAssignmentStatus.NEW,
              LearningAssignmentStatus.VIEWED,
              LearningAssignmentStatus.STARTED,
            ],
          },
          revokedAt: null,
          AND: [
            {
              OR: [{ availableAt: null }, { availableAt: { lte: new Date() } }],
            },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ],
        },
        select: { id: true },
      });
      return Boolean(activity && assignment);
    }
    case StudyActivityKind.COMMUNITY: {
      const post = await database.communityPost.findFirst({
        where: {
          id: resourceId,
          status: ContentStatus.PUBLISHED,
          deletedAt: null,
          OR: [
            { spaceId: null },
            {
              space: {
                is: {
                  status: ContentStatus.PUBLISHED,
                  OR: [
                    { visibility: "PUBLIC" },
                    { members: { some: { memberId } } },
                  ],
                },
              },
            },
          ],
        },
        select: { id: true },
      });
      return Boolean(post);
    }
    default:
      return false;
  }
};

const isRetryableTransactionError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error.code === "P2034" || error.code === "P2002");

export const recordStudyHeartbeat = async (
  memberId: string,
  input: StudyHeartbeatInput
) => {
  const accessible = await hasResourceAccess(
    memberId,
    input.activityKind,
    input.resourceId
  );
  if (!(accessible && input.active)) {
    if (!input.active) {
      await database.studyTrackingSession.updateMany({
        where: {
          memberId,
          clientSessionId: input.clientSessionId,
          lastSequence: { lt: input.sequence },
        },
        data: {
          lastSequence: input.sequence,
          lastHeartbeatAt: new Date(),
          endedAt: new Date(),
        },
      });
    }
    return { accepted: false, seconds: 0 };
  }

  const now = new Date();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await database.$transaction(
        async (transaction) => {
          const existing = await transaction.studyTrackingSession.findUnique({
            where: {
              memberId_clientSessionId: {
                memberId,
                clientSessionId: input.clientSessionId,
              },
            },
          });
          if (!existing) {
            await transaction.studyTrackingSession.create({
              data: {
                memberId,
                clientSessionId: input.clientSessionId,
                activityKind: input.activityKind,
                resourceId: input.resourceId,
                lastSequence: input.sequence,
                lastHeartbeatAt: now,
              },
            });
            return { accepted: true, seconds: 0 };
          }
          if (
            existing.activityKind !== input.activityKind ||
            existing.resourceId !== input.resourceId ||
            input.sequence <= existing.lastSequence
          ) {
            return { accepted: false, seconds: 0 };
          }

          const elapsedSeconds = Math.floor(
            (now.getTime() - existing.lastHeartbeatAt.getTime()) / 1000
          );
          const seconds = Math.min(30, Math.max(0, elapsedSeconds));
          if (seconds >= 10) {
            await transaction.studyActivityInterval.create({
              data: {
                memberId,
                sessionId: existing.id,
                sequence: input.sequence,
                startedAt: new Date(now.getTime() - seconds * 1000),
                endedAt: now,
                seconds,
                isPlayback: input.isPlayback,
              },
            });
            await evaluateMemberBadges(transaction, memberId, now, {
              criteria: [
                BadgeCriterion.STUDY_MINUTES,
                BadgeCriterion.STUDY_STREAK_DAYS,
                BadgeCriterion.STUDY_GOALS_MET,
              ],
            });
          }
          await transaction.studyTrackingSession.update({
            where: { id: existing.id },
            data: {
              lastSequence: input.sequence,
              lastHeartbeatAt: now,
              endedAt: null,
            },
          });
          return { accepted: true, seconds };
        },
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt > 0) {
        throw error;
      }
    }
  }
  return { accepted: false, seconds: 0 };
};

export type StudyIntervalRow = Pick<
  Prisma.StudyActivityIntervalGetPayload<{
    select: {
      startedAt: true;
      endedAt: true;
      isPlayback: true;
    };
  }>,
  "startedAt" | "endedAt" | "isPlayback"
>;

const localDayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).format(date);

const localDayBounds = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 3));
  return [start, new Date(start.getTime() + 86_400_000)] as const;
};

const mergeRanges = (ranges: Array<{ end: number; start: number }>) => {
  const sorted = ranges.sort((left, right) => left.start - right.start);
  let total = 0;
  let range: { end: number; start: number } | undefined;
  for (const next of sorted) {
    if (!range || next.start > range.end) {
      if (range) {
        total += range.end - range.start;
      }
      range = { ...next };
    } else {
      range.end = Math.max(range.end, next.end);
    }
  }
  if (range) {
    total += range.end - range.start;
  }
  return Math.floor(total / 1000);
};

export const summarizeStudyIntervals = (
  intervals: readonly StudyIntervalRow[]
) => {
  const byDay = new Map<
    string,
    {
      playback: Array<{ end: number; start: number }>;
      study: Array<{ end: number; start: number }>;
    }
  >();
  for (const interval of intervals) {
    let cursor = interval.startedAt.getTime();
    const end = interval.endedAt.getTime();
    while (cursor < end) {
      const key = localDayKey(new Date(cursor));
      const [dayStart, nextDayStart] = localDayBounds(key);
      const segmentEnd = Math.min(end, nextDayStart.getTime());
      const ranges = byDay.get(key) ?? { playback: [], study: [] };
      const range = { end: segmentEnd, start: cursor };
      ranges.study.push(range);
      if (interval.isPlayback) {
        ranges.playback.push(range);
      }
      byDay.set(key, ranges);
      cursor = Math.max(segmentEnd, dayStart.getTime());
    }
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, ranges]) => ({
      date,
      playbackSeconds: mergeRanges(ranges.playback),
      studySeconds: mergeRanges(ranges.study),
    }));
};
