import { notificationPriority as sharedNotificationPriority } from "@repo/member-domain";

export const notificationPriority = sharedNotificationPriority;

export type NotificationDomainType = keyof typeof notificationPriority;

export const selectNotificationType = (
  current: NotificationDomainType | undefined,
  next: NotificationDomainType
) => {
  if (!current) {
    return next;
  }
  return notificationPriority[next] > notificationPriority[current]
    ? next
    : current;
};

export const mergeNotificationRecipients = (
  actorId: string,
  entries: readonly {
    readonly memberId: string | null | undefined;
    readonly type: NotificationDomainType;
  }[]
) => {
  const recipients = new Map<string, NotificationDomainType>();
  for (const entry of entries) {
    if (!entry.memberId || entry.memberId === actorId) {
      continue;
    }
    const current = recipients.get(entry.memberId);
    recipients.set(entry.memberId, selectNotificationType(current, entry.type));
  }
  return [...recipients.entries()];
};

export const notificationFilterTypes = {
  ACTIVITIES: ["ACTIVITY_ASSIGNED", "FEEDBACK_RECEIVED", "ACTIVITY_DEADLINE"],
  COMMUNITY: [
    "COMMENT_REPLY",
    "TOPIC_COMMENT",
    "FOLLOWED_TOPIC_ACTIVITY",
    "GROUP_INVITATION",
    "GROUP_POST",
  ],
  LEARNING: [
    "LESSON_AVAILABLE",
    "MODULE_AVAILABLE",
    "LEARNING_CONTENT_ASSIGNED",
  ],
  BADGES: ["BADGE_AWARDED"],
  MENTIONS: ["MENTION"],
} as const satisfies Record<
  "MENTIONS" | "COMMUNITY" | "ACTIVITIES" | "LEARNING" | "BADGES",
  readonly NotificationDomainType[]
>;
