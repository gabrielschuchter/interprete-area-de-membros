import { database } from "@repo/database";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
} from "@/lib/mutation-reliability";
import {
  clearSearchHistory,
  getSearchHistory,
  recordSearchHistory,
  removeSearchHistoryEntry,
} from "@/lib/search-history";

export const dynamic = "force-dynamic";

const getActiveMemberId = async () => {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }
  const member = await database.member.findFirst({
    where: { id: userId, deactivatedAt: null },
    select: { id: true },
  });
  return member?.id ?? null;
};

const unauthorized = () =>
  NextResponse.json(
    { error: "Não autenticado" },
    { status: 401, headers: { "Cache-Control": "private, no-store" } }
  );

export const GET = async () => {
  const memberId = await getActiveMemberId();
  if (!memberId) {
    return unauthorized();
  }
  return NextResponse.json(
    { history: await getSearchHistory(memberId) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
};

export const POST = async (request: Request) => {
  const memberId = await getActiveMemberId();
  if (!memberId) {
    return unauthorized();
  }
  try {
    await consumeMutationRateLimit({
      action: "member.search-history",
      memberId,
    });
    const body = (await request.json()) as { query?: unknown };
    const history = await recordSearchHistory(memberId, body.query);
    return NextResponse.json(
      { history },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return NextResponse.json(
        {
          error: "Muitas buscas recentes. Tente novamente em alguns segundos.",
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "private, no-store",
            "Retry-After": String(error.retryAfterSeconds),
          },
        }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível guardar esta busca." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } }
    );
  }
};

export const DELETE = async (request: Request) => {
  const memberId = await getActiveMemberId();
  if (!memberId) {
    return unauthorized();
  }
  try {
    await consumeMutationRateLimit({
      action: "member.search-history",
      memberId,
    });
    const body = (await request.json()) as { id?: unknown };
    if (typeof body.id === "string") {
      await removeSearchHistoryEntry(memberId, body.id);
    } else {
      await clearSearchHistory(memberId);
    }
    return NextResponse.json(
      { history: await getSearchHistory(memberId) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível alterar o histórico." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } }
    );
  }
};
