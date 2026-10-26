import { redirect } from "next/navigation";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import { getNotifications } from "@/lib/notifications";
import { GestaoNotificationsList } from "./notifications-list";

const GestaoNotificationsPage = async () => {
  const actor = await requireGestaoActor();
  const initial = await getNotifications(actor.userId, {
    filter: "ALL",
    limit: 30,
  });
  if (!initial) {
    redirect("/gestao");
  }
  return (
    <GestaoNotificationsList
      initialCursor={initial.nextCursor}
      initialItems={initial.items.map((item) => ({
        body: item.body,
        createdAt: item.createdAt.toISOString(),
        entityType: item.entityType,
        href: item.href,
        id: item.id,
        readAt: item.readAt?.toISOString() ?? null,
        seenAt: item.seenAt?.toISOString() ?? null,
        title: item.title,
        type: item.type,
      }))}
      initialUnread={initial.unreadCount}
    />
  );
};

export default GestaoNotificationsPage;
