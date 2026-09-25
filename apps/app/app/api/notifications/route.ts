import { auth } from "@repo/auth/server";
import { NextResponse } from "next/server";
import { getNotifications } from "@/lib/notifications";

export const GET = async () => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const notifications = await getNotifications(userId);
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
