import { database } from "@repo/database";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordMemberPresence } from "@/lib/member-presence";

const headers = { "Cache-Control": "private, no-store" };

export const POST = async () => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers }
    );
  }
  const member = await database.member.findFirst({
    where: { id: userId, deactivatedAt: null },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json(
      { error: "Membro indisponível" },
      { status: 403, headers }
    );
  }
  // Sem limite de taxa: o crédito sai do relógio do servidor, então sinais em
  // excesso não rendem tempo a mais e o custo é um upsert.
  await recordMemberPresence(member.id);
  return new NextResponse(null, { status: 204, headers });
};
