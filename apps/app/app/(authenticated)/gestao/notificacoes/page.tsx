import { redirect } from "next/navigation";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import { getNotifications } from "@/lib/notifications";
import { NotificationsPageClient } from "../../notificacoes/notifications-page-client";

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
    <NotificationsPageClient
      initial={{
        ...initial,
        items: initial.items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          readAt: item.readAt?.toISOString() ?? null,
          seenAt: item.seenAt?.toISOString() ?? null,
        })),
      }}
    />
  );
};

export default GestaoNotificationsPage;
