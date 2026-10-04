import { randomUUID } from "node:crypto";
import { notificationOutboxConsumerKey } from "@repo/member-domain";
import { processOutboxBatch } from "@repo/member-domain/server";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { notificationOutboxConsumer } from "@/lib/notification-outbox-consumer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const processOutbox = async (request: Request) => {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "O processamento agendado não está configurado." },
      { status: 503 }
    );
  }
  if (!isAuthorizedCronRequest(request, secret)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "O banco de dados não está configurado." },
      { status: 503 }
    );
  }

  try {
    const { database } = await import("@repo/database");
    const result = await processOutboxBatch(
      database,
      { [notificationOutboxConsumerKey]: notificationOutboxConsumer },
      { workerId: randomUUID() }
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error(
      "[cron/outbox] batch processing failed",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json(
      { error: "Não foi possível processar a fila agora." },
      { status: 500 }
    );
  }
};

export const GET = processOutbox;
export const POST = processOutbox;
