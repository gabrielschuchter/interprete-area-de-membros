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
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  publishPost,
  updateDraft,
  updatePost,
} from "@/app/(authenticated)/comunidade/actions";
import { TopicEditor } from "./topic-editor";

type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

interface ComposerSpace {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

interface CommunityComposerProperties {
  readonly backHref: string;
  readonly idempotencyKey: string;
  readonly initialContent: JSONContent;
  readonly initialCoverUrl: string | null;
  readonly initialSpaceId: string | null;
  readonly initialSpaceSlug: string | null;
  readonly initialSubtitle: string | null;
  readonly initialTags: readonly string[];
  readonly initialTitle: string;
  readonly initialUpdatedAt: string | null;
  readonly postId: string | null;
  readonly spaces: readonly ComposerSpace[];
  readonly status: PostStatus;
}

const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
const draftTitle = "Rascunho sem título";
const hasLocalDraftContent = (value: {
  readonly content: JSONContent;
  readonly coverUrl: string;
  readonly subtitle: string;
  readonly tags: string;
  readonly title: string;
}) =>
  Boolean(value.title.trim() && value.title.trim() !== draftTitle) ||
  Boolean(value.subtitle.trim()) ||
  Boolean(value.coverUrl.trim()) ||
  Boolean(value.tags.trim()) ||
  JSON.stringify(value.content) !== JSON.stringify(emptyDocument);

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
  if (state === "conflict") {
    return "Conflito entre abas";
  }
  if (state === "idle") {
    return "Escreva para salvar seu rascunho";
  }
  return "Rascunho salvo · visível só para você";
};

const editorSaveLabel = (
  status: PostStatus,
  dirty: boolean,
  state: SaveState
) => {
  if (status === "PUBLISHED") {
    return dirty ? "Alterações não salvas" : "Edição publicada";
  }
  if (status === "ARCHIVED") {
    return dirty ? "Alterações não salvas" : "Publicação arquivada";
  }
  return saveLabel(state);
};

const publishButtonLabel = (status: PostStatus, publishing: boolean) => {
  if (status === "ARCHIVED") {
    return publishing ? "Republicando…" : "Republicar";
  }
  return publishing ? "Publicando…" : "Publicar";
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
  initialUpdatedAt,
  idempotencyKey,
  postId,
  spaces,
  status,
}: CommunityComposerProperties) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle ?? "");
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl ?? "");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState(initialSpaceId ?? "");
  const [spaceSlug, setSpaceSlug] = useState(initialSpaceSlug ?? "");
  const [content, setContent] = useState<JSONContent>(
    initialContent ?? emptyDocument
  );
  const [saveState, setSaveState] = useState<SaveState>(
    postId ? "saved" : "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [savedPostId, setSavedPostId] = useState(postId);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const actionsSentinelRef = useRef<HTMLDivElement>(null);
  const uploadedCoverUrlRef = useRef<string | null>(null);
  const coverUploadInFlight = useRef(false);
  const publishingRef = useRef(false);
  const groupMentionConfirmedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const postIdRef = useRef(postId);
  const postWasNewRef = useRef(!postId);
  const expectedUpdatedAtRef = useRef(initialUpdatedAt);
  const conflictUpdatedAtRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
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

  const formDataFromSnapshot = (
    current = snapshot.current,
    currentPostId = postIdRef.current
  ) => {
    const formData = new FormData();
    if (currentPostId) {
      formData.set("postId", currentPostId);
      if (expectedUpdatedAtRef.current) {
        formData.set("expectedUpdatedAt", expectedUpdatedAtRef.current);
      }
    } else {
      formData.set("idempotencyKey", idempotencyKey);
    }
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

  const adoptPersistedPostId = (persistedPostId: string) => {
    postIdRef.current = persistedPostId;
    setSavedPostId(persistedPostId);
    if (!postWasNewRef.current) {
      return;
    }
    postWasNewRef.current = false;
    const nextUrl = new URLSearchParams({ from: backHref });
    router.replace(
      `/comunidade/editor/${persistedPostId}?${nextUrl.toString()}`,
      { scroll: false }
    );
  };

  const applyDraftSaveResult = (
    result: Awaited<ReturnType<typeof updateDraft>>,
    nextSnapshot: typeof snapshot.current
  ) => {
    if (disposedRef.current) {
      return false;
    }
    if (!result.ok) {
      if (result.code === "conflict") {
        conflictUpdatedAtRef.current = result.currentUpdatedAt ?? null;
        if (result.currentPostId) {
          adoptPersistedPostId(result.currentPostId);
        }
        setSaveState("conflict");
      } else {
        setSaveState("error");
      }
      setErrorMessage(result.error);
      return false;
    }

    setSpaceSlug(result.spaceSlug);
    snapshot.current.spaceSlug = result.spaceSlug;
    if (result.postId) {
      adoptPersistedPostId(result.postId);
    }
    expectedUpdatedAtRef.current = result.updatedAt;
    dirtyRef.current =
      JSON.stringify(snapshot.current) !== JSON.stringify(nextSnapshot);
    setSaveState(result.saved ? "saved" : "idle");
    return result.saved || !hasLocalDraftContent(nextSnapshot);
  };

  const waitBeforeRetry = (attempt: number) =>
    new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 500 : 1500));

  const saveDraftSnapshot = async (
    nextSnapshot: typeof snapshot.current
  ): Promise<boolean> => {
    const request = formDataFromSnapshot(nextSnapshot);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await updateDraft(request);
        return applyDraftSaveResult(result, nextSnapshot);
      } catch {
        if (attempt < 2) {
          await waitBeforeRetry(attempt);
          continue;
        }
        if (!disposedRef.current) {
          setErrorMessage(
            "Não foi possível salvar por causa da conexão. Tente novamente; suas alterações continuam neste editor."
          );
          setSaveState("error");
        }
      }
    }
    return false;
  };

  const flushSave = async (): Promise<boolean> => {
    if (status !== "DRAFT" || disposedRef.current) {
      return false;
    }
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirtyRef.current) {
      return Boolean(postIdRef.current);
    }
    if (savePromiseRef.current) {
      const priorResult = await savePromiseRef.current;
      if (!dirtyRef.current) {
        return priorResult;
      }
      return flushSave();
    }

    setSaveState("saving");
    setErrorMessage("");
    conflictUpdatedAtRef.current = null;
    const saving = saveDraftSnapshot({ ...snapshot.current });
    savePromiseRef.current = saving;
    const result = await saving;
    if (savePromiseRef.current === saving) {
      savePromiseRef.current = null;
    }
    if (dirtyRef.current && result && !disposedRef.current) {
      return flushSave();
    }
    return result;
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
    dirtyRef.current = true;
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
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnAboutUnsavedChanges);
    return () =>
      window.removeEventListener("beforeunload", warnAboutUnsavedChanges);
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

  const handlePublishResult = (
    result: Awaited<ReturnType<typeof publishPost>>
  ) => {
    if (result.ok) {
      router.push(result.href);
      return;
    }
    if (result.code === "conflict") {
      conflictUpdatedAtRef.current = result.currentUpdatedAt ?? null;
      if (result.currentPostId) {
        adoptPersistedPostId(result.currentPostId);
      }
      setSaveState("conflict");
    }
    setErrorMessage(result.error);
  };

  const publishSavedDraft = async () => {
    const currentPostId = postIdRef.current;
    if (!currentPostId) {
      setErrorMessage("Salve o rascunho antes de publicar.");
      return;
    }
    const result = await publishPost(
      formDataFromSnapshot(snapshot.current, currentPostId)
    );
    handlePublishResult(result);
  };

  const saveDraftBeforePublishing = async () => {
    const saved = await flushSave();
    if (!saved) {
      setErrorMessage(
        postIdRef.current
          ? "Resolva o salvamento do rascunho antes de publicar."
          : "Escreva o título e o conteúdo antes de publicar."
      );
    }
    return saved;
  };

  const handlePublish = async () => {
    if (publishingRef.current || disposedRef.current) {
      return;
    }
    publishingRef.current = true;
    setPublishing(true);
    setErrorMessage("");
    try {
      const saved =
        status === "ARCHIVED"
          ? await updatePublishedPost()
          : await saveDraftBeforePublishing();
      if (saved) {
        await publishSavedDraft();
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

  const updatePublishedPost = async () => {
    const currentPostId = postIdRef.current;
    if (!currentPostId) {
      setErrorMessage("Salve o rascunho antes de continuar.");
      return false;
    }
    if (!dirtyRef.current) {
      return true;
    }
    const result = await updatePost(
      formDataFromSnapshot(snapshot.current, currentPostId)
    );
    if (!result.ok) {
      if (result.code === "conflict") {
        conflictUpdatedAtRef.current = result.currentUpdatedAt ?? null;
        if (result.currentPostId) {
          postIdRef.current = result.currentPostId;
          setSavedPostId(result.currentPostId);
        }
        setSaveState("conflict");
      }
      setErrorMessage(result.error);
      return false;
    }
    expectedUpdatedAtRef.current = result.updatedAt;
    dirtyRef.current = false;
    setSaveState("saved");
    setErrorMessage("");
    return true;
  };

  const handlePublishedSave = async () => {
    try {
      setSaveState("saving");
      setErrorMessage("");
      await updatePublishedPost();
    } catch {
      setSaveState("error");
      setErrorMessage(
        "Não foi possível salvar por causa da conexão. Tente novamente."
      );
    }
  };

  const handleKeepLocalVersion = async () => {
    const latestVersion = conflictUpdatedAtRef.current;
    if (!latestVersion) {
      return;
    }
    expectedUpdatedAtRef.current = latestVersion;
    conflictUpdatedAtRef.current = null;
    dirtyRef.current = true;
    setSaveState("idle");
    setErrorMessage("");
    if (status === "DRAFT") {
      await flushSave();
      return;
    }
    await handlePublishedSave();
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handlePublishedSave().catch(() => undefined);
  };

  const handleLeave = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (leaving) {
      return;
    }
    if (isUploadingCover || isUploadingInlineImage) {
      setErrorMessage("Aguarde o envio da imagem antes de sair do editor.");
      return;
    }
    setLeaving(true);
    try {
      let canLeave = true;
      if (status === "DRAFT") {
        const hasDraftToSave =
          Boolean(postIdRef.current) || hasLocalDraftContent(snapshot.current);
        canLeave = !hasDraftToSave || (await flushSave());
      } else if (dirtyRef.current) {
        canLeave = await updatePublishedPost();
      }
      if (canLeave) {
        router.push(backHref);
      }
    } catch {
      setErrorMessage(
        "Não foi possível salvar antes de sair. Tente novamente quando a conexão voltar."
      );
      setSaveState("error");
    } finally {
      setLeaving(false);
    }
  };

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
        <Link
          aria-disabled={leaving}
          className="community-editor-back"
          href={backHref}
          onClick={(event) => handleLeave(event).catch(() => undefined)}
        >
          <ArrowLeftIcon aria-hidden="true" />
          <span>{leaving ? "Salvando…" : "Voltar"}</span>
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
          {editorSaveLabel(status, dirtyRef.current, saveState)}
        </output>
        <div className="community-editor-action-buttons">
          {savedPostId ? (
            <Button
              asChild
              className="community-editor-preview"
              variant="outline"
            >
              <Link
                aria-label="Pré-visualizar publicação"
                href={`/comunidade/editor/${savedPostId}?${new URLSearchParams({ from: backHref, preview: "1" }).toString()}`}
              >
                <EyeIcon aria-hidden="true" /> <span>Pré-visualizar</span>
              </Link>
            </Button>
          ) : (
            <Button
              className="community-editor-preview"
              disabled
              type="button"
              variant="outline"
            >
              <EyeIcon aria-hidden="true" /> <span>Pré-visualizar</span>
            </Button>
          )}
          {status !== "PUBLISHED" ? (
            <Button
              className="community-editor-publish"
              disabled={
                publishing || isUploadingCover || isUploadingInlineImage
              }
              onClick={handlePublish}
              type="button"
            >
              {publishButtonLabel(status, publishing)}
            </Button>
          ) : (
            <Button
              className="community-editor-publish"
              onClick={handlePublishedSave}
              type="button"
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
      {saveState === "error" && (
        <Button
          className="mt-3"
          onClick={() =>
            (status === "DRAFT" ? flushSave() : handlePublishedSave()).catch(
              () => undefined
            )
          }
          type="button"
          variant="outline"
        >
          Tentar salvar novamente
        </Button>
      )}
      {saveState === "conflict" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => window.location.reload()}
            type="button"
            variant="outline"
          >
            Recarregar versão salva
          </Button>
          <Button
            onClick={() => handleKeepLocalVersion().catch(() => undefined)}
            type="button"
            variant="outline"
          >
            Manter minha versão
          </Button>
        </div>
      )}

      <form
        className="community-editor-form"
        id="community-editor-form"
        onSubmit={handleFormSubmit}
      >
        {savedPostId ? (
          <input name="postId" type="hidden" value={savedPostId} />
        ) : (
          <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
        )}
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
              updateSnapshot({ title: nextTitle || draftTitle });
            }}
            placeholder="Título da publicação"
            required={status !== "DRAFT"}
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
