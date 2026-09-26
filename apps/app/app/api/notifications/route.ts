import { auth } from "@repo/auth/server";
import { NextResponse } from "next/server";
import {
  getNotifications,
  getUnreadNotificationCount,
  getUnseenNotificationCount,
  type NotificationFilter,
} from "@/lib/notifications";

export const GET = async (request: Request) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const summaryOnly = searchParams.get("summary") === "1";
    const filterValue = searchParams.get("filter") ?? "ALL";
    const filters = [
      "ALL",
      "MENTIONS",
      "COMMUNITY",
      "ACTIVITIES",
      "LEARNING",
    ] as const;
    const filter = filters.includes(filterValue as (typeof filters)[number])
      ? (filterValue as NotificationFilter)
      : "ALL";
    const notifications = summaryOnly
      ? {
          items: [],
          unreadCount: await getUnreadNotificationCount(userId),
          unseenCount: await getUnseenNotificationCount(userId),
        }
      : await getNotifications(userId, {
          cursor: searchParams.get("cursor") ?? undefined,
          filter,
          limit: Number(searchParams.get("limit") ?? 24),
        });
    return NextResponse.json(notifications, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Notifications lookup failed", error);
    return NextResponse.json(
      { error: "Não foi possível carregar as notificações agora." },
      { status: 500 }
    );
  }
};
