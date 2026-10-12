import "server-only";

import { tracePerformance } from "@repo/observability/performance";
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

    const activities = await resolveStudentFeed(memberId, at, {
      assignmentLimit: 200,
      dueRange: range,
    });
    return activities.flatMap((activity): StudentCalendarActivityDeadline[] => {
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
    });
  });
