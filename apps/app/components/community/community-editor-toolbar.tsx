"use client";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Input } from "@repo/design-system/components/ui/input";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  BoldIcon,
  ChevronDownIcon,
  CodeIcon,
  EraserIcon,
  FileIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PlusIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  Undo2Icon,
  VideoIcon,
} from "lucide-react";
import { type FocusEvent, type ReactNode, type RefObject, useRef } from "react";

interface FieldState {
  readonly onApply: () => void;
  readonly onChange: (value: string) => void;
  readonly onClose: () => void;
  /** Abre o campo (idempotente). */
  readonly onOpen: () => void;
  readonly onToggle: () => void;
  readonly open: boolean;
  readonly value: string;
}

export interface CommunityEditorToolbarProperties {
  readonly attachmentInputRef: RefObject<HTMLInputElement | null>;
  /** Celular: barra de 8 controles com Bloco, Inserir e Mais em menus. */
  readonly compact: boolean;
  /** Celular rolado: a barra vira o trilho lateral. */
  readonly docked: boolean;
  readonly editor: Editor;
  readonly enableCommunityMedia: boolean;
  readonly imageField: FieldState;
  readonly imageInputRef: RefObject<HTMLInputElement | null>;
  readonly linkField: FieldState;
  readonly onAttachmentFile: (file: File) => void;
  readonly onImageFile: (file: File) => void;
  readonly sentinelRef: (node: HTMLDivElement | null) => void;
  readonly uploadError: string;
  readonly uploading: boolean;
}

type BlockStyle =
  | "paragraph"
  | "heading2"
  | "heading3"
  | "blockquote"
  | "codeBlock";

const blockStyleNames: Readonly<Record<BlockStyle, string>> = {
  blockquote: "Citação",
  codeBlock: "Bloco de código",
  heading2: "Título",
  heading3: "Subtítulo",
  paragraph: "Texto",
};

const currentBlockStyle = (editor: Editor): BlockStyle => {
  if (editor.isActive("heading", { level: 2 })) {
    return "heading2";
  }
  if (editor.isActive("heading", { level: 3 })) {
    return "heading3";
  }
  if (editor.isActive("blockquote")) {
    return "blockquote";
  }
  if (editor.isActive("codeBlock")) {
    return "codeBlock";
  }
  return "paragraph";
};

// Mantém a seleção e o teclado do celular no texto ao tocar na barra.
const keepEditorFocus = (event: { preventDefault: () => void }) =>
  event.preventDefault();

// O campo fecha quando o foco vai para o texto; foco que volta ao menu ou ao
// próprio campo não conta (o menu devolve o foco ao fechar).
const closeOnFocusLeave = (
  event: FocusEvent<HTMLInputElement>,
  onClose: () => void
) => {
  const next = event.relatedTarget;
  if (!(next instanceof Element)) {
    return;
  }
  if (
    event.currentTarget.parentElement?.contains(next) ||
    next.closest("[role=menu], [role=toolbar]")
  ) {
    return;
  }
  onClose();
};

function ToolButton({
  children,
  disabled,
  expanded,
  label,
  onClick,
  pressed,
  title,
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly expanded?: boolean;
  readonly label: string;
  readonly onClick: () => void;
  readonly pressed?: boolean;
  readonly title?: string;
}) {
  return (
    <button
      aria-expanded={expanded}
      aria-label={label}
      aria-pressed={pressed}
      className="community-toolbar-button"
      disabled={disabled}
      onClick={onClick}
      onMouseDown={keepEditorFocus}
      title={title ?? label}
      type="button"
    >
      {children}
    </button>
  );
}

const separator = (
  <span aria-hidden="true" className="community-toolbar-separator" />
);

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one component owns the desktop strip and the compact bar so both share state and handlers.
export function CommunityEditorToolbar({
  attachmentInputRef,
  compact,
  docked,
  editor,
  enableCommunityMedia,
  imageField,
  imageInputRef,
  linkField,
  onAttachmentFile,
  onImageFile,
  sentinelRef,
  uploadError,
  uploading,
}: CommunityEditorToolbarProperties) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Assina a seleção: sem isso o estado dos botões só mudaria ao digitar.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      blockStyle: currentBlockStyle(current),
      blockquote: current.isActive("blockquote"),
      bold: current.isActive("bold"),
      bulletList: current.isActive("bulletList"),
      canRedo: current.can().redo(),
      canUndo: current.can().undo(),
      code: current.isActive("code"),
      italic: current.isActive("italic"),
      link: current.isActive("link"),
      orderedList: current.isActive("orderedList"),
      strike: current.isActive("strike"),
    }),
  });
  const run = (callback: () => void) => {
    callback();
    editor.commands.focus();
  };
  const blockStyle = state.blockStyle;
  const applyBlockStyle = (style: BlockStyle) =>
    run(() => {
      const chain = editor.chain().setParagraph();
      if (style === "heading2") {
        chain.setHeading({ level: 2 });
      } else if (style === "heading3") {
        chain.setHeading({ level: 3 });
      } else if (style === "blockquote") {
        chain.setBlockquote();
      } else if (style === "codeBlock") {
        chain.setCodeBlock();
      }
      chain.run();
    });
  const toggleMark = (mark: "bold" | "code" | "italic" | "strike") =>
    run(() => editor.chain().toggleMark(mark).run());
  const menuSide = docked ? "left" : "bottom";
  const menuProps = {
    align: "start" as const,
    className: "community-menu",
    // Ao fechar, o foco vai para o campo recém-aberto ou volta ao texto.
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      const field = rootRef.current?.querySelector<HTMLInputElement>(
        ".motion-reveal-fast input"
      );
      if (field) {
        field.focus();
        return;
      }
      editor.commands.focus();
    },
    side: menuSide as "bottom" | "left",
    sideOffset: docked ? 12 : 8,
  };

  const history = (
    <>
      <ToolButton
        disabled={!state.canUndo}
        label="Desfazer"
        onClick={() => run(() => editor.chain().undo().run())}
      >
        <Undo2Icon aria-hidden="true" />
      </ToolButton>
      <ToolButton
        disabled={!state.canRedo}
        label="Refazer"
        onClick={() => run(() => editor.chain().redo().run())}
      >
        <Redo2Icon aria-hidden="true" />
      </ToolButton>
    </>
  );

  const markButton = (
    label: string,
    mark: "bold" | "code" | "italic" | "strike",
    Icon: typeof BoldIcon
  ) => (
    <ToolButton
      label={label}
      onClick={() => toggleMark(mark)}
      pressed={state[mark]}
    >
      <Icon aria-hidden="true" />
    </ToolButton>
  );

  const linkButton = (
    <ToolButton
      expanded={linkField.open}
      label="Adicionar link"
      onClick={linkField.onToggle}
      pressed={state.link}
      title="Link, vídeo ou artigo (DOI)"
    >
      <LinkIcon aria-hidden="true" />
    </ToolButton>
  );

  const imageButton = (
    <ToolButton
      label="Adicionar imagem"
      onClick={() => imageInputRef.current?.click()}
      title="Imagem"
    >
      <ImageIcon aria-hidden="true" />
    </ToolButton>
  );
  const videoButton = (
    <ToolButton
      label="Incorporar vídeo"
      onClick={linkField.onOpen}
      title="Vídeo do YouTube ou Vimeo"
    >
      <VideoIcon aria-hidden="true" />
    </ToolButton>
  );
  const fileButton = (
    <ToolButton
      label="Adicionar PDF ou arquivo"
      onClick={() => attachmentInputRef.current?.click()}
      title="PDF ou arquivo de texto"
    >
      <FileIcon aria-hidden="true" />
    </ToolButton>
  );

  const blockMenuLabel = (style: BlockStyle) => {
    if (style === "heading2") {
      return <span className="community-menu-title">Título</span>;
    }
    if (style === "heading3") {
      return <span className="community-menu-subtitle">Subtítulo</span>;
    }
    return blockStyleNames[style];
  };

  // Desktop: o menu Estilo mostra o bloco atual.
  const styleMenuDesktop = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Estilo do bloco"
          className="community-toolbar-button community-toolbar-text"
          onMouseDown={keepEditorFocus}
          type="button"
        >
          <span>{blockStyleNames[blockStyle]}</span>
          <ChevronDownIcon aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...menuProps}>
        <DropdownMenuRadioGroup
          onValueChange={(value) => applyBlockStyle(value as BlockStyle)}
          value={blockStyle}
        >
          {(
            [
              "paragraph",
              "heading2",
              "heading3",
              "blockquote",
              "codeBlock",
            ] as const
          ).map((style) => (
            <DropdownMenuRadioItem key={style} value={style}>
              {blockMenuLabel(style)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Celular: Bloco reúne os estilos do parágrafo, a citação e as listas.
  const blockMenuCompact = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Estilo do bloco"
          className="community-toolbar-button"
          onMouseDown={keepEditorFocus}
          title="Estilo do bloco"
          type="button"
        >
          <span
            aria-hidden="true"
            style={{
              fontFamily: "var(--font-display-family), serif",
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            Aa
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...menuProps}>
        <DropdownMenuCheckboxItem
          checked={
            blockStyle === "paragraph" &&
            !state.bulletList &&
            !state.orderedList
          }
          onSelect={() => applyBlockStyle("paragraph")}
        >
          Texto
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={blockStyle === "heading2"}
          onSelect={() => applyBlockStyle("heading2")}
        >
          {blockMenuLabel("heading2")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={blockStyle === "heading3"}
          onSelect={() => applyBlockStyle("heading3")}
        >
          {blockMenuLabel("heading3")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator className="community-menu-separator" />
        <DropdownMenuCheckboxItem
          checked={blockStyle === "blockquote"}
          onSelect={() => run(() => editor.chain().toggleBlockquote().run())}
        >
          Citação
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={state.bulletList}
          onSelect={() => run(() => editor.chain().toggleBulletList().run())}
        >
          Lista
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={state.orderedList}
          onSelect={() => run(() => editor.chain().toggleOrderedList().run())}
        >
          Lista numerada
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={blockStyle === "codeBlock"}
          onSelect={() => applyBlockStyle("codeBlock")}
        >
          Bloco de código
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const insertMenuCompact = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Inserir"
          className="community-toolbar-button"
          onMouseDown={keepEditorFocus}
          title="Inserir"
          type="button"
        >
          <PlusIcon aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...menuProps}>
        <DropdownMenuItem onSelect={() => imageInputRef.current?.click()}>
          <ImageIcon aria-hidden="true" /> Imagem
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={imageField.onOpen}>
          <ImageIcon aria-hidden="true" /> Imagem por endereço
        </DropdownMenuItem>
        {enableCommunityMedia ? (
          <>
            <DropdownMenuItem onSelect={linkField.onOpen}>
              <VideoIcon aria-hidden="true" /> Vídeo
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => attachmentInputRef.current?.click()}
            >
              <FileIcon aria-hidden="true" /> PDF ou texto
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator className="community-menu-separator" />
        <DropdownMenuItem
          onSelect={() => run(() => editor.chain().setHorizontalRule().run())}
        >
          <MinusIcon aria-hidden="true" /> Divisor
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const moreMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Mais"
          aria-pressed={compact && (state.strike || state.code)}
          className="community-toolbar-button"
          onMouseDown={keepEditorFocus}
          title="Mais"
          type="button"
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...menuProps}>
        {compact ? (
          <>
            {enableCommunityMedia ? (
              <DropdownMenuItem
                data-on={state.strike}
                onSelect={() => toggleMark("strike")}
              >
                <StrikethroughIcon aria-hidden="true" /> Tachado
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              data-on={state.code}
              onSelect={() => toggleMark("code")}
            >
              <CodeIcon aria-hidden="true" /> Código
            </DropdownMenuItem>
            <DropdownMenuSeparator className="community-menu-separator" />
          </>
        ) : (
          <>
            <DropdownMenuItem onSelect={imageField.onOpen}>
              <ImageIcon aria-hidden="true" /> Imagem por endereço
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                run(() => editor.chain().setHorizontalRule().run())
              }
            >
              <MinusIcon aria-hidden="true" /> Divisor
            </DropdownMenuItem>
            <DropdownMenuSeparator className="community-menu-separator" />
          </>
        )}
        <DropdownMenuItem
          onSelect={() =>
            run(() => editor.chain().unsetAllMarks().clearNodes().run())
          }
        >
          <EraserIcon aria-hidden="true" /> Limpar formatação
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const hiddenInputs = (
    <>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onImageFile(file);
          }
          event.currentTarget.value = "";
        }}
        ref={imageInputRef}
        tabIndex={-1}
        type="file"
      />
      {enableCommunityMedia ? (
        <input
          accept="application/pdf,text/plain,.pdf,.txt"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onAttachmentFile(file);
            }
            event.currentTarget.value = "";
          }}
          ref={attachmentInputRef}
          tabIndex={-1}
          type="file"
        />
      ) : null}
    </>
  );

  const fields = (
    <>
      {linkField.open ? (
        <div className="motion-reveal-fast">
          <Input
            aria-label="Endereço do link ou embed"
            autoFocus
            inputMode="url"
            onBlur={(event) => closeOnFocusLeave(event, linkField.onClose)}
            onChange={(event) => linkField.onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                linkField.onApply();
              } else if (event.key === "Escape") {
                event.preventDefault();
                linkField.onClose();
                editor.commands.focus();
              }
            }}
            placeholder="https://…, vídeo do YouTube ou DOI"
            value={linkField.value}
          />
          <button onClick={linkField.onApply} type="button">
            Aplicar
          </button>
        </div>
      ) : null}
      {imageField.open ? (
        <div className="motion-reveal-fast">
          <Input
            aria-label="Endereço da imagem"
            autoFocus
            inputMode="url"
            onBlur={(event) => closeOnFocusLeave(event, imageField.onClose)}
            onChange={(event) => imageField.onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                imageField.onApply();
              } else if (event.key === "Escape") {
                event.preventDefault();
                imageField.onClose();
                editor.commands.focus();
              }
            }}
            placeholder="https://exemplo.com/imagem.jpg"
            value={imageField.value}
          />
          <button onClick={imageField.onApply} type="button">
            Inserir
          </button>
        </div>
      ) : null}
      {uploading ? (
        <output className="community-editor-toolbar-status">
          Enviando mídia…
        </output>
      ) : null}
      {uploadError ? (
        <span className="community-editor-toolbar-status" role="alert">
          {uploadError}
        </span>
      ) : null}
    </>
  );

  return (
    <div className="community-editor-toolbar-slot" ref={rootRef}>
      <div
        aria-hidden="true"
        className="community-editor-toolbar-sentinel"
        ref={sentinelRef}
      />
      <div
        aria-label="Ferramentas de formatação"
        aria-orientation={docked ? "vertical" : "horizontal"}
        className={["community-editor-toolbar", docked && "is-mobile-rail"]
          .filter(Boolean)
          .join(" ")}
        role="toolbar"
      >
        {compact ? (
          <>
            {history}
            {separator}
            {blockMenuCompact}
            {markButton("Negrito", "bold", BoldIcon)}
            {markButton("Itálico", "italic", ItalicIcon)}
            {linkButton}
            {separator}
            {insertMenuCompact}
            {moreMenu}
          </>
        ) : (
          <>
            {history}
            {separator}
            {styleMenuDesktop}
            {separator}
            {markButton("Negrito", "bold", BoldIcon)}
            {markButton("Itálico", "italic", ItalicIcon)}
            {enableCommunityMedia
              ? markButton("Tachado", "strike", StrikethroughIcon)
              : null}
            {markButton("Código", "code", CodeIcon)}
            {separator}
            {linkButton}
            {imageButton}
            {enableCommunityMedia ? videoButton : null}
            {enableCommunityMedia ? fileButton : null}
            {separator}
            <ToolButton
              label="Citação"
              onClick={() => run(() => editor.chain().toggleBlockquote().run())}
              pressed={state.blockquote}
            >
              <QuoteIcon aria-hidden="true" />
            </ToolButton>
            {separator}
            <ToolButton
              label="Lista"
              onClick={() => run(() => editor.chain().toggleBulletList().run())}
              pressed={state.bulletList}
            >
              <ListIcon aria-hidden="true" />
            </ToolButton>
            <ToolButton
              label="Lista numerada"
              onClick={() =>
                run(() => editor.chain().toggleOrderedList().run())
              }
              pressed={state.orderedList}
            >
              <ListOrderedIcon aria-hidden="true" />
            </ToolButton>
            {separator}
            {moreMenu}
          </>
        )}
        {hiddenInputs}
        {fields}
      </div>
    </div>
  );
}
