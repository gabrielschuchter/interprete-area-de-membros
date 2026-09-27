"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import type { JSONContent } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  Code2Icon,
  FileIcon,
  Heading2Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  articleUrlFrom,
  directVideoUrl,
  extractDoi,
  isScientificArticleReference,
  videoEmbedFromUrl,
} from "@/lib/community-media";
import {
  CommunityArticleNode,
  CommunityFileNode,
  CommunityVideoNode,
} from "./community-media-nodes";
import { MentionNode } from "./mention-extension";

const mentionQueryPattern = /(?:^|\s)@([a-z0-9-]{0,30})$/i;

const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

type MentionKind = "USER" | "GROUP";

const groupMentionSummary = (value: JSONContent) => {
  const groups = new Map<string, number>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    if (record.type === "mention" && record.attrs) {
      const attrs = record.attrs as Record<string, unknown>;
      if (attrs.kind === "GROUP" && typeof attrs.id === "string") {
        groups.set(
          attrs.id,
          typeof attrs.recipientCount === "number" ? attrs.recipientCount : 0
        );
      }
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return {
    count: [...groups.values()].reduce((total, count) => total + count, 0),
    hasGroup: groups.size > 0,
  };
};

interface TopicEditorProperties {
  readonly ariaLabel?: string;
  readonly defaultValue?: JSONContent;
  readonly enableCommunityMedia?: boolean;
  readonly name?: string;
  readonly onDocumentChange?: (value: JSONContent) => void;
  readonly onEditorBlur?: () => void;
  readonly onGroupMentionChange?: (
    hasGroupMention: boolean,
    confirmed: boolean
  ) => void;
  readonly onUploadStateChange?: (uploading: boolean) => void;
}

interface MentionCandidate {
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
  readonly id: string;
  readonly kind?: MentionKind;
  readonly recipientCount?: number;
  readonly role: string;
  readonly username: string;
}

interface MentionState {
  readonly from: number;
  readonly query: string;
  readonly to: number;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the shared editor coordinates formatting, mentions, image uploads, and community-only media controls.
export function TopicEditor({
  defaultValue,
  enableCommunityMedia = false,
  name = "contentJson",
  onDocumentChange,
  onEditorBlur,
  onGroupMentionChange,
  onUploadStateChange,
  ariaLabel = "Conteúdo do tópico",
}: TopicEditorProperties) {
  const [value, setValue] = useState<JSONContent>(
    defaultValue ?? emptyDocument
  );
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showImageField, setShowImageField] = useState(false);
  const [showLinkField, setShowLinkField] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<
    MentionCandidate[]
  >([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [groupMentionConfirmed, setGroupMentionConfirmed] = useState(false);
  const mentionStateRef = useRef<MentionState | null>(null);
  const mentionCandidatesRef = useRef<MentionCandidate[]>([]);
  const groupMentionConfirmedRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const pendingPreviewUrls = useRef(new Set<string>());
  const pendingFileKeys = useRef(new Set<string>());
  const pendingUploads = useRef(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, linkOnPaste: true },
      }),
      MentionNode,
      Image.configure({ allowBase64: false }),
      ...(enableCommunityMedia
        ? [CommunityArticleNode, CommunityFileNode, CommunityVideoNode]
        : []),
    ],
    content: defaultValue ?? emptyDocument,
    editorProps: {
      attributes: {
        class: "prose-editor min-h-64 px-4 py-4 outline-none",
        "aria-label": ariaLabel,
      },
      handleDOMEvents: {
        blur: () => {
          onEditorBlur?.();
          return false;
        },
      },
      handleKeyDown: (view, event) => {
        const currentState = mentionStateRef.current;
        const candidates = mentionCandidatesRef.current;
        if (!(currentState && candidates.length > 0)) {
          return false;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedMentionIndex((current) =>
            event.key === "ArrowDown"
              ? (current + 1) % candidates.length
              : (current - 1 + candidates.length) % candidates.length
          );
          return true;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          mentionStateRef.current = null;
          setMentionState(null);
          return true;
        }
        if (event.key !== "Enter" && event.key !== "Tab") {
          return false;
        }
        event.preventDefault();
        const candidate = candidates[selectedMentionIndex] ?? candidates[0];
        const mention = view.state.schema.nodes.mention?.create({
          id: candidate.id,
          kind: candidate.kind === "GROUP" ? "GROUP" : "USER",
          recipientCount: candidate.recipientCount,
          username: candidate.username,
          label: candidate.displayName ?? candidate.username,
        });
        if (!mention) {
          return false;
        }
        if (candidate.kind === "GROUP") {
          groupMentionConfirmedRef.current = false;
          setGroupMentionConfirmed(false);
        }
        const transaction = view.state.tr
          .replaceWith(currentState.from, currentState.to, mention)
          .insertText(" ");
        view.dispatch(transaction);
        mentionStateRef.current = null;
        setMentionState(null);
        return true;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const document = currentEditor.getJSON();
      setValue(document);
      const summary = groupMentionSummary(document);
      if (!summary.hasGroup && groupMentionConfirmedRef.current) {
        groupMentionConfirmedRef.current = false;
        setGroupMentionConfirmed(false);
      }
      const cursor = currentEditor.state.selection.from;
      const textBefore = currentEditor.state.doc.textBetween(
        Math.max(0, cursor - 80),
        cursor,
        "\n",
        ""
      );
      const match = textBefore.match(mentionQueryPattern);
      const nextMentionState = match
        ? {
            from: cursor - match[1].length - 1,
            query: match[1],
            to: cursor,
          }
        : null;
      mentionStateRef.current = nextMentionState;
      setMentionState(nextMentionState);
      // Do not autosave a blob URL. The local image is intentionally visible
      // while the server processes it, then the persisted member-asset URL is
      // emitted once the node is replaced.
      if (pendingUploads.current === 0) {
        onDocumentChange?.(document);
      }
    },
    onDestroy: () => {
      for (const previewUrl of pendingPreviewUrls.current) {
        URL.revokeObjectURL(previewUrl);
      }
      pendingPreviewUrls.current.clear();
    },
  });

  useEffect(() => {
    if (!mentionState) {
      mentionCandidatesRef.current = [];
      setMentionCandidates([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/members/search?q=${encodeURIComponent(mentionState.query)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) {
          return { items: [] };
        }
        return (await response.json()) as { items?: MentionCandidate[] };
      })
      .then((payload) => {
        const items = payload.items ?? [];
        mentionCandidatesRef.current = items;
        setMentionCandidates(items);
        setSelectedMentionIndex(0);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          mentionCandidatesRef.current = [];
          setMentionCandidates([]);
        }
      });
    return () => controller.abort();
  }, [mentionState]);

  const mentionSummary = groupMentionSummary(value);

  useEffect(() => {
    onGroupMentionChange?.(
      mentionSummary.hasGroup,
      mentionSummary.hasGroup ? groupMentionConfirmed : true
    );
  }, [groupMentionConfirmed, mentionSummary.hasGroup, onGroupMentionChange]);

  if (!editor) {
    return <div className="min-h-64 animate-pulse bg-muted" />;
  }

  const action = (callback: () => void) => {
    callback();
    editor.commands.focus();
  };

  const removePreviewNode = (previewUrl: string) => {
    const positions: number[] = [];
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === "image" && node.attrs.src === previewUrl) {
        positions.push(position);
      }
    });
    if (positions.length > 0) {
      const transaction = editor.state.tr;
      for (const position of positions.reverse()) {
        const node = editor.state.doc.nodeAt(position);
        if (node) {
          transaction.delete(position, position + node.nodeSize);
        }
      }
      editor.view.dispatch(transaction);
    }
  };

  const replacePreviewNode = (previewUrl: string, persistedUrl: string) => {
    const transaction = editor.state.tr;
    let replaced = false;
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === "image" && node.attrs.src === previewUrl) {
        transaction.setNodeMarkup(position, undefined, {
          ...node.attrs,
          src: persistedUrl,
          alt: "",
        });
        replaced = true;
      }
    });
    if (replaced) {
      editor.view.dispatch(transaction);
    }
  };

  const uploadImage = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Envie uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setUploadError("A imagem deve ter entre 1 byte e 5 MB.");
      return;
    }

    const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
    if (pendingFileKeys.current.has(fileKey)) {
      return;
    }
    pendingFileKeys.current.add(fileKey);

    setUploadError("");
    const previewUrl = URL.createObjectURL(file);
    pendingPreviewUrls.current.add(previewUrl);
    editor
      .chain()
      .focus()
      .setImage({
        src: previewUrl,
        alt: "Enviando imagem…",
      })
      .run();
    pendingUploads.current += 1;
    setIsUploadingMedia(true);
    onUploadStateChange?.(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("assetType", "community-inline");
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
      replacePreviewNode(previewUrl, payload.url);
      pendingPreviewUrls.current.delete(previewUrl);
      setTimeout(() => URL.revokeObjectURL(previewUrl), 0);
    } catch (error) {
      removePreviewNode(previewUrl);
      setUploadError(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a imagem."
      );
      setTimeout(() => URL.revokeObjectURL(previewUrl), 0);
    } finally {
      pendingFileKeys.current.delete(fileKey);
      pendingUploads.current = Math.max(0, pendingUploads.current - 1);
      if (pendingUploads.current === 0) {
        const document = editor.getJSON();
        setValue(document);
        onDocumentChange?.(document);
      }
      onUploadStateChange?.(pendingUploads.current > 0);
      setIsUploadingMedia(pendingUploads.current > 0);
    }
  };

  const removeUploadedAsset = async (value: string) => {
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
      // The draft cleanup path will remove the object once it is persisted.
    }
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: attachment upload validates, uploads, inserts, and cleans up one private asset atomically from the editor.
  const uploadAttachment = async (file: File) => {
    if (!(file.type === "application/pdf" || file.type === "text/plain")) {
      setUploadError("Envie um PDF ou arquivo de texto.");
      return;
    }
    if (file.size <= 0 || file.size > 20 * 1024 * 1024) {
      setUploadError("O arquivo deve ter entre 1 byte e 20 MB.");
      return;
    }

    const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
    if (pendingFileKeys.current.has(fileKey)) {
      return;
    }
    pendingFileKeys.current.add(fileKey);
    pendingUploads.current += 1;
    setUploadError("");
    setIsUploadingMedia(true);
    onUploadStateChange?.(true);

    let uploadedUrl = "";
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("assetType", "community-attachment");
      const response = await fetch("/api/member-assets", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        mimeType?: string;
        name?: string;
        size?: number;
        url?: string;
      };
      if (!(response.ok && payload.url)) {
        throw new Error(payload.error ?? "Não foi possível enviar o arquivo.");
      }
      uploadedUrl = payload.url;
      const inserted = editor
        .chain()
        .focus()
        .insertContent({
          attrs: {
            mimeType: payload.mimeType ?? file.type,
            name: payload.name ?? file.name,
            sizeBytes: payload.size ?? file.size,
            src: payload.url,
          },
          type: "communityFile",
        })
        .run();
      if (!inserted) {
        throw new Error("Não foi possível inserir o arquivo no texto.");
      }
    } catch (error) {
      if (uploadedUrl) {
        await removeUploadedAsset(uploadedUrl);
      }
      setUploadError(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o arquivo."
      );
    } finally {
      pendingFileKeys.current.delete(fileKey);
      pendingUploads.current = Math.max(0, pendingUploads.current - 1);
      onUploadStateChange?.(pendingUploads.current > 0);
      setIsUploadingMedia(pendingUploads.current > 0);
    }
  };

  const startUpload = (file: File) => {
    uploadImage(file).catch(() => undefined);
  };

  const startAttachmentUpload = (file: File) => {
    uploadAttachment(file).catch(() => undefined);
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: the editor surface accepts intentional drag-and-drop and clipboard paste events for image uploads.
    <div
      className="overflow-hidden rounded-sm border bg-background"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) {
          if (file.type.startsWith("image/")) {
            startUpload(file);
          } else if (enableCommunityMedia) {
            startAttachmentUpload(file);
          } else {
            setUploadError("Este editor aceita apenas imagens.");
          }
        }
      }}
      onPaste={(event) => {
        const file = Array.from(event.clipboardData.files).find((item) =>
          item.type.startsWith("image/")
        );
        if (file) {
          event.preventDefault();
          startUpload(file);
        }
      }}
      role="application"
    >
      <div
        aria-label="Ferramentas de formatação"
        className="flex flex-wrap gap-1 border-border border-b bg-muted/40 p-2"
        role="toolbar"
      >
        <Button
          aria-label="Negrito"
          onClick={() => action(() => editor.chain().toggleBold().run())}
          size="icon"
          type="button"
          variant={editor.isActive("bold") ? "default" : "ghost"}
        >
          <BoldIcon aria-hidden="true" />
        </Button>
        <Button
          aria-label="Itálico"
          onClick={() => action(() => editor.chain().toggleItalic().run())}
          size="icon"
          type="button"
          variant={editor.isActive("italic") ? "default" : "ghost"}
        >
          <ItalicIcon aria-hidden="true" />
        </Button>
        <Button
          aria-label="Título"
          onClick={() =>
            action(() => editor.chain().toggleHeading({ level: 2 }).run())
          }
          size="icon"
          type="button"
          variant={
            editor.isActive("heading", { level: 2 }) ? "default" : "ghost"
          }
        >
          <Heading2Icon aria-hidden="true" />
        </Button>
        <Button
          aria-label="Lista"
          onClick={() => action(() => editor.chain().toggleBulletList().run())}
          size="icon"
          type="button"
          variant={editor.isActive("bulletList") ? "default" : "ghost"}
        >
          <ListIcon aria-hidden="true" />
        </Button>
        <Button
          aria-label="Lista numerada"
          onClick={() => action(() => editor.chain().toggleOrderedList().run())}
          size="icon"
          type="button"
          variant={editor.isActive("orderedList") ? "default" : "ghost"}
        >
          <ListOrderedIcon aria-hidden="true" />
        </Button>
        <Button
          aria-label="Citação"
          onClick={() => action(() => editor.chain().toggleBlockquote().run())}
          size="icon"
          type="button"
          variant={editor.isActive("blockquote") ? "default" : "ghost"}
        >
          <QuoteIcon aria-hidden="true" />
        </Button>
        <Button
          aria-label="Código"
          onClick={() => action(() => editor.chain().toggleCodeBlock().run())}
          size="icon"
          type="button"
          variant={editor.isActive("codeBlock") ? "default" : "ghost"}
        >
          <Code2Icon aria-hidden="true" />
        </Button>
        <Button
          aria-label="Adicionar link"
          onClick={() => setShowLinkField((visible) => !visible)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <LinkIcon aria-hidden="true" />
        </Button>
        {showLinkField && (
          <div className="motion-reveal-fast flex min-w-60 flex-1 gap-2">
            <Input
              aria-label="Endereço do link ou embed"
              autoFocus
              className="h-9"
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://… ou DOI"
              value={linkUrl}
            />
            <Button
              onClick={() => {
                const value = linkUrl.trim();
                if (!value) {
                  return;
                }
                const video = enableCommunityMedia
                  ? videoEmbedFromUrl(value)
                  : null;
                const directVideo = enableCommunityMedia
                  ? directVideoUrl(value)
                  : null;
                if (video || directVideo) {
                  action(() =>
                    editor
                      .chain()
                      .insertContent({
                        attrs: {
                          provider: video?.provider ?? "youtube",
                          src: video?.src ?? directVideo,
                          title: "Vídeo incorporado",
                        },
                        type: "communityVideo",
                      })
                      .run()
                  );
                } else if (
                  enableCommunityMedia &&
                  isScientificArticleReference(value)
                ) {
                  const articleUrl = articleUrlFrom(value);
                  if (articleUrl) {
                    action(() =>
                      editor
                        .chain()
                        .insertContent({
                          attrs: {
                            doi: extractDoi(value),
                            url: articleUrl,
                          },
                          type: "communityArticle",
                        })
                        .run()
                    );
                  }
                } else {
                  action(() => editor.chain().setLink({ href: value }).run());
                }
                setLinkUrl("");
                setShowLinkField(false);
              }}
              size="sm"
              type="button"
            >
              Aplicar
            </Button>
          </div>
        )}
        <Button
          aria-label="Adicionar imagem"
          onClick={() => imageInputRef.current?.click()}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ImageIcon aria-hidden="true" />
        </Button>
        <Button
          onClick={() => setShowImageField((visible) => !visible)}
          size="sm"
          type="button"
          variant="ghost"
        >
          URL
        </Button>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              startUpload(file);
            }
            event.currentTarget.value = "";
          }}
          ref={imageInputRef}
          type="file"
        />
        {enableCommunityMedia && (
          <>
            <Button
              aria-label="Adicionar PDF ou arquivo"
              onClick={() => attachmentInputRef.current?.click()}
              size="icon"
              type="button"
              variant="ghost"
            >
              <FileIcon aria-hidden="true" />
            </Button>
            <input
              accept="application/pdf,text/plain,.pdf,.txt"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  startAttachmentUpload(file);
                }
                event.currentTarget.value = "";
              }}
              ref={attachmentInputRef}
              type="file"
            />
          </>
        )}
        {isUploadingMedia ? (
          <span className="self-center px-2 text-muted-foreground text-xs">
            Enviando mídia…
          </span>
        ) : null}
        {uploadError ? (
          <span
            className="basis-full px-2 text-destructive text-xs"
            role="alert"
          >
            {uploadError}
          </span>
        ) : null}
        {showImageField && (
          <div className="motion-reveal-fast flex min-w-60 flex-1 gap-2">
            <Input
              aria-label="Endereço da imagem"
              autoFocus
              className="h-9"
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
              value={imageUrl}
            />
            <Button
              onClick={() => {
                if (imageUrl.trim()) {
                  action(() =>
                    editor
                      .chain()
                      .setImage({ src: imageUrl.trim(), alt: "" })
                      .run()
                  );
                  setImageUrl("");
                  setShowImageField(false);
                }
              }}
              size="sm"
              type="button"
            >
              Inserir
            </Button>
          </div>
        )}
        <Button
          aria-label="Adicionar divisor"
          onClick={() => action(() => editor.chain().setHorizontalRule().run())}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MinusIcon aria-hidden="true" />
        </Button>
      </div>
      <EditorContent editor={editor} />
      {mentionState && mentionCandidates.length > 0 && (
        <div
          aria-label="Membros para mencionar"
          className="motion-layer max-h-56 overflow-y-auto border-border border-t bg-background p-1 shadow-[var(--shadow-floating)]"
          role="listbox"
        >
          {mentionCandidates.slice(0, 8).map((candidate, index) => (
            <button
              aria-selected={index === selectedMentionIndex}
              className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm ${index === selectedMentionIndex ? "bg-accent" : "hover:bg-accent/60"}`}
              key={candidate.id}
              onMouseDown={(event) => {
                event.preventDefault();
                const currentState = mentionStateRef.current;
                const instance = editor;
                const mention = instance.state.schema.nodes.mention?.create({
                  id: candidate.id,
                  kind: candidate.kind === "GROUP" ? "GROUP" : "USER",
                  recipientCount: candidate.recipientCount,
                  username: candidate.username,
                  label: candidate.displayName ?? candidate.username,
                });
                if (!(currentState && mention)) {
                  return;
                }
                if (candidate.kind === "GROUP") {
                  groupMentionConfirmedRef.current = false;
                  setGroupMentionConfirmed(false);
                }
                instance
                  .chain()
                  .focus()
                  .deleteRange({ from: currentState.from, to: currentState.to })
                  .insertContent([
                    {
                      type: "mention",
                      attrs: {
                        id: candidate.id,
                        kind: candidate.kind === "GROUP" ? "GROUP" : "USER",
                        recipientCount: candidate.recipientCount,
                        username: candidate.username,
                        label: candidate.displayName ?? candidate.username,
                      },
                    },
                    { type: "text", text: " " },
                  ])
                  .run();
                mentionStateRef.current = null;
                setMentionState(null);
              }}
              role="option"
              type="button"
            >
              <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-xs">
                {candidate.avatarUrl ? (
                  // biome-ignore lint/performance/noImgElement: authenticated member asset route.
                  <img
                    alt=""
                    className="size-full object-cover object-center"
                    height={28}
                    src={candidate.avatarUrl}
                    width={28}
                  />
                ) : (
                  (candidate.displayName ?? candidate.username)
                    .slice(0, 1)
                    .toUpperCase()
                )}
              </span>
              <span className="min-w-0">
                {candidate.kind === "GROUP" && (
                  <span className="mb-0.5 block text-[11px] text-muted-foreground">
                    {candidate.recipientCount ?? 0} membros serão notificados
                  </span>
                )}
                <span className="block truncate font-medium">
                  {candidate.displayName ?? candidate.username}
                </span>
                <span className="block truncate text-muted-foreground text-xs">
                  @{candidate.username}
                  {candidate.role !== "MEMBER"
                    ? ` · ${candidate.role === "ADMIN" ? "Admin" : "Professor"}`
                    : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {mentionSummary.hasGroup && (
        <label className="flex items-start gap-2 border-border border-t bg-brand-action/5 px-4 py-3 text-muted-foreground text-xs">
          <input
            checked={groupMentionConfirmed}
            className="mt-0.5"
            onChange={(event) => {
              groupMentionConfirmedRef.current = event.target.checked;
              setGroupMentionConfirmed(event.target.checked);
            }}
            type="checkbox"
          />
          <span>
            Você está prestes a notificar{" "}
            <strong className="font-medium text-foreground">
              {mentionSummary.count || "um grupo"}{" "}
              {mentionSummary.count ? "membros" : "de membros"}
            </strong>
            . Confirme o envio para continuar.
          </span>
        </label>
      )}
      <input
        name="confirmGroupMention"
        type="hidden"
        value={mentionSummary.hasGroup && groupMentionConfirmed ? "1" : "0"}
      />
      <input name={name} type="hidden" value={JSON.stringify(value)} />
    </div>
  );
}
