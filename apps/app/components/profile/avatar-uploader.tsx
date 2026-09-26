"use client";

import { ImagePlusIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface AvatarUploaderProperties {
  readonly initials: string;
  readonly initialUrl: string | null;
}

export const AvatarUploader = ({
  initialUrl,
  initials,
}: AvatarUploaderProperties) => {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const uploadedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const removeTemporaryUpload = async (value: string) => {
    if (!value || value === initialUrl) {
      return;
    }

    try {
      const path = new URL(value, window.location.origin).searchParams.get(
        "path"
      );
      if (path) {
        await fetch(`/api/member-assets?path=${encodeURIComponent(path)}`, {
          method: "DELETE",
        });
      }
    } catch {
      // The profile save remains the source of truth. A cleanup failure is
      // harmless and can be reconciled by the scheduled orphan cleanup.
    }
  };

  const upload = async (file: File) => {
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setError("Envie uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter entre 1 byte e 5 MB.");
      return;
    }

    setError("");
    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("assetType", "avatar");
      const response = await fetch("/api/member-assets", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        url?: string;
      };

      if (!(response.ok && payload.url)) {
        throw new Error(payload.error ?? "Não foi possível enviar a imagem.");
      }

      setUrl(payload.url);
      uploadedUrlRef.current = payload.url;
      setPreviewUrl(null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível enviar a imagem."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-5 flex flex-wrap items-center gap-4">
      <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-structural text-2xl text-primary-foreground">
        {(previewUrl ?? url) ? (
          // The source is either an authenticated member-asset route or a legacy
          // external URL already stored for this profile.
          // biome-ignore lint/performance/noImgElement: avatar URLs are resolved by the private media route.
          <img
            alt="Prévia do avatar"
            className="motion-reveal-fast size-full object-cover"
            height={80}
            src={previewUrl ?? url}
            width={80}
          />
        ) : (
          initials
        )}
      </div>
      <div className="min-w-52 space-y-2">
        <input name="avatarUrl" type="hidden" value={url} />
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm underline underline-offset-4">
          <ImagePlusIcon aria-hidden="true" className="size-4" />
          {isUploading ? "Enviando…" : "Escolher foto"}
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                upload(file).catch(() => undefined);
              }
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
        {url || previewUrl ? (
          <button
            className="flex items-center gap-1 text-muted-foreground text-xs underline underline-offset-4"
            onClick={() => {
              const currentUrl = uploadedUrlRef.current ?? url;
              removeTemporaryUpload(currentUrl).catch(() => undefined);
              uploadedUrlRef.current = null;
              setPreviewUrl(null);
              setUrl("");
            }}
            type="button"
          >
            <XIcon aria-hidden="true" className="size-3" /> Remover foto
          </button>
        ) : null}
        <p className="text-muted-foreground text-xs">
          JPG, PNG ou WebP · até 5 MB.
        </p>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    </div>
  );
};
