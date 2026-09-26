import { auth } from "@repo/auth/server";
import { NextResponse } from "next/server";
import { markNotificationsSeen } from "@/lib/notifications";

export const POST = async (request: Request) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(payload.ids)
      ? payload.ids
          .filter((id): id is string => typeof id === "string")
          .slice(0, 50)
      : [];
    const result = await markNotificationsSeen(userId, ids);
    return NextResponse.json({ ok: true, count: result.count });
  } catch (error) {
    console.error("Notifications seen update failed", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar as notificações." },
      { status: 500 }
    );
  }
};
