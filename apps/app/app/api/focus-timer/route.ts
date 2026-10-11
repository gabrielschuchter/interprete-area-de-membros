import { FocusTimerMode } from "@repo/database";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  addManualFocusTimerSession,
  claimFocusTimer,
  deleteFocusTimerHistorySession,
  getActiveFocusTimerState,
  getFocusTimerState,
  linkFocusTimer,
  pauseFocusTimer,
  resumeFocusTimer,
  reviewFocusTimerSession,
  saveFocusTimerSettings,
  startFocusTimer,
  stopFocusTimer,
  updateFocusTimerHistorySession,
} from "@/lib/focus-timer";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
} from "@/lib/mutation-reliability";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    clientId: z.string().uuid(),
    mode: z.nativeEnum(FocusTimerMode),
    durationSeconds: z.number().int().min(1).max(86_400).nullable().optional(),
    linkedResourceType: z.literal("LESSON").nullable().optional(),
    linkedResourceId: z.string().trim().max(255).nullable().optional(),
    title: z.string().trim().max(180).nullable().optional(),
  }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("stop") }),
  z.object({
    action: z.literal("claim"),
    sessionId: z.string().trim().min(1).max(255),
    clientId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("link"),
    linkedResourceId: z.string().trim().max(255).nullable(),
  }),
  z.object({
    action: z.literal("review"),
    id: z.string().min(1).max(255),
    note: z.string().trim().max(4000),
    saveStudy: z.boolean(),
  }),
  z.object({ action: z.literal("history-add"), session: z.unknown() }),
  z.object({ action: z.literal("history-update"), session: z.unknown() }),
  z.object({
    action: z.literal("history-delete"),
    id: z.string().min(1).max(255),
  }),
  z.object({
    action: z.literal("settings"),
    settings: z.unknown(),
  }),
]);

const memberForRequest = async () => {
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

const noStore = { "Cache-Control": "private, no-store" };

export const GET = async (request: Request) => {
  const memberId = await memberForRequest();
  if (!memberId) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: noStore }
    );
  }
  const compact = new URL(request.url).searchParams.get("compact") === "1";
  return NextResponse.json(
    compact
      ? await getActiveFocusTimerState(memberId)
      : await getFocusTimerState(memberId),
    { headers: noStore }
  );
};

export const POST = async (request: Request) => {
  const memberId = await memberForRequest();
  if (!memberId) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: noStore }
    );
  }
  try {
    await consumeMutationRateLimit({ action: "member.focus-timer", memberId });
    const action = actionSchema.parse(await request.json());
    let result: unknown;
    switch (action.action) {
      case "start":
        result = await startFocusTimer(memberId, action);
        break;
      case "pause":
        result = await pauseFocusTimer(memberId);
        break;
      case "resume":
        result = await resumeFocusTimer(memberId);
        break;
      case "stop":
        result = await stopFocusTimer(memberId);
        break;
      case "claim":
        result = await claimFocusTimer(
          memberId,
          action.sessionId,
          action.clientId
        );
        break;
      case "link":
        result = await linkFocusTimer(memberId, action.linkedResourceId);
        break;
      case "review":
        result = await reviewFocusTimerSession(memberId, action);
        break;
      case "history-add":
        result = await addManualFocusTimerSession(memberId, action.session);
        break;
      case "history-update":
        result = await updateFocusTimerHistorySession(memberId, action.session);
        break;
      case "history-delete":
        result = await deleteFocusTimerHistorySession(memberId, action.id);
        break;
      case "settings":
        result = await saveFocusTimerSettings(memberId, action.settings);
        break;
      default: {
        const unreachableAction: never = action;
        throw new Error(
          `Ação de cronômetro desconhecida: ${unreachableAction}`
        );
      }
    }
    return NextResponse.json({ result }, { headers: noStore });
  } catch (error) {
    const conflict =
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "P2002" || error.code === "P2034");
    if (conflict) {
      return NextResponse.json(
        {
          error:
            "O cronômetro mudou em outra sessão. Atualize e tente novamente.",
        },
        { status: 409, headers: noStore }
      );
    }
    if (isMutationRateLimitError(error)) {
      return NextResponse.json(
        { error: "Muitas alterações no cronômetro. Aguarde alguns segundos." },
        {
          status: 429,
          headers: {
            ...noStore,
            "Retry-After": String(error.retryAfterSeconds),
          },
        }
      );
    }
    const message =
      error instanceof Error ? error.message : "Não foi possível salvar.";
    const status = message.includes("Já existe") ? 409 : 400;
    return NextResponse.json({ error: message }, { status, headers: noStore });
  }
};
