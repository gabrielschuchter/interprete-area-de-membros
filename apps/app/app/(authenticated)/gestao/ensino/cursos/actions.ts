"use server";

import { randomUUID } from "node:crypto";
import {
  database,
  LessonAssetKind,
  LessonAssetMediaProvider,
  LessonKind,
  type Prisma,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { sanitizeRichDocument } from "@/lib/community-content";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";
import { getYouTubeDataAdapter } from "@/lib/youtube-adapter";
import {
  verifyYouTubeVideo,
  type YouTubeVerificationResult,
} from "@/lib/youtube-verification";

export interface GestaoLessonSaveState {
  readonly assetExpectedUpdatedAt: string;
  readonly assetId: string | null;
  readonly expectedUpdatedAt: string;
  readonly idempotencyKey: string;
  readonly message: string;
  readonly status: "idle" | "saved" | "invalid" | "conflict" | "error";
}

class LessonVersionConflict extends Error {}

const formText = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const lineBreakPattern = /\r?\n/;
const lessonSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedYouTubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const parseOptionalSeconds = (value: string) => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 86_400
    ? parsed
    : Number.NaN;
};

const checkedAtFor = (
  status: YouTubeVerificationResult["status"],
  sameVideo: boolean,
  previousCheck: Date | null | undefined
) => {
  if (status !== "NOT_CONFIGURED") {
    return new Date();
  }
  return sameVideo ? (previousCheck ?? null) : null;
};

const youtubeSourceUrlFor = (sourceUrl: string, videoId: string | null) => {
  if (videoId) {
    return `https://youtu.be/${videoId}`;
  }
  try {
    const url = new URL(sourceUrl);
    return url.protocol === "https:" && allowedYouTubeHosts.has(url.hostname)
      ? url.toString().slice(0, 2000)
      : null;
  } catch {
    return null;
  }
};

const youtubeAssetFields = (
  verification: YouTubeVerificationResult,
  sourceUrl: string,
  startAtSeconds: number | null,
  endAtSeconds: number | null,
  sameVideo: boolean,
  current?: {
    readonly youtubeVideoTitle: string | null;
    readonly youtubeThumbnailUrl: string | null;
    readonly youtubePrivacyStatus: string | null;
    readonly youtubeEmbeddable: boolean | null;
    readonly youtubeCaptionsAvailable: boolean | null;
    readonly youtubeCheckedAt: Date | null;
    readonly durationSeconds: number | null;
  }
): Prisma.LessonAssetUpdateManyMutationInput => ({
  mediaProvider: LessonAssetMediaProvider.YOUTUBE,
  mediaExternalId: verification.videoId,
  externalUrl: null,
  youtubeSourceUrl: youtubeSourceUrlFor(sourceUrl, verification.videoId),
  youtubeVideoTitle:
    verification.metadata?.title ??
    (sameVideo ? current?.youtubeVideoTitle : null),
  youtubeThumbnailUrl:
    verification.metadata?.thumbnailUrl ??
    (sameVideo ? current?.youtubeThumbnailUrl : null),
  youtubePrivacyStatus:
    verification.metadata?.privacyStatus ??
    (sameVideo ? current?.youtubePrivacyStatus : null),
  youtubeEmbeddable:
    verification.metadata?.embeddable ??
    (sameVideo ? current?.youtubeEmbeddable : null),
  youtubeCaptionsAvailable:
    verification.metadata?.captionsAvailable ??
    (sameVideo ? current?.youtubeCaptionsAvailable : null),
  youtubeVerificationStatus: verification.status,
  youtubeCheckedAt: checkedAtFor(
    verification.status,
    sameVideo,
    current?.youtubeCheckedAt
  ),
  youtubeStartAtSeconds: startAtSeconds,
  youtubeEndAtSeconds: endAtSeconds,
  durationSeconds:
    verification.metadata?.durationSeconds ??
    (sameVideo ? current?.durationSeconds : null),
});

export const verifyGestaoYouTubeVideo = async (
  lessonId: string,
  videoUrl: string
) => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "youtube.verify",
    memberId: actor.userId,
  });

  if (!(lessonId.length > 0 && lessonId.length <= 128)) {
    return {
      status: "INVALID" as const,
      source: "TEST" as const,
      videoId: null,
      metadata: null,
    };
  }

  const lesson = await database.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true },
  });
  if (!lesson) {
    return {
      status: "INVALID" as const,
      source: "TEST" as const,
      videoId: null,
      metadata: null,
    };
  }

  const { adapter } = await getYouTubeDataAdapter();
  return verifyYouTubeVideo(videoUrl, adapter);
};

export const saveGestaoLesson = async (
  previousState: GestaoLessonSaveState,
  formData: FormData
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The action validates editor fields, verifies remote media, and coordinates the versioned write.
): Promise<GestaoLessonSaveState> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });

  const lessonId = formText(formData, "lessonId");
  const courseId = formText(formData, "courseId");
  const title = formText(formData, "title").slice(0, 180);
  const slug = formText(formData, "slug").toLowerCase();
  const description = formText(formData, "description").slice(0, 5000);
  const objectives = formText(formData, "objectives")
    .split(lineBreakPattern)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
  const kind = formText(formData, "kind");
  const expectedUpdatedAt = new Date(formText(formData, "expectedUpdatedAt"));
  const assetId = formText(formData, "assetId") || null;
  const assetExpectedUpdatedAtText = formText(
    formData,
    "assetExpectedUpdatedAt"
  );
  const assetExpectedUpdatedAt = assetExpectedUpdatedAtText
    ? new Date(assetExpectedUpdatedAtText)
    : null;
  const idempotencyKey = readIdempotencyKey(formData.get("idempotencyKey"));
  const providerValue = formText(formData, "mediaProvider");
  const provider = Object.values(LessonAssetMediaProvider).includes(
    providerValue as LessonAssetMediaProvider
  )
    ? (providerValue as LessonAssetMediaProvider)
    : null;
  const startAtSeconds = parseOptionalSeconds(
    formText(formData, "youtubeStartAtSeconds")
  );
  const endAtSeconds = parseOptionalSeconds(
    formText(formData, "youtubeEndAtSeconds")
  );

  const result = (
    status: GestaoLessonSaveState["status"],
    message: string
  ): GestaoLessonSaveState => ({
    ...previousState,
    status,
    message,
  });

  if (
    !(
      lessonId &&
      courseId &&
      title &&
      lessonSlugPattern.test(slug) &&
      Object.values(LessonKind).includes(kind as LessonKind) &&
      Number.isFinite(expectedUpdatedAt.valueOf()) &&
      idempotencyKey &&
      provider &&
      !Number.isNaN(startAtSeconds) &&
      !Number.isNaN(endAtSeconds) &&
      !(
        startAtSeconds !== null &&
        endAtSeconds !== null &&
        endAtSeconds <= startAtSeconds
      ) &&
      (assetId
        ? Number.isFinite(assetExpectedUpdatedAt?.valueOf())
        : !assetExpectedUpdatedAtText)
    )
  ) {
    return result("invalid", "Confira os campos da aula e tente novamente.");
  }

  let content: ReturnType<typeof sanitizeRichDocument> = null;
  try {
    content = sanitizeRichDocument(
      JSON.parse(formText(formData, "contentJson")) as unknown
    );
  } catch {
    return result("invalid", "O conteúdo da aula não pôde ser validado.");
  }
  if (!content) {
    return result("invalid", "O conteúdo da aula não pôde ser validado.");
  }

  const youtubeUrl = formText(formData, "youtubeUrl");
  const currentAsset = assetId
    ? await database.lessonAsset.findFirst({
        where: { id: assetId, lessonId },
        select: {
          id: true,
          updatedAt: true,
          mediaExternalId: true,
          youtubeVideoTitle: true,
          youtubeThumbnailUrl: true,
          youtubePrivacyStatus: true,
          youtubeEmbeddable: true,
          youtubeCaptionsAvailable: true,
          youtubeCheckedAt: true,
          durationSeconds: true,
        },
      })
    : null;
  if (assetId && !currentAsset) {
    return result("conflict", "O vídeo desta aula mudou. Recarregue a página.");
  }

  let mediaData: Prisma.LessonAssetUpdateManyMutationInput | null = null;
  if (provider === LessonAssetMediaProvider.YOUTUBE) {
    const { adapter } = await getYouTubeDataAdapter();
    const verification = await verifyYouTubeVideo(youtubeUrl, adapter);
    mediaData = youtubeAssetFields(
      verification,
      youtubeUrl,
      startAtSeconds,
      endAtSeconds,
      verification.videoId === currentAsset?.mediaExternalId,
      currentAsset ?? undefined
    );
  } else if (provider === LessonAssetMediaProvider.EXTERNAL_URL) {
    let externalUrl: string | null = null;
    try {
      const url = new URL(formText(formData, "externalUrl"));
      if (url.protocol === "http:" || url.protocol === "https:") {
        externalUrl = url.toString().slice(0, 2000);
      }
    } catch {
      // An invalid URL is reported as a form error below.
    }
    if (!externalUrl) {
      return result("invalid", "Informe uma URL externa válida.");
    }
    mediaData = {
      mediaProvider: LessonAssetMediaProvider.EXTERNAL_URL,
      mediaExternalId: null,
      externalUrl,
      youtubeSourceUrl: null,
      youtubeVideoTitle: null,
      youtubeThumbnailUrl: null,
      youtubePrivacyStatus: null,
      youtubeEmbeddable: null,
      youtubeCaptionsAvailable: null,
      youtubeVerificationStatus: null,
      youtubeCheckedAt: null,
      youtubeStartAtSeconds: null,
      youtubeEndAtSeconds: null,
      durationSeconds: null,
    };
  } else if (currentAsset) {
    mediaData = {
      mediaProvider: LessonAssetMediaProvider.STORAGE,
      mediaExternalId: null,
      externalUrl: null,
      youtubeSourceUrl: null,
      youtubeVideoTitle: null,
      youtubeThumbnailUrl: null,
      youtubePrivacyStatus: null,
      youtubeEmbeddable: null,
      youtubeCaptionsAvailable: null,
      youtubeVerificationStatus: null,
      youtubeCheckedAt: null,
      youtubeStartAtSeconds: null,
      youtubeEndAtSeconds: null,
      durationSeconds: currentAsset.durationSeconds,
    };
  }

  let currentAssetId = assetId;
  try {
    await database.$transaction(
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Version checks, lesson and asset writes, and the audit event share one transaction.
      async (transaction) => {
        const previousEvent = await transaction.domainEvent.findUnique({
          where: { idempotencyKey },
          select: { aggregateId: true },
        });
        if (previousEvent) {
          if (previousEvent.aggregateId !== lessonId) {
            throw new LessonVersionConflict();
          }
          return;
        }

        const currentLesson = await transaction.lesson.findFirst({
          where: { id: lessonId, module: { courseId } },
          select: { updatedAt: true },
        });
        if (
          !currentLesson ||
          currentLesson.updatedAt.getTime() !== expectedUpdatedAt.getTime()
        ) {
          throw new LessonVersionConflict();
        }

        if (assetId) {
          const assetStillCurrent = await transaction.lessonAsset.findFirst({
            where: {
              id: assetId,
              lessonId,
              updatedAt: assetExpectedUpdatedAt as Date,
            },
            select: { id: true },
          });
          if (!assetStillCurrent) {
            throw new LessonVersionConflict();
          }
        }

        const lessonUpdate = await transaction.lesson.updateMany({
          where: { id: lessonId, updatedAt: expectedUpdatedAt },
          data: {
            title,
            slug,
            description: description || null,
            objectives,
            content: content as Prisma.InputJsonValue,
            kind: kind as LessonKind,
            updatedBy: actor.userId,
          },
        });
        if (lessonUpdate.count !== 1) {
          throw new LessonVersionConflict();
        }

        if (mediaData && assetId) {
          const assetUpdate = await transaction.lessonAsset.updateMany({
            where: {
              id: assetId,
              lessonId,
              updatedAt: assetExpectedUpdatedAt as Date,
            },
            data: mediaData,
          });
          if (assetUpdate.count !== 1) {
            throw new LessonVersionConflict();
          }
        } else if (mediaData) {
          const createdAsset = await transaction.lessonAsset.create({
            data: {
              lessonId,
              title,
              kind: LessonAssetKind.VIDEO,
              ...mediaData,
            } as Prisma.LessonAssetUncheckedCreateInput,
          });
          currentAssetId = createdAsset.id;
        }

        await transaction.domainEvent.create({
          data: {
            eventType: "gestao.lesson.edited",
            actorId: actor.userId,
            aggregateType: "Lesson",
            aggregateId: lessonId,
            idempotencyKey,
            payload: {
              courseId,
              mediaProvider: provider,
              verificationStatus: mediaData?.youtubeVerificationStatus ?? null,
            },
            occurredAt: new Date(),
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if (
      error instanceof LessonVersionConflict ||
      isUniqueConstraintError(error) ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2034")
    ) {
      return result(
        "conflict",
        "A aula mudou em outra aba. Recarregue a versão atual antes de salvar."
      );
    }
    throw error;
  }

  const savedLesson = await database.lesson.findUnique({
    where: { id: lessonId },
    select: { updatedAt: true },
  });
  const savedAssetId = currentAssetId ?? assetId;
  const savedAsset = savedAssetId
    ? await database.lessonAsset.findUnique({
        where: { id: savedAssetId },
        select: { updatedAt: true },
      })
    : null;
  revalidatePath(`/gestao/ensino/cursos/${courseId}`);
  revalidatePath(`/gestao/ensino/cursos/${courseId}/aulas/${lessonId}`);
  revalidatePath("/aprender");

  return {
    ...previousState,
    status: "saved",
    message: "Alterações salvas.",
    expectedUpdatedAt: (savedLesson?.updatedAt ?? new Date()).toISOString(),
    assetId: savedAssetId,
    assetExpectedUpdatedAt: savedAsset?.updatedAt.toISOString() ?? "",
    idempotencyKey: randomUUID(),
  };
};
