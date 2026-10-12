import "server-only";

import { database } from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import {
  resolveStudentCalendarLessonReleases,
  type StudentCalendarLessonRelease,
} from "./student-calendar-domain";
import { resolveStudentFeed } from "./student-feed";

export interface StudentCalendarActivityDeadline {
  readonly activityId: string;
  readonly dueAt: Date;
  readonly href: string;
  readonly id: string;
  readonly slug: string;
  readonly status: string;
  readonly title: string;
}

export interface StudentCalendarRange {
  readonly end: Date;
  readonly start: Date;
}

const getLessonReleases = async (
  memberId: string,
  range: StudentCalendarRange,
  at: Date
): Promise<StudentCalendarLessonRelease[]> => {
  const memberships = await database.cohortMembership.findMany({
    where: {
      memberId,
      status: "ACTIVE",
      leftAt: null,
      joinedAt: { lte: at },
    },
    select: {
      cohortId: true,
      joinedAt: true,
      cohort: {
        select: {
          archivedAt: true,
          endsAt: true,
          startsAt: true,
          lateJoinPolicy: true,
          readAfterEndDays: true,
          courseAccesses: {
            where: { revokedAt: null },
            select: {
              courseId: true,
              createdAt: true,
              releaseMode: true,
              startsAt: true,
              revokedAt: true,
            },
          },
        },
      },
    },
  });
  if (memberships.length === 0) {
    return [];
  }

  const candidates = await database.cohortLessonRelease.findMany({
    where: {
      cohortId: {
        in: [...new Set(memberships.map(({ cohortId }) => cohortId))],
      },
      releaseAt: { gte: range.start, lte: range.end },
      lesson: {
        is: {
          status: "PUBLISHED",
          module: {
            is: {
              status: "PUBLISHED",
              course: { is: { status: "PUBLISHED" } },
            },
          },
        },
      },
    },
    orderBy: [{ releaseAt: "asc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true,
      cohortId: true,
      lessonId: true,
      releaseAt: true,
      lesson: {
        select: {
          title: true,
          slug: true,
          module: {
            select: {
              courseId: true,
              course: { select: { id: true, slug: true } },
            },
          },
        },
      },
    },
  });
  return resolveStudentCalendarLessonReleases(
    candidates,
    memberships,
    range,
    at
  );
};

const isWithinRange = (date: Date, range: StudentCalendarRange) =>
  date >= range.start && date <= range.end;

export const resolveCalendar = (
  memberId: string,
  range: StudentCalendarRange,
  at = new Date()
) =>
  tracePerformance("member.learning.calendar", async () => {
    if (
      Number.isNaN(range.start.valueOf()) ||
      Number.isNaN(range.end.valueOf()) ||
      range.end <= range.start ||
      range.end.getTime() - range.start.getTime() > 400 * 86_400_000
    ) {
      throw new Error("O período solicitado não é válido.");
    }

    const [activities, lessonReleases] = await Promise.all([
      resolveStudentFeed(memberId, at, {
        assignmentLimit: 200,
        dueRange: range,
      }),
      getLessonReleases(memberId, range, at),
    ]);
    return {
      activities: activities.flatMap(
        (activity): StudentCalendarActivityDeadline[] => {
          if (
            !(activity.dueAt && isWithinRange(activity.dueAt, range)) ||
            (activity.availableAt && activity.availableAt > at)
          ) {
            return [];
          }
          return [
            {
              id: activity.id,
              activityId: activity.targetId,
              title: activity.title,
              slug: activity.slug,
              dueAt: activity.dueAt,
              status: activity.status,
              href: `/atividades/${activity.slug}`,
            },
          ];
        }
      ),
      lessonReleases,
    };
  });
