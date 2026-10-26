"use client";

import { useEffect, useRef, useState } from "react";
import { GestaoIcon } from "@/app/(authenticated)/gestao/gestao-icon";
import { collectionCoverStyle } from "@/lib/collection-covers";

interface CollectionCoverOption {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

export const CollectionCoverPicker = ({
  coverOptions,
  initialUrl,
  mutationStatus,
  noun = "capa",
  onValueChange,
  sizeHint = " · até 5 MB",
}: {
  readonly coverOptions: readonly CollectionCoverOption[];
  readonly initialUrl: string;
  readonly mutationStatus: "idle" | "error" | "success";
  readonly noun?: string;
  readonly onValueChange: () => void;
  readonly sizeHint?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const uncommittedUploadUrl = useRef<string | null>(null);
  const [coverUrl, setCoverUrl] = useState(initialUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedOption = coverOptions.find(({ url }) => url === coverUrl);

  useEffect(() => {
    if (mutationStatus === "success") {
      uncommittedUploadUrl.current = null;
    }
  }, [mutationStatus]);

  const deleteUncommittedUpload = async () => {
    const uploadUrl = uncommittedUploadUrl.current;
    if (!uploadUrl) {
      return;
    }
    uncommittedUploadUrl.current = null;
    try {
      const path = new URL(uploadUrl, window.location.origin).searchParams.get(
        "path"
      );
      if (!path) {
        return;
      }
      await fetch(`/api/member-assets?path=${encodeURIComponent(path)}`, {
        method: "DELETE",
      });
    } catch {
      // A storage cleanup failure does not undo a cover selection.
    }
  };

  const upload = async (file: File) => {
    setError(null);
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setError("Escolha uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter até 5 MB.");
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.set("assetType", "community-cover");
    formData.set("file", file);
    try {
      const response = await fetch("/api/member-assets", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        readonly error?: string;
        readonly url?: string;
      };
      if (!(response.ok && result.url)) {
        setError(result.error ?? "Não foi possível enviar a capa.");
        return;
      }
      await deleteUncommittedUpload();
      uncommittedUploadUrl.current = result.url;
      setCoverUrl(result.url);
      setPreviewUrl(URL.createObjectURL(file));
      onValueChange();
    } catch {
      setError("A conexão foi interrompida. Tente enviar a capa novamente.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const selectLibraryCover = async (url: string) => {
    if (url !== coverUrl) {
      await deleteUncommittedUpload();
      setPreviewUrl(null);
      setCoverUrl(url);
      setLibraryOpen(false);
      onValueChange();
    }
  };

  const removeCover = async () => {
    await deleteUncommittedUpload();
    setPreviewUrl(null);
    setCoverUrl("");
    setError(null);
    onValueChange();
  };

  const visualUrl = previewUrl ?? coverUrl;

  return (
    <div className="gco-cover-picker">
      <input name="coverUrl" type="hidden" value={coverUrl} />
      <div
        aria-label={
          visualUrl ? "Prévia da capa selecionada" : "Sem capa selecionada"
        }
        className="gco-cover-preview"
        role="img"
        style={collectionCoverStyle(visualUrl)}
      >
        {visualUrl ? null : <span>Sem capa</span>}
      </div>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions lint/a11y/noStaticElementInteractions: Drag-and-drop is an enhancement; the file picker remains keyboard accessible. */}
      <div
        className={`gco-cover-dropzone ${isDragging ? "is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) {
            setIsDragging(false);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={async (event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files.item(0);
          if (file) {
            await upload(file);
          }
        }}
      >
        <span aria-hidden="true" className="gco-upload-arrow">
          ↑
        </span>
        <strong>
          {isUploading ? `Enviando ${noun}…` : `Arraste uma ${noun}`}
        </strong>
        <small>JPG, PNG ou WebP{sizeHint}</small>
        <span className="gco-cover-tools">
          <button
            className="gco-cover-choose"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {isUploading ? "Enviando…" : "Escolher arquivo"}
          </button>
          <button
            aria-expanded={libraryOpen}
            className="gco-cover-library"
            onClick={() => setLibraryOpen((open) => !open)}
            type="button"
          >
            <GestaoIcon name="book" size={16} /> Da biblioteca de arquivos
          </button>
        </span>
      </div>
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label="Escolher arquivo de capa"
        className="sr-only"
        disabled={isUploading}
        onChange={async (event) => {
          const file = event.currentTarget.files?.item(0);
          if (file) {
            await upload(file);
          }
        }}
        ref={inputRef}
        type="file"
      />
      {libraryOpen ? (
        <label className="gco-library-cover-select">
          <span>Arquivo já enviado</span>
          <select
            onChange={async (event) =>
              await selectLibraryCover(event.currentTarget.value)
            }
            value={selectedOption?.url ?? ""}
          >
            <option value="">Escolha uma capa da biblioteca</option>
            {coverOptions.map((option) => (
              <option key={option.id} value={option.url}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {coverUrl ? (
        <button
          className="gco-remove-cover"
          onClick={async () => await removeCover()}
          type="button"
        >
          Remover capa
        </button>
      ) : null}
      {error ? (
        <p className="gco-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
