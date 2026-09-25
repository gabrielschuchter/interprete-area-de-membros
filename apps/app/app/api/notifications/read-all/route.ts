import { auth } from "@repo/auth/server";
import { NextResponse } from "next/server";
import { markAllNotificationsRead } from "@/lib/notifications";

export const POST = async () => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    await markAllNotificationsRead(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notifications read-all failed", error);
    return NextResponse.json(
      { error: "Não foi possível marcar as notificações." },
      { status: 500 }
    );
  }
};
