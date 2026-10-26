import { isAuthorizedCronRequest } from "@repo/security/cron-auth";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { cleanupExpiredGestaoLessonVideoUploads } from "@/lib/gestao-lesson-video-upload-actions";
import { publishDueGestaoMeetings } from "@/lib/gestao-meetings-schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "O processamento agendado não está configurado." },
      { status: 503 }
    );
  }
  if (!isAuthorizedCronRequest(request, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await cleanupExpiredGestaoLessonVideoUploads();
    // Rotina diária da Gestão: publica também os encontros agendados.
    const meetingsPublished = await publishDueGestaoMeetings();
    return NextResponse.json(
      { ...result, meetingsPublished },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    console.error(
      "[cron/gestao-video-upload-cleanup] batch failed",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json(
      { error: "Não foi possível limpar os envios expirados." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
