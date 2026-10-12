import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
} from "@/lib/mutation-reliability";
import {
  getPlannerCalendarFeedItems,
  issuePlannerCalendarFeedToken,
  memberForPlannerCalendarFeedToken,
  serializePlannerCalendarFeed,
} from "@/lib/planner-calendar-feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "private, no-store" };

const activeMemberId = async () => {
  const { userId, memberSnapshot, memberDeactivated } = await auth();
  if (
    !userId ||
    memberDeactivated ||
    memberSnapshot?.onboardingStatus !== "COMPLETED"
  ) {
    return null;
  }
  return userId;
};

export const POST = async () => {
  const memberId = await activeMemberId();
  if (!memberId) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: noStore }
    );
  }
  try {
    await consumeMutationRateLimit({
      action: "member.planner-calendar-feed",
      memberId,
    });
    const token = await issuePlannerCalendarFeedToken(memberId);
    return NextResponse.json({ token }, { headers: noStore });
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return NextResponse.json(
        {
          error:
            "Muitas alterações no link de calendário. Aguarde alguns segundos.",
        },
        {
          status: 429,
          headers: {
            ...noStore,
            "Retry-After": String(error.retryAfterSeconds),
          },
        }
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar o link.",
      },
      { status: 400, headers: noStore }
    );
  }
};

export const GET = async (request: Request) => {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const memberId = await memberForPlannerCalendarFeedToken(token);
  if (!memberId) {
    return new Response("Calendário indisponível.", {
      status: 404,
      headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  try {
    const now = new Date();
    const rangeStart = new Date(now.getTime() - 14 * 86_400_000);
    const rangeEnd = new Date(now.getTime() + 180 * 86_400_000);
    const { items, timezone } = await getPlannerCalendarFeedItems(
      memberId,
      rangeStart,
      rangeEnd,
      new URL(request.url).origin
    );
    return new Response(serializePlannerCalendarFeed(items, timezone, now), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'inline; filename="interprete-calendario.ics"',
        "Content-Type": "text/calendar; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Calendário indisponível.", {
      status: 503,
      headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
};
