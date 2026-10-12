import { env } from "@/env";
import {
  readCohortCalendarFeed,
  serializeCohortCalendarFeed,
} from "@/lib/cohort-calendar-feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "private, no-store" };

export const GET = async (request: Request) => {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const now = new Date();
  try {
    const feed = await readCohortCalendarFeed(
      token,
      {
        start: new Date(now.getTime() - 14 * 86_400_000),
        end: new Date(now.getTime() + 180 * 86_400_000),
      },
      env.NEXT_PUBLIC_APP_URL
    );
    if (!feed) {
      return new Response("Calendário indisponível.", {
        status: 404,
        headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return new Response(
      serializeCohortCalendarFeed(feed.items, feed.timezone, feed.name, now),
      {
        headers: {
          ...noStore,
          "Content-Disposition": 'inline; filename="interprete-turma.ics"',
          "Content-Type": "text/calendar; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch {
    return new Response("Calendário indisponível.", {
      status: 503,
      headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
};
