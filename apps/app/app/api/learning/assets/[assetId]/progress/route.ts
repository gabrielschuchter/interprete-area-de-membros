import { database, LearningAssignmentTargetType, Prisma } from "@repo/database";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getAccessiblePlaybackAsset } from "@/lib/content-access";
import {
  markLearningAssignmentCompleted,
  markLearningAssignmentStarted,
} from "@/lib/learning-assignments";
import { completeLessonForMember } from "@/lib/lesson-completion";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
  mutationLog,
} from "@/lib/mutation-reliability";
import {
  createPlaybackWindow,
  deriveWatchedInterval,
  hasWatchedNinetyPercent,
  mergeWatchedIntervals,
  readPlaybackCheckpoint,
  updatePlaybackCheckpoints,
} from "@/lib/playback-progress";

const progressInput = z.object({
  positionMs: z.number().int().min(0).max(86_400_000),
  durationSeconds: z.number().int().min(0).max(86_400).nullable().optional(),
  playbackRate: z.number().min(0.25).max(2).default(1),
  checkpointOnly: z.boolean().default(false),
  sessionId: z.string().uuid(),
});

interface ProgressRouteProperties {
  readonly params: Promise<{ assetId: string }>;
}

const noStore = { "Cache-Control": "private, no-store" };
const unboundedPlaybackWindow = { startMs: 0, endMs: 86_400_000 };

const canRetryTransaction = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error.code === "P2034" || error.code === "P2002");

type PlaybackInput = z.infer<typeof progressInput>;

interface PersistPlaybackParameters {
  readonly assetId: string;
  readonly durationSeconds: number | null;
  readonly input: PlaybackInput;
  readonly intervalWindow: { endMs: number; startMs: number };
  readonly memberId: string;
  readonly playbackWindow: { endMs: number; startMs: number } | null;
  readonly positionMs: number;
}

const persistPlaybackProgressOnce = async ({
  assetId,
  durationSeconds,
  intervalWindow,
  memberId,
  playbackWindow,
  input,
  positionMs,
}: PersistPlaybackParameters) =>
  database.$transaction(
    async (transaction) => {
      const existing = await transaction.playbackProgress.findUnique({
        where: { memberId_assetId: { memberId, assetId } },
        select: {
          watchedIntervals: true,
          playbackSessions: true,
          completedPlaybackAt: true,
        },
      });
      const sampledAtMs = Date.now();
      const currentCheckpoint = { positionMs, sampledAtMs };
      const previousCheckpoint = readPlaybackCheckpoint(
        existing?.playbackSessions,
        input.sessionId,
        sampledAtMs
      );
      const newInterval = deriveWatchedInterval(
        previousCheckpoint,
        currentCheckpoint,
        input.playbackRate,
        input.checkpointOnly
      );
      const intervals = mergeWatchedIntervals(
        existing?.watchedIntervals,
        newInterval,
        intervalWindow
      );
      const completed = hasWatchedNinetyPercent(intervals, playbackWindow);
      const checkpoints = updatePlaybackCheckpoints(
        existing?.playbackSessions,
        input.sessionId,
        currentCheckpoint
      );
      const intervalsJson = intervals.map(({ fromMs, toMs }) => ({
        fromMs,
        toMs,
      })) as Prisma.InputJsonValue;
      const checkpointsJson = Object.fromEntries(
        Object.entries(checkpoints).map(([id, checkpoint]) => [
          id,
          {
            positionMs: checkpoint.positionMs,
            sampledAtMs: checkpoint.sampledAtMs,
          },
        ])
      ) as Prisma.InputJsonValue;
      const progress = await transaction.playbackProgress.upsert({
        where: { memberId_assetId: { memberId, assetId } },
        create: {
          memberId,
          assetId,
          positionSeconds: Math.floor(positionMs / 1000),
          durationSeconds,
          watchedIntervals: intervalsJson,
          playbackSessions: checkpointsJson,
          completedPlaybackAt: completed ? new Date(sampledAtMs) : null,
        },
        update: {
          positionSeconds: Math.floor(positionMs / 1000),
          durationSeconds,
          watchedIntervals: intervalsJson,
          playbackSessions: checkpointsJson,
          lastViewedAt: new Date(sampledAtMs),
          completedPlaybackAt: completed
            ? (existing?.completedPlaybackAt ?? new Date(sampledAtMs))
            : null,
        },
        select: {
          positionSeconds: true,
          durationSeconds: true,
          lastViewedAt: true,
          completedPlaybackAt: true,
        },
      });
      return { progress, completed };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

const persistPlaybackProgress = async (
  parameters: PersistPlaybackParameters
) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await persistPlaybackProgressOnce(parameters);
    } catch (error) {
      if (attempt === 2 || !canRetryTransaction(error)) {
        throw error;
      }
    }
  }
  throw new Error("Playback progress transaction did not complete.");
};

export const GET = async (
  _request: Request,
  { params }: ProgressRouteProperties
) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { assetId } = await params;
  const asset = await getAccessiblePlaybackAsset(assetId, userId);
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
    const asset = await getAccessiblePlaybackAsset(assetId, userId);
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
      asset.durationSeconds ?? parsed.data.durationSeconds ?? null;
    const durationMs =
      durationSeconds !== null && durationSeconds > 0
        ? durationSeconds * 1000
        : null;
    const positionMs = Math.min(
      parsed.data.positionMs,
      durationMs ?? parsed.data.positionMs
    );
    const playbackWindow = createPlaybackWindow(
      durationSeconds,
      asset.youtubeStartAtSeconds,
      asset.youtubeEndAtSeconds
    );
    const intervalWindow = playbackWindow ?? {
      startMs: Math.min(
        Math.max(0, (asset.youtubeStartAtSeconds ?? 0) * 1000),
        unboundedPlaybackWindow.endMs
      ),
      endMs: unboundedPlaybackWindow.endMs,
    };

    const saved = await persistPlaybackProgress({
      assetId,
      durationSeconds,
      intervalWindow,
      memberId: userId,
      playbackWindow,
      input: parsed.data,
      positionMs,
    });

    const at = new Date();
    const recordingId = asset.importedRecording?.id;
    if (recordingId) {
      await markLearningAssignmentStarted(
        userId,
        LearningAssignmentTargetType.RECORDING,
        recordingId,
        at
      );
      if (saved.completed) {
        await markLearningAssignmentCompleted(
          userId,
          LearningAssignmentTargetType.RECORDING,
          recordingId,
          at
        );
      }
    }

    await markLearningAssignmentStarted(
      userId,
      LearningAssignmentTargetType.ASSET,
      assetId,
      at
    );
    if (saved.completed) {
      await markLearningAssignmentCompleted(
        userId,
        LearningAssignmentTargetType.ASSET,
        assetId,
        at
      );
    }

    if (saved.completed && !recordingId) {
      await completeLessonForMember(userId, asset.lesson.id);
    }

    mutationLog({
      action: "learning.playback",
      memberId: userId,
      resource: assetId,
      status: "success",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { progress: saved.progress },
      { headers: noStore }
    );
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
