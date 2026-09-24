import "server-only";

import { ContentStatus, database } from "@repo/database";

export const getMeetings = async () => {
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    database.meeting.findMany({
      where: { status: ContentStatus.PUBLISHED, startsAt: { gte: now } },
      orderBy: [{ startsAt: "asc" }, { position: "asc" }],
      take: 12,
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        joinUrl: true,
        recordingUrl: true,
      },
    }),
    database.meeting.findMany({
      where: { status: ContentStatus.PUBLISHED, startsAt: { lt: now } },
      orderBy: { startsAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        joinUrl: true,
        recordingUrl: true,
      },
    }),
  ]);

  return { upcoming, past };
};

export const getStaffMeetings = async () =>
  database.meeting.findMany({
    orderBy: [{ startsAt: "desc" }, { position: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      joinUrl: true,
      recordingUrl: true,
      status: true,
    },
  });
