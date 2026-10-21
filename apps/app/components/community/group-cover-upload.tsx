"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ImagePlusIcon, XIcon } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { useId, useRef, useState } from "react";

interface GroupCoverUploadProperties {
  readonly compact?: boolean;
  readonly initialUrl?: string | null;
}

export const GroupCoverUpload = ({
  compact = false,
  initialUrl,
}: GroupCoverUploadProperties) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  let uploadLabel = "Enviar capa";
  if (uploading) {
    uploadLabel = "Enviando capa…";
  } else if (url) {
    uploadLabel = "Trocar capa";
  }

  const upload = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Envie uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter até 5 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("assetType", "community-cover");
      const response = await fetch("/api/member-assets", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        url?: string;
      };
      if (!(response.ok && payload.url)) {
        throw new Error(payload.error ?? "Não foi possível enviar a capa.");
      }
      setUrl(payload.url);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível enviar a capa."
      );
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const chooseFile = () => inputRef.current?.click();
  let coverContent: ReactNode = null;
  if (url) {
    coverContent = (
      <div className="relative mt-2 aspect-[16/6] overflow-hidden rounded-sm border">
        <Image
          alt="Prévia da capa do grupo"
          className="object-cover"
          fill
          sizes="(max-width: 768px) 100vw, 640px"
          src={url}
          unoptimized
        />
      </div>
    );
  } else if (compact) {
    coverContent = (
      <button
        aria-controls={inputId}
        className="mt-2 flex min-h-28 w-full flex-col gap-4 border border-dashed bg-background p-4 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:flex-row sm:items-center sm:px-6"
        disabled={uploading}
        onClick={chooseFile}
        onDragOver={(event) => event.preventDefault()}
        onDrop={async (event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) {
            await upload(file);
          }
        }}
        type="button"
      >
        <ImagePlusIcon
          aria-hidden="true"
          className="hidden size-10 shrink-0 text-brand-structural sm:block"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-sm">
            Arraste uma imagem ou envie do computador
          </span>
          <span className="mt-1 block text-muted-foreground text-xs leading-5">
            Proporção 4:1 · JPG, PNG ou WebP · até 5 MB.
          </span>
        </span>
        <span className="inline-flex h-10 shrink-0 items-center justify-center gap-2 border border-input bg-background px-4 font-medium text-sm">
          <ImagePlusIcon aria-hidden="true" className="size-4" />
          {uploadLabel}
        </span>
      </button>
    );
  } else {
    coverContent = (
      <div className="mt-2 flex aspect-[16/6] items-center justify-center border border-dashed bg-muted/20 text-muted-foreground">
        Nenhuma capa selecionada
      </div>
    );
  }

  return (
    <div data-testid="group-cover-upload">
      <span className="font-medium text-sm">Capa · opcional</span>
      <input name="coverUrl" type="hidden" value={url} />
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-hidden="true"
        className="sr-only"
        id={inputId}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            upload(file);
          }
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
      <input
        name="coverUploadPending"
        type="hidden"
        value={uploading ? "true" : "false"}
      />
      {coverContent}
      {compact && !url ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            aria-controls={inputId}
            disabled={uploading}
            onClick={chooseFile}
            type="button"
            variant="outline"
          >
            <ImagePlusIcon aria-hidden="true" />
            {uploadLabel}
          </Button>
          {url ? (
            <Button
              disabled={uploading}
              onClick={() => setUrl("")}
              type="button"
              variant="ghost"
            >
              <XIcon aria-hidden="true" /> Remover capa
            </Button>
          ) : null}
        </div>
      )}
      <p className="mt-2 text-muted-foreground text-xs">
        A imagem fica no armazenamento privado da plataforma e só aparece para
        quem pode ver o grupo.
      </p>
      {error ? (
        <p className="mt-2 text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
