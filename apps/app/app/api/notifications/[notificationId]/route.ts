import { auth } from "@repo/auth/server";
import { NextResponse } from "next/server";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
} from "@/lib/mutation-reliability";
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
    await consumeMutationRateLimit({
      action: "notification.mutation",
      memberId: userId,
    });
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
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return NextResponse.json(
        { error: "Você está fazendo muitas ações em sequência." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        }
      );
    }
    console.error("Notification update failed", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar a notificação." },
      { status: 500 }
    );
  }
};
