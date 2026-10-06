"use client";

import { Button } from "@repo/design-system/components/ui/button";
import Image from "next/image";
import { useRef, useState } from "react";

interface RecordingThumbnailUploaderProperties {
  readonly recordingId: string;
  readonly thumbnailPath: string | null;
}

export const RecordingThumbnailUploader = ({
  recordingId,
  thumbnailPath,
}: RecordingThumbnailUploaderProperties) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState(
    thumbnailPath ? `/api/learning/recordings/${recordingId}/thumbnail` : null
  );
  let uploadLabel = "Adicionar capa";
  if (preview) {
    uploadLabel = "Trocar capa";
  }
  if (busy) {
    uploadLabel = "Salvando…";
  }

  const upload = async (file: File) => {
    setBusy(true);
    setMessage(null);
    const body = new FormData();
    body.set("file", file);
    try {
      const response = await fetch(
        `/api/learning/recordings/${recordingId}/thumbnail`,
        { body, method: "POST" }
      );
      const payload = (await response.json()) as {
        error?: string;
        url?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível salvar a capa.");
      }
      setPreview(
        `${payload.url ?? `/api/learning/recordings/${recordingId}/thumbnail`}?v=${Date.now()}`
      );
      setMessage("Capa atualizada.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a capa."
      );
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/learning/recordings/${recordingId}/thumbnail`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Não foi possível remover a capa.");
      }
      setPreview(null);
      setMessage("Capa removida.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível remover a capa."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {preview ? (
        <Image
          alt=""
          className="aspect-video w-40 border object-cover object-center"
          height={90}
          src={preview}
          unoptimized
          width={160}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          {uploadLabel}
        </Button>
        {preview ? (
          <Button
            disabled={busy}
            onClick={remove}
            size="sm"
            type="button"
            variant="ghost"
          >
            Remover
          </Button>
        ) : null}
      </div>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            upload(file).catch(() => undefined);
          }
        }}
        ref={inputRef}
        type="file"
      />
      {message ? (
        <output className="block text-muted-foreground text-xs">
          {message}
        </output>
      ) : null}
    </div>
  );
};
