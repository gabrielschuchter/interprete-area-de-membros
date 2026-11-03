"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/design-system/components/ui/alert-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import type { JSONContent } from "@tiptap/core";
import {
  ArrowLeftIcon,
  CheckIcon,
  EyeIcon,
  FolderInputIcon,
  ImageIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useMemberNavigation } from "@/app/(authenticated)/components/member-navigation-context";
import {
  discardCommunityDraft,
  publishPost,
  updateDraft,
  updatePost,
} from "@/app/(authenticated)/comunidade/actions";
import { CommunityEditorField } from "./community-editor-field";
import { TopicEditor } from "./topic-editor";

type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

interface ComposerSpace {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly visibility: "PUBLIC" | "PRIVATE";
}

interface CommunityComposerProperties {
  readonly backHref: string;
  readonly enableCoverAltText?: boolean;
  readonly idempotencyKey: string;
  readonly initialContent: JSONContent;
  readonly initialCoverAltText?: string;
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

const documentHasText = (value: JSONContent): boolean => {
  if (typeof value.text === "string" && value.text.trim()) {
    return true;
  }
  return value.content?.some(documentHasText) ?? false;
};

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

const publishConfirmLabel = (
  status: PostStatus,
  publishing: boolean,
  spaceTitle: string | null
) => {
  if (status === "ARCHIVED") {
    return publishing ? "Republicando…" : "Republicar";
  }
  if (publishing) {
    return "Publicando…";
  }
  return spaceTitle ? `Publicar em ${spaceTitle}` : "Publicar no feed";
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the editor coordinates autosave, preview, publish, and metadata controls as one deliberate workflow.
export function CommunityComposer({
  backHref,
  initialContent,
  initialCoverAltText = "",
  initialCoverUrl,
  enableCoverAltText = false,
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
  const memberNavigation = useMemberNavigation();
  // Leaving goes through the shell when there is one, so the destination gets
  // its cover and transition like any other link; tests render without it.
  const leaveTo = (href: string) =>
    memberNavigation ? memberNavigation.navigate(href) : router.push(href);
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle ?? "");
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl ?? "");
  const [coverAltText, setCoverAltText] = useState(initialCoverAltText);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverUploadPercent, setCoverUploadPercent] = useState(0);
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
  const [stripHost, setStripHost] = useState<HTMLDivElement | null>(null);
  const [inlineHost, setInlineHost] = useState<HTMLDivElement | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [groupMention, setGroupMention] = useState({ count: 0, has: false });
  const [groupMentionConfirmed, setGroupMentionConfirmed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [savedPostId, setSavedPostId] = useState(postId);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
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
  const snapshot = useRef({
    title: initialTitle,
    subtitle: initialSubtitle ?? "",
    coverAltText: initialCoverAltText,
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
    formData.set("coverAltText", current.coverAltText);
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
    // Trocar a URL sem navegar: router.replace remontava o editor no primeiro
    // salvamento e engolia o foco, o cursor e a menção em andamento.
    window.history.replaceState(
      window.history.state,
      "",
      `/comunidade/editor/${persistedPostId}?${nextUrl.toString()}`
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
    if (status !== "DRAFT") {
      setSaveState("idle");
    }
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
    setCoverUploadPercent(0);
    setErrorMessage("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("assetType", "community-cover");
      const payload = await new Promise<{ error?: string; url?: string }>(
        (resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("POST", "/api/member-assets");
          request.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setCoverUploadPercent(
                Math.round((event.loaded / event.total) * 100)
              );
            }
          };
          request.onerror = () => reject(new Error("Falha de conexão."));
          request.onload = () => {
            try {
              const response = JSON.parse(request.responseText) as {
                error?: string;
                url?: string;
              };
              if (request.status >= 200 && request.status < 300) {
                resolve(response);
              } else {
                reject(new Error(response.error ?? "Falha no envio da capa."));
              }
            } catch {
              reject(new Error("Não foi possível confirmar o envio da capa."));
            }
          };
          request.send(formData);
        }
      );
      if (!payload.url) {
        throw new Error(payload.error ?? "Não foi possível enviar a capa.");
      }
      setCoverUrl(payload.url);
      uploadedCoverUrlRef.current = payload.url;
      setCoverPreviewUrl(null);
      updateSnapshot({ coverUrl: payload.url });
      setCoverUploadPercent(100);
    } catch (uploadError) {
      setCoverPreviewUrl(null);
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

  const requestLeave = (event: {
    preventDefault: () => void;
    stopPropagation?: () => void;
  }) => {
    event.preventDefault();
    event.stopPropagation?.();
    if (leaving || exitDialogOpen) {
      return;
    }
    if (isUploadingCover || isUploadingInlineImage) {
      setErrorMessage("Aguarde o envio da imagem antes de sair do editor.");
      return;
    }
    if (!dirtyRef.current) {
      leaveTo(backHref);
      return;
    }
    setExitDialogOpen(true);
  };

  const saveAndLeave = async () => {
    if (leaving) {
      return;
    }
    setLeaving(true);
    try {
      const saved =
        !dirtyRef.current ||
        (status === "DRAFT" ? await flushSave() : await updatePublishedPost());
      if (saved) {
        setExitDialogOpen(false);
        leaveTo(backHref);
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

  const discardAndLeave = async () => {
    if (leaving) {
      return;
    }
    setLeaving(true);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    try {
      const currentPostId = postIdRef.current;
      if (currentPostId) {
        const formData = new FormData();
        formData.set("postId", currentPostId);
        const result = await discardCommunityDraft(formData);
        if (!result.ok) {
          setErrorMessage(
            "Não foi possível descartar este rascunho. Atualize a página e tente novamente."
          );
          return;
        }
        if (backHref.startsWith("/comunidade/minhas-publicacoes")) {
          const separator = backHref.includes("?") ? "&" : "?";
          const undoState = new URLSearchParams({
            undoPost: currentPostId,
            undoUntil: String(Date.parse(result.deletedAt) + 8000),
          });
          router.push(`${backHref}${separator}${undoState.toString()}`);
          return;
        }
      }
      await removeTemporaryCover();
      leaveTo(backHref);
    } catch {
      setErrorMessage("Não foi possível descartar o rascunho agora.");
    } finally {
      setLeaving(false);
      setExitDialogOpen(false);
    }
  };

  const saveDestination = async () => {
    setSaveState("saving");
    setErrorMessage("");
    try {
      if (await updatePublishedPost()) {
        setPublishOpen(false);
      } else if (conflictUpdatedAtRef.current === null) {
        setSaveState("error");
      }
    } catch {
      setSaveState("error");
      setErrorMessage(
        "Não foi possível salvar por causa da conexão. Tente novamente."
      );
    }
  };

  const chooseSpace = (nextSpaceId: string) => {
    const nextSpace = spaces.find(({ id }) => id === nextSpaceId);
    setSpaceId(nextSpaceId);
    setSpaceSlug(nextSpace?.slug ?? "");
    updateSnapshot({
      spaceId: nextSpaceId,
      spaceSlug: nextSpace?.slug ?? "",
    });
  };

  const focusBody = () =>
    bodyRef.current?.querySelector<HTMLElement>("[role=textbox]")?.focus();

  const selectedSpace = spaces.find((space) => space.id === spaceId) ?? null;
  const isMoveDialog = status === "PUBLISHED";
  const uploading = isUploadingCover || isUploadingInlineImage;
  const showNotice =
    Boolean(errorMessage) || saveState === "error" || saveState === "conflict";
  const hasCover = Boolean(coverUrl || coverPreviewUrl);
  const destinationOptions = [
    { id: "", note: "Visível para todos os membros", title: "Feed geral" },
    ...spaces.map((space) => ({
      id: space.id,
      note:
        space.visibility === "PRIVATE"
          ? "Grupo privado · só os membros veem"
          : "Grupo de estudo",
      title: space.title,
    })),
  ];
  const confirmBlocked =
    publishing ||
    uploading ||
    leaving ||
    (groupMention.has && !groupMentionConfirmed);

  return (
    <div className="community-editor">
      <div className="community-editor-bar">
        <Link
          aria-disabled={leaving}
          className="community-editor-back"
          data-member-navigation="manual"
          href={backHref}
          onClickCapture={requestLeave}
        >
          <ArrowLeftIcon aria-hidden="true" />
          <span>{leaving ? "Salvando…" : "Voltar"}</span>
        </Link>
        <output aria-live="polite" className="community-editor-save-status">
          {saveState === "error" ? (
            <SaveIcon aria-hidden="true" />
          ) : (
            <CheckIcon aria-hidden="true" />
          )}
          <span>{editorSaveLabel(status, dirtyRef.current, saveState)}</span>
        </output>
        <div className="community-editor-action-buttons">
          {savedPostId ? (
            <Button
              asChild
              className="community-editor-preview"
              variant="ghost"
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
              variant="ghost"
            >
              <EyeIcon aria-hidden="true" /> <span>Pré-visualizar</span>
            </Button>
          )}
          {isMoveDialog && spaces.length > 0 ? (
            <Button
              aria-label="Onde a publicação aparece"
              className="community-editor-destination"
              onClick={() => setPublishOpen(true)}
              type="button"
              variant="ghost"
            >
              <FolderInputIcon aria-hidden="true" />{" "}
              <span>{selectedSpace?.title ?? "Feed geral"}</span>
            </Button>
          ) : null}
          {isMoveDialog ? (
            <Button
              className="community-editor-publish"
              disabled={uploading || leaving}
              onClick={handlePublishedSave}
              type="button"
              variant="ghost"
            >
              <SaveIcon aria-hidden="true" /> Salvar alterações
            </Button>
          ) : (
            <Button
              className="community-editor-publish"
              disabled={
                publishing ||
                uploading ||
                title.trim().length < 4 ||
                !documentHasText(content)
              }
              onClick={() => {
                setErrorMessage("");
                setPublishOpen(true);
              }}
              type="button"
              variant="ghost"
            >
              {status === "ARCHIVED" ? "Republicar" : "Publicar"}
            </Button>
          )}
        </div>
      </div>

      {showNotice && !publishOpen ? (
        <div className="community-editor-notice" role="alert">
          {errorMessage ? <p>{errorMessage}</p> : null}
          {saveState === "error" ? (
            <div className="community-editor-notice-actions">
              <button
                onClick={() =>
                  (status === "DRAFT"
                    ? flushSave()
                    : handlePublishedSave()
                  ).catch(() => undefined)
                }
                type="button"
              >
                Tentar salvar novamente
              </button>
            </div>
          ) : null}
          {saveState === "conflict" ? (
            <div className="community-editor-notice-actions">
              <button onClick={() => window.location.reload()} type="button">
                Recarregar versão salva
              </button>
              <button
                onClick={() => handleKeepLocalVersion().catch(() => undefined)}
                type="button"
              >
                Manter minha versão
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="community-editor-strip-host" ref={setStripHost} />

      <div className="community-editor-page">
        <div className="community-editor-sheet">
          <form
            className="community-editor-form"
            id="community-editor-form"
            onSubmit={handleFormSubmit}
          >
            {savedPostId ? (
              <input name="postId" type="hidden" value={savedPostId} />
            ) : (
              <input
                name="idempotencyKey"
                type="hidden"
                value={idempotencyKey}
              />
            )}
            <input name="spaceId" type="hidden" value={spaceId} />
            <input name="spaceSlug" type="hidden" value={spaceSlug} />
            <input name="tags" type="hidden" value={snapshot.current.tags} />

            {hasCover ? (
              <div className="community-editor-cover">
                {/* The authenticated media route resolves the private object. */}
                {/* biome-ignore lint/performance/noImgElement: this is a small upload preview. */}
                <img
                  alt={coverAltText || `Capa: ${title || draftTitle}`}
                  className="community-editor-cover-preview"
                  height={224}
                  src={coverPreviewUrl ?? coverUrl}
                  width={900}
                />
                <div className="community-editor-cover-controls">
                  <button
                    disabled={isUploadingCover}
                    onClick={() => coverInputRef.current?.click()}
                    type="button"
                  >
                    <ImageIcon aria-hidden="true" />
                    {isUploadingCover ? "Enviando…" : "Trocar capa"}
                  </button>
                  <button
                    aria-label="Remover capa"
                    disabled={isUploadingCover}
                    onClick={() => {
                      removeTemporaryCover().catch(() => undefined);
                      setCoverPreviewUrl(null);
                      setCoverUrl("");
                      updateSnapshot({ coverUrl: "" });
                    }}
                    type="button"
                  >
                    <Trash2Icon aria-hidden="true" />
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="community-editor-cover-add"
                onClick={() => coverInputRef.current?.click()}
                title="JPG, PNG ou WebP, até 5 MB"
                type="button"
              >
                <ImageIcon aria-hidden="true" />
                Adicionar capa
              </button>
            )}
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-label="Arquivo da capa"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  uploadCover(file).catch(() => undefined);
                }
                event.currentTarget.value = "";
              }}
              ref={coverInputRef}
              tabIndex={-1}
              type="file"
            />
            {isUploadingCover ? (
              <div
                aria-label={`Enviando capa: ${coverUploadPercent}%`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={coverUploadPercent}
                className="community-editor-cover-progress"
                role="progressbar"
              >
                <span style={{ width: `${coverUploadPercent}%` }} />
              </div>
            ) : null}
            {enableCoverAltText && coverUrl ? (
              <label className="community-editor-cover-alt">
                <span>Texto alternativo</span>
                <input
                  aria-label="Texto alternativo da capa"
                  className="community-editor-cover-alt-input"
                  maxLength={500}
                  onBlur={() => flushSave().catch(() => undefined)}
                  onChange={(event) => {
                    const nextAltText = event.target.value;
                    setCoverAltText(nextAltText);
                    updateSnapshot({ coverAltText: nextAltText });
                  }}
                  placeholder="Descreva a imagem para quem usa leitor de tela"
                  value={coverAltText}
                />
              </label>
            ) : null}

            <CommunityEditorField
              aria-label="Título"
              className="community-editor-title"
              name="title"
              onBlur={() => flushSave().catch(() => undefined)}
              onEnter={focusBody}
              onValueChange={(nextTitle) => {
                setTitle(nextTitle);
                updateSnapshot({ title: nextTitle || draftTitle });
              }}
              placeholder="Título da publicação"
              required={status !== "DRAFT"}
              value={title === draftTitle ? "" : title}
            />
            <CommunityEditorField
              aria-label="Subtítulo opcional"
              className="community-editor-subtitle"
              name="subtitle"
              onBlur={() => flushSave().catch(() => undefined)}
              onEnter={focusBody}
              onValueChange={(nextSubtitle) => {
                setSubtitle(nextSubtitle);
                updateSnapshot({ subtitle: nextSubtitle });
              }}
              placeholder="Subtítulo opcional"
              value={subtitle}
            />
            <div aria-hidden="true" className="community-editor-rule" />

            <div className="community-editor-inline-host" ref={setInlineHost} />

            <div className="community-editor-body" ref={bodyRef}>
              <TopicEditor
                ariaLabel="Conteúdo da publicação"
                compactToolbarTarget={inlineHost}
                defaultValue={content}
                enableCommunityMedia
                groupMentionConfirmed={groupMentionConfirmed}
                hideGroupMentionConfirmation
                onDocumentChange={(nextContent) => {
                  setContent(nextContent);
                  updateSnapshot({ content: nextContent });
                }}
                onEditorBlur={() => flushSave().catch(() => undefined)}
                onGroupMentionChange={(hasGroup, confirmed, count) => {
                  groupMentionConfirmedRef.current = confirmed;
                  setGroupMention((previous) =>
                    previous.has === hasGroup && previous.count === count
                      ? previous
                      : { count, has: hasGroup }
                  );
                }}
                onGroupMentionConfirmedChange={(confirmed) => {
                  groupMentionConfirmedRef.current = confirmed;
                  setGroupMentionConfirmed(confirmed);
                }}
                onUploadStateChange={setIsUploadingInlineImage}
                toolbarTarget={stripHost}
              />
            </div>
          </form>
        </div>
      </div>

      <Dialog onOpenChange={setPublishOpen} open={publishOpen}>
        <DialogContent
          className="community-publish-dialog"
          showCloseButton={false}
        >
          <DialogTitle className="community-publish-title">
            {isMoveDialog ? "Onde a publicação aparece" : "Publicar"}
          </DialogTitle>
          <DialogDescription className="community-publish-subtitle">
            {isMoveDialog
              ? "Escolha o destino e salve as alterações."
              : "Escolha onde a publicação aparece. Você pode editar depois."}
          </DialogDescription>
          <fieldset className="community-publish-options">
            <legend className="community-publish-label">Publicar em</legend>
            {destinationOptions.map((option) => (
              <label
                className="community-publish-option"
                key={option.id || "feed"}
              >
                <input
                  checked={option.id === spaceId}
                  className="sr-only"
                  name="community-publish-destination"
                  onChange={() => chooseSpace(option.id)}
                  type="radio"
                  value={option.id}
                />
                <span aria-hidden="true" className="community-publish-radio" />
                <span>
                  {option.title}
                  <small>{option.note}</small>
                </span>
              </label>
            ))}
          </fieldset>
          {selectedSpace?.visibility === "PRIVATE" ? (
            <p className="community-publish-private">
              Esta publicação ficará visível apenas para membros do grupo.
            </p>
          ) : null}
          {groupMention.has ? (
            <label className="community-publish-confirm">
              <input
                checked={groupMentionConfirmed}
                className="community-publish-confirm-box"
                onChange={(event) => {
                  groupMentionConfirmedRef.current = event.target.checked;
                  setGroupMentionConfirmed(event.target.checked);
                }}
                type="checkbox"
              />
              <span>
                Você mencionou um grupo e vai notificar{" "}
                <strong>
                  {groupMention.count
                    ? `${groupMention.count} membros`
                    : "os membros do grupo"}
                </strong>
                . Confirme o envio para continuar.
              </span>
            </label>
          ) : null}
          {errorMessage && publishOpen ? (
            <p className="community-publish-private" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div className="community-publish-actions">
            <button
              className="community-publish-secondary"
              disabled={publishing}
              onClick={() => setPublishOpen(false)}
              type="button"
            >
              Voltar a escrever
            </button>
            <button
              className="community-publish-primary"
              disabled={confirmBlocked}
              onClick={() =>
                (isMoveDialog ? saveDestination() : handlePublish()).catch(
                  () => undefined
                )
              }
              type="button"
            >
              {isMoveDialog
                ? "Salvar alterações"
                : publishConfirmLabel(
                    status,
                    publishing,
                    selectedSpace?.title ?? null
                  )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setExitDialogOpen} open={exitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do editor?</AlertDialogTitle>
            <AlertDialogDescription>
              {status === "DRAFT"
                ? "Suas alterações ainda podem estar salvando. Você pode manter o rascunho ou descartá-lo."
                : "Salve as alterações antes de sair para manter sua publicação atualizada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>
              Continuar editando
            </AlertDialogCancel>
            {status === "DRAFT" ? (
              <Button
                disabled={leaving}
                onClick={() => saveAndLeave().catch(() => undefined)}
                type="button"
                variant="outline"
              >
                {leaving ? "Salvando…" : "Sair e manter rascunho"}
              </Button>
            ) : (
              <Button
                disabled={leaving}
                onClick={() => saveAndLeave().catch(() => undefined)}
                type="button"
              >
                {leaving ? "Salvando…" : "Salvar e sair"}
              </Button>
            )}
            {status === "DRAFT" ? (
              <Button
                disabled={leaving}
                onClick={() => discardAndLeave().catch(() => undefined)}
                type="button"
                variant="destructive"
              >
                Descartar rascunho
              </Button>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
