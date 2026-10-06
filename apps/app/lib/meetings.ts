import "server-only";

import { ContentStatus, database, MemberRole } from "@repo/database";
import { getMemberRole } from "./authorization";
import {
  getLearningAccessScope,
  type LearningAccessScope,
} from "./content-access";
import {
  canReadMeeting,
  hasConfiguredExternalRecordingSource,
  safeMeetingRecordingUrl,
} from "./meeting-access";
import { getProfilesByClerkIds } from "./profile";
import { getAccessibleRecordingIds } from "./recordings";

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

const attachAuthorizedRecordings = async <T extends { readonly id: string }>(
  meetings: readonly T[],
  memberId: string,
  fullAccess: boolean
) => {
  const ids = meetings.map((meeting) => meeting.id);
  if (ids.length === 0) {
    return meetings.map((meeting) => ({ ...meeting, recordings: [] }));
  }

  const recordings = await database.importedRecording.findMany({
    where: {
      meetingId: { in: ids },
      group: fullAccess ? undefined : { memberId },
    },
    orderBy: { meetingDate: "desc" },
    select: {
      id: true,
      meetingId: true,
      originalTitle: true,
      asset: { select: { id: true, title: true, kind: true } },
    },
  });

  return meetings.map((meeting) => ({
    ...meeting,
    recordings: recordings.filter(
      (recording) => recording.meetingId === meeting.id
    ),
  }));
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
      where: {
        status: ContentStatus.PUBLISHED,
        demoKey: null,
        startsAt: { gte: now },
      },
      orderBy: [{ startsAt: "asc" }, { position: "asc" }],
      take: 48,
      select: memberMeetingSelection(memberId),
    }),
    database.meeting.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        demoKey: null,
        startsAt: { lt: now },
      },
      orderBy: { startsAt: "desc" },
      take: 48,
      select: memberMeetingSelection(memberId),
    }),
    database.meeting.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        demoKey: null,
        startsAt: { gte: calendarStart, lt: calendarEnd },
      },
      orderBy: [{ startsAt: "asc" }, { position: "asc" }],
      take: 120,
      select: memberMeetingSelection(memberId),
    }),
  ]);
  const [scope, role, [upcoming, past, calendar]] = await Promise.all([
    scopePromise,
    getMemberRole(memberId),
    meetingsPromise,
  ]);

  const fullAccess = role === MemberRole.ADMIN || role === MemberRole.TEACHER;
  const filteredUpcoming = upcoming
    .filter((meeting) => canReadMeeting(meeting, memberId, scope))
    .slice(0, 12);
  const filteredPast = past
    .filter((meeting) => canReadMeeting(meeting, memberId, scope))
    .slice(0, 12);
  const filteredCalendar = calendar.filter((meeting) =>
    canReadMeeting(meeting, memberId, scope)
  );
  const [upcomingWithRecordings, pastWithRecordings, calendarWithRecordings] =
    await Promise.all([
      attachAuthorizedRecordings(filteredUpcoming, memberId, fullAccess),
      attachAuthorizedRecordings(filteredPast, memberId, fullAccess),
      attachAuthorizedRecordings(filteredCalendar, memberId, fullAccess),
    ]);

  return {
    upcoming: upcomingWithRecordings,
    past: pastWithRecordings,
    calendar: calendarWithRecordings,
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
    where: {
      status: ContentStatus.PUBLISHED,
      demoKey: null,
      startsAt: { gte: new Date() },
    },
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
      relatedActivity: { select: { id: true, title: true, slug: true } },
      relatedLibraryItem: { select: { id: true, title: true } },
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

/**
 * Recording links on past published meetings belong in the member's recording
 * archive as well as the calendar. Visibility follows the same participant
 * and course rules used by meeting details.
 */
export const getMemberMeetingRecordings = async (memberId: string) => {
  const scope = await getLearningAccessScope(memberId);
  const now = new Date();
  const visibleWhere = scope.fullAccess
    ? {}
    : {
        OR: [
          { participants: { some: { memberId } } },
          {
            participants: { none: {} },
            OR: [
              { courseId: null },
              { courseId: { in: [...scope.courseIds] } },
            ],
          },
        ],
      };
  const meetings = await database.meeting.findMany({
    where: {
      status: ContentStatus.PUBLISHED,
      demoKey: null,
      startsAt: { lt: now },
      recordingUrl: { not: null },
      ...visibleWhere,
    },
    orderBy: [{ startsAt: "desc" }, { position: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      timezone: true,
      recordingUrl: true,
      course: { select: { id: true, title: true } },
      participants: { where: { memberId }, select: { memberId: true } },
      _count: { select: { participants: true } },
    },
  });
  const visibleMeetings = meetings.filter((meeting) =>
    canReadMeeting(meeting, memberId, scope)
  );
  const linkedRecordings = visibleMeetings.length
    ? await database.importedRecording.findMany({
        where: { meetingId: { in: visibleMeetings.map(({ id }) => id) } },
        select: {
          id: true,
          meetingId: true,
          asset: {
            select: {
              externalUrl: true,
              kind: true,
              mediaExternalId: true,
              mediaProvider: true,
            },
          },
        },
      })
    : [];
  const accessibleIds = await getAccessibleRecordingIds(
    memberId,
    linkedRecordings.map(({ id }) => id)
  );
  const meetingsWithPlayableInternalRecording = new Set(
    linkedRecordings
      .filter(
        (recording) =>
          accessibleIds.has(recording.id) &&
          hasConfiguredExternalRecordingSource(recording.asset)
      )
      .map((recording) => recording.meetingId)
      .filter((meetingId): meetingId is string => meetingId !== null)
  );

  return visibleMeetings.flatMap((meeting) => {
    const url = safeMeetingRecordingUrl(meeting.recordingUrl);
    if (!url || meetingsWithPlayableInternalRecording.has(meeting.id)) {
      return [];
    }

    return [
      {
        id: meeting.id,
        title: meeting.title,
        description: meeting.description,
        startsAt: meeting.startsAt,
        timezone: meeting.timezone,
        recordingUrl: url,
        courseTitle: meeting.course?.title ?? null,
      },
    ];
  });
};

export const getStaffMeetings = async () =>
  database.meeting.findMany({
    orderBy: [{ startsAt: "desc" }, { position: "asc" }],
    select: {
      ...meetingSelection,
      status: true,
      participants: { select: { memberId: true } },
      attendance: {
        select: {
          memberId: true,
          isPresent: true,
          markedAt: true,
          member: { select: { displayName: true, email: true } },
        },
      },
      _count: { select: { participants: true } },
    },
  });

export const getPublishedMeeting = async (id: string, memberId: string) => {
  const [scope, role, meeting] = await Promise.all([
    getLearningAccessScope(memberId),
    getMemberRole(memberId),
    database.meeting.findFirst({
      where: { id, status: ContentStatus.PUBLISHED, demoKey: null },
      select: memberMeetingSelection(memberId),
    }),
  ]);

  if (!(meeting && canReadMeeting(meeting, memberId, scope))) {
    return null;
  }

  const teacherProfile = meeting.teacherId
    ? (await getProfilesByClerkIds([meeting.teacherId])).get(meeting.teacherId)
    : null;

  const [meetingWithRecordings] = await attachAuthorizedRecordings(
    [meeting],
    memberId,
    role === MemberRole.ADMIN || role === MemberRole.TEACHER
  );

  return {
    ...meetingWithRecordings,
    teacherProfile: teacherProfile ?? null,
  };
};
