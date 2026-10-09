"use client";

import { CameraIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface AvatarUploaderProperties {
  readonly initials: string;
  readonly initialUrl: string | null;
  readonly onUploadingChange?: (isUploading: boolean) => void;
  readonly onValueChange?: (value: string) => void;
  readonly variant?: "default" | "profile-editor";
}

export const AvatarUploader = ({
  initialUrl,
  initials,
  onUploadingChange,
  onValueChange,
  variant = "default",
}: AvatarUploaderProperties) => {
  const isProfileEditor = variant === "profile-editor";
  const [url, setUrl] = useState(initialUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const uploadedUrlRef = useRef<string | null>(null);
  const uploadInFlight = useRef(false);

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
    if (uploadInFlight.current) {
      return;
    }
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setError("Envie uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter entre 1 byte e 5 MB.");
      return;
    }

    uploadInFlight.current = true;
    setError("");
    onUploadingChange?.(true);
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
      onValueChange?.(payload.url);
      uploadedUrlRef.current = payload.url;
      setPreviewUrl(null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível enviar a imagem."
      );
    } finally {
      uploadInFlight.current = false;
      setIsUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <div
      className={
        isProfileEditor
          ? "mt-5 grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4"
          : "mt-5 flex flex-wrap items-center gap-4"
      }
    >
      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--line-soft)] text-brand-dark-amaranth ${isProfileEditor ? "size-[72px] border border-[#D4C4BE] font-display text-[26px]" : "size-14 text-lg"}`}
      >
        {(previewUrl ?? url) ? (
          // The source is either an authenticated member-asset route or a legacy
          // external URL already stored for this profile.
          // biome-ignore lint/performance/noImgElement: avatar URLs are resolved by the private media route.
          <img
            alt="Prévia do avatar"
            className="motion-reveal-fast size-full object-cover"
            height={isProfileEditor ? 72 : 56}
            src={previewUrl ?? url}
            width={isProfileEditor ? 72 : 56}
          />
        ) : (
          initials
        )}
      </div>
      <div
        className={
          isProfileEditor
            ? "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
            : "flex flex-wrap items-center gap-x-3 gap-y-1"
        }
      >
        <input name="avatarUrl" type="hidden" value={url} />
        <label
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm font-semibold text-brand-dark-amaranth text-sm focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-dark-amaranth hover:bg-brand-pink-essence ${isProfileEditor ? "border-2 border-brand-dark-amaranth px-5" : "border border-brand-dark-amaranth px-3"}`}
        >
          <CameraIcon aria-hidden="true" className="size-4" />
          {isUploading ? "Enviando…" : "Trocar foto"}
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
            className={`flex min-h-11 items-center gap-1 text-muted-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isProfileEditor ? "px-3 font-medium text-sm" : "text-xs"}`}
            onClick={() => {
              const currentUrl = uploadedUrlRef.current ?? url;
              removeTemporaryUpload(currentUrl).catch(() => undefined);
              uploadedUrlRef.current = null;
              setPreviewUrl(null);
              setUrl("");
              onValueChange?.("");
            }}
            type="button"
          >
            <XIcon aria-hidden="true" className="size-3" /> Remover
          </button>
        ) : null}
        <p
          className={`basis-full text-muted-foreground ${isProfileEditor ? "text-[13px]" : "text-xs"}`}
        >
          JPG, PNG ou WebP · até 5 MB{isProfileEditor ? "" : "."}
        </p>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    </div>
  );
};
