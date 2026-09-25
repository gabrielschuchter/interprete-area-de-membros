"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import type { JSONContent } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
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
import { useState } from "react";

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
}

export const TopicEditor = ({
  defaultValue,
  name = "contentJson",
  onDocumentChange,
  onEditorBlur,
  ariaLabel = "Conteúdo do tópico",
}: TopicEditorProperties) => {
  const [value, setValue] = useState<JSONContent>(
    defaultValue ?? emptyDocument
  );
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showImageField, setShowImageField] = useState(false);
  const [showLinkField, setShowLinkField] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image.configure({ allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
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
      onDocumentChange?.(document);
    },
  });

  if (!editor) {
    return <div className="min-h-64 animate-pulse bg-muted" />;
  }

  const action = (callback: () => void) => {
    callback();
    editor.commands.focus();
  };

  return (
    <div className="overflow-hidden rounded-sm border bg-background">
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
          <div className="flex min-w-60 flex-1 gap-2">
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
          onClick={() => setShowImageField((visible) => !visible)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ImageIcon aria-hidden="true" />
        </Button>
        {showImageField && (
          <div className="flex min-w-60 flex-1 gap-2">
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
