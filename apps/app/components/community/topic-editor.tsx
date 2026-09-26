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
  Heading2Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
} from "lucide-react";
import { useRef, useState } from "react";

const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

interface TopicEditorProperties {
  readonly ariaLabel?: string;
  readonly defaultValue?: JSONContent;
  readonly name?: string;
  readonly onDocumentChange?: (value: JSONContent) => void;
  readonly onEditorBlur?: () => void;
  readonly onUploadStateChange?: (uploading: boolean) => void;
}

export const TopicEditor = ({
  defaultValue,
  name = "contentJson",
  onDocumentChange,
  onEditorBlur,
  onUploadStateChange,
  ariaLabel = "Conteúdo do tópico",
}: TopicEditorProperties) => {
  const [value, setValue] = useState<JSONContent>(
    defaultValue ?? emptyDocument
  );
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showImageField, setShowImageField] = useState(false);
  const [showLinkField, setShowLinkField] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pendingPreviewUrls = useRef(new Set<string>());
  const pendingUploads = useRef(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, linkOnPaste: true },
      }),
      Image.configure({ allowBase64: false }),
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
    },
    onUpdate: ({ editor: currentEditor }) => {
      const document = currentEditor.getJSON();
      setValue(document);
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
    setIsUploadingImage(true);
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
      pendingUploads.current = Math.max(0, pendingUploads.current - 1);
      if (pendingUploads.current === 0) {
        const document = editor.getJSON();
        setValue(document);
        onDocumentChange?.(document);
      }
      onUploadStateChange?.(pendingUploads.current > 0);
      setIsUploadingImage(pendingUploads.current > 0);
    }
  };

  const startUpload = (file: File) => {
    uploadImage(file).catch(() => undefined);
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
          startUpload(file);
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
              aria-label="Endereço do link"
              autoFocus
              className="h-9"
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://exemplo.com"
              value={linkUrl}
            />
            <Button
              onClick={() => {
                if (linkUrl.trim()) {
                  action(() =>
                    editor.chain().setLink({ href: linkUrl.trim() }).run()
                  );
                  setLinkUrl("");
                  setShowLinkField(false);
                }
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
        {isUploadingImage ? (
          <span className="self-center px-2 text-muted-foreground text-xs">
            Enviando imagem…
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
      <input name={name} type="hidden" value={JSON.stringify(value)} />
    </div>
  );
};
