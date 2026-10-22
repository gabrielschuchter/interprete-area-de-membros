"use server";

import {
  AnnouncementAudience,
  ContentStatus,
  database,
  MemberRole,
  type Prisma,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { requireMemberId } from "@/lib/learning";

export type AnnouncementDismissalResult =
  | "dismissed"
  | "already-dismissed"
  | "stale"
  | "unavailable";

interface AnnouncementAudienceSnapshot {
  readonly audience: AnnouncementAudience;
  readonly cohorts: readonly { readonly cohortId: string }[];
  readonly recipientIds: readonly string[];
}

const memberMatchesAnnouncementAudience = async (
  transaction: Prisma.TransactionClient,
  announcement: AnnouncementAudienceSnapshot,
  memberId: string,
  role: MemberRole
) => {
  switch (announcement.audience) {
    case AnnouncementAudience.ALL:
      return true;
    case AnnouncementAudience.STAFF:
      return role === MemberRole.TEACHER || role === MemberRole.ADMIN;
    case AnnouncementAudience.SELECTED:
      return announcement.recipientIds.includes(memberId);
    case AnnouncementAudience.COHORT:
      return Boolean(
        await transaction.cohortMembership.findFirst({
          where: {
            memberId,
            cohortId: {
              in: announcement.cohorts.map(({ cohortId }) => cohortId),
            },
            status: "ACTIVE",
            leftAt: null,
            cohort: { is: { archivedAt: null } },
          },
          select: { id: true },
        })
      );
    default:
      return false;
  }
};

export const dismissCommunityAnnouncement = async (
  announcementId: string,
  version: number
): Promise<AnnouncementDismissalResult> => {
  const memberId = await requireMemberId();
  if (
    typeof announcementId !== "string" ||
    announcementId.length < 1 ||
    announcementId.length > 255 ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    return "unavailable";
  }

  const result = await database.$transaction(async (transaction) => {
    await transaction.$queryRaw<Array<{ readonly id: string }>>`
      SELECT "id" FROM "Announcement"
      WHERE "id" = ${announcementId}
      FOR UPDATE
    `;
    const [announcement, member] = await Promise.all([
      transaction.announcement.findUnique({
        where: { id: announcementId },
        select: {
          id: true,
          audience: true,
          recipientIds: true,
          status: true,
          startsAt: true,
          endsAt: true,
          deletedAt: true,
          version: true,
          cohorts: { select: { cohortId: true } },
        },
      }),
      transaction.member.findUnique({
        where: { id: memberId },
        select: { role: true, deactivatedAt: true },
      }),
    ]);
    if (!(announcement && member && !member.deactivatedAt)) {
      return "unavailable" as const;
    }
    if (announcement.version !== version) {
      return "stale" as const;
    }

    const now = new Date();
    if (
      announcement.status !== ContentStatus.PUBLISHED ||
      announcement.deletedAt ||
      (announcement.startsAt && announcement.startsAt > now) ||
      (announcement.endsAt && announcement.endsAt <= now)
    ) {
      return "unavailable" as const;
    }

    if (
      !(await memberMatchesAnnouncementAudience(
        transaction,
        announcement,
        memberId,
        member.role
      ))
    ) {
      return "unavailable" as const;
    }

    const inserted = await transaction.announcementDismissal.createMany({
      data: [{ announcementId, memberId, announcementVersion: version }],
      skipDuplicates: true,
    });
    return inserted.count > 0 ? "dismissed" : "already-dismissed";
  });
  if (result === "dismissed" || result === "already-dismissed") {
    revalidatePath("/comunidade");
  }
  return result;
};
