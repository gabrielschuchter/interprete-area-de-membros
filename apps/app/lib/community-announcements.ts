import "server-only";

import {
  AnnouncementAudience,
  ContentStatus,
  database,
  MemberRole,
} from "@repo/database";

const announcementSelect = {
  id: true,
  title: true,
  body: true,
  href: true,
  createdAt: true,
  publishedAt: true,
  startsAt: true,
  endsAt: true,
  isPinned: true,
  isImportant: true,
  version: true,
} as const;

export type CommunityAnnouncement = Awaited<
  ReturnType<typeof getCommunityAnnouncements>
>[number];

export const getCommunityAnnouncements = async (
  memberId: string,
  requestedLimit = 50,
  now = new Date()
) => {
  const limit = Math.max(1, Math.min(requestedLimit, 100));
  const member = await database.member.findUnique({
    where: { id: memberId },
    select: { role: true, deactivatedAt: true },
  });
  if (!member || member.deactivatedAt) {
    return [];
  }

  const isStaff =
    member.role === MemberRole.TEACHER || member.role === MemberRole.ADMIN;
  const candidates = await database.announcement.findMany({
    where: {
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
      OR: [
        { audience: AnnouncementAudience.ALL },
        ...(isStaff ? [{ audience: AnnouncementAudience.STAFF }] : []),
        {
          audience: AnnouncementAudience.SELECTED,
          recipientIds: { has: memberId },
        },
        {
          audience: AnnouncementAudience.COHORT,
          cohorts: {
            some: {
              cohort: {
                is: {
                  archivedAt: null,
                  memberships: {
                    some: {
                      memberId,
                      status: "ACTIVE",
                      leftAt: null,
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
    orderBy: [
      { isImportant: "desc" },
      { isPinned: "desc" },
      { publishedAt: "desc" },
      { id: "desc" },
    ],
    take: limit,
    select: announcementSelect,
  });
  if (candidates.length === 0) {
    return [];
  }

  // Avisos são fixos (05/11/2026): o membro não dispensa; quem publicou
  // encerra ou apaga pela Gestão.
  return candidates.map((announcement) => ({
    ...announcement,
    createdAt: announcement.publishedAt ?? announcement.createdAt,
    groupKey: `announcement:${announcement.id}`,
  }));
};
