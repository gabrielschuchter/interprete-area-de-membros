import { database, LearningAssignmentTargetType } from "@repo/database";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getAccessibleRecording } from "@/lib/content-access";
import {
  markLearningAssignmentCompleted,
  markLearningAssignmentStarted,
} from "@/lib/learning-assignments";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
  mutationLog,
} from "@/lib/mutation-reliability";

const progressInput = z.object({
  positionSeconds: z.number().int().min(0).max(86_400),
  durationSeconds: z.number().int().min(0).max(86_400).nullable().optional(),
  completed: z.boolean().optional(),
});

interface ProgressRouteProperties {
  readonly params: Promise<{ assetId: string }>;
}

const noStore = { "Cache-Control": "private, no-store" };

export const GET = async (
  _request: Request,
  { params }: ProgressRouteProperties
) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { assetId } = await params;
  const asset = await getAccessibleRecording(assetId, userId);
  if (!asset) {
    return NextResponse.json(
      { error: "Material não encontrado." },
      { status: 404 }
    );
  }

  const progress = await database.playbackProgress.findUnique({
    where: { memberId_assetId: { memberId: userId, assetId } },
    select: {
      positionSeconds: true,
      durationSeconds: true,
      lastViewedAt: true,
      completedPlaybackAt: true,
    },
  });

  return NextResponse.json({ progress }, { headers: noStore });
};

export const PUT = async (
  request: Request,
  { params }: ProgressRouteProperties
) => {
  const startedAt = Date.now();
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { assetId } = await params;
  try {
    await consumeMutationRateLimit({
      action: "learning.playback",
      memberId: userId,
    });
    const asset = await getAccessibleRecording(assetId, userId);
    if (!asset) {
      return NextResponse.json(
        { error: "Material não encontrado." },
        { status: 404 }
      );
    }

    const parsed = progressInput.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Posição de reprodução inválida." },
        { status: 400 }
      );
    }

    const durationSeconds =
      parsed.data.durationSeconds ?? asset.durationSeconds ?? null;
    const positionSeconds = durationSeconds
      ? Math.min(parsed.data.positionSeconds, durationSeconds)
      : parsed.data.positionSeconds;
    const completed =
      parsed.data.completed === true ||
      (durationSeconds !== null &&
        durationSeconds > 0 &&
        positionSeconds >= Math.floor(durationSeconds * 0.95));

    const progress = await database.playbackProgress.upsert({
      where: { memberId_assetId: { memberId: userId, assetId } },
      create: {
        memberId: userId,
        assetId,
        positionSeconds,
        durationSeconds,
        completedPlaybackAt: completed ? new Date() : null,
      },
      update: {
        positionSeconds,
        durationSeconds,
        lastViewedAt: new Date(),
        ...(completed ? { completedPlaybackAt: new Date() } : {}),
      },
      select: {
        positionSeconds: true,
        durationSeconds: true,
        lastViewedAt: true,
        completedPlaybackAt: true,
      },
    });

    const recordingId = asset.importedRecording?.id;
    if (recordingId) {
      const at = new Date();
      await markLearningAssignmentStarted(
        userId,
        LearningAssignmentTargetType.RECORDING,
        recordingId,
        at
      );
      if (completed) {
        await markLearningAssignmentCompleted(
          userId,
          LearningAssignmentTargetType.RECORDING,
          recordingId,
          at
        );
      }
    }

    mutationLog({
      action: "learning.playback",
      memberId: userId,
      resource: assetId,
      status: "success",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ progress }, { headers: noStore });
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return NextResponse.json(
        { error: "Você está fazendo muitas ações em sequência." },
        {
          status: 429,
          headers: {
            ...noStore,
            "Retry-After": String(error.retryAfterSeconds),
          },
        }
      );
    }
    mutationLog({
      action: "learning.playback",
      memberId: userId,
      resource: assetId,
      status: "error",
      durationMs: Date.now() - startedAt,
    });
    console.error("Playback progress update failed", error);
    return NextResponse.json(
      { error: "Não foi possível salvar sua posição agora." },
      { status: 500, headers: noStore }
    );
  }
};
