"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

interface UploadCapability {
  readonly bucket: string | null;
  readonly endpoint: string | null;
  readonly expiresAt: string;
  readonly fileName: string;
  readonly id: string;
  readonly maxSizeBytes: number;
  readonly mimeType: string;
  readonly publishableKey: string | null;
  readonly sizeBytes: number;
  readonly status: "PENDING" | "READY" | "COMPLETED";
  readonly storagePath: string;
  readonly token: string | null;
}

interface SavedUpload {
  readonly fileName: string;
  readonly lastModified: number | null;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly status: "PENDING" | "READY";
  readonly tusComplete: boolean;
  readonly uploadId: string;
}

interface UploadStatusChange {
  readonly canSave: boolean;
  readonly uploadId: string | null;
  readonly waitingForSelectedFile: boolean;
}

interface GestaoLessonVideoUploadProperties {
  readonly courseId: string;
  readonly currentAsset: {
    readonly hasStoredAsset: boolean;
    readonly id: string;
    readonly updatedAt: string;
  } | null;
  readonly lessonId: string;
  readonly maxSizeBytes: number;
  readonly memberId: string;
  readonly onStatusChange: (status: UploadStatusChange) => void;
  readonly pendingUpload: {
    readonly expiresAt: string;
    readonly fileName: string;
    readonly id: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly status: "PENDING" | "READY";
  } | null;
}

interface CreateIntent {
  readonly fileName: string;
  readonly idempotencyKey: string;
  readonly lastModified: number;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

type UploadUiStatus =
  | "idle"
  | "authorizing"
  | "uploading"
  | "finalizing"
  | "ready"
  | "error";

const apiBase = "/api/gestao/lesson-video-uploads";
const safeGetLocalItem = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetLocalItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Browser storage only improves resumability; the server owns the session.
  }
};

const safeRemoveLocalItem = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Browser storage only improves resumability; the server owns the session.
  }
};

const retryDelays = [0, 3000, 5000, 10_000, 20_000];
const tusChunkSize = 6 * 1024 * 1024;

class UploadHttpError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor({
    code,
    message,
    status,
  }: {
    readonly code: string | null;
    readonly message: string;
    readonly status: number;
  }) {
    super(message);
    this.name = "UploadHttpError";
    this.code = code;
    this.status = status;
  }
}

const clearExpiredCreateIntent = (error: unknown, key: string) => {
  if (error instanceof UploadHttpError && error.code === "EXPIRED") {
    safeRemoveLocalItem(key);
  }
};

const uploadHttpError = async (response: Response) => {
  try {
    const payload = (await response.json()) as {
      code?: unknown;
      error?: unknown;
    };
    return new UploadHttpError({
      code: typeof payload.code === "string" ? payload.code : null,
      message:
        typeof payload.error === "string"
          ? payload.error
          : "Não foi possível concluir o envio.",
      status: response.status,
    });
  } catch {
    return new UploadHttpError({
      code: null,
      message: "Não foi possível concluir o envio.",
      status: response.status,
    });
  }
};

const mimeTypeFor = (file: File) => {
  if (file.type === "video/mp4" || file.type === "video/webm") {
    return file.type;
  }
  if (file.name.toLowerCase().endsWith(".mp4")) {
    return "video/mp4";
  }
  if (file.name.toLowerCase().endsWith(".webm")) {
    return "video/webm";
  }
  return "";
};

const sameFile = (saved: SavedUpload, file: File, mimeType: string) =>
  saved.fileName === file.name &&
  saved.sizeBytes === file.size &&
  saved.mimeType === mimeType &&
  (saved.lastModified === null || saved.lastModified === file.lastModified);

type UploadPreparation =
  | { readonly kind: "ready"; readonly upload: SavedUpload }
  | { readonly kind: "finalize"; readonly upload: SavedUpload }
  | {
      readonly kind: "capability";
      readonly capability: UploadCapability;
      readonly resume: boolean;
    };

const resolveUploadPreparation = async ({
  cancel,
  create,
  file,
  mimeType,
  requestToken,
  savedUpload,
}: {
  readonly cancel: (uploadId: string) => Promise<void>;
  readonly create: (file: File, mimeType: string) => Promise<UploadCapability>;
  readonly file: File;
  readonly mimeType: string;
  readonly requestToken: (uploadId: string) => Promise<UploadCapability>;
  readonly savedUpload: SavedUpload | null;
}): Promise<UploadPreparation> => {
  const matchesSavedFile =
    savedUpload !== null && sameFile(savedUpload, file, mimeType);
  if (matchesSavedFile && savedUpload.status === "READY") {
    return { kind: "ready", upload: savedUpload };
  }
  if (matchesSavedFile && savedUpload.tusComplete) {
    return { kind: "finalize", upload: savedUpload };
  }
  if (matchesSavedFile && savedUpload) {
    try {
      return {
        kind: "capability",
        capability: await requestToken(savedUpload.uploadId),
        resume: true,
      };
    } catch {
      await cancel(savedUpload.uploadId);
    }
  } else if (savedUpload) {
    await cancel(savedUpload.uploadId);
  }
  return {
    kind: "capability",
    capability: await create(file, mimeType),
    resume: false,
  };
};

const uploadButtonLabel = (status: UploadUiStatus, progress: number) => {
  if (status === "uploading") {
    return `Enviando… ${progress}%`;
  }
  if (status === "finalizing") {
    return "Conferindo…";
  }
  if (status === "error") {
    return "Tentar novamente";
  }
  if (status === "ready") {
    return "Enviar outro vídeo";
  }
  return "Enviar vídeo";
};

const formatBytes = (bytes: number) => {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  }
  return `${Math.ceil(bytes / 1_000_000)} MB`;
};

export const GestaoLessonVideoUpload = ({
  courseId,
  currentAsset,
  lessonId,
  maxSizeBytes,
  memberId,
  onStatusChange,
  pendingUpload,
}: GestaoLessonVideoUploadProperties) => {
  const storageKey = `gestao-video-upload:${memberId}:${lessonId}`;
  const createIntentKey = `${storageKey}:create-intent`;
  const uploadRef = useRef<import("tus-js-client").Upload | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [savedUpload, setSavedUpload] = useState<SavedUpload | null>(() =>
    pendingUpload
      ? {
          fileName: pendingUpload.fileName,
          lastModified: null,
          mimeType: pendingUpload.mimeType,
          sizeBytes: pendingUpload.sizeBytes,
          status: pendingUpload.status,
          tusComplete: pendingUpload.status === "READY",
          uploadId: pendingUpload.id,
        }
      : null
  );
  const [status, setStatus] = useState<UploadUiStatus>(
    pendingUpload?.status === "READY" ? "ready" : "idle"
  );
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [selectedFileNeedsUpload, setSelectedFileNeedsUpload] = useState(false);
  const [cancellingPreviousUpload, setCancellingPreviousUpload] =
    useState(false);

  useEffect(() => {
    if (pendingUpload) {
      safeRemoveLocalItem(createIntentKey);
      return;
    }
    try {
      const raw = safeGetLocalItem(storageKey);
      if (!raw) {
        return;
      }
      const value = JSON.parse(raw) as Partial<SavedUpload>;
      if (
        typeof value.uploadId === "string" &&
        typeof value.fileName === "string" &&
        typeof value.sizeBytes === "number" &&
        typeof value.mimeType === "string" &&
        (value.status === "PENDING" || value.status === "READY")
      ) {
        const restored: SavedUpload = {
          fileName: value.fileName,
          lastModified:
            typeof value.lastModified === "number" ? value.lastModified : null,
          mimeType: value.mimeType,
          sizeBytes: value.sizeBytes,
          status: value.status,
          tusComplete: value.tusComplete === true || value.status === "READY",
          uploadId: value.uploadId,
        };
        setSavedUpload(restored);
        if (restored.status === "READY") {
          setStatus("ready");
        }
      }
    } catch {
      safeRemoveLocalItem(storageKey);
    }
  }, [createIntentKey, pendingUpload, storageKey]);

  const saveLocalSession = (next: SavedUpload) => {
    setSavedUpload(next);
    try {
      safeSetLocalItem(storageKey, JSON.stringify(next));
    } catch {
      // Resumability is an enhancement; the signed session remains server-owned.
    }
  };

  useEffect(() => {
    const selectedMatchesReadySession =
      !file ||
      (savedUpload?.status === "READY" &&
        sameFile(savedUpload, file, mimeTypeFor(file)));
    const isReady =
      status === "ready" &&
      savedUpload?.status === "READY" &&
      selectedMatchesReadySession;
    onStatusChange({
      canSave: !selectedFileNeedsUpload || isReady,
      uploadId: isReady ? savedUpload.uploadId : null,
      waitingForSelectedFile: selectedFileNeedsUpload && !isReady,
    });
  }, [file, onStatusChange, savedUpload, selectedFileNeedsUpload, status]);

  const requestJson = async <T,>(
    url: string,
    init?: RequestInit
  ): Promise<T> => {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw await uploadHttpError(response);
    }
    return (await response.json()) as T;
  };

  const finalizeUpload = async (
    uploadId: string,
    sessionToKeep: SavedUpload | null = savedUpload
  ) => {
    setStatus("finalizing");
    setMessage("Conferindo o vídeo no Storage…");
    try {
      const finalized = await requestJson<{
        readonly assetId: string | null;
        readonly fileName: string;
        readonly mimeType: string;
        readonly sizeBytes: number;
        readonly status: "READY" | "COMPLETED";
        readonly uploadId: string;
      }>(`${apiBase}/${encodeURIComponent(uploadId)}/finalize`, {
        method: "POST",
        body: "{}",
      });
      const ready: SavedUpload = {
        ...(sessionToKeep ?? {
          fileName: finalized.fileName,
          lastModified: file?.lastModified ?? null,
          mimeType: finalized.mimeType,
          sizeBytes: finalized.sizeBytes,
          status: "PENDING" as const,
          tusComplete: true,
          uploadId,
        }),
        status: "READY",
        tusComplete: true,
        uploadId,
      };
      saveLocalSession(ready);
      setStatus("ready");
      setProgress(100);
      setMessage(
        "Vídeo enviado e conferido. Salve as alterações para vinculá-lo à aula."
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar o vídeo. Tente novamente."
      );
    }
  };

  const createSession = async (selectedFile: File, mimeType: string) => {
    let intent: CreateIntent | null = null;
    try {
      const value = JSON.parse(
        safeGetLocalItem(createIntentKey) ?? "null"
      ) as Partial<CreateIntent> | null;
      if (
        value &&
        typeof value.idempotencyKey === "string" &&
        value.fileName === selectedFile.name &&
        value.lastModified === selectedFile.lastModified &&
        value.mimeType === mimeType &&
        value.sizeBytes === selectedFile.size
      ) {
        intent = value as CreateIntent;
      }
    } catch {
      safeRemoveLocalItem(createIntentKey);
    }
    if (!intent) {
      intent = {
        fileName: selectedFile.name,
        idempotencyKey: crypto.randomUUID(),
        lastModified: selectedFile.lastModified,
        mimeType,
        sizeBytes: selectedFile.size,
      };
      try {
        safeSetLocalItem(createIntentKey, JSON.stringify(intent));
      } catch {
        // Server-side idempotency remains available for retries during this page session.
      }
    }
    let capability: UploadCapability;
    try {
      capability = await requestJson<UploadCapability>(apiBase, {
        method: "POST",
        body: JSON.stringify({
          assetExpectedUpdatedAt: currentAsset?.updatedAt ?? null,
          assetId: currentAsset?.id ?? null,
          courseId,
          fileName: selectedFile.name,
          idempotencyKey: intent.idempotencyKey,
          lessonId,
          mimeType,
          sizeBytes: selectedFile.size,
        }),
      });
    } catch (error) {
      clearExpiredCreateIntent(error, createIntentKey);
      throw error;
    }
    safeRemoveLocalItem(createIntentKey);
    if (capability.status === "PENDING") {
      saveLocalSession({
        fileName: selectedFile.name,
        lastModified: selectedFile.lastModified,
        mimeType,
        sizeBytes: selectedFile.size,
        status: "PENDING",
        tusComplete: false,
        uploadId: capability.id,
      });
    }
    return capability;
  };

  const startTusUpload = async (
    selectedFile: File,
    mimeType: string,
    capability: UploadCapability,
    resume: boolean
  ) => {
    if (!(capability.bucket && capability.endpoint && capability.token)) {
      if (capability.status === "READY" || capability.status === "COMPLETED") {
        const ready: SavedUpload = {
          fileName: capability.fileName,
          lastModified: selectedFile.lastModified,
          mimeType,
          sizeBytes: selectedFile.size,
          status: "READY",
          tusComplete: true,
          uploadId: capability.id,
        };
        saveLocalSession(ready);
        setStatus("ready");
        setMessage(
          "Vídeo enviado. Salve as alterações para vinculá-lo à aula."
        );
        return;
      }
      throw new Error("O Storage não emitiu uma autorização de upload.");
    }
    const tus = await import("tus-js-client");
    const next: SavedUpload = {
      fileName: selectedFile.name,
      lastModified: selectedFile.lastModified,
      mimeType,
      sizeBytes: selectedFile.size,
      status: "PENDING",
      tusComplete: false,
      uploadId: capability.id,
    };
    saveLocalSession(next);
    setStatus("uploading");
    setProgress(0);
    setMessage("Enviando vídeo…");
    const upload = new tus.Upload(selectedFile, {
      endpoint: capability.endpoint,
      chunkSize: tusChunkSize,
      retryDelays,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      fingerprint: async (sourceFile) =>
        `gestao:${memberId}:${lessonId}:${capability.id}:${sourceFile.size}:${sourceFile.type}:${sourceFile.name}:${"lastModified" in sourceFile ? sourceFile.lastModified : 0}`,
      headers: {
        "x-signature": capability.token,
        ...(capability.publishableKey
          ? { apikey: capability.publishableKey }
          : {}),
      },
      metadata: {
        bucketName: capability.bucket,
        objectName: capability.storagePath,
        contentType: mimeType,
        cacheControl: "3600",
      },
      onError: (error) => {
        setStatus("error");
        setMessage(
          `O envio foi interrompido: ${error.message}. Tente novamente para retomar.`
        );
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = Math.min(
          100,
          Math.floor((bytesUploaded / Math.max(1, bytesTotal)) * 100)
        );
        setProgress(percentage);
        setMessage(`Enviando vídeo… ${percentage}%`);
      },
      onSuccess: () => {
        const uploaded: SavedUpload = {
          ...next,
          tusComplete: true,
        };
        saveLocalSession(uploaded);
        setSavedUpload(uploaded);
        finalizeUpload(capability.id, uploaded).catch(() => undefined);
      },
    });
    uploadRef.current = upload;
    if (resume) {
      const previous = await upload.findPreviousUploads();
      const previousUpload = previous.at(0);
      if (previousUpload) {
        upload.resumeFromPreviousUpload(previousUpload);
      }
    }
    upload.start();
  };

  const cancelServerUpload = async (uploadId: string) => {
    const response = await fetch(`${apiBase}/${encodeURIComponent(uploadId)}`, {
      method: "DELETE",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw await uploadHttpError(response);
    }
  };

  const beginUpload = async () => {
    if (!file) {
      setMessage("Selecione um vídeo MP4 ou WebM.");
      setStatus("error");
      return;
    }
    const mimeType = mimeTypeFor(file);
    if (!mimeType) {
      setMessage("O arquivo precisa estar no formato MP4 ou WebM.");
      setStatus("error");
      return;
    }
    if (file.size <= 0 || file.size > maxSizeBytes) {
      setMessage(`O vídeo precisa ter até ${formatBytes(maxSizeBytes)}.`);
      setStatus("error");
      return;
    }

    setStatus("authorizing");
    setMessage("Preparando o envio seguro…");
    try {
      const preparation = await resolveUploadPreparation({
        cancel: async (uploadId) => {
          await cancelServerUpload(uploadId);
          safeRemoveLocalItem(createIntentKey);
        },
        create: createSession,
        file,
        mimeType,
        requestToken: (uploadId) =>
          requestJson<UploadCapability>(
            `${apiBase}/${encodeURIComponent(uploadId)}/token`,
            { method: "POST", body: "{}" }
          ),
        savedUpload,
      });
      if (preparation.kind === "ready") {
        setStatus("ready");
        setMessage(
          "Vídeo enviado. Salve as alterações para vinculá-lo à aula."
        );
        return;
      }
      if (preparation.kind === "finalize") {
        await finalizeUpload(preparation.upload.uploadId, preparation.upload);
        return;
      }
      const { capability, resume } = preparation;
      if (capability.status === "READY" || capability.status === "COMPLETED") {
        const ready: SavedUpload = {
          fileName: file.name,
          lastModified: file.lastModified,
          mimeType,
          sizeBytes: file.size,
          status: "READY",
          tusComplete: true,
          uploadId: capability.id,
        };
        saveLocalSession(ready);
        setStatus("ready");
        setMessage(
          "Vídeo enviado. Salve as alterações para vinculá-lo à aula."
        );
        return;
      }
      await startTusUpload(file, mimeType, capability, resume);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar o envio. Tente novamente."
      );
    }
  };

  const cancelUpload = async () => {
    if (uploadRef.current) {
      try {
        await uploadRef.current.abort(true);
      } catch {
        // The server cancellation below remains authoritative.
      }
      uploadRef.current = null;
    }
    if (savedUpload) {
      try {
        await cancelServerUpload(savedUpload.uploadId);
      } catch (error) {
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível cancelar o envio. Tente novamente."
        );
        return;
      }
    }
    setSavedUpload(null);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setProgress(0);
    setStatus("idle");
    setMessage("Envio cancelado.");
    setSelectedFileNeedsUpload(false);
    safeRemoveLocalItem(storageKey);
    safeRemoveLocalItem(createIntentKey);
    onStatusChange({
      canSave: Boolean(currentAsset?.hasStoredAsset),
      uploadId: null,
      waitingForSelectedFile: false,
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.currentTarget.files?.[0] ?? null;
    setFile(next);
    setProgress(0);
    if (next) {
      setStatus("idle");
      setMessage(`${next.name} selecionado (${formatBytes(next.size)}).`);
      const type = mimeTypeFor(next);
      const isSamePendingFile =
        savedUpload && type && sameFile(savedUpload, next, type);
      setSelectedFileNeedsUpload(
        Boolean(next && (savedUpload?.status !== "READY" || !isSamePendingFile))
      );
      if (savedUpload?.status === "READY" && !isSamePendingFile) {
        setCancellingPreviousUpload(true);
        cancelServerUpload(savedUpload.uploadId)
          .then(() => {
            setSavedUpload(null);
            safeRemoveLocalItem(storageKey);
            setSelectedFileNeedsUpload(true);
            setCancellingPreviousUpload(false);
          })
          .catch((error: unknown) => {
            setStatus("error");
            setCancellingPreviousUpload(false);
            setMessage(
              error instanceof Error
                ? error.message
                : "Não foi possível liberar o envio anterior. Tente novamente."
            );
          });
      }
    } else {
      setMessage("");
      setSelectedFileNeedsUpload(false);
      setStatus(savedUpload?.status === "READY" ? "ready" : "idle");
    }
  };

  const disabled =
    status === "authorizing" ||
    status === "uploading" ||
    status === "finalizing" ||
    cancellingPreviousUpload;
  const buttonLabel = uploadButtonLabel(status, progress);

  return (
    <section aria-label="Enviar vídeo para a aula" className="gl-lesson-upload">
      <label className="gl-lesson-field" htmlFor="gestao-lesson-video-file">
        <span>Vídeo próprio (MP4 ou WebM)</span>
        <Input
          accept="video/mp4,video/webm,.mp4,.webm"
          disabled={disabled}
          id="gestao-lesson-video-file"
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />
      </label>
      <p className="gl-lesson-upload-note">
        Arquivo privado, enviado diretamente ao Storage com retomada automática.
        Limite atual: {formatBytes(maxSizeBytes)}.
        {currentAsset?.hasStoredAsset
          ? " O vídeo atual permanece ativo até salvar."
          : ""}
      </p>
      {status === "uploading" ? (
        <progress
          aria-label="Progresso do envio do vídeo"
          className="gl-lesson-upload-progress"
          max={100}
          value={progress}
        />
      ) : null}
      <div className="gl-lesson-upload-actions">
        <Button
          disabled={
            disabled ||
            !(file || (savedUpload?.tusComplete && status === "error"))
          }
          onClick={async () => {
            if (savedUpload?.tusComplete && status === "error") {
              await finalizeUpload(savedUpload.uploadId, savedUpload);
              return;
            }
            await beginUpload();
          }}
          type="button"
          variant="outline"
        >
          {buttonLabel}
        </Button>
        {savedUpload && status !== "finalizing" && !cancellingPreviousUpload ? (
          <Button onClick={cancelUpload} type="button" variant="ghost">
            Cancelar envio
          </Button>
        ) : null}
        {file && !savedUpload ? (
          <Button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
              setFile(null);
              setSelectedFileNeedsUpload(false);
              setStatus("idle");
              setMessage("Seleção removida.");
            }}
            type="button"
            variant="ghost"
          >
            Limpar seleção
          </Button>
        ) : null}
      </div>
      {message ? (
        <output
          aria-live={status === "error" ? "assertive" : "polite"}
          className={`gl-lesson-upload-feedback is-${status}`}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </output>
      ) : null}
    </section>
  );
};
