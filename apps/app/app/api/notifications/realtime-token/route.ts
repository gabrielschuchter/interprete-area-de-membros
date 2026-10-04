import { auth as clerkAuth } from "@repo/auth/server";
import { database } from "@repo/database";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const GET = async () => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const member = await database.member.findUnique({
    where: { id: userId },
    select: { onboardingStatus: true },
  });
  if (member?.onboardingStatus !== "COMPLETED") {
    return NextResponse.json(
      { error: "Membro não disponível." },
      { status: 403 }
    );
  }

  const { getToken } = await clerkAuth();
  const token = await getToken();
  if (!token) {
    return NextResponse.json(
      {
        error: "A integração nativa Clerk/Supabase ainda não está configurada.",
      },
      { status: 503 }
    );
  }

  try {
    const encodedClaims = token.split(".")[1];
    const claims = JSON.parse(
      Buffer.from(encodedClaims, "base64url").toString("utf8")
    ) as { exp?: number; role?: string; sub?: string };
    if (
      typeof claims.exp !== "number" ||
      claims.exp * 1000 <= Date.now() ||
      claims.sub !== userId ||
      claims.role !== "authenticated"
    ) {
      throw new Error("The Supabase Clerk token has invalid claims.");
    }
    return NextResponse.json(
      { expiresAt: claims.exp * 1000, memberId: userId, token },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "O token de integração Clerk/Supabase é inválido." },
      { status: 503 }
    );
  }
};
