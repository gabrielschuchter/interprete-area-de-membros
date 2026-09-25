import "server-only";

import { database } from "@repo/database";

export interface NotificationInput {
  readonly body?: string;
  readonly href?: string;
  readonly memberId: string;
  readonly title: string;
  readonly type: string;
}

export const getNotifications = async (memberId: string) => {
  const [items, unreadCount] = await Promise.all([
    database.notification.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
    database.notification.count({ where: { memberId, readAt: null } }),
  ]);

  return { items, unreadCount };
};

export const createNotification = (input: NotificationInput) =>
  database.notification.create({
    data: {
      memberId: input.memberId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
    },
    select: { id: true },
  });

export const markNotificationRead = (
  memberId: string,
  notificationId: string
) =>
  database.notification.updateMany({
    where: { id: notificationId, memberId, readAt: null },
    data: { readAt: new Date() },
  });

export const markAllNotificationsRead = (memberId: string) =>
  database.notification.updateMany({
    where: { memberId, readAt: null },
    data: { readAt: new Date() },
  });
