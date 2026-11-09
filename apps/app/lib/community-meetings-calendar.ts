import "server-only";

import { ContentStatus, database } from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import { resolveCohortCalendarItems } from "./cohort-calendar-domain";
import {
  type CalendarMonth,
  type CommunityCalendarEntry,
  calendarGridDays,
  calendarGridRange,
  calendarMonthParam,
  communityCalendarTimezone,
  entryDateKeys,
  isWithinJoinWindow,
  meetingCategory,
  meetingKindLabel,
  zonedDateKey,
} from "./community-meetings-calendar-domain";
import { getLearningAccessScope } from "./content-access";
import { publishDueGestaoMeetings } from "./gestao-meetings-schedule";
import { canReadMeeting, safeMeetingRecordingUrl } from "./meeting-access";
import { canReadMeetingCohortTarget } from "./meeting-cohort-access";
import { resolveStudentCohortEvents } from "./student-calendar";

const loadMeetings = (
  memberId: string,
  range: { readonly end: Date; readonly start: Date }
) =>
  database.meeting.findMany({
    where: {
      status: ContentStatus.PUBLISHED,
      demoKey: null,
      startsAt: { lt: range.end },
      OR: [
        { startsAt: { gte: range.start } },
        { endsAt: { gte: range.start } },
        {
          recurrenceRule: { not: null },
          OR: [
            { recurrenceUntil: null },
            { recurrenceUntil: { gte: range.start } },
          ],
        },
      ],
    },
    orderBy: [{ startsAt: "asc" }, { position: "asc" }],
    take: 300,
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      joinUrl: true,
      kind: true,
      createdAt: true,
      publishedAt: true,
      recurrenceRule: true,
      recurrenceUntil: true,
      course: { select: { id: true, title: true } },
      participants: { where: { memberId }, select: { memberId: true } },
      cohortTargets: {
        where: { revokedAt: null },
        select: { cohortId: true, assignedAt: true },
      },
      _count: { select: { participants: true, cohortTargets: true } },
      occurrenceExceptions: {
        where: {
          OR: [
            { occurrenceStartsAt: { gte: range.start, lt: range.end } },
            { startsAtOverride: { gte: range.start, lt: range.end } },
          ],
        },
        take: 200,
        select: {
          occurrenceStartsAt: true,
          startsAtOverride: true,
          endsAtOverride: true,
          titleOverride: true,
          descriptionOverride: true,
          cancelledAt: true,
          version: true,
        },
      },
    },
  });

type CalendarMeetingRow = Awaited<ReturnType<typeof loadMeetings>>[number];

/**
 * Encontros, aulas e workshops que o membro pode ver, mais os eventos da
 * turma dele, para a grade de um mês. Mesmas regras da lista de Encontros
 * (canReadMeeting) e, para quem vê só pela turma, a checagem por ocorrência
 * que o calendário de Ferramentas já aplica.
 */
export const getCommunityMeetingsCalendar = (
  memberId: string,
  month: CalendarMonth,
  now = new Date()
) =>
  tracePerformance("member.community.meetings-calendar", async () => {
    await publishDueGestaoMeetings(now);
    const range = calendarGridRange(month);
    const visibleDays = new Set(calendarGridDays(month));
    const [scope, meetings, cohortEvents] = await Promise.all([
      getLearningAccessScope(memberId),
      loadMeetings(memberId, range),
      resolveStudentCohortEvents(memberId, range, now),
    ]);

    const occurrenceVisible = (
      meeting: CalendarMeetingRow,
      startsAt: Date,
      endsAt: Date | null
    ) =>
      scope.fullAccess ||
      meeting.participants.length > 0 ||
      meeting.cohortTargets.length === 0 ||
      meeting.cohortTargets.some((target) =>
        canReadMeetingCohortTarget(
          { ...meeting, startsAt, endsAt, recurrenceRule: null },
          target,
          scope.cohortMemberships?.get(target.cohortId)
        )
      );

    const meetingEntries = meetings
      .filter((meeting) => canReadMeeting(meeting, memberId, scope))
      .flatMap((meeting) =>
        resolveCohortCalendarItems(
          [
            {
              id: meeting.id,
              sourceType: "meeting",
              title: meeting.title,
              description: meeting.description,
              startsAt: meeting.startsAt,
              endsAt: meeting.endsAt,
              recurrenceRule: meeting.recurrenceRule,
              recurrenceUntil: meeting.recurrenceUntil,
              timezone: meeting.timezone,
              status: "PUBLISHED",
              href: `/encontros/${meeting.id}`,
              exceptions: meeting.occurrenceExceptions.map((exception) => ({
                ...exception,
                colorOverride: null,
              })),
            },
          ],
          range
        )
          .filter(
            (item) =>
              !item.cancelled &&
              occurrenceVisible(meeting, item.startsAt, item.endsAt)
          )
          .map(
            (item): CommunityCalendarEntry => ({
              key: `meeting:${meeting.id}:${item.occurrenceKey ?? "single"}`,
              category: meetingCategory(meeting.kind),
              kindLabel: meetingKindLabel(meeting.kind),
              title: item.title,
              description: item.description,
              startsAt: item.startsAt.toISOString(),
              endsAt: item.endsAt?.toISOString() ?? null,
              allDay: false,
              dateKeys: entryDateKeys(item.startsAt, item.endsAt, visibleDays),
              href: `/encontros/${meeting.id}`,
              joinUrl: isWithinJoinWindow(item.startsAt, item.endsAt, now)
                ? safeMeetingRecordingUrl(meeting.joinUrl)
                : null,
              registered: meeting.participants.length > 0,
              courseTitle: meeting.course?.title ?? null,
            })
          )
      );

    const cohortEntries = cohortEvents.map(
      (event): CommunityCalendarEntry => ({
        key: `cohort:${event.id}`,
        category: "cohort",
        kindLabel: "Evento da turma",
        title: event.title,
        description: event.description,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
        allDay: event.allDay,
        dateKeys: entryDateKeys(event.startsAt, event.endsAt, visibleDays),
        href: null,
        joinUrl: null,
        registered: false,
        courseTitle: null,
      })
    );

    const monthKey = calendarMonthParam(month);
    const todayKey = zonedDateKey(now);
    const monthLabel = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(month.year, month.month - 1, 15)));

    return {
      timezone: communityCalendarTimezone,
      monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      days: [...visibleDays].map((key) => ({
        key,
        inMonth: key.startsWith(monthKey),
        isToday: key === todayKey,
      })),
      entries: [...meetingEntries, ...cohortEntries]
        .filter((entry) => entry.dateKeys.length > 0)
        .sort(
          (left, right) =>
            Number(right.allDay) - Number(left.allDay) ||
            left.startsAt.localeCompare(right.startsAt) ||
            left.title.localeCompare(right.title)
        ),
    };
  });
