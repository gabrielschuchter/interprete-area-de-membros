import "server-only";

import { ContentStatus, database } from "@repo/database";
import {
  getLearningAccessScope,
  hasCourseAccess,
  type LearningAccessScope,
} from "./content-access";
import { getProfilesByClerkIds } from "./profile";

const meetingSelection = {
  id: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  joinUrl: true,
  recordingUrl: true,
  teacherId: true,
  kind: true,
  recurrenceRule: true,
  relatedActivity: { select: { id: true, title: true, slug: true } },
  relatedLibraryItem: { select: { id: true, title: true } },
  course: { select: { id: true, title: true, slug: true } },
} as const;

const memberMeetingSelection = (memberId: string) => ({
  ...meetingSelection,
  participants: {
    where: { memberId },
    select: { memberId: true },
  },
  _count: { select: { participants: true } },
});

const canReadMeeting = (
  meeting: {
    readonly course: { readonly id: string } | null;
    readonly participants: readonly { readonly memberId: string }[];
    readonly _count: { readonly participants: number };
  },
  memberId: string,
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>
) => {
  if (scope.fullAccess) {
    return true;
  }
  if (meeting._count.participants > 0) {
    return meeting.participants.some(
      (participant) => participant.memberId === memberId
    );
  }
  return !meeting.course || hasCourseAccess(scope, meeting.course.id);
};

export const getMeetings = async (
  memberId: string,
  accessScope?: LearningAccessScope | Promise<LearningAccessScope>
) => {
  const now = new Date();
  const calendarStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const calendarEnd = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const scopePromise = accessScope
    ? Promise.resolve(accessScope)
    : getLearningAccessScope(memberId);
  const meetingsPromise = Promise.all([
    database.meeting.findMany({
      where: { status: ContentStatus.PUBLISHED, startsAt: { gte: now } },
      orderBy: [{ startsAt: "asc" }, { position: "asc" }],
      take: 48,
      select: memberMeetingSelection(memberId),
    }),
    database.meeting.findMany({
      where: { status: ContentStatus.PUBLISHED, startsAt: { lt: now } },
      orderBy: { startsAt: "desc" },
      take: 48,
      select: memberMeetingSelection(memberId),
    }),
    database.meeting.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        startsAt: { gte: calendarStart, lt: calendarEnd },
      },
      orderBy: [{ startsAt: "asc" }, { position: "asc" }],
      take: 120,
      select: memberMeetingSelection(memberId),
    }),
  ]);
  const [scope, [upcoming, past, calendar]] = await Promise.all([
    scopePromise,
    meetingsPromise,
  ]);

  return {
    upcoming: upcoming
      .filter((meeting) => canReadMeeting(meeting, memberId, scope))
      .slice(0, 12),
    past: past
      .filter((meeting) => canReadMeeting(meeting, memberId, scope))
      .slice(0, 12),
    calendar: calendar.filter((meeting) =>
      canReadMeeting(meeting, memberId, scope)
    ),
  };
};

export const getUpcomingMeetings = async (
  memberId: string,
  accessScope?: LearningAccessScope | Promise<LearningAccessScope>
) => {
  const scopePromise = accessScope
    ? Promise.resolve(accessScope)
    : getLearningAccessScope(memberId);
  const meetingsPromise = database.meeting.findMany({
    where: { status: ContentStatus.PUBLISHED, startsAt: { gte: new Date() } },
    orderBy: [{ startsAt: "asc" }, { position: "asc" }],
    // Keep the same filtering headroom as the full calendar query. A member
    // may not be allowed to see every course-linked meeting in the first page.
    take: 48,
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      joinUrl: true,
      recordingUrl: true,
      teacherId: true,
      kind: true,
      recurrenceRule: true,
      course: { select: { id: true } },
      participants: { where: { memberId }, select: { memberId: true } },
      _count: { select: { participants: true } },
    },
  });
  const [scope, meetings] = await Promise.all([scopePromise, meetingsPromise]);

  return meetings
    .filter((meeting) => canReadMeeting(meeting, memberId, scope))
    .slice(0, 12);
};

export const getStaffMeetings = async () =>
  database.meeting.findMany({
    orderBy: [{ startsAt: "desc" }, { position: "asc" }],
    select: {
      ...meetingSelection,
      status: true,
      participants: { select: { memberId: true } },
      _count: { select: { participants: true } },
    },
  });

export const getPublishedMeeting = async (id: string, memberId: string) => {
  const [scope, meeting] = await Promise.all([
    getLearningAccessScope(memberId),
    database.meeting.findFirst({
      where: { id, status: ContentStatus.PUBLISHED },
      select: memberMeetingSelection(memberId),
    }),
  ]);

  if (!(meeting && canReadMeeting(meeting, memberId, scope))) {
    return null;
  }

  const teacherProfile = meeting.teacherId
    ? (await getProfilesByClerkIds([meeting.teacherId])).get(meeting.teacherId)
    : null;

  return { ...meeting, teacherProfile: teacherProfile ?? null };
};
