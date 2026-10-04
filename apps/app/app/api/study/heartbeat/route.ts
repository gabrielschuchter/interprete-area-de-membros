import { database, StudyActivityKind } from "@repo/database";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
} from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";
import { recordStudyHeartbeat } from "@/lib/study-tracking";

const heartbeatInput = z.object({
  active: z.boolean(),
  activityKind: z.nativeEnum(StudyActivityKind),
  clientSessionId: z.string().uuid(),
  isPlayback: z.boolean(),
  resourceId: z.string().trim().min(1).max(255),
  sequence: z.number().int().min(0).max(2_000_000_000),
});

const headers = { "Cache-Control": "private, no-store" };

export const POST = async (request: Request) => {
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

  const parsed = heartbeatInput.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Sinal de estudo inválido" },
      { status: 400, headers }
    );
  }
  if (
    parsed.data.isPlayback &&
    parsed.data.activityKind !== StudyActivityKind.LESSON &&
    parsed.data.activityKind !== StudyActivityKind.RECORDING
  ) {
    return NextResponse.json(
      { error: "Tipo de reprodução inválido" },
      { status: 400, headers }
    );
  }

  try {
    const rateLimit = await consumeMutationRateLimit({
      action: "study.heartbeat",
      memberId: member.id,
    });
    const result = await recordStudyHeartbeat(member.id, parsed.data);
    if (result.seconds >= 10) {
      await dispatchPendingNotifications();
    }
    return NextResponse.json(result, {
      headers: {
        ...headers,
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return NextResponse.json(
        { error: "Muitos sinais de estudo em sequência." },
        {
          headers: {
            ...headers,
            "Retry-After": String(error.retryAfterSeconds),
          },
          status: 429,
        }
      );
    }
    console.error("Study heartbeat failed", error);
    return NextResponse.json(
      { error: "Não foi possível registrar este intervalo de estudo." },
      { status: 503, headers }
    );
  }
};
