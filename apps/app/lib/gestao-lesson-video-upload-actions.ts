import "server-only";

import { randomUUID } from "node:crypto";
import {
  database,
  LessonAssetKind,
  LessonAssetUploadStatus,
} from "@repo/database";
import { z } from "zod";
import {
  createGestaoVideoUploadToken,
  deleteGestaoVideoStorageObject,
  GESTAO_VIDEO_UPLOAD_SESSION_TTL_MS,
  gestaoVideoExtension,
  gestaoVideoUploadLimit,
  hasValidGestaoVideoStorageSignature,
  inspectGestaoVideoStorageObject,
  isGestaoVideoMimeType,
  normalizeGestaoVideoFileName,
} from "./gestao-lesson-video-upload";

const createInputSchema = z.object({
  assetExpectedUpdatedAt: z.string().datetime().nullable(),
  assetId: z.string().min(1).max(128).nullable(),
  courseId: z.string().min(1).max(128),
  fileName: z.string().min(1).max(512),
  idempotencyKey: z.string().uuid(),
  lessonId: z.string().min(1).max(128),
  mimeType: z.string().max(128),
  sizeBytes: z.number().int().positive().safe(),
});

export type CreateGestaoLessonVideoUploadInput = z.infer<
  typeof createInputSchema
>;

export type LessonVideoUploadFaultCode =
  | "CONFLICT"
  | "EXPIRED"
  | "INVALID"
  | "NOT_CONFIGURED"
  | "NOT_FOUND"
  | "TOO_LARGE"
  | "UNAVAILABLE";

export class LessonVideoUploadFault extends Error {
  readonly code: LessonVideoUploadFaultCode;
  readonly status: number;

  constructor(
    code: LessonVideoUploadFaultCode,
    message: string,
    status: number
  ) {
    super(message);
    this.name = "LessonVideoUploadFault";
    this.code = code;
    this.status = status;
  }
}

export const parseCreateGestaoLessonVideoUploadInput = (input: unknown) => {
  const parsed = createInputSchema.safeParse(input);
  if (!(parsed.success && isGestaoVideoMimeType(parsed.data.mimeType))) {
    return null;
  }
  const value = parsed.data;
  if (
    Boolean(value.assetId) !== Boolean(value.assetExpectedUpdatedAt) ||
    value.sizeBytes > gestaoVideoUploadLimit()
  ) {
    return null;
  }
  return value as CreateGestaoLessonVideoUploadInput & {
    mimeType: import("./gestao-lesson-video-upload").GestaoVideoMimeType;
  };
};

const normalizeVideoMimeType = (value: string) => {
  if (!isGestaoVideoMimeType(value)) {
    throw new LessonVideoUploadFault(
      "INVALID",
      "Escolha um vídeo MP4 ou WebM.",
      400
    );
  }
  return value;
};

const matchesExpectedAsset = (
  current: { readonly id: string; readonly updatedAt: Date } | null,
  expectedAssetId: string | null,
  expectedAssetUpdatedAt: Date | null
) => {
  if ((current?.id ?? null) !== expectedAssetId) {
    return false;
  }
  if (!current) {
    return !expectedAssetUpdatedAt;
  }
  return (
    expectedAssetUpdatedAt !== null &&
    current.updatedAt.getTime() === expectedAssetUpdatedAt.getTime()
  );
};

const assertUploadTargetIsCurrent = async ({
  courseId,
  expectedAssetId,
  expectedAssetUpdatedAt,
  lessonId,
}: {
  readonly courseId?: string;
  readonly expectedAssetId: string | null;
  readonly expectedAssetUpdatedAt: Date | null;
  readonly lessonId: string;
}) => {
  const lesson = await database.lesson.findFirst({
    where: {
      id: lessonId,
      ...(courseId ? { module: { courseId } } : {}),
    },
    select: { id: true },
  });
  if (!lesson) {
    throw new LessonVideoUploadFault(
      "NOT_FOUND",
      "A aula não está disponível para edição.",
      404
    );
  }

  const current = await database.lessonAsset.findFirst({
    where: { lessonId, kind: LessonAssetKind.VIDEO },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, updatedAt: true },
  });
  if (!matchesExpectedAsset(current, expectedAssetId, expectedAssetUpdatedAt)) {
    throw new LessonVideoUploadFault(
      "CONFLICT",
      "O vídeo da aula mudou. Recarregue a versão atual antes de enviar outro arquivo.",
      409
    );
  }
};

const uploadTokenFor = async (storagePath: string) => {
  const token = await createGestaoVideoUploadToken(storagePath);
  if (!token) {
    throw new LessonVideoUploadFault(
      "NOT_CONFIGURED",
      "O Storage privado não está configurado para receber vídeos.",
      503
    );
  }
  return token;
};

const terminalUploadStatuses = [
  LessonAssetUploadStatus.CANCELLED,
  LessonAssetUploadStatus.EXPIRED,
  LessonAssetUploadStatus.FAILED,
];

const deleteAndRecordStorageObject = async ({
  uploadId,
  storagePath,
}: {
  readonly uploadId: string;
  readonly storagePath: string;
}) => {
  const deleted = await deleteGestaoVideoStorageObject(storagePath);
  if (deleted) {
    await database.lessonAssetUpload.updateMany({
      where: {
        id: uploadId,
        storageDeletedAt: null,
        status: { in: terminalUploadStatuses },
      },
      data: { storageDeletedAt: new Date() },
    });
  }
  return deleted;
};

const expireUploadSession = async ({
  actorId,
  uploadId,
  storagePath,
}: {
  readonly actorId: string;
  readonly uploadId: string;
  readonly storagePath: string;
}) => {
  const expired = await database.lessonAssetUpload.updateMany({
    where: {
      id: uploadId,
      actorId,
      status: {
        in: [LessonAssetUploadStatus.PENDING, LessonAssetUploadStatus.READY],
      },
      expiresAt: { lte: new Date() },
      storageDeletedAt: null,
    },
    data: { status: LessonAssetUploadStatus.EXPIRED },
  });
  if (expired.count !== 1) {
    return false;
  }
  await deleteAndRecordStorageObject({ uploadId, storagePath });
  return true;
};

const uploadSessionSelect = {
  id: true,
  lessonId: true,
  expectedAssetId: true,
  expectedAssetUpdatedAt: true,
  originalFileName: true,
  mimeType: true,
  sizeBytes: true,
  storagePath: true,
  status: true,
  expiresAt: true,
  assetId: true,
} as const;

const sessionResponse = async (
  session: {
    readonly id: string;
    readonly storagePath: string;
    readonly originalFileName: string;
    readonly mimeType: string;
    readonly sizeBytes: bigint;
    readonly status: LessonAssetUploadStatus;
    readonly expiresAt: Date;
    readonly expectedAssetId: string | null;
    readonly expectedAssetUpdatedAt: Date | null;
  },
  includeToken: boolean
) => {
  const token = includeToken ? await uploadTokenFor(session.storagePath) : null;
  return {
    assetExpectedUpdatedAt:
      session.expectedAssetUpdatedAt?.toISOString() ?? null,
    assetId: session.expectedAssetId,
    bucket: token?.bucket ?? null,
    endpoint: token?.endpoint ?? null,
    expiresAt: session.expiresAt.toISOString(),
    fileName: session.originalFileName,
    id: session.id,
    maxSizeBytes: gestaoVideoUploadLimit(),
    mimeType: session.mimeType,
    publishableKey: token?.publishableKey ?? null,
    sizeBytes: Number(session.sizeBytes),
    status: session.status,
    storagePath: session.storagePath,
    token: token?.token ?? null,
  };
};

const handleExistingUploadSession = async ({
  actorId,
  expectedAssetUpdatedAt,
  fileName,
  input,
  session,
}: {
  readonly actorId: string;
  readonly expectedAssetUpdatedAt: Date | null;
  readonly fileName: string;
  readonly input: CreateGestaoLessonVideoUploadInput;
  readonly session: {
    readonly id: string;
    readonly lessonId: string;
    readonly expectedAssetId: string | null;
    readonly expectedAssetUpdatedAt: Date | null;
    readonly originalFileName: string;
    readonly mimeType: string;
    readonly sizeBytes: bigint;
    readonly storagePath: string;
    readonly status: LessonAssetUploadStatus;
    readonly expiresAt: Date;
    readonly assetId: string | null;
  };
}) => {
  const sameIntent =
    session.lessonId === input.lessonId &&
    session.expectedAssetId === input.assetId &&
    session.expectedAssetUpdatedAt?.getTime() ===
      expectedAssetUpdatedAt?.getTime() &&
    session.originalFileName === fileName &&
    session.mimeType === input.mimeType &&
    session.sizeBytes === BigInt(input.sizeBytes);
  if (!sameIntent) {
    throw new LessonVideoUploadFault(
      "CONFLICT",
      "Esta chave de envio já foi usada com outro arquivo.",
      409
    );
  }
  if (session.status === LessonAssetUploadStatus.COMPLETED) {
    return sessionResponse(session, false);
  }
  if (
    session.status === LessonAssetUploadStatus.PENDING ||
    session.status === LessonAssetUploadStatus.READY
  ) {
    if (session.expiresAt.getTime() <= Date.now()) {
      await expireUploadSession({
        actorId,
        uploadId: session.id,
        storagePath: session.storagePath,
      });
      throw new LessonVideoUploadFault(
        "EXPIRED",
        "O prazo deste envio terminou. Inicie um novo envio.",
        410
      );
    }
    if (session.status === LessonAssetUploadStatus.READY) {
      return sessionResponse(session, false);
    }
  } else {
    throw new LessonVideoUploadFault(
      session.status === LessonAssetUploadStatus.EXPIRED
        ? "EXPIRED"
        : "CONFLICT",
      "Este envio não pode ser retomado. Selecione o arquivo novamente.",
      409
    );
  }
  await assertUploadTargetIsCurrent({
    courseId: input.courseId,
    expectedAssetId: session.expectedAssetId,
    expectedAssetUpdatedAt: session.expectedAssetUpdatedAt,
    lessonId: session.lessonId,
  });
  return sessionResponse(session, true);
};

export const createGestaoLessonVideoUpload = async ({
  actorId,
  input,
}: {
  readonly actorId: string;
  readonly input: CreateGestaoLessonVideoUploadInput;
}) => {
  const mimeType = normalizeVideoMimeType(input.mimeType);
  const expectedAssetUpdatedAt = input.assetExpectedUpdatedAt
    ? new Date(input.assetExpectedUpdatedAt)
    : null;
  const fileName = normalizeGestaoVideoFileName(input.fileName).slice(0, 255);
  const uniqueIntent = {
    actorId_idempotencyKey: {
      actorId,
      idempotencyKey: input.idempotencyKey,
    },
  };
  const previous = await database.lessonAssetUpload.findUnique({
    where: uniqueIntent,
    select: uploadSessionSelect,
  });

  if (previous) {
    return handleExistingUploadSession({
      actorId,
      expectedAssetUpdatedAt,
      fileName,
      input,
      session: previous,
    });
  }

  await assertUploadTargetIsCurrent({
    courseId: input.courseId,
    expectedAssetId: input.assetId,
    expectedAssetUpdatedAt,
    lessonId: input.lessonId,
  });

  const now = Date.now();
  let session: {
    readonly id: string;
    readonly storagePath: string;
    readonly originalFileName: string;
    readonly mimeType: string;
    readonly sizeBytes: bigint;
    readonly status: LessonAssetUploadStatus;
    readonly expiresAt: Date;
    readonly expectedAssetId: string | null;
    readonly expectedAssetUpdatedAt: Date | null;
  };
  try {
    session = await database.lessonAssetUpload.create({
      data: {
        id: randomUUID(),
        actorId,
        idempotencyKey: input.idempotencyKey,
        lessonId: input.lessonId,
        expectedAssetId: input.assetId,
        expectedAssetUpdatedAt,
        storagePath: `lesson-videos/${randomUUID()}.${gestaoVideoExtension(mimeType)}`,
        originalFileName: fileName,
        mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        status: LessonAssetUploadStatus.PENDING,
        expiresAt: new Date(now + GESTAO_VIDEO_UPLOAD_SESSION_TTL_MS),
      },
      select: {
        id: true,
        storagePath: true,
        originalFileName: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        expiresAt: true,
        expectedAssetId: true,
        expectedAssetUpdatedAt: true,
      },
    });
  } catch (error) {
    const concurrent = await database.lessonAssetUpload.findUnique({
      where: uniqueIntent,
      select: uploadSessionSelect,
    });
    if (!concurrent) {
      throw error;
    }
    return handleExistingUploadSession({
      actorId,
      expectedAssetUpdatedAt,
      fileName,
      input,
      session: concurrent,
    });
  }
  return sessionResponse(session, true);
};

export const resumeGestaoLessonVideoUpload = async ({
  actorId,
  uploadId,
}: {
  readonly actorId: string;
  readonly uploadId: string;
}) => {
  const session = await database.lessonAssetUpload.findFirst({
    where: { id: uploadId, actorId },
    select: {
      id: true,
      lessonId: true,
      expectedAssetId: true,
      expectedAssetUpdatedAt: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      storagePath: true,
      status: true,
      expiresAt: true,
    },
  });
  if (!session) {
    throw new LessonVideoUploadFault(
      "NOT_FOUND",
      "O envio não foi encontrado.",
      404
    );
  }
  if (session.status === LessonAssetUploadStatus.COMPLETED) {
    return sessionResponse(session, false);
  }
  if (
    session.status === LessonAssetUploadStatus.PENDING ||
    session.status === LessonAssetUploadStatus.READY
  ) {
    if (session.expiresAt.getTime() <= Date.now()) {
      await expireUploadSession({
        actorId,
        uploadId: session.id,
        storagePath: session.storagePath,
      });
      throw new LessonVideoUploadFault(
        "EXPIRED",
        "O prazo deste envio terminou. Inicie um novo envio.",
        410
      );
    }
    if (session.status === LessonAssetUploadStatus.READY) {
      return sessionResponse(session, false);
    }
  } else {
    throw new LessonVideoUploadFault(
      session.status === LessonAssetUploadStatus.EXPIRED
        ? "EXPIRED"
        : "CONFLICT",
      "Este envio não pode ser retomado.",
      409
    );
  }
  await assertUploadTargetIsCurrent({
    // The session binds the lesson and actor; no client course id is trusted here.
    expectedAssetId: session.expectedAssetId,
    expectedAssetUpdatedAt: session.expectedAssetUpdatedAt,
    lessonId: session.lessonId,
  });
  return sessionResponse(session, true);
};

export const finalizeGestaoLessonVideoUpload = async ({
  actorId,
  uploadId,
}: {
  readonly actorId: string;
  readonly uploadId: string;
}) => {
  const session = await database.lessonAssetUpload.findFirst({
    where: { id: uploadId, actorId },
    select: {
      id: true,
      expectedAssetId: true,
      expectedAssetUpdatedAt: true,
      assetId: true,
      lessonId: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      storagePath: true,
      status: true,
      expiresAt: true,
    },
  });
  if (!session) {
    throw new LessonVideoUploadFault(
      "NOT_FOUND",
      "O envio não foi encontrado.",
      404
    );
  }
  if (session.status === LessonAssetUploadStatus.COMPLETED) {
    return {
      assetId: session.assetId,
      fileName: session.originalFileName,
      mimeType: session.mimeType,
      sizeBytes: Number(session.sizeBytes),
      status: session.status,
      uploadId: session.id,
    };
  }
  if (
    session.status === LessonAssetUploadStatus.PENDING ||
    session.status === LessonAssetUploadStatus.READY
  ) {
    if (session.expiresAt.getTime() <= Date.now()) {
      await expireUploadSession({
        actorId,
        uploadId: session.id,
        storagePath: session.storagePath,
      });
      throw new LessonVideoUploadFault(
        "EXPIRED",
        "O prazo deste envio terminou. Inicie um novo envio.",
        410
      );
    }
    if (session.status === LessonAssetUploadStatus.READY) {
      return {
        assetId: session.assetId,
        fileName: session.originalFileName,
        mimeType: session.mimeType,
        sizeBytes: Number(session.sizeBytes),
        status: session.status,
        uploadId: session.id,
      };
    }
  } else {
    throw new LessonVideoUploadFault(
      session.status === LessonAssetUploadStatus.EXPIRED
        ? "EXPIRED"
        : "CONFLICT",
      "Este envio não pode ser finalizado.",
      409
    );
  }

  const metadata = await inspectGestaoVideoStorageObject(session.storagePath);
  if (!metadata) {
    throw new LessonVideoUploadFault(
      "CONFLICT",
      "O Storage ainda não confirmou o arquivo. Aguarde o envio terminar e tente novamente.",
      409
    );
  }
  if (
    metadata.sizeBytes !== Number(session.sizeBytes) ||
    metadata.mimeType !== session.mimeType ||
    metadata.sizeBytes > gestaoVideoUploadLimit()
  ) {
    await deleteGestaoVideoStorageObject(session.storagePath);
    await database.lessonAssetUpload.updateMany({
      where: {
        id: session.id,
        actorId,
        status: LessonAssetUploadStatus.PENDING,
      },
      data: { status: LessonAssetUploadStatus.FAILED },
    });
    throw new LessonVideoUploadFault(
      "INVALID",
      "O arquivo recebido não corresponde ao tipo ou tamanho informado.",
      422
    );
  }
  const signatureIsValid = await hasValidGestaoVideoStorageSignature(
    session.storagePath,
    session.mimeType
  );
  if (signatureIsValid === null) {
    throw new LessonVideoUploadFault(
      "UNAVAILABLE",
      "Não foi possível conferir o vídeo no Storage. Tente novamente.",
      503
    );
  }
  if (!signatureIsValid) {
    await deleteGestaoVideoStorageObject(session.storagePath);
    await database.lessonAssetUpload.updateMany({
      where: {
        id: session.id,
        actorId,
        status: LessonAssetUploadStatus.PENDING,
      },
      data: { status: LessonAssetUploadStatus.FAILED },
    });
    throw new LessonVideoUploadFault(
      "INVALID",
      "O conteúdo do arquivo não corresponde ao formato de vídeo declarado.",
      422
    );
  }

  const update = await database.lessonAssetUpload.updateMany({
    where: {
      id: session.id,
      actorId,
      status: LessonAssetUploadStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
    data: { status: LessonAssetUploadStatus.READY },
  });
  if (update.count !== 1) {
    const latest = await database.lessonAssetUpload.findFirst({
      where: { id: session.id, actorId },
      select: { status: true },
    });
    if (latest?.status !== LessonAssetUploadStatus.READY) {
      throw new LessonVideoUploadFault(
        "CONFLICT",
        "Este envio mudou em outra aba. Recarregue antes de continuar.",
        409
      );
    }
  }
  return {
    assetId: null,
    fileName: session.originalFileName,
    mimeType: session.mimeType,
    sizeBytes: Number(session.sizeBytes),
    status: LessonAssetUploadStatus.READY,
    uploadId: session.id,
  };
};

export const cancelGestaoLessonVideoUpload = async ({
  actorId,
  uploadId,
}: {
  readonly actorId: string;
  readonly uploadId: string;
}) => {
  const session = await database.lessonAssetUpload.findFirst({
    where: { id: uploadId, actorId },
    select: { id: true, storagePath: true, status: true },
  });
  if (!session) {
    throw new LessonVideoUploadFault(
      "NOT_FOUND",
      "O envio não foi encontrado.",
      404
    );
  }
  if (session.status === LessonAssetUploadStatus.COMPLETED) {
    throw new LessonVideoUploadFault(
      "CONFLICT",
      "O vídeo já está vinculado à aula e não pode ser cancelado.",
      409
    );
  }
  if (
    session.status === LessonAssetUploadStatus.PENDING ||
    session.status === LessonAssetUploadStatus.READY
  ) {
    const cancellation = await database.lessonAssetUpload.updateMany({
      where: {
        id: session.id,
        actorId,
        status: {
          in: [LessonAssetUploadStatus.PENDING, LessonAssetUploadStatus.READY],
        },
      },
      data: { status: LessonAssetUploadStatus.CANCELLED },
    });
    if (cancellation.count !== 1) {
      const latest = await database.lessonAssetUpload.findFirst({
        where: { id: session.id, actorId },
        select: { status: true },
      });
      if (latest?.status === LessonAssetUploadStatus.COMPLETED) {
        throw new LessonVideoUploadFault(
          "CONFLICT",
          "O vídeo já está vinculado à aula e não pode ser cancelado.",
          409
        );
      }
    }
  }
  await deleteAndRecordStorageObject({
    uploadId: session.id,
    storagePath: session.storagePath,
  });
  return { uploadId: session.id, status: LessonAssetUploadStatus.CANCELLED };
};

export const cleanupExpiredGestaoLessonVideoUploads = async ({
  batchSize = 100,
  now = new Date(),
}: {
  readonly batchSize?: number;
  readonly now?: Date;
} = {}) => {
  const uploads = await database.lessonAssetUpload.findMany({
    where: {
      storageDeletedAt: null,
      OR: [
        {
          status: {
            in: [
              LessonAssetUploadStatus.PENDING,
              LessonAssetUploadStatus.READY,
            ],
          },
          expiresAt: { lte: now },
        },
        { status: { in: terminalUploadStatuses } },
      ],
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
    take: Math.max(1, Math.min(batchSize, 100)),
    select: { id: true, storagePath: true, status: true },
  });

  let deleted = 0;
  let failed = 0;
  let skipped = 0;
  for (const upload of uploads) {
    if (upload.status === LessonAssetUploadStatus.COMPLETED) {
      skipped += 1;
      continue;
    }
    if (
      upload.status === LessonAssetUploadStatus.PENDING ||
      upload.status === LessonAssetUploadStatus.READY
    ) {
      const expired = await database.lessonAssetUpload.updateMany({
        where: {
          id: upload.id,
          status: upload.status,
          expiresAt: { lte: now },
          storageDeletedAt: null,
        },
        data: { status: LessonAssetUploadStatus.EXPIRED },
      });
      if (expired.count !== 1) {
        skipped += 1;
        continue;
      }
    }

    const removed = await deleteAndRecordStorageObject({
      uploadId: upload.id,
      storagePath: upload.storagePath,
    });
    if (removed) {
      deleted += 1;
    } else {
      failed += 1;
    }
  }

  return { deleted, failed, scanned: uploads.length, skipped };
};
