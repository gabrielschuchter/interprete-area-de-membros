import { database, MemberRole } from "@repo/database";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemberRole } from "@/lib/authorization";
import { getLearningAssignmentRecipientSearchWhere } from "@/lib/learning-assignment-scope";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
} from "@/lib/mutation-reliability";

export const dynamic = "force-dynamic";

export const GET = async (request: Request) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const role = await getMemberRole(userId);
  if (role !== MemberRole.ADMIN && role !== MemberRole.TEACHER) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    await consumeMutationRateLimit({
      action: "member.search",
      memberId: userId,
    });
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return NextResponse.json(
        {
          error:
            "Você está fazendo muitas buscas em sequência. Tente novamente em alguns segundos.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        }
      );
    }
    throw error;
  }

  const query =
    new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  try {
    const recipients = await database.member.findMany({
      where: getLearningAssignmentRecipientSearchWhere({ role, userId }, query),
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: 48,
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        profile: { select: { username: true } },
      },
    });

    return NextResponse.json({
      items: recipients.map((member) => ({
        id: member.id,
        displayName:
          member.displayName?.trim() || member.profile?.username || "Aluno",
        username: member.profile?.username ?? member.id,
        avatarUrl: member.avatarUrl,
        kind: "USER" as const,
        role: MemberRole.MEMBER,
      })),
    });
  } catch (error) {
    console.error("Assignment recipient search failed", error);
    return NextResponse.json(
      { error: "Não foi possível buscar alunos para atribuição." },
      { status: 500 }
    );
  }
};
