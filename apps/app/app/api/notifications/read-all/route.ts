import { auth } from "@repo/auth/server";
import { NextResponse } from "next/server";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
} from "@/lib/mutation-reliability";
import { markAllNotificationsRead } from "@/lib/notifications";

export const POST = async () => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    await consumeMutationRateLimit({
      action: "notification.mutation",
      memberId: userId,
    });
    await markAllNotificationsRead(userId);
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
    console.error("Notifications read-all failed", error);
    return NextResponse.json(
      { error: "Não foi possível marcar as notificações." },
      { status: 500 }
    );
  }
};
