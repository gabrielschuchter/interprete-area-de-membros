import "server-only";
import {
  AnnouncementAudience,
  ContentStatus,
  MemberRole,
  type Prisma,
} from "@repo/database";
import {
  assertPreviewNotificationAudience,
  enqueueNotificationBatch,
  resolveOutboxConsumerKey,
} from "@repo/member-domain";

export const queueAnnouncementNotifications = async (
  transaction: Prisma.TransactionClient,
  announcement: {
    readonly id: string;
    readonly title: string;
    readonly body: string;
    readonly href: string | null;
    readonly audience: AnnouncementAudience;
    readonly recipientIds: readonly string[];
    readonly startsAt: Date | null;
    readonly endsAt: Date | null;
    readonly status: ContentStatus;
    readonly isImportant: boolean;
    readonly version: number;
  },
  cohortIds: readonly string[],
  actorId: string
) => {
  const now = new Date();
  if (
    announcement.status !== ContentStatus.PUBLISHED ||
    (announcement.endsAt && announcement.endsAt <= now)
  ) {
    return;
  }
  let audienceWhere: Prisma.MemberWhereInput = {};
  if (announcement.audience === AnnouncementAudience.STAFF) {
    audienceWhere = { role: { in: [MemberRole.TEACHER, MemberRole.ADMIN] } };
  } else if (announcement.audience === AnnouncementAudience.SELECTED) {
    audienceWhere = { id: { in: [...announcement.recipientIds] } };
  } else if (announcement.audience === AnnouncementAudience.COHORT) {
    audienceWhere = {
      cohortMemberships: {
        some: {
          cohortId: { in: [...cohortIds] },
          status: "ACTIVE",
          leftAt: null,
          cohort: { is: { archivedAt: null } },
        },
      },
    };
  }
  const recipients = await transaction.member.findMany({
    where: {
      deactivatedAt: null,
      id: { not: actorId },
      ...audienceWhere,
    },
    select: {
      id: true,
      notificationPreference: { select: { announcements: true } },
    },
    take: 10_001,
  });
  if (recipients.length > 10_000) {
    throw new Error("Announcement audience exceeds the supported limit.");
  }

  let recipientIds = recipients
    .filter(
      ({ notificationPreference }) =>
        notificationPreference?.announcements !== false
    )
    .map(({ id }) => id);
  const previewConsumer =
    resolveOutboxConsumerKey("notifications.create.v1") !==
    "notifications.create.v1";
  if (previewConsumer) {
    const allowedIds = new Set(
      (process.env.OUTBOX_PREVIEW_MEMBER_IDS ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    );
    recipientIds = recipientIds.filter((id) => allowedIds.has(id));
  }
  assertPreviewNotificationAudience(actorId, recipientIds);
  if (recipientIds.length === 0) {
    return;
  }

  const availableAt =
    announcement.startsAt && announcement.startsAt > now
      ? announcement.startsAt
      : undefined;
  await enqueueNotificationBatch(transaction, {
    actorId,
    aggregateType: "announcement",
    aggregateId: announcement.id,
    idempotencyKey: `announcement:${announcement.id}:v${announcement.version}`,
    occurredAt: now,
    availableAt,
    notifications: recipientIds.map((recipientId) => ({
      announcementId: announcement.id,
      announcementVersion: announcement.version,
      body: announcement.body.slice(0, 500),
      dedupeKey: `announcement:${announcement.id}:v${announcement.version}:${recipientId}`,
      entityId: announcement.id,
      entityType: "ANNOUNCEMENT",
      groupKey: `announcement:${announcement.id}`,
      href: "/comunidade",
      priority: announcement.isImportant ? 80 : 40,
      recipientId,
      title: announcement.title.slice(0, 160),
      type: "ANNOUNCEMENT",
    })),
  });
};
