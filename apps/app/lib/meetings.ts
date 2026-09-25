import "server-only";

import { ContentStatus, database } from "@repo/database";
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
  course: { select: { title: true, slug: true } },
} as const;

export const getMeetings = async () => {
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    database.meeting.findMany({
      where: { status: ContentStatus.PUBLISHED, startsAt: { gte: now } },
      orderBy: [{ startsAt: "asc" }, { position: "asc" }],
      take: 12,
      select: meetingSelection,
    }),
    database.meeting.findMany({
      where: { status: ContentStatus.PUBLISHED, startsAt: { lt: now } },
      orderBy: { startsAt: "desc" },
      take: 12,
      select: meetingSelection,
    }),
  ]);

  return { upcoming, past };
};

export const getStaffMeetings = async () =>
  database.meeting.findMany({
    orderBy: [{ startsAt: "desc" }, { position: "asc" }],
    select: { ...meetingSelection, status: true },
  });

export const getPublishedMeeting = async (id: string) => {
  const meeting = await database.meeting.findFirst({
    where: { id, status: ContentStatus.PUBLISHED },
    select: meetingSelection,
  });

  if (!meeting) {
    return null;
  }

  const teacherProfile = meeting.teacherId
    ? (await getProfilesByClerkIds([meeting.teacherId])).get(meeting.teacherId)
    : null;

  return { ...meeting, teacherProfile: teacherProfile ?? null };
};
