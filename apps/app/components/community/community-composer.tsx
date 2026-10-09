"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import type { JSONContent } from "@tiptap/core";
import {
  ArrowLeftIcon,
  CheckIcon,
  EyeIcon,
  ImageIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  publishPost,
  updateDraft,
  updatePost,
} from "@/app/(authenticated)/comunidade/actions";
import { TopicEditor } from "./topic-editor";

type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type SaveState = "idle" | "saving" | "saved" | "error";

interface ComposerSpace {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

interface CommunityComposerProperties {
  readonly backHref: string;
  readonly initialContent: JSONContent;
  readonly initialCoverUrl: string | null;
  readonly initialSpaceId: string | null;
  readonly initialSpaceSlug: string | null;
  readonly initialSubtitle: string | null;
  readonly initialTags: readonly string[];
  readonly initialTitle: string;
  readonly postId: string;
  readonly spaces: readonly ComposerSpace[];
  readonly status: PostStatus;
}

const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
const draftTitle = "Rascunho sem título";

const saveLabel = (state: SaveState) => {
  if (state === "saving") {
    return "Salvando…";
  }
  if (state === "saved") {
    return "Rascunho salvo · visível só para você";
  }
  if (state === "error") {
    return "Não foi possível salvar";
  }
  return "Rascunho salvo · visível só para você";
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the editor coordinates autosave, preview, publish, and metadata controls as one deliberate workflow.
export function CommunityComposer({
  backHref,
  initialContent,
  initialCoverUrl,
  initialSpaceId,
  initialSpaceSlug,
  initialSubtitle,
  initialTags,
  initialTitle,
  postId,
  spaces,
  status,
}: CommunityComposerProperties) {
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle ?? "");
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl ?? "");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState(initialSpaceId ?? "");
  const [spaceSlug, setSpaceSlug] = useState(initialSpaceSlug ?? "");
  const [content, setContent] = useState<JSONContent>(
    initialContent ?? emptyDocument
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const actionsSentinelRef = useRef<HTMLDivElement>(null);
  const uploadedCoverUrlRef = useRef<string | null>(null);
  const coverUploadInFlight = useRef(false);
  const publishingRef = useRef(false);
  const groupMentionConfirmedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestQueue = useRef(Promise.resolve());
  const requestVersion = useRef(0);
  const disposedRef = useRef(false);
  const [actionsCompact, setActionsCompact] = useState(false);
  const snapshot = useRef({
    title: initialTitle,
    subtitle: initialSubtitle ?? "",
    coverUrl: initialCoverUrl ?? "",
    tags: initialTags.join(", "),
    spaceId: initialSpaceId ?? "",
    spaceSlug: initialSpaceSlug ?? "",
    content: initialContent ?? emptyDocument,
  });

  const formDataFromSnapshot = () => {
    const current = snapshot.current;
    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("title", current.title);
    formData.set("subtitle", current.subtitle);
    formData.set("coverUrl", current.coverUrl);
    formData.set("tags", current.tags);
    formData.set("spaceId", current.spaceId);
    formData.set("spaceSlug", current.spaceSlug);
    formData.set("contentJson", JSON.stringify(current.content));
    formData.set(
      "confirmGroupMention",
      groupMentionConfirmedRef.current ? "1" : "0"
    );
    return formData;
  };

  const flushSave = async () => {
    if (status !== "DRAFT" || disposedRef.current) {
      return;
    }
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setSaveState("saving");
    const saveRequest = requestQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (disposedRef.current) {
          return;
        }
        const result = await updateDraft(formDataFromSnapshot());
        if (disposedRef.current || version !== requestVersion.current) {
          return;
        }
        if (result.ok) {
          setSpaceSlug(result.spaceSlug);
          snapshot.current.spaceSlug = result.spaceSlug;
          setSaveState("saved");
        } else {
          setErrorMessage(result.error);
          setSaveState("error");
        }
      });
    requestQueue.current = saveRequest.catch(() => undefined);
    await saveRequest;
  };

  const scheduleSave = () => {
    if (status !== "DRAFT" || disposedRef.current) {
      return;
    }
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setSaveState("saving");
    timer.current = setTimeout(() => {
      if (disposedRef.current) {
        return;
      }
      flushSave().catch(() => {
        if (!disposedRef.current) {
          setSaveState("error");
          setErrorMessage("Não foi possível salvar o rascunho.");
        }
      });
    }, 700);
  };

  const updateSnapshot = (patch: Partial<typeof snapshot.current>) => {
    snapshot.current = { ...snapshot.current, ...patch };
    scheduleSave();
  };

  const uploadCover = async (file: File) => {
    if (coverUploadInFlight.current) {
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage("Envie uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setErrorMessage("A imagem deve ter entre 1 byte e 5 MB.");
      return;
    }

    coverUploadInFlight.current = true;
    setCoverPreviewUrl(URL.createObjectURL(file));
    setIsUploadingCover(true);
    setErrorMessage("");
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
      setCoverUrl(payload.url);
      uploadedCoverUrlRef.current = payload.url;
      setCoverPreviewUrl(null);
      updateSnapshot({ coverUrl: payload.url });
    } catch (uploadError) {
      setErrorMessage(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível enviar a capa."
      );
    } finally {
      coverUploadInFlight.current = false;
      setIsUploadingCover(false);
    }
  };

  useEffect(() => {
    return () => {
      disposedRef.current = true;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  useEffect(() => {
    const sentinel = actionsSentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setActionsCompact(!entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const removeTemporaryCover = async () => {
    const value = uploadedCoverUrlRef.current;
    if (!value) {
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
    } finally {
      uploadedCoverUrlRef.current = null;
    }
  };

  const handlePublish = async () => {
    if (publishingRef.current || disposedRef.current) {
      return;
    }
    publishingRef.current = true;
    setPublishing(true);
    setErrorMessage("");
    try {
      await flushSave();
      const result = await publishPost(formDataFromSnapshot());
      if (result && !result.ok) {
        setErrorMessage(result.error);
      }
    } catch {
      if (!disposedRef.current) {
        setErrorMessage(
          "Não foi possível publicar agora. Seu rascunho foi mantido."
        );
      }
    } finally {
      if (!disposedRef.current) {
        publishingRef.current = false;
        setPublishing(false);
      }
    }
  };

  const editorAction = status === "PUBLISHED" ? updatePost : undefined;
  let coverButtonLabel = coverUrl ? "Trocar capa" : "Adicionar capa";
  if (isUploadingCover) {
    coverButtonLabel = "Enviando…";
  }

  return (
    <div
      className={["community-editor", "pb-12", actionsCompact && "is-scrolled"]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        aria-hidden="true"
        className="community-editor-sticky-sentinel"
        ref={actionsSentinelRef}
      />
      <div className="community-editor-actions">
        <Link className="community-editor-back" href={backHref}>
          <ArrowLeftIcon aria-hidden="true" /> <span>Voltar</span>
        </Link>
        <span aria-hidden="true" className="community-editor-sticky-title">
          {title || draftTitle}
        </span>
        <output aria-live="polite" className="community-editor-save-status">
          {saveState === "error" ? (
            <SaveIcon aria-hidden="true" />
          ) : (
            <CheckIcon aria-hidden="true" />
          )}
          {status === "PUBLISHED" ? "Edição publicada" : saveLabel(saveState)}
        </output>
        <div className="community-editor-action-buttons">
          <Button
            asChild
            className="community-editor-preview"
            variant="outline"
          >
            <Link
              aria-label="Pré-visualizar publicação"
              href={`/comunidade/editor/${postId}?preview=1`}
            >
              <EyeIcon aria-hidden="true" /> <span>Pré-visualizar</span>
            </Link>
          </Button>
          {status === "DRAFT" ? (
            <Button
              className="community-editor-publish"
              disabled={
                publishing || isUploadingCover || isUploadingInlineImage
              }
              onClick={handlePublish}
            >
              {publishing ? "Publicando…" : "Publicar"}
            </Button>
          ) : (
            <Button
              className="community-editor-publish"
              form="community-editor-form"
              type="submit"
            >
              <SaveIcon aria-hidden="true" /> Salvar alterações
            </Button>
          )}
        </div>
      </div>

      {errorMessage && (
        <p
          className="mt-5 border border-destructive/35 bg-destructive/5 px-4 py-3 text-destructive text-sm"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      <form
        action={editorAction}
        className="community-editor-form"
        id="community-editor-form"
      >
        <input name="postId" type="hidden" value={postId} />
        <div className="community-editor-fields">
          <div className="community-editor-publish-target">
            <label
              className="community-editor-publish-label"
              htmlFor="community-post-space"
            >
              Publicar em
            </label>
            <select
              aria-label="Publicar em feed ou grupo de estudo"
              className="community-editor-publish-select"
              id="community-post-space"
              name="spaceId"
              onChange={(event) => {
                const nextSpaceId = event.target.value;
                const nextSpace = spaces.find(({ id }) => id === nextSpaceId);
                setSpaceId(nextSpaceId);
                setSpaceSlug(nextSpace?.slug ?? "");
                updateSnapshot({
                  spaceId: nextSpaceId,
                  spaceSlug: nextSpace?.slug ?? "",
                });
              }}
              value={spaceId}
            >
              <option value="">Feed geral</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.title}
                </option>
              ))}
            </select>
            <input name="spaceSlug" type="hidden" value={spaceSlug} />
            <input name="tags" type="hidden" value={snapshot.current.tags} />
          </div>

          <Input
            aria-label="Título"
            className="community-editor-title"
            name="title"
            onBlur={() => flushSave().catch(() => undefined)}
            onChange={(event) => {
              const nextTitle = event.target.value;
              setTitle(nextTitle);
              updateSnapshot({ title: nextTitle });
            }}
            placeholder="Título da publicação"
            required={status === "PUBLISHED"}
            value={title === draftTitle ? "" : title}
          />

          <Input
            aria-label="Subtítulo opcional"
            className="community-editor-subtitle"
            name="subtitle"
            onBlur={() => flushSave().catch(() => undefined)}
            onChange={(event) => {
              const nextSubtitle = event.target.value;
              setSubtitle(nextSubtitle);
              updateSnapshot({ subtitle: nextSubtitle });
            }}
            placeholder="Subtítulo opcional"
            value={subtitle}
          />

          <div className="community-editor-cover-row">
            <div className="community-editor-cover-controls">
              <Button
                className="community-editor-cover-button"
                onClick={() => coverInputRef.current?.click()}
                type="button"
                variant="outline"
              >
                <ImageIcon aria-hidden="true" />
                {coverButtonLabel}
              </Button>
              {coverUrl || coverPreviewUrl ? (
                <Button
                  aria-label="Remover capa"
                  onClick={() => {
                    removeTemporaryCover().catch(() => undefined);
                    setCoverPreviewUrl(null);
                    setCoverUrl("");
                    updateSnapshot({ coverUrl: "" });
                  }}
                  type="button"
                  variant="ghost"
                >
                  <XIcon aria-hidden="true" />
                </Button>
              ) : null}
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    uploadCover(file).catch(() => undefined);
                  }
                  event.currentTarget.value = "";
                }}
                ref={coverInputRef}
                type="file"
              />
            </div>
            {coverUrl || coverPreviewUrl ? (
              // The authenticated media route resolves the private object.
              // biome-ignore lint/performance/noImgElement: this is a small upload preview.
              <img
                alt="Prévia da capa"
                className="community-editor-cover-preview"
                height={224}
                src={coverPreviewUrl ?? coverUrl}
                width={900}
              />
            ) : null}
            <p className="community-editor-cover-note">
              JPG, PNG ou WebP · até 5 MB. O upload é salvo junto do rascunho.
            </p>
          </div>
        </div>

        <div className="community-editor-body">
          <TopicEditor
            ariaLabel="Conteúdo da publicação"
            defaultValue={content}
            enableCommunityMedia
            onDocumentChange={(nextContent) => {
              setContent(nextContent);
              updateSnapshot({ content: nextContent });
            }}
            onEditorBlur={() => flushSave().catch(() => undefined)}
            onGroupMentionChange={(_hasGroupMention, confirmed) => {
              groupMentionConfirmedRef.current = confirmed;
            }}
            onUploadStateChange={setIsUploadingInlineImage}
          />
        </div>
      </form>
    </div>
  );
}
