import "server-only";

import { database } from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import {
  resolveStudentCalendarCohortEvents,
  resolveStudentCalendarLessonReleases,
  type StudentCalendarCohortEvent,
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

const getCalendarMemberships = (memberId: string, at: Date) =>
  database.cohortMembership.findMany({
    where: {
      memberId,
      status: "ACTIVE",
      leftAt: null,
      joinedAt: { lte: at },
    },
    select: {
      cohortId: true,
      joinedAt: true,
      includePastReadOnly: true,
      cohort: {
        select: {
          archivedAt: true,
          endsAt: true,
          lateJoinPolicy: true,
          startsAt: true,
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
type CalendarMembership = Awaited<
  ReturnType<typeof getCalendarMemberships>
>[number];

const getLessonReleases = async (
  memberships: readonly CalendarMembership[],
  range: StudentCalendarRange,
  at: Date
): Promise<StudentCalendarLessonRelease[]> => {
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

const getCohortEvents = async (
  memberships: readonly CalendarMembership[],
  range: StudentCalendarRange,
  at: Date
): Promise<StudentCalendarCohortEvent[]> => {
  if (memberships.length === 0) {
    return [];
  }
  const candidates = await database.cohortEvent.findMany({
    where: {
      cohortId: {
        in: [...new Set(memberships.map(({ cohortId }) => cohortId))],
      },
      status: "PUBLISHED",
      OR: [
        { startsAt: { gte: range.start, lte: range.end } },
        { startsAt: { lt: range.start }, endsAt: { gte: range.start } },
        {
          recurrence: { not: "NONE" },
          OR: [
            { recurrenceUntil: null },
            { recurrenceUntil: { gte: range.start } },
          ],
        },
      ],
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true,
      cohortId: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      color: true,
      createdAt: true,
      publishedAt: true,
      status: true,
      recurrence: true,
      recurrenceUntil: true,
      occurrenceExceptions: {
        where: {
          OR: [
            {
              occurrenceStartsAt: {
                gte: range.start,
                lte: range.end,
              },
            },
            { startsAtOverride: { gte: range.start, lte: range.end } },
          ],
        },
        take: 200,
        select: {
          occurrenceStartsAt: true,
          startsAtOverride: true,
          endsAtOverride: true,
          titleOverride: true,
          descriptionOverride: true,
          colorOverride: true,
          cancelledAt: true,
          version: true,
        },
      },
    },
  });
  return resolveStudentCalendarCohortEvents(candidates, memberships, range, at);
};

const getCohortCalendarProjection = async (
  memberId: string,
  range: StudentCalendarRange,
  at: Date
) => {
  const memberships = await getCalendarMemberships(memberId, at);
  if (memberships.length === 0) {
    return { lessonReleases: [], cohortEvents: [] };
  }
  const [lessonReleases, cohortEvents] = await Promise.all([
    getLessonReleases(memberships, range, at),
    getCohortEvents(memberships, range, at),
  ]);
  return { lessonReleases, cohortEvents };
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

    const [activities, cohortCalendar] = await Promise.all([
      resolveStudentFeed(memberId, at, {
        assignmentLimit: 200,
        dueRange: range,
      }),
      getCohortCalendarProjection(memberId, range, at),
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
      lessonReleases: cohortCalendar.lessonReleases,
      cohortEvents: cohortCalendar.cohortEvents,
    };
  });
