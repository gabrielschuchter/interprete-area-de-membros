import "server-only";

import { ContentStatus, database } from "@repo/database";
import { getLearningAccessScope, hasCourseAccess } from "./content-access";
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
  course: { select: { id: true, title: true, slug: true } },
} as const;

const canReadMeeting = (
  meeting: { readonly course: { readonly id: string } | null },
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>
) => !meeting.course || hasCourseAccess(scope, meeting.course.id);

export const getMeetings = async (memberId: string) => {
  const now = new Date();
  const [scope, upcoming, past] = await Promise.all([
    getLearningAccessScope(memberId),
    database.meeting.findMany({
      where: { status: ContentStatus.PUBLISHED, startsAt: { gte: now } },
      orderBy: [{ startsAt: "asc" }, { position: "asc" }],
      take: 48,
      select: meetingSelection,
    }),
    database.meeting.findMany({
      where: { status: ContentStatus.PUBLISHED, startsAt: { lt: now } },
      orderBy: { startsAt: "desc" },
      take: 48,
      select: meetingSelection,
    }),
  ]);

  return {
    upcoming: upcoming
      .filter((meeting) => canReadMeeting(meeting, scope))
      .slice(0, 12),
    past: past.filter((meeting) => canReadMeeting(meeting, scope)).slice(0, 12),
  };
};

export const getStaffMeetings = async () =>
  database.meeting.findMany({
    orderBy: [{ startsAt: "desc" }, { position: "asc" }],
    select: { ...meetingSelection, status: true },
  });

export const getPublishedMeeting = async (id: string, memberId: string) => {
  const [scope, meeting] = await Promise.all([
    getLearningAccessScope(memberId),
    database.meeting.findFirst({
      where: { id, status: ContentStatus.PUBLISHED },
      select: meetingSelection,
    }),
  ]);

  if (!(meeting && canReadMeeting(meeting, scope))) {
    return null;
  }

  const teacherProfile = meeting.teacherId
    ? (await getProfilesByClerkIds([meeting.teacherId])).get(meeting.teacherId)
    : null;

  return { ...meeting, teacherProfile: teacherProfile ?? null };
};
