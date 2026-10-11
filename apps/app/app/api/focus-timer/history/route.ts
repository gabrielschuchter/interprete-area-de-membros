import { database } from "@repo/database";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportFocusTimerHistoryCsv } from "@/lib/focus-timer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = async () => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  const member = await database.member.findFirst({
    where: { id: userId, deactivatedAt: null },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  const csv = await exportFocusTimerHistoryCsv(member.id);
  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="interprete-sessoes.csv"',
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
