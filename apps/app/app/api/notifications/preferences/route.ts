import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
} from "@/lib/mutation-reliability";
import { getOrCreateNotificationPreferences } from "@/lib/notifications";

const preferenceKeys = [
  "mentions",
  "commentReplies",
  "topicComments",
  "followedTopicActivity",
  "lessonAvailable",
  "moduleAvailable",
  "activityAssigned",
  "feedbackReceived",
  "activityDeadline",
  "announcements",
] as const;

const preferenceInput = z.object(
  Object.fromEntries(
    preferenceKeys.map((key) => [key, z.boolean().optional()])
  ) as Record<(typeof preferenceKeys)[number], z.ZodOptional<z.ZodBoolean>>
);

export const GET = async () => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const preferences = await getOrCreateNotificationPreferences(userId);
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("Notification preferences lookup failed", error);
    return NextResponse.json(
      { error: "Não foi possível carregar suas preferências." },
      { status: 500 }
    );
  }
};

export const PUT = async (request: Request) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    await consumeMutationRateLimit({
      action: "notification.mutation",
      memberId: userId,
    });
    const parsed = preferenceInput.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Preferência inválida." },
        { status: 400 }
      );
    }
    const preferences = await database.notificationPreference.upsert({
      where: { memberId: userId },
      create: { memberId: userId, ...parsed.data },
      update: parsed.data,
    });
    return NextResponse.json({ preferences });
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return NextResponse.json(
        { error: "Você está fazendo muitas alterações em sequência." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        }
      );
    }
    console.error("Notification preferences update failed", error);
    return NextResponse.json(
      { error: "Não foi possível salvar sua preferência." },
      { status: 500 }
    );
  }
};
