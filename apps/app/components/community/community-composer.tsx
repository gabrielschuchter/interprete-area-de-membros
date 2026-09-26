"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import type { JSONContent } from "@tiptap/core";
import {
  EyeIcon,
  FileTextIcon,
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

type PostKind = "DISCUSSION" | "PUBLICATION";
type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type SaveState = "idle" | "saving" | "saved" | "error";

interface ComposerSpace {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

interface CommunityComposerProperties {
  readonly initialContent: JSONContent;
  readonly initialCoverUrl: string | null;
  readonly initialKind: PostKind;
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
    return "Salvo";
  }
  if (state === "error") {
    return "Não foi possível salvar";
  }
  return "Rascunho persistente";
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the editor coordinates autosave, preview, publish, and metadata controls as one deliberate workflow.
export function CommunityComposer({
  initialContent,
  initialCoverUrl,
  initialKind,
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
  const [tags, setTags] = useState(initialTags.join(", "));
  const [kind, setKind] = useState<PostKind>(initialKind);
  const [spaceId, setSpaceId] = useState(initialSpaceId ?? "");
  const [spaceSlug, setSpaceSlug] = useState(initialSpaceSlug ?? "");
  const [content, setContent] = useState<JSONContent>(
    initialContent ?? emptyDocument
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestQueue = useRef(Promise.resolve());
  const requestVersion = useRef(0);
  const snapshot = useRef({
    title: initialTitle,
    subtitle: initialSubtitle ?? "",
    coverUrl: initialCoverUrl ?? "",
    tags: initialTags.join(", "),
    kind: initialKind,
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
    formData.set("kind", current.kind);
    formData.set("spaceId", current.spaceId);
    formData.set("spaceSlug", current.spaceSlug);
    formData.set("contentJson", JSON.stringify(current.content));
    return formData;
  };

  const flushSave = async () => {
    if (status !== "DRAFT") {
      return;
    }
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setSaveState("saving");
    requestQueue.current = requestQueue.current.then(async () => {
      const result = await updateDraft(formDataFromSnapshot());
      if (version !== requestVersion.current) {
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
    await requestQueue.current;
  };

  const scheduleSave = () => {
    if (status !== "DRAFT") {
      return;
    }
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setSaveState("saving");
    timer.current = setTimeout(() => {
      flushSave().catch(() => {
        setSaveState("error");
        setErrorMessage("Não foi possível salvar o rascunho.");
      });
    }, 700);
  };

  const updateSnapshot = (patch: Partial<typeof snapshot.current>) => {
    snapshot.current = { ...snapshot.current, ...patch };
    scheduleSave();
  };

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }

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
      updateSnapshot({ coverUrl: payload.url });
    } catch (uploadError) {
      setErrorMessage(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível enviar a capa."
      );
    } finally {
      setIsUploadingCover(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const handlePublish = async () => {
    setPublishing(true);
    setErrorMessage("");
    try {
      await flushSave();
      const result = await publishPost(formDataFromSnapshot());
      if (result && !result.ok) {
        setErrorMessage(result.error);
      }
    } catch {
      setErrorMessage(
        "Não foi possível publicar agora. Seu rascunho foi mantido."
      );
    } finally {
      setPublishing(false);
    }
  };

  const isPublication = kind === "PUBLICATION";
  const editorAction = status === "PUBLISHED" ? updatePost : undefined;

  return (
    <div className="mt-10 pb-12">
      <div className="sticky top-0 z-10 -mx-5 flex flex-wrap items-center justify-between gap-3 border-border border-b bg-background/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
        <output
          aria-live="polite"
          className="inline-flex items-center gap-2 text-muted-foreground text-sm"
        >
          <SaveIcon aria-hidden="true" className="size-4" />
          {status === "PUBLISHED" ? "Edição publicada" : saveLabel(saveState)}
        </output>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/comunidade/editor/${postId}?preview=1`}>
              <EyeIcon aria-hidden="true" /> Pré-visualizar
            </Link>
          </Button>
          {status === "DRAFT" ? (
            <Button disabled={publishing} onClick={handlePublish} size="sm">
              {publishing ? "Publicando…" : "Publicar"}
            </Button>
          ) : (
            <Button form="community-editor-form" size="sm" type="submit">
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
        className="mx-auto mt-8 max-w-4xl space-y-8"
        id="community-editor-form"
      >
        <input name="postId" type="hidden" value={postId} />
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
            <FileTextIcon aria-hidden="true" className="size-4" />
            <select
              aria-label="Tipo de conteúdo"
              className="h-9 rounded-sm border bg-background px-3 text-foreground text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
              name="kind"
              onChange={(event) => {
                const nextKind = event.target.value as PostKind;
                setKind(nextKind);
                updateSnapshot({ kind: nextKind });
              }}
              value={kind}
            >
              <option value="PUBLICATION">Publicação</option>
              <option value="DISCUSSION">Discussão rápida</option>
            </select>
            <span>·</span>
            <select
              aria-label="Espaço da comunidade"
              className="h-9 max-w-full rounded-sm border bg-background px-3 text-foreground text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
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
          </div>

          <Input
            aria-label="Título"
            className="h-auto rounded-none border-0 border-b px-0 py-3 font-display text-4xl shadow-none focus-visible:ring-0 sm:text-6xl"
            name="title"
            onBlur={() => flushSave().catch(() => undefined)}
            onChange={(event) => {
              const nextTitle = event.target.value;
              setTitle(nextTitle);
              updateSnapshot({ title: nextTitle });
            }}
            placeholder={
              isPublication
                ? "Dê um título ao que você quer dizer"
                : "Qual é a sua pergunta?"
            }
            required={status === "PUBLISHED"}
            value={title === draftTitle ? "" : title}
          />

          {isPublication && (
            <Input
              aria-label="Subtítulo opcional"
              className="h-auto rounded-none border-0 px-0 py-2 text-xl shadow-none focus-visible:ring-0 sm:text-2xl"
              name="subtitle"
              onBlur={() => flushSave().catch(() => undefined)}
              onChange={(event) => {
                const nextSubtitle = event.target.value;
                setSubtitle(nextSubtitle);
                updateSnapshot({ subtitle: nextSubtitle });
              }}
              placeholder="Um subtítulo opcional para orientar a leitura"
              value={subtitle}
            />
          )}

          <div className="border-border border-y py-4">
            <div className="flex flex-wrap items-center gap-3">
              <ImageIcon aria-hidden="true" className="size-4" />
              <span className="text-muted-foreground text-sm">
                {isPublication ? "Capa da publicação" : "Imagem de capa"}
              </span>
              <Button
                onClick={() => coverInputRef.current?.click()}
                size="sm"
                type="button"
                variant="outline"
              >
                {isUploadingCover ? "Enviando…" : "Escolher imagem"}
              </Button>
              {coverUrl ? (
                <Button
                  aria-label="Remover capa"
                  onClick={() => {
                    setCoverUrl("");
                    updateSnapshot({ coverUrl: "" });
                  }}
                  size="icon"
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
            {coverUrl ? (
              // The authenticated media route resolves the private object.
              // biome-ignore lint/performance/noImgElement: this is a small upload preview.
              <img
                alt="Prévia da capa"
                className="mt-4 max-h-56 w-full rounded-sm border object-cover"
                height={224}
                src={coverUrl}
                width={900}
              />
            ) : null}
            <p className="mt-2 text-muted-foreground text-xs">
              JPG, PNG ou WebP · até 5 MB. O upload é salvo junto do rascunho.
            </p>
          </div>
        </div>

        <div>
          <TopicEditor
            ariaLabel={
              isPublication ? "Texto da publicação" : "Texto da discussão"
            }
            defaultValue={content}
            onDocumentChange={(nextContent) => {
              setContent(nextContent);
              updateSnapshot({ content: nextContent });
            }}
            onEditorBlur={() => flushSave().catch(() => undefined)}
          />
        </div>

        <label className="block max-w-xl" htmlFor="community-editor-tags">
          <span className="brand-eyebrow">Tags</span>
          <Input
            className="mt-2"
            id="community-editor-tags"
            name="tags"
            onBlur={() => flushSave().catch(() => undefined)}
            onChange={(event) => {
              const nextTags = event.target.value;
              setTags(nextTags);
              updateSnapshot({ tags: nextTags });
            }}
            placeholder="epidemiologia, causalidade, meta-análise"
            value={tags}
          />
          <span className="mt-2 block text-muted-foreground text-xs">
            Separe por vírgulas. Até cinco tags.
          </span>
        </label>
      </form>
    </div>
  );
}
