import { requireGestaoActor } from "@/lib/gestao-authorization";
import { getNotifications } from "@/lib/notifications";
import { NotificationsPageClient } from "../../notificacoes/notifications-page-client";

// A Gestão usa a mesma central de notificações da plataforma.
const GestaoNotificationsPage = async () => {
  const actor = await requireGestaoActor();
  const initial = await getNotifications(actor.userId, {
    filter: "ALL",
    limit: 30,
  });
  return (
    <NotificationsPageClient
      embedded
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
