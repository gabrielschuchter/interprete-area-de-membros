export const notificationPriority = {
  ACTIVITY_ASSIGNED: 2,
  ACTIVITY_DEADLINE: 2,
  ANNOUNCEMENT: 2,
  COMMENT_REPLY: 3,
  FEEDBACK_RECEIVED: 3,
  FOLLOWED_TOPIC_ACTIVITY: 2,
  LESSON_AVAILABLE: 1,
  MENTION: 4,
  MODULE_AVAILABLE: 1,
  TOPIC_COMMENT: 2,
} as const;

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
  COMMUNITY: ["COMMENT_REPLY", "TOPIC_COMMENT", "FOLLOWED_TOPIC_ACTIVITY"],
  LEARNING: ["LESSON_AVAILABLE", "MODULE_AVAILABLE"],
  MENTIONS: ["MENTION"],
} as const satisfies Record<
  "MENTIONS" | "COMMUNITY" | "ACTIVITIES" | "LEARNING",
  readonly NotificationDomainType[]
>;
