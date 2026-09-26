import { auth } from "@repo/auth/server";
import { NextResponse } from "next/server";
import {
  markNotificationRead,
  markNotificationUnread,
} from "@/lib/notifications";

interface NotificationRouteContext {
  readonly params: Promise<{ notificationId: string }>;
}

export const PATCH = async (
  _request: Request,
  { params }: NotificationRouteContext
) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { notificationId } = await params;
  if (!notificationId) {
    return NextResponse.json(
      { error: "Notificação inválida." },
      { status: 400 }
    );
  }

  try {
    let markUnread = false;
    try {
      const payload = (await _request.clone().json()) as { read?: unknown };
      markUnread = payload.read === false;
    } catch {
      // A PATCH without a body means "mark as read" for the compact UI.
    }
    if (markUnread) {
      await markNotificationUnread(userId, notificationId);
    } else {
      await markNotificationRead(userId, notificationId);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notification update failed", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar a notificação." },
      { status: 500 }
    );
  }
};
