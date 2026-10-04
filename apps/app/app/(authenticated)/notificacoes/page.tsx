import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { NotificationsPageClient } from "./notifications-page-client";

const NotificationsPage = async () => {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const initial = await getNotifications(userId, { filter: "ALL", limit: 30 });
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

export default NotificationsPage;
