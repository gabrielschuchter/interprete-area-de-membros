"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import { toast } from "@repo/design-system/lib/toast";
import type { JSONContent } from "@tiptap/core";
import {
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  FilePlus2Icon,
  FolderIcon,
  FolderPlusIcon,
  Link2Icon,
  MapPinIcon,
  MoreHorizontalIcon,
  PlayCircleIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { getPlannerNote, getPlannerNotes } from "@/lib/planner-notes";
import {
  formatNoteListDate as noteListDate,
  formatStudyTimestamp as textDate,
} from "@/lib/study-date";
import {
  bulkUpdatePlannerNotesAction,
  createPlannerNoteAction,
  createPlannerNoteFolderAction,
  createPlannerNoteForLessonAction,
  deletePlannerNoteFolderAction,
  deletePlannerNoteForeverAction,
  duplicatePlannerNoteAction,
  exportPlannerNoteMarkdownAction,
  loadPlannerNoteAction,
  loadPlannerNotesAction,
  movePlannerNoteToTrashAction,
  renamePlannerNoteFolderAction,
  restorePlannerNoteAction,
  savePlannerNoteAction,
  togglePlannerNotePinAction,
} from "./actions";

type NotesData = Awaited<ReturnType<typeof getPlannerNotes>>;
type NoteItem = NotesData["notes"][number];
type FullNote = NonNullable<Awaited<ReturnType<typeof getPlannerNote>>>;
type FolderItem = NotesData["folders"][number];
type BulkNoteOperation = "MOVE" | "PIN" | "UNPIN" | "TAG" | "TRASH";
type NoteFolderFilter = string | null | "all" | "linked" | "pinned";

interface FolderDialogState {
  readonly icon?: string;
  readonly id?: string;
  readonly name: string;
  readonly parentId?: string | null;
}

interface NotesWorkspaceDialogsProps {
  readonly applyBulkUpdate: (
    operation: BulkNoteOperation,
    extra?: { folderId?: string | null; tagName?: string }
  ) => Promise<void>;
  readonly bulkTagName: string;
  readonly bulkTagOpen: boolean;
  readonly bulkTrashOpen: boolean;
  readonly deleteFolder: FolderItem | null;
  readonly deleteNote: NoteItem | null;
  readonly folderDialog: FolderDialogState | null;
  readonly pending: boolean;
  readonly permanentlyDeleteFolder: () => Promise<void>;
  readonly permanentlyDeleteNote: () => Promise<void>;
  readonly saveFolder: () => Promise<void>;
  readonly selectedNoteIds: readonly string[];
  readonly setBulkTagName: Dispatch<SetStateAction<string>>;
  readonly setBulkTagOpen: Dispatch<SetStateAction<boolean>>;
  readonly setBulkTrashOpen: Dispatch<SetStateAction<boolean>>;
  readonly setDeleteFolder: Dispatch<SetStateAction<FolderItem | null>>;
  readonly setDeleteNote: Dispatch<SetStateAction<NoteItem | null>>;
  readonly setFolderDialog: Dispatch<SetStateAction<FolderDialogState | null>>;
}

interface NoteFoldersSidebarProps {
  readonly data: NotesData;
  readonly folderFilter: NoteFolderFilter;
  readonly orderedFolders: readonly FolderItem[];
  readonly setDeleteFolder: Dispatch<SetStateAction<FolderItem | null>>;
  readonly setFolderDialog: Dispatch<SetStateAction<FolderDialogState | null>>;
  readonly setFolderFilter: Dispatch<SetStateAction<NoteFolderFilter>>;
  readonly setMobileEditorOpen: Dispatch<SetStateAction<boolean>>;
  readonly setSelectedId: Dispatch<SetStateAction<string | null>>;
  readonly setTagFilter: Dispatch<SetStateAction<string | null>>;
  readonly setTrash: Dispatch<SetStateAction<boolean>>;
  readonly tagFilter: string | null;
  readonly toggleTrash: () => void;
  readonly trash: boolean;
}

interface NotesListPanelProps {
  readonly allSelectedNotesPinned: boolean;
  readonly allVisibleNotesSelected: boolean;
  readonly applyBulkUpdate: (
    operation: BulkNoteOperation,
    extra?: { folderId?: string | null; tagName?: string }
  ) => Promise<void>;
  readonly createNote: () => Promise<void>;
  readonly data: NotesData;
  readonly folderFilter: NoteFolderFilter;
  readonly linkResources: readonly TimerLinkResource[];
  readonly mobileEditorOpen: boolean;
  readonly orderedFolders: readonly FolderItem[];
  readonly pending: boolean;
  readonly search: string;
  readonly selectedId: string | null;
  readonly selectedNoteIds: readonly string[];
  readonly setBulkTagOpen: Dispatch<SetStateAction<boolean>>;
  readonly setBulkTrashOpen: Dispatch<SetStateAction<boolean>>;
  readonly setDeleteFolder: Dispatch<SetStateAction<FolderItem | null>>;
  readonly setFolderDialog: Dispatch<SetStateAction<FolderDialogState | null>>;
  readonly setFolderFilter: Dispatch<SetStateAction<NoteFolderFilter>>;
  readonly setMobileEditorOpen: Dispatch<SetStateAction<boolean>>;
  readonly setSearch: Dispatch<SetStateAction<string>>;
  readonly setSelectedId: Dispatch<SetStateAction<string | null>>;
  readonly setSelectedNoteIds: Dispatch<SetStateAction<string[]>>;
  readonly setSortOrder: Dispatch<SetStateAction<"RECENT" | "TITLE">>;
  readonly setTagFilter: Dispatch<SetStateAction<string | null>>;
  readonly setTrash: Dispatch<SetStateAction<boolean>>;
  readonly sortOrder: "RECENT" | "TITLE";
  readonly tagFilter: string | null;
  readonly toggleTrash: () => void;
  readonly trash: boolean;
}
interface NotesWorkspaceToolbarActions {
  readonly createNote: () => Promise<unknown>;
}
interface TimerLinkResource {
  readonly context: string;
  readonly href: string;
  readonly id: string;
  readonly shortLabel?: string;
  readonly title: string;
  readonly type: "LESSON";
}

const TopicEditor = dynamic(
  () =>
    import("@/components/community/topic-editor").then(
      (module) => module.TopicEditor
    ),
  {
    ssr: false,
    loading: () => (
      <output
        aria-busy="true"
        className="grid min-h-64 place-items-center rounded-xl border border-[#E2D6D1] bg-[#FBF8F5] text-[#7A5A69] text-sm"
      >
        Carregando editor…
      </output>
    ),
  }
);

const NoteConflictDialog = dynamic(
  () =>
    import("@/components/notes/note-conflict-dialog").then(
      (module) => module.NoteConflictDialog
    ),
  { ssr: false, loading: () => null }
);

const noteTitle = (note: NoteItem) => note.title.trim() || "Sem título";

type NoteSaveStatusValue = "saved" | "dirty" | "saving" | "error" | "offline";
interface LocalNoteDraft {
  readonly baseUpdatedAt?: unknown;
  readonly content: JSONContent;
  readonly folderId?: string;
  readonly linkedResourceId?: string;
  readonly tagText: string;
  readonly title: string;
}

function parseLocalNoteDraft(raw: string): LocalNoteDraft | null {
  let draft: Record<string, unknown>;
  try {
    draft = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const content = draft.content;
  if (
    !content ||
    typeof content !== "object" ||
    (content as { type?: unknown }).type !== "doc" ||
    typeof draft.tagText !== "string" ||
    typeof draft.title !== "string" ||
    (typeof draft.linkedResourceId !== "string" &&
      draft.linkedResourceId !== undefined) ||
    (typeof draft.folderId !== "string" && draft.folderId !== undefined)
  ) {
    return null;
  }

  return {
    baseUpdatedAt: draft.baseUpdatedAt,
    content: content as JSONContent,
    folderId: draft.folderId as string | undefined,
    linkedResourceId: draft.linkedResourceId as string | undefined,
    tagText: draft.tagText,
    title: draft.title,
  };
}

const isExternalNoteConflict = (error: unknown) =>
  error instanceof Error &&
  error.message.toLocaleLowerCase("pt-BR").includes("outro aparelho");

const currentSaveErrorStatus = (): "error" | "offline" =>
  typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error";

function NoteSaveStatus({ status }: { readonly status: NoteSaveStatusValue }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-2">
        <span className="size-2 animate-pulse rounded-full bg-[#B97A58]" />
        Salvando…
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-[#B53D4F]" />
        Não foi possível salvar
      </span>
    );
  }

  if (status === "offline") {
    return (
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-[#B97A58]" />
        Sem conexão · rascunho salvo neste aparelho
      </span>
    );
  }

  if (status === "dirty") {
    return (
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-[#B97A58]" />
        Alterações pendentes
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <CheckIcon aria-hidden="true" className="size-3.5 text-[#55785C]" />
      Salvo agora
    </span>
  );
}

function NoteFolderIcon({ icon }: { readonly icon: string }) {
  if (icon === "book") {
    return <BookOpenIcon aria-hidden="true" className="size-4 shrink-0" />;
  }
  if (icon === "star") {
    return <StarIcon aria-hidden="true" className="size-4 shrink-0" />;
  }
  return <FolderIcon aria-hidden="true" className="size-4 shrink-0" />;
}

function getFolderDialogTitle(
  folderDialog: {
    readonly id?: string;
    readonly parentId?: string | null;
  } | null
) {
  if (folderDialog?.id) {
    return "Renomear pasta";
  }
  if (folderDialog?.parentId) {
    return "Criar subpasta";
  }
  return "Criar pasta";
}

function getBulkUpdateMessage(
  operation: "MOVE" | "PIN" | "UNPIN" | "TAG" | "TRASH"
) {
  switch (operation) {
    case "MOVE":
      return "Notas movidas.";
    case "PIN":
      return "Notas fixadas.";
    case "UNPIN":
      return "Notas desafixadas.";
    case "TAG":
      return "Etiqueta aplicada às notas.";
    case "TRASH":
      return "Notas movidas para a lixeira.";
    default:
      throw new Error("Operação de nota inválida.");
  }
}

const noteContentJson = (note: FullNote) =>
  note.contentJson as unknown as JSONContent;

const noteJsonText = (content: JSONContent): string => {
  const visit = (node: JSONContent): string => {
    const ownText = typeof node.text === "string" ? node.text : "";
    const children = (node.content ?? []).map(visit).join("");
    const text = `${ownText}${children}`;
    return [
      "blockquote",
      "codeBlock",
      "heading",
      "listItem",
      "orderedList",
      "paragraph",
      "taskItem",
    ].includes(node.type ?? "")
      ? `${text}\n`
      : text;
  };
  return visit(content)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const localNoteDraftKey = (noteId: string) => `interprete:note-draft:${noteId}`;

const clearLocalNoteDraft = (noteId: string) => {
  try {
    window.localStorage.removeItem(localNoteDraftKey(noteId));
  } catch {
    // A server save remains successful even when browser storage is unavailable.
  }
};

const clientError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
function NoteEditor({
  folders,
  linkResources,
  note,
  onDuplicate,
  onExport,
  onMoveToTrash,
  onPin,
  saveHandlerRef,
}: {
  readonly folders: readonly FolderItem[];
  readonly linkResources: readonly TimerLinkResource[];
  readonly note: FullNote;
  readonly onDuplicate: () => void;
  readonly onExport: () => void;
  readonly onMoveToTrash: () => void;
  readonly onPin: () => void;
  readonly saveHandlerRef: MutableRefObject<(() => Promise<boolean>) | null>;
}) {
  const [title, setTitle] = useState(note.title);
  const [editingTags, setEditingTags] = useState(false);
  const [tagText, setTagText] = useState(
    note.tags.map((tag) => tag.name).join(", ")
  );
  const [content, setContent] = useState<JSONContent>(noteContentJson(note));
  const [folderId, setFolderId] = useState(note.folderId ?? "");
  const [linkedResourceId, setLinkedResourceId] = useState(
    note.linkedResourceId ?? ""
  );
  const [status, setStatus] = useState<NoteSaveStatusValue>("saved");
  const [localConflict, setLocalConflict] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictServerVersion, setConflictServerVersion] =
    useState<FullNote | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const revisionRef = useRef(0);
  const dirtyRef = useRef(false);
  const draftRef = useRef({
    title,
    tagText,
    content,
    folderId,
    linkedResourceId,
  });
  const savedAtRef = useRef(new Date(note.updatedAt).toISOString());

  const writeLocalDraft = useCallback(() => {
    try {
      window.localStorage.setItem(
        localNoteDraftKey(note.id),
        JSON.stringify({
          baseUpdatedAt: savedAtRef.current,
          ...draftRef.current,
        })
      );
      return true;
    } catch {
      return false;
    }
  }, [note.id]);

  const persist = useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current) {
      return true;
    }
    if (savingRef.current) {
      timerRef.current = window.setTimeout(() => persist(), 650);
      return false;
    }
    savingRef.current = true;
    setStatus("saving");
    const revision = revisionRef.current;
    const draft = draftRef.current;
    try {
      const result = await savePlannerNoteAction({
        id: note.id,
        folderId: draft.folderId || null,
        title: draft.title,
        contentJson: draft.content,
        tagNames: draft.tagText
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        linkedResourceType: draft.linkedResourceId ? "LESSON" : null,
        linkedResourceId: draft.linkedResourceId || null,
        expectedUpdatedAt: savedAtRef.current,
      });
      savedAtRef.current = new Date(result.updatedAt).toISOString();
      dirtyRef.current = revisionRef.current !== revision;
      setStatus(dirtyRef.current ? "dirty" : "saved");
      setLocalConflict(false);
      if (dirtyRef.current) {
        writeLocalDraft();
      } else {
        clearLocalNoteDraft(note.id);
      }
      if (dirtyRef.current) {
        timerRef.current = window.setTimeout(() => persist(), 300);
      }
      return !dirtyRef.current;
    } catch (error) {
      dirtyRef.current = true;
      setStatus(currentSaveErrorStatus());
      if (isExternalNoteConflict(error)) {
        setLocalConflict(true);
      }
      writeLocalDraft();
      toast.error(clientError(error, "Não foi possível salvar a nota."));
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [note.id, writeLocalDraft]);

  const markDirty = useCallback(() => {
    revisionRef.current += 1;
    dirtyRef.current = true;
    setStatus(writeLocalDraft() ? "dirty" : "error");
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => persist(), 700);
  }, [persist, writeLocalDraft]);

  useEffect(() => {
    let timer: number | null = null;
    try {
      const raw = window.localStorage.getItem(localNoteDraftKey(note.id));
      const draft = raw ? parseLocalNoteDraft(raw) : null;
      if (draft) {
        const restoredLinkedResourceId =
          typeof draft.linkedResourceId === "string"
            ? draft.linkedResourceId
            : (note.linkedResourceId ?? "");
        const restoredFolderId =
          typeof draft.folderId === "string"
            ? draft.folderId
            : (note.folderId ?? "");
        draftRef.current = {
          title: draft.title,
          tagText: draft.tagText,
          content: draft.content as JSONContent,
          folderId: restoredFolderId,
          linkedResourceId: restoredLinkedResourceId,
        };
        setTitle(draft.title);
        setTagText(draft.tagText);
        setContent(draft.content as JSONContent);
        setFolderId(restoredFolderId);
        setLinkedResourceId(restoredLinkedResourceId);
        dirtyRef.current = true;
        if (draft.baseUpdatedAt === savedAtRef.current) {
          setStatus("dirty");
          timer = window.setTimeout(() => persist(), 160);
        } else {
          setLocalConflict(true);
          setStatus("error");
        }
      }
    } catch {
      setStatus("error");
    }
    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [note.folderId, note.id, note.linkedResourceId, persist]);

  useEffect(() => {
    const onOnline = () => {
      if (dirtyRef.current) {
        persist();
      }
    };
    const onOffline = () => {
      if (dirtyRef.current) {
        setStatus("offline");
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [persist]);

  useEffect(() => {
    saveHandlerRef.current = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      return persist();
    };
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      saveHandlerRef.current = null;
    };
  }, [persist, saveHandlerRef]);

  useEffect(() => {
    draftRef.current = { title, tagText, content, folderId, linkedResourceId };
  }, [content, folderId, linkedResourceId, tagText, title]);

  const downloadLocalDraft = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            title: draftRef.current.title,
            tags: draftRef.current.tagText,
            content: draftRef.current.content,
            folderId: draftRef.current.folderId || null,
            linkedResourceId: draftRef.current.linkedResourceId || null,
            baseUpdatedAt: savedAtRef.current,
          },
          null,
          2
        ),
      ],
      { type: "application/json;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "nota"}-rascunho.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const inspectConflict = async () => {
    setConflictOpen(true);
    setConflictServerVersion(null);
    setConflictError(null);
    setConflictLoading(true);
    try {
      const latest = await loadPlannerNoteAction(note.id);
      if (latest) {
        setConflictServerVersion(latest);
      } else {
        setConflictError("Esta nota não está mais disponível no servidor.");
      }
    } catch {
      setConflictError("Não foi possível carregar a versão do servidor.");
    } finally {
      setConflictLoading(false);
    }
  };

  const useServerVersion = () => {
    if (!conflictServerVersion) {
      return;
    }
    const serverDraft = {
      title: conflictServerVersion.title,
      tagText: conflictServerVersion.tags.map((tag) => tag.name).join(", "),
      content: noteContentJson(conflictServerVersion),
      folderId: conflictServerVersion.folderId ?? "",
      linkedResourceId: conflictServerVersion.linkedResourceId ?? "",
    };
    draftRef.current = serverDraft;
    setTitle(serverDraft.title);
    setTagText(serverDraft.tagText);
    setContent(serverDraft.content);
    setFolderId(serverDraft.folderId);
    setLinkedResourceId(serverDraft.linkedResourceId);
    setEditorGeneration((generation) => generation + 1);
    savedAtRef.current = new Date(
      conflictServerVersion.updatedAt
    ).toISOString();
    dirtyRef.current = false;
    revisionRef.current += 1;
    clearLocalNoteDraft(note.id);
    setStatus("saved");
    setLocalConflict(false);
    setConflictOpen(false);
  };

  const keepLocalVersion = async () => {
    if (!conflictServerVersion) {
      return;
    }
    savedAtRef.current = new Date(
      conflictServerVersion.updatedAt
    ).toISOString();
    dirtyRef.current = true;
    writeLocalDraft();
    await persist();
    if (!dirtyRef.current) {
      setConflictOpen(false);
    }
  };

  const tags = tagText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const selectedResource = linkResources.find(
    (resource) => resource.id === linkedResourceId
  );

  return (
    <div className="note-editor-canvas flex min-h-[calc(100dvh-56px)] flex-col bg-[#F1EBE8] md:min-h-[560px] md:bg-white">
      {localConflict ? (
        <div
          aria-live="assertive"
          className="flex flex-wrap items-center justify-between gap-3 border-[#C9984A]/50 border-b bg-[#FBF3E8] px-4 py-3 text-[#40222F] text-sm sm:px-7"
          role="alert"
        >
          <p>
            Há uma versão deste rascunho salva neste aparelho, mas a nota foi
            atualizada no servidor. A cópia local foi preservada; compare as
            versões antes de escolher qual manter.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={downloadLocalDraft}
              size="sm"
              type="button"
              variant="outline"
            >
              Baixar cópia local
            </Button>
            <Button
              onClick={() => inspectConflict()}
              size="sm"
              type="button"
              variant="outline"
            >
              Comparar versões
            </Button>
          </div>
        </div>
      ) : null}
      {conflictOpen ? (
        <NoteConflictDialog
          error={conflictError}
          loading={conflictLoading}
          localContent={noteJsonText(draftRef.current.content)}
          localTags={draftRef.current.tagText}
          localTitle={draftRef.current.title}
          onClose={() => setConflictOpen(false)}
          onKeepLocal={keepLocalVersion}
          onUseServer={useServerVersion}
          saving={status === "saving"}
          serverContent={conflictServerVersion?.contentText ?? ""}
          serverTags={
            conflictServerVersion?.tags.map((tag) => tag.name).join(", ") ?? ""
          }
          serverTitle={conflictServerVersion?.title ?? ""}
          serverUpdatedLabel={
            conflictServerVersion
              ? textDate(conflictServerVersion.updatedAt)
              : ""
          }
          versionAvailable={Boolean(conflictServerVersion)}
        />
      ) : null}
      <div className="flex flex-1 flex-col px-5 pt-[14px] max-sm:pr-[84px] max-sm:pb-28 sm:px-10 sm:pt-8 md:px-7">
        <div className="flex min-h-[34px] flex-wrap items-center gap-2">
          <label className="flex h-[34px] w-[169px] min-w-0 items-center gap-1.5 rounded-md border border-[#E2D6D1] bg-[#F8F4F1] px-2 text-[#40222F]">
            <BookOpenIcon aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="sr-only">Pasta</span>
            <select
              aria-label="Pasta"
              className="min-w-0 flex-1 appearance-none truncate bg-transparent text-xs outline-none"
              onChange={(event) => {
                const next = event.target.value;
                setFolderId(next);
                draftRef.current = { ...draftRef.current, folderId: next };
                markDirty();
              }}
              value={folderId}
            >
              <option value="">Sem pasta</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.parentId ? "↳ " : ""}
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <label className="relative flex h-[22px] min-w-0 max-w-full items-center gap-1 rounded-md border border-[#E2D6D1] bg-white px-2 text-[#40222F] max-sm:max-w-[105px]">
            <PlayCircleIcon
              aria-hidden="true"
              className="size-3 shrink-0 text-[#8C1535]"
            />
            <span className="sr-only">Vincular a uma aula</span>
            <span className="truncate text-[11.5px] md:hidden">
              {selectedResource?.shortLabel ?? "Sem vínculo"}
            </span>
            <select
              aria-label="Vincular a uma aula"
              className="min-w-0 flex-1 appearance-none truncate bg-transparent text-[11.5px] outline-none max-sm:absolute max-sm:inset-0 max-sm:w-full max-sm:opacity-0 max-sm:focus-visible:opacity-100"
              onChange={(event) => {
                const next = event.target.value;
                setLinkedResourceId(next);
                draftRef.current = {
                  ...draftRef.current,
                  linkedResourceId: next,
                };
                markDirty();
              }}
              value={linkedResourceId}
            >
              <option value="">Sem vínculo</option>
              {linkResources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  Aula · {resource.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 flex min-h-[22px] items-center gap-1.5">
          {editingTags ? (
            <input
              aria-label="Etiquetas da nota, separadas por vírgulas"
              autoFocus
              className="h-[22px] min-w-20 max-w-full rounded bg-[#E9DAD9] px-2 text-[#8C1535] text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[#8C1535]"
              onBlur={() => setEditingTags(false)}
              onChange={(event) => {
                const next = event.target.value;
                setTagText(next);
                draftRef.current = { ...draftRef.current, tagText: next };
                markDirty();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              placeholder="Adicionar etiqueta"
              value={tagText}
            />
          ) : (
            <button
              aria-label="Editar etiquetas"
              className="flex min-h-[22px] min-w-[22px] max-w-full items-center gap-1.5 text-left"
              onClick={() => setEditingTags(true)}
              type="button"
            >
              {tags.map((tag) => (
                <span
                  className="h-[22px] max-w-[150px] truncate rounded px-2 text-[#8C1535] text-[11px] leading-[22px]"
                  key={tag}
                  style={{ backgroundColor: "rgba(140,21,53,.08)" }}
                >
                  {tag}
                </span>
              ))}
              <span
                className={`text-[#8C1535] text-xs ${tags.length ? "max-sm:hidden" : ""}`}
              >
                + etiqueta
              </span>
            </button>
          )}
        </div>
        <div className="mt-2 hidden items-center justify-end gap-3 border-[#E2D6D1] border-b pb-3 text-[#6C4857] text-xs md:flex">
          <span aria-live="polite">
            <NoteSaveStatus status={status} />
          </span>
          <Button
            aria-label={note.pinnedAt ? "Desafixar nota" : "Fixar nota"}
            className="size-9 text-[#6C4857]"
            onClick={onPin}
            size="icon"
            type="button"
            variant="ghost"
          >
            <MapPinIcon
              aria-hidden="true"
              className={`size-4 ${note.pinnedAt ? "fill-[#C9984A] text-[#C9984A]" : ""}`}
            />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Mais ações"
                className="size-9 text-[#6C4857]"
                size="icon"
                type="button"
                variant="ghost"
              >
                <MoreHorizontalIcon aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52" side="bottom">
              <DropdownMenuItem onSelect={onDuplicate}>
                <CopyIcon aria-hidden="true" />
                Duplicar nota
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExport}>
                <DownloadIcon aria-hidden="true" />
                Exportar Markdown
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={status === "saved" || status === "saving"}
                onSelect={() => persist()}
              >
                Salvar agora
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onMoveToTrash}>
                <Trash2Icon aria-hidden="true" />
                Mover para a lixeira
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <input
          aria-label="Título da nota"
          className="mt-[10px] h-[53px] w-full border-0 border-[#E2D6D1] border-b bg-white px-1 font-display font-semibold text-[#40222F] text-[25px] tracking-tight outline-none placeholder:text-[#BFA9A3] focus-visible:ring-0 md:h-[65px] md:text-4xl"
          maxLength={180}
          onChange={(event) => {
            const next = event.target.value;
            setTitle(next);
            draftRef.current = { ...draftRef.current, title: next };
            markDirty();
          }}
          placeholder="Sem título"
          value={title}
        />
        <div className="mt-6 flex-1">
          <TopicEditor
            allowImageUploads={false}
            ariaLabel="Texto da nota"
            defaultValue={content}
            enableImages={false}
            enableMentions={false}
            key={editorGeneration}
            name="plannerNote"
            noteMode
            onDocumentChange={(next) => {
              setContent(next);
              draftRef.current = { ...draftRef.current, content: next };
              markDirty();
            }}
            onEditorBlur={() => {
              if (dirtyRef.current) {
                persist();
              }
            }}
          />
        </div>
      </div>
      <header className="fixed inset-x-0 bottom-0 z-20 flex min-h-[75px] items-center justify-between gap-2 border-[#E2D6D1] border-t bg-[#F1EBE8] px-5 pt-[10px] pr-[84px] pb-5 md:hidden">
        <span
          aria-live="polite"
          className="min-w-0 truncate text-[#7A5A69] text-xs"
        >
          <NoteSaveStatus status={status} />
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Mais ações"
                className="size-10 rounded-full text-[#6C4857]"
                size="icon"
                type="button"
                variant="ghost"
              >
                <MoreHorizontalIcon aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52" side="top">
              <DropdownMenuItem onSelect={onDuplicate}>
                <CopyIcon aria-hidden="true" />
                Duplicar nota
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExport}>
                <DownloadIcon aria-hidden="true" />
                Exportar Markdown
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={status === "saved" || status === "saving"}
                onSelect={() => persist()}
              >
                Salvar agora
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onMoveToTrash}>
                <Trash2Icon aria-hidden="true" />
                Mover para a lixeira
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            aria-label={note.pinnedAt ? "Desafixar nota" : "Fixar nota"}
            className="size-10 rounded-full text-[#6C4857]"
            onClick={onPin}
            size="icon"
            type="button"
            variant="ghost"
          >
            <MapPinIcon
              aria-hidden="true"
              className={`size-4 ${note.pinnedAt ? "fill-[#C9984A] text-[#C9984A]" : ""}`}
            />
          </Button>
          <Button
            aria-label="Mover nota para a lixeira"
            className="size-10 rounded-full text-[#6C4857]"
            onClick={onMoveToTrash}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Trash2Icon aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </header>
    </div>
  );
}

function NoteListItem({
  isBulkSelected,
  isSelected,
  linkResources,
  note,
  timezone,
  referenceNow,
  onOpen,
  onSelectionChange,
  trash,
}: {
  readonly timezone: string;
  readonly referenceNow: string;
  readonly isBulkSelected: boolean;
  readonly isSelected: boolean;
  readonly linkResources: readonly TimerLinkResource[];
  readonly note: NoteItem;
  readonly onOpen: () => void;
  readonly onSelectionChange: (checked: boolean) => void;
  readonly trash: boolean;
}) {
  const longPressTimer = useRef<number | null>(null);
  const suppressOpen = useRef(false);
  const linkedResourceTitle = note.linkedResourceId
    ? linkResources.find((resource) => resource.id === note.linkedResourceId)
        ?.title
    : null;
  const startLongPress = (pointerType: string) => {
    if (pointerType !== "touch" && pointerType !== "pen") {
      return;
    }
    longPressTimer.current = window.setTimeout(() => {
      suppressOpen.current = true;
      onSelectionChange(!isBulkSelected);
    }, 480);
  };
  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div className="group/note relative min-w-0 border-[#E2D6D1] border-b last:border-b-0">
      {trash ? null : (
        <label
          className={`absolute top-3 left-2 z-10 grid size-6 place-items-center rounded bg-white/95 transition-opacity group-focus-within/note:pointer-events-auto group-focus-within/note:opacity-100 group-hover/note:pointer-events-auto group-hover/note:opacity-100 ${isBulkSelected ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <span className="sr-only">Selecionar {noteTitle(note)}</span>
          <input
            checked={isBulkSelected}
            onChange={(event) => onSelectionChange(event.target.checked)}
            type="checkbox"
          />
        </label>
      )}
      <button
        aria-current={isSelected ? "true" : undefined}
        className={`block min-h-[104px] w-full min-w-0 py-3 text-left transition-colors ${isBulkSelected ? "pr-4 pl-12" : "pr-4 pl-5"} ${isSelected ? "lg:border-[#8C1535] lg:border-l-2 lg:bg-[#F8F4F1]" : "hover:bg-[#FBF8F5]"}`}
        onClick={() => {
          if (suppressOpen.current) {
            suppressOpen.current = false;
            return;
          }
          onOpen();
        }}
        onPointerCancel={clearLongPress}
        onPointerDown={(event) => startLongPress(event.pointerType)}
        onPointerLeave={clearLongPress}
        onPointerUp={clearLongPress}
        type="button"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="line-clamp-1 font-semibold text-[#40222F] text-sm">
            {noteTitle(note)}
          </span>
          {note.pinnedAt ? (
            <MapPinIcon
              aria-label="Fixada"
              className="size-3.5 shrink-0 text-[#8C1535]"
            />
          ) : null}
        </span>
        <span className="mt-1 line-clamp-2 block text-[#7A5A69] text-[13px] leading-[1.4]">
          {note.contentText || "Nota sem conteúdo"}
        </span>
        <span className="mt-1.5 flex min-w-0 items-center gap-2 truncate font-mono text-[#947A83] text-[10px] uppercase tracking-[0.06em]">
          <span className="shrink-0">
            {noteListDate(note.updatedAt, timezone, referenceNow)}
          </span>
          {note.linkedResourceId ? (
            <span className="flex min-w-0 items-center gap-1 truncate normal-case tracking-normal">
              <Link2Icon aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">
                Aula · {linkedResourceTitle ?? "Vínculo indisponível"}
              </span>
            </span>
          ) : (
            <span className="shrink-0 normal-case tracking-normal">
              Sem vínculo
            </span>
          )}
          {note.deletedAt ? (
            <span className="sr-only">
              Removida {textDate(note.deletedAt, timezone)}
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );
}

function NoteWorkspaceEditorPanel({
  folders,
  linkResources,
  loading,
  mobileEditorOpen,
  note,
  onBack,
  onCreate,
  onDelete,
  onDuplicate,
  onExport,
  onMoveToTrash,
  onPin,
  onRestore,
  pending,
  saveHandlerRef,
  selectedTrashNote,
  trash,
}: {
  readonly folders: readonly FolderItem[];
  readonly linkResources: readonly TimerLinkResource[];
  readonly loading: boolean;
  readonly mobileEditorOpen: boolean;
  readonly note: FullNote | null;
  readonly onBack: () => void;
  readonly onCreate: () => void;
  readonly onDelete: (note: NoteItem) => void;
  readonly onDuplicate: () => void;
  readonly onExport: () => void;
  readonly onMoveToTrash: () => void;
  readonly onPin: (noteId: string) => void;
  readonly onRestore: (note: NoteItem) => void;
  readonly pending: boolean;
  readonly saveHandlerRef: MutableRefObject<(() => Promise<boolean>) | null>;
  readonly selectedTrashNote: NoteItem | null;
  readonly trash: boolean;
}) {
  if (note) {
    const linkedResourceHref = note.linkedResourceId
      ? (linkResources.find((resource) => resource.id === note.linkedResourceId)
          ?.href ?? "/cursos")
      : null;

    return (
      <section
        aria-label="Editor de nota"
        className={`${mobileEditorOpen ? "flex" : "hidden"} min-h-[640px] min-w-0 flex-col md:flex`}
      >
        <NoteEditor
          folders={folders}
          key={note.id}
          linkResources={linkResources}
          note={note}
          onDuplicate={onDuplicate}
          onExport={onExport}
          onMoveToTrash={onMoveToTrash}
          onPin={() => onPin(note.id)}
          saveHandlerRef={saveHandlerRef}
        />
        <footer className="hidden flex-wrap items-center justify-between gap-3 border-[#E2D6D1] border-t px-4 py-3 sm:px-7 md:flex">
          <span className="text-[#947A83] text-xs">
            {note.tags.map((tag) => `#${tag.name}`).join("  ")}
          </span>
          {linkedResourceHref ? (
            <a
              className="text-[#8C1535] text-xs underline-offset-4 hover:underline"
              href={linkedResourceHref}
            >
              Abrir aula vinculada
            </a>
          ) : null}
          <Button
            className="text-[#8C1535]"
            disabled={pending}
            onClick={onMoveToTrash}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Trash2Icon aria-hidden="true" className="mr-2 size-4" />
            Mover para lixeira
          </Button>
        </footer>
      </section>
    );
  }

  if (selectedTrashNote) {
    return (
      <section
        aria-label="Editor de nota"
        className={`${mobileEditorOpen ? "flex" : "hidden"} min-h-[640px] min-w-0 flex-col md:flex`}
      >
        <div className="flex flex-1 flex-col p-6 sm:p-10">
          <button
            className="mb-8 flex items-center gap-2 text-[#6C4857] text-sm lg:hidden"
            onClick={onBack}
            type="button"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-4" />
            Voltar para lixeira
          </button>
          <p className="brand-eyebrow text-[#8C1535]">Nota na lixeira</p>
          <h3 className="mt-2 font-display text-3xl text-[#40222F]">
            {noteTitle(selectedTrashNote)}
          </h3>
          <p className="mt-2 text-[#7A5A69] text-sm">
            Esta nota será removida automaticamente após 30 dias.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              disabled={pending}
              onClick={() => onRestore(selectedTrashNote)}
              type="button"
            >
              <ArchiveRestoreIcon aria-hidden="true" className="mr-2 size-4" />
              Restaurar
            </Button>
            <Button
              className="text-[#8C1535]"
              disabled={pending}
              onClick={() => onDelete(selectedTrashNote)}
              type="button"
              variant="outline"
            >
              <Trash2Icon aria-hidden="true" className="mr-2 size-4" />
              Excluir definitivamente
            </Button>
          </div>
          <div className="prose-editor mt-8 rounded-xl border border-[#E2D6D1] bg-[#FBF8F5] p-5 text-[#6C4857] text-sm">
            {selectedTrashNote.contentText || "Esta nota não tem texto."}
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section
        aria-label="Editor de nota"
        className={`${mobileEditorOpen ? "flex" : "hidden"} min-h-[640px] min-w-0 flex-col md:flex`}
      >
        <output
          aria-busy="true"
          aria-live="polite"
          className="grid flex-1 place-items-center p-8 text-center text-[#7A5A69] text-sm"
        >
          Abrindo nota…
        </output>
      </section>
    );
  }

  return (
    <section
      aria-label="Editor de nota"
      className={`${mobileEditorOpen ? "flex" : "hidden"} min-h-[640px] min-w-0 flex-col md:flex`}
    >
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div className="max-w-sm">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#F8F4F1] text-[#8C1535]">
            <FilePlus2Icon aria-hidden="true" className="size-6" />
          </span>
          <h3 className="mt-4 font-display text-2xl text-[#40222F]">
            {trash ? "Escolha uma nota" : "Um lugar para suas ideias"}
          </h3>
          <p className="mt-2 text-[#7A5A69] text-sm leading-relaxed">
            {trash
              ? "Selecione uma nota para restaurar ou excluir."
              : "Crie sua primeira nota para guardar referências, lembretes e pensamentos de estudo."}
          </p>
          {trash ? null : (
            <Button
              className="mt-5 rounded-full bg-[#8C1535] text-white hover:bg-[#6D102A]"
              onClick={onCreate}
              type="button"
            >
              <FilePlus2Icon aria-hidden="true" className="mr-2 size-4" />
              Criar nota
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function NotesWorkspaceDialogs({
  applyBulkUpdate,
  bulkTagName,
  bulkTagOpen,
  bulkTrashOpen,
  deleteFolder,
  deleteNote,
  folderDialog,
  pending,
  permanentlyDeleteFolder,
  permanentlyDeleteNote,
  saveFolder,
  selectedNoteIds,
  setBulkTagName,
  setBulkTagOpen,
  setBulkTrashOpen,
  setDeleteFolder,
  setDeleteNote,
  setFolderDialog,
}: NotesWorkspaceDialogsProps) {
  return (
    <>
      <Dialog
        onOpenChange={(open) => !open && setFolderDialog(null)}
        open={Boolean(folderDialog)}
      >
        <DialogContent className="max-w-md border-[#E2D6D1] bg-[#FBF8F5]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#40222F]">
              {getFolderDialogTitle(folderDialog)}
            </DialogTitle>
            <DialogDescription>
              Organize suas notas pessoais por assunto.
            </DialogDescription>
          </DialogHeader>
          <label
            className="grid gap-2 text-[#40222F] text-sm"
            htmlFor="note-folder-name"
          >
            Nome da pasta
            <Input
              autoFocus
              id="note-folder-name"
              maxLength={48}
              onChange={(event) =>
                setFolderDialog(
                  folderDialog
                    ? { ...folderDialog, name: event.target.value }
                    : null
                )
              }
              value={folderDialog?.name ?? ""}
            />
          </label>
          <label className="grid gap-2 text-[#40222F] text-sm">
            Ícone
            <select
              className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
              onChange={(event) =>
                setFolderDialog(
                  folderDialog
                    ? { ...folderDialog, icon: event.target.value }
                    : null
                )
              }
              value={folderDialog?.icon ?? "folder"}
            >
              <option value="folder">Pasta</option>
              <option value="book">Livro</option>
              <option value="star">Estrela</option>
            </select>
          </label>
          <DialogFooter>
            <Button
              onClick={() => setFolderDialog(null)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={pending || !folderDialog?.name.trim()}
              onClick={saveFolder}
              type="button"
            >
              Salvar pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setBulkTagOpen(false);
            setBulkTagName("");
          }
        }}
        open={bulkTagOpen}
      >
        <DialogContent className="max-w-md border-[#E2D6D1] bg-[#FBF8F5]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#40222F]">
              Etiquetar notas
            </DialogTitle>
            <DialogDescription>
              A etiqueta será adicionada às {selectedNoteIds.length} notas
              selecionadas.
            </DialogDescription>
          </DialogHeader>
          <label
            className="grid gap-2 text-[#40222F] text-sm"
            htmlFor="note-bulk-tag"
          >
            Nova etiqueta
            <Input
              autoFocus
              id="note-bulk-tag"
              maxLength={32}
              onChange={(event) => setBulkTagName(event.target.value)}
              value={bulkTagName}
            />
          </label>
          <DialogFooter>
            <Button
              onClick={() => setBulkTagOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={pending || !bulkTagName.trim()}
              onClick={() => applyBulkUpdate("TAG", { tagName: bulkTagName })}
              type="button"
            >
              Aplicar etiqueta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => !open && setBulkTrashOpen(false)}
        open={bulkTrashOpen}
      >
        <DialogContent className="max-w-md border-[#E2D6D1] bg-[#FBF8F5]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#40222F]">
              Mover notas para a lixeira?
            </DialogTitle>
            <DialogDescription>
              {selectedNoteIds.length} notas serão guardadas na lixeira por 30
              dias e poderão ser restauradas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setBulkTrashOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={pending}
              onClick={() => applyBulkUpdate("TRASH")}
              type="button"
            >
              Mover para a lixeira
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => !open && setDeleteNote(null)}
        open={Boolean(deleteNote)}
      >
        <DialogContent className="max-w-md border-[#E2D6D1] bg-[#FBF8F5]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#40222F]">
              Excluir nota definitivamente?
            </DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <p className="text-[#7A5A69] text-sm">
            {deleteNote ? noteTitle(deleteNote) : ""}
          </p>
          <DialogFooter>
            <Button
              onClick={() => setDeleteNote(null)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              className="bg-[#8C1535] text-white hover:bg-[#6D102A]"
              disabled={pending}
              onClick={permanentlyDeleteNote}
              type="button"
            >
              Excluir nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => !open && setDeleteFolder(null)}
        open={Boolean(deleteFolder)}
      >
        <DialogContent className="max-w-md border-[#E2D6D1] bg-[#FBF8F5]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#40222F]">
              Excluir pasta?
            </DialogTitle>
            <DialogDescription>
              As notas serão mantidas e movidas para “Sem pasta”.
            </DialogDescription>
          </DialogHeader>
          <p className="text-[#7A5A69] text-sm">{deleteFolder?.name}</p>
          <DialogFooter>
            <Button
              onClick={() => setDeleteFolder(null)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={pending}
              onClick={permanentlyDeleteFolder}
              type="button"
            >
              Excluir pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function NoteFoldersSidebar({
  data,
  folderFilter,
  orderedFolders,
  setDeleteFolder,
  setFolderDialog,
  setFolderFilter,
  setMobileEditorOpen,
  setSelectedId,
  setTagFilter,
  setTrash,
  tagFilter,
  toggleTrash,
  trash,
}: NoteFoldersSidebarProps) {
  return (
    <aside className="hidden bg-transparent p-0 lg:block">
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        <h2 className="font-display text-[#40222F] text-xl">Pastas</h2>
        <Button
          aria-label="Criar pasta"
          onClick={() => setFolderDialog({ name: "", icon: "folder" })}
          size="icon"
          type="button"
          variant="ghost"
        >
          <FolderPlusIcon aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <nav aria-label="Pastas de notas" className="mt-3 grid gap-1">
        <button
          aria-current={!trash && folderFilter === "all" ? "page" : undefined}
          className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm ${!trash && folderFilter === "all" ? "bg-white font-medium text-[#8C1535] shadow-sm" : "text-[#6C4857] hover:bg-white/70"}`}
          onClick={() => {
            setTrash(false);
            setFolderFilter("all");
            setTagFilter(null);
            setSelectedId(null);
            setMobileEditorOpen(false);
          }}
          type="button"
        >
          <FilePlus2Icon aria-hidden="true" className="size-4" />
          Todas as notas
        </button>
        <button
          aria-current={
            !trash && folderFilter === "pinned" ? "page" : undefined
          }
          className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm ${!trash && folderFilter === "pinned" ? "bg-white font-medium text-[#8C1535] shadow-sm" : "text-[#6C4857] hover:bg-white/70"}`}
          onClick={() => {
            setTrash(false);
            setFolderFilter("pinned");
            setTagFilter(null);
            setSelectedId(null);
            setMobileEditorOpen(false);
          }}
          type="button"
        >
          <StarIcon aria-hidden="true" className="size-4" />
          Fixadas
        </button>
        <button
          aria-current={
            !trash && folderFilter === "linked" ? "page" : undefined
          }
          className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm ${!trash && folderFilter === "linked" ? "bg-white font-medium text-[#8C1535] shadow-sm" : "text-[#6C4857] hover:bg-white/70"}`}
          onClick={() => {
            setTrash(false);
            setFolderFilter("linked");
            setTagFilter(null);
            setSelectedId(null);
            setMobileEditorOpen(false);
          }}
          type="button"
        >
          <BookOpenIcon aria-hidden="true" className="size-4" />
          Vinculadas a aulas
        </button>
        <button
          aria-current={!trash && folderFilter === null ? "page" : undefined}
          className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm ${!trash && folderFilter === null ? "bg-white font-medium text-[#8C1535] shadow-sm" : "text-[#6C4857] hover:bg-white/70"}`}
          onClick={() => {
            setTrash(false);
            setFolderFilter(null);
            setTagFilter(null);
            setSelectedId(null);
            setMobileEditorOpen(false);
          }}
          type="button"
        >
          <FolderIcon aria-hidden="true" className="size-4" />
          Sem pasta
        </button>
        {orderedFolders.map((folder) => (
          <div
            className={`group flex items-center gap-1 ${folder.parentId ? "ml-4" : ""}`}
            key={folder.id}
          >
            <button
              aria-current={
                !trash && folderFilter === folder.id ? "page" : undefined
              }
              className={`flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left text-sm ${!trash && folderFilter === folder.id ? "bg-white font-medium text-[#8C1535] shadow-sm" : "text-[#6C4857] hover:bg-white/70"}`}
              onClick={() => {
                setTrash(false);
                setFolderFilter(folder.id);
                setTagFilter(null);
                setSelectedId(null);
                setMobileEditorOpen(false);
              }}
              type="button"
            >
              <NoteFolderIcon icon={folder.icon} />
              <span className="truncate">{folder.name}</span>
            </button>
            {folder.parentId ? null : (
              <button
                aria-label={`Criar subpasta em ${folder.name}`}
                className="hidden size-8 place-items-center rounded-md text-[#947A83] hover:bg-white hover:text-[#8C1535] focus-visible:grid group-hover:grid"
                onClick={() =>
                  setFolderDialog({
                    name: "",
                    icon: "folder",
                    parentId: folder.id,
                  })
                }
                type="button"
              >
                <FolderPlusIcon aria-hidden="true" className="size-3.5" />
              </button>
            )}
            <button
              aria-label={`Renomear pasta ${folder.name}`}
              className="hidden size-8 place-items-center rounded-md text-[#947A83] hover:bg-white hover:text-[#8C1535] focus-visible:grid group-hover:grid"
              onClick={() =>
                setFolderDialog({
                  id: folder.id,
                  icon: folder.icon,
                  name: folder.name,
                })
              }
              type="button"
            >
              <span aria-hidden="true">···</span>
            </button>
            <button
              aria-label={`Excluir pasta ${folder.name}`}
              className="hidden size-8 place-items-center rounded-md text-[#947A83] hover:bg-white hover:text-[#8C1535] focus-visible:grid group-hover:grid"
              onClick={() => setDeleteFolder(folder)}
              type="button"
            >
              <Trash2Icon aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        ))}
      </nav>
      {data.tags.length ? (
        <div className="mt-6 border-[#E2D6D1] border-t pt-4">
          <h3 className="px-3 font-medium text-[#947A83] text-[11px] uppercase tracking-[.12em]">
            Etiquetas
          </h3>
          <nav aria-label="Etiquetas de notas" className="mt-2 grid gap-1">
            {data.tags.map((tag) => (
              <button
                aria-current={tagFilter === tag.id ? "page" : undefined}
                className={`flex min-h-9 items-center rounded-lg px-3 text-left text-sm ${tagFilter === tag.id ? "bg-white font-medium text-[#8C1535] shadow-sm" : "text-[#6C4857] hover:bg-white/70"}`}
                key={tag.id}
                onClick={() => {
                  setTrash(false);
                  setFolderFilter("all");
                  setTagFilter(tag.id);
                  setSelectedId(null);
                  setMobileEditorOpen(false);
                }}
                type="button"
              >
                <span className="truncate">#{tag.name}</span>
              </button>
            ))}
          </nav>
        </div>
      ) : null}
      <div className="mt-8 border-[#E2D6D1] border-t pt-4">
        <button
          aria-current={trash ? "page" : undefined}
          className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm ${trash ? "bg-white font-medium text-[#8C1535] shadow-sm" : "text-[#6C4857] hover:bg-white/70"}`}
          onClick={toggleTrash}
          type="button"
        >
          <Trash2Icon aria-hidden="true" className="size-4" />
          Lixeira
        </button>
        <p className="px-3 pt-2 text-[#947A83] text-xs">
          Exclusão automática após 30 dias
        </p>
      </div>
    </aside>
  );
}
function NotesMobileFolderSheet({
  data,
  folderFilter,
  orderedFolders,
  search,
  setDeleteFolder,
  setFolderDialog,
  setFolderFilter,
  setMobileEditorOpen,
  setSelectedId,
  setTagFilter,
  setTrash,
  tagFilter,
  trash,
}: Pick<
  NotesListPanelProps,
  | "data"
  | "folderFilter"
  | "orderedFolders"
  | "search"
  | "setDeleteFolder"
  | "setFolderDialog"
  | "setFolderFilter"
  | "setMobileEditorOpen"
  | "setSelectedId"
  | "setTagFilter"
  | "setTrash"
  | "tagFilter"
  | "trash"
>) {
  const [open, setOpen] = useState(false);
  const [manageFolders, setManageFolders] = useState(false);
  const visibleNotes = data.notes;
  const showFolderCounts = folderFilter === "all" && !search.trim() && !trash;

  const updateFolderFilter = (value: string) => {
    setSelectedId(null);
    setMobileEditorOpen(false);
    if (value === "trash") {
      setTrash(true);
      return;
    }
    setTrash(false);
    if (value.startsWith("tag:")) {
      setFolderFilter("all");
      setTagFilter(value.slice(4));
      return;
    }
    setTagFilter(null);
    setFolderFilter(value === "all" ? "all" : value || null);
  };

  const chooseFolder = (value: string) => {
    updateFolderFilter(value);
    setOpen(false);
  };

  let selectedFolderLabel = "Pasta";
  if (tagFilter) {
    selectedFolderLabel = `#${data.tags.find((tag) => tag.id === tagFilter)?.name ?? "etiqueta"}`;
  } else if (trash) {
    selectedFolderLabel = "Lixeira";
  } else if (folderFilter === "all") {
    selectedFolderLabel = `Todas as notas${showFolderCounts ? ` · ${visibleNotes.length}` : ""}`;
  } else if (folderFilter === "pinned") {
    selectedFolderLabel = "Fixadas";
  } else if (folderFilter === "linked") {
    selectedFolderLabel = "Vinculadas a aulas";
  } else if (folderFilter === null) {
    selectedFolderLabel = "Sem pasta";
  } else {
    selectedFolderLabel =
      orderedFolders.find((folder) => folder.id === folderFilter)?.name ??
      "Pasta";
  }

  const quickFilters = [
    {
      count: visibleNotes.length,
      icon: (
        <FilePlus2Icon aria-hidden="true" className="size-4 text-[#8C1535]" />
      ),
      label: "Todas as notas",
      value: "all",
    },
    {
      count: visibleNotes.filter((note) => note.pinnedAt).length,
      icon: <StarIcon aria-hidden="true" className="size-4 text-[#7A5A69]" />,
      label: "Fixadas",
      value: "pinned",
    },
    {
      count: visibleNotes.filter((note) => note.linkedResourceId).length,
      icon: (
        <PlayCircleIcon aria-hidden="true" className="size-4 text-[#7A5A69]" />
      ),
      label: "Vinculadas a aulas",
      value: "linked",
    },
    {
      count: null,
      icon: <FolderIcon aria-hidden="true" className="size-4 text-[#7A5A69]" />,
      label: "Sem pasta",
      value: "",
    },
  ];

  return (
    <Sheet
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setManageFolders(false);
        }
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button
          aria-expanded={open}
          aria-haspopup="dialog"
          className="h-12 w-full justify-between rounded-md border border-[#E2D6D1] bg-white px-3 font-normal text-[#40222F] hover:bg-white"
          type="button"
          variant="outline"
        >
          <span className="truncate">{selectedFolderLabel}</span>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-[#7A5A69]"
          />
        </Button>
      </SheetTrigger>
      <SheetContent
        className="max-h-[82dvh] gap-0 rounded-t-2xl border-[#E2D6D1] bg-white px-5 pt-7 pb-[max(20px,env(safe-area-inset-bottom))]"
        side="bottom"
      >
        <div
          aria-hidden="true"
          className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-[#CDBBB5]"
        />
        <SheetHeader className="border-[#E2D6D1] border-b px-0 pt-1 pb-4 text-left">
          <SheetTitle className="font-display text-[#40222F] text-xl">
            Pastas
          </SheetTitle>
          <SheetDescription className="sr-only">
            Escolha uma pasta, etiqueta ou lista de notas.
          </SheetDescription>
        </SheetHeader>
        <nav
          aria-label="Pastas de notas"
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {quickFilters.map((filter) => (
            <button
              aria-current={
                !trash &&
                (filter.value === ""
                  ? folderFilter === null
                  : folderFilter === filter.value)
                  ? "page"
                  : undefined
              }
              className="flex min-h-[70px] w-full items-center gap-3 border-[#E2D6D1] border-b text-left text-[#40222F] text-sm"
              key={filter.value || "unfiled"}
              onClick={() => chooseFolder(filter.value)}
              type="button"
            >
              {filter.icon}
              <span className="flex-1">{filter.label}</span>
              {showFolderCounts && filter.count !== null ? (
                <span className="text-[#7A5A69] text-xs">{filter.count}</span>
              ) : null}
            </button>
          ))}
          {orderedFolders.map((folder) => (
            <div
              className={`flex min-h-[70px] items-center gap-2 border-[#E2D6D1] border-b ${folder.parentId ? "pl-5" : ""}`}
              key={folder.id}
            >
              <button
                aria-current={
                  !trash && folderFilter === folder.id ? "page" : undefined
                }
                className="flex min-h-[69px] min-w-0 flex-1 items-center gap-3 text-left text-[#40222F] text-sm"
                onClick={() => chooseFolder(folder.id)}
                type="button"
              >
                <NoteFolderIcon icon={folder.icon} />
                <span className="flex-1 truncate">{folder.name}</span>
                {showFolderCounts ? (
                  <span className="text-[#7A5A69] text-xs">
                    {
                      visibleNotes.filter((note) => note.folderId === folder.id)
                        .length
                    }
                  </span>
                ) : null}
              </button>
              {manageFolders ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={`Ações da pasta ${folder.name}`}
                      className="size-10 shrink-0 text-[#7A5A69]"
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <MoreHorizontalIcon
                        aria-hidden="true"
                        className="size-4"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white">
                    <DropdownMenuItem
                      onSelect={() => {
                        setOpen(false);
                        setFolderDialog({
                          id: folder.id,
                          icon: folder.icon,
                          name: folder.name,
                        });
                      }}
                    >
                      Renomear pasta ou mudar ícone
                    </DropdownMenuItem>
                    {folder.parentId ? null : (
                      <DropdownMenuItem
                        onSelect={() => {
                          setOpen(false);
                          setFolderDialog({
                            name: "",
                            icon: "folder",
                            parentId: folder.id,
                          });
                        }}
                      >
                        Nova subpasta
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-[#8C1535]"
                      onSelect={() => {
                        setOpen(false);
                        setDeleteFolder(folder);
                      }}
                    >
                      <Trash2Icon aria-hidden="true" className="mr-2 size-4" />
                      Excluir pasta
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          ))}
          {data.tags.length ? (
            <div className="border-[#E2D6D1] border-b py-4">
              <p className="font-medium text-[#947A83] text-[11px] uppercase tracking-[.12em]">
                Etiquetas
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.tags.map((tag) => (
                  <button
                    aria-current={tagFilter === tag.id ? "page" : undefined}
                    className="min-h-9 rounded-full border border-[#E2D6D1] px-3 text-[#6C4857] text-sm"
                    key={tag.id}
                    onClick={() => chooseFolder(`tag:${tag.id}`)}
                    type="button"
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <button
            aria-current={trash ? "page" : undefined}
            className="flex min-h-[70px] w-full items-center gap-3 border-[#E2D6D1] border-b text-left text-[#40222F] text-sm"
            onClick={() => chooseFolder("trash")}
            type="button"
          >
            <Trash2Icon aria-hidden="true" className="size-4 text-[#7A5A69]" />
            <span className="flex-1">Lixeira</span>
            <span className="text-[#7A5A69] text-xs">30 dias</span>
          </button>
        </nav>
        <div className="flex gap-2 border-[#E2D6D1] border-t pt-4">
          <Button
            className="h-12 flex-1 border-2 border-[#8C1535] text-[#8C1535]"
            onClick={() => {
              setFolderDialog({ name: "", icon: "folder" });
              setOpen(false);
            }}
            type="button"
            variant="outline"
          >
            Nova pasta
          </Button>
          <Button
            className="h-12 flex-1 border-2 border-[#8C1535] text-[#8C1535]"
            onClick={() => setManageFolders((current) => !current)}
            type="button"
            variant="outline"
          >
            {manageFolders ? "Concluir" : "Gerenciar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NotesListPanel({
  allSelectedNotesPinned,
  allVisibleNotesSelected,
  applyBulkUpdate,
  createNote,
  data,
  folderFilter,
  linkResources,
  mobileEditorOpen,
  orderedFolders,
  pending,
  search,
  selectedId,
  selectedNoteIds,
  setBulkTagOpen,
  setBulkTrashOpen,
  setDeleteFolder,
  setFolderDialog,
  setFolderFilter,
  setMobileEditorOpen,
  setSearch,
  setSelectedId,
  setSelectedNoteIds,
  setSortOrder,
  setTagFilter,
  setTrash,
  sortOrder,
  tagFilter,
  toggleTrash,
  trash,
}: NotesListPanelProps) {
  const visibleNotes = data.notes;
  const sortSelect = (mobile: boolean) => (
    <select
      aria-label="Ordenar notas"
      className={`h-12 w-full rounded-md border border-[#E2D6D1] bg-white px-3 text-[#40222F] text-sm ${mobile ? "" : "max-w-[130px]"}`}
      onChange={(event) =>
        setSortOrder(event.target.value as "RECENT" | "TITLE")
      }
      value={sortOrder}
    >
      <option value="RECENT">Mais recentes</option>
      <option value="TITLE">Título A–Z</option>
    </select>
  );
  return (
    <section
      aria-label="Lista de notas"
      className={`${mobileEditorOpen ? "hidden" : "flex"} min-h-0 flex-col md:flex md:min-h-[640px] md:overflow-hidden md:rounded-lg md:border md:border-[#E2D6D1] md:bg-white`}
    >
      <header className="grid gap-2 border-b-0 p-0 lg:gap-2 lg:border-[#E2D6D1] lg:border-b lg:p-3">
        {trash ? (
          <div className="flex items-center justify-between lg:hidden">
            <h2 className="font-display text-[#40222F] text-xl">Lixeira</h2>
            <Button
              aria-label="Voltar às notas"
              onClick={toggleTrash}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ArrowLeftIcon aria-hidden="true" className="size-4" />
            </Button>
          </div>
        ) : null}
        <div className="flex min-w-0 items-center gap-2">
          <label className="block min-w-0 flex-1" htmlFor="notes-search">
            <span className="sr-only">Buscar notas</span>
            <Input
              className="h-11 border-[#E2D6D1] bg-white"
              id="notes-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar nas notas"
              value={search}
            />
          </label>
          {trash ? null : (
            <Button
              className="hidden h-11 min-w-[86px] rounded-md bg-[#8C1535] font-semibold text-white hover:bg-[#6D102A] lg:inline-flex"
              disabled={pending}
              onClick={createNote}
              type="button"
            >
              Nova
            </Button>
          )}
        </div>
        <div className="hidden items-center justify-between gap-2 lg:flex">
          <span className="text-[#7A5A69] text-xs">
            {visibleNotes.length} {visibleNotes.length === 1 ? "nota" : "notas"}
          </span>
          {sortSelect(false)}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:hidden">
          <div className="grid min-w-0 gap-1 text-[#7A5A69] text-xs">
            <span>Pasta</span>
            <NotesMobileFolderSheet
              data={data}
              folderFilter={folderFilter}
              orderedFolders={orderedFolders}
              search={search}
              setDeleteFolder={setDeleteFolder}
              setFolderDialog={setFolderDialog}
              setFolderFilter={setFolderFilter}
              setMobileEditorOpen={setMobileEditorOpen}
              setSelectedId={setSelectedId}
              setTagFilter={setTagFilter}
              setTrash={setTrash}
              tagFilter={tagFilter}
              trash={trash}
            />
          </div>
          <div className="grid min-w-0 gap-1 text-[#7A5A69] text-xs">
            <span>Ordenar</span>
            {sortSelect(true)}
          </div>
        </div>
        {trash ? null : (
          <Button
            className="h-12 w-full rounded-md bg-[#8C1535] font-semibold text-white hover:bg-[#6D102A] lg:hidden"
            disabled={pending}
            onClick={createNote}
            type="button"
          >
            <FilePlus2Icon aria-hidden="true" className="mr-2 size-4" />
            Nova nota
          </Button>
        )}
      </header>
      {trash || selectedNoteIds.length === 0 ? null : (
        <div className="border-[#E2D6D1] border-b bg-[#FBF8F5] p-3">
          <label className="flex min-h-9 items-center gap-2 px-1 text-[#6C4857] text-xs">
            <input
              checked={allVisibleNotesSelected}
              disabled={!visibleNotes.length || pending}
              onChange={(event) =>
                setSelectedNoteIds(
                  event.target.checked
                    ? visibleNotes.map((note) => note.id)
                    : []
                )
              }
              type="checkbox"
            />
            Selecionar todas as notas visíveis
          </label>
          {selectedNoteIds.length ? (
            <div className="mt-2 grid gap-2">
              <p aria-live="polite" className="text-[#7A5A69] text-xs">
                {selectedNoteIds.length} selecionada(s)
              </p>
              <select
                aria-label="Mover notas selecionadas para uma pasta"
                className="h-9 w-full rounded-md border border-[#E2D6D1] bg-white px-2 text-[#40222F] text-xs"
                disabled={pending}
                onChange={(event) =>
                  applyBulkUpdate("MOVE", {
                    folderId: event.target.value || null,
                  })
                }
                value="__choose__"
              >
                <option disabled value="__choose__">
                  Mover para…
                </option>
                <option value="">Sem pasta</option>
                {orderedFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.parentId ? "↳ " : ""}
                    {folder.name}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-1">
                <Button
                  disabled={pending}
                  onClick={() =>
                    applyBulkUpdate(allSelectedNotesPinned ? "UNPIN" : "PIN")
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {allSelectedNotesPinned ? "Desafixar" : "Fixar"}
                </Button>
                <Button
                  disabled={pending}
                  onClick={() => setBulkTagOpen(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Etiquetar
                </Button>
                <Button
                  className="text-[#8C1535]"
                  disabled={pending}
                  onClick={() => setBulkTrashOpen(true)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Lixeira
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto lg:p-0">
        {visibleNotes.length ? (
          <div className="overflow-hidden rounded-lg border border-[#E2D6D1] bg-white lg:rounded-none lg:border-0">
            {visibleNotes.map((note) => (
              <NoteListItem
                isBulkSelected={selectedNoteIds.includes(note.id)}
                isSelected={selectedId === note.id}
                key={note.id}
                linkResources={linkResources}
                note={note}
                onOpen={() => {
                  setSelectedId(note.id);
                  setMobileEditorOpen(true);
                }}
                onSelectionChange={(checked) =>
                  setSelectedNoteIds((current) =>
                    checked
                      ? [...current, note.id]
                      : current.filter((id) => id !== note.id)
                  )
                }
                referenceNow={data.referenceNow}
                timezone={data.timezone}
                trash={trash}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-[#E2D6D1] bg-white px-4 py-10 text-center text-[#7A5A69] text-sm">
            {trash ? "A lixeira está vazia." : "Nenhuma nota nesta pasta."}
          </p>
        )}
      </div>
      {trash ? null : (
        <footer className="hidden border-[#E2D6D1] border-t p-3 lg:block">
          <Button
            className="w-full justify-start text-[#6C4857]"
            onClick={toggleTrash}
            type="button"
            variant="ghost"
          >
            <Trash2Icon aria-hidden="true" className="mr-2 size-4" />
            Lixeira
          </Button>
        </footer>
      )}
    </section>
  );
}
export function NotesWorkspace({
  initialData,
  initialNoteId,
  linkResources,
  registerToolbarActions,
}: {
  readonly initialData: NotesData;
  readonly initialNoteId: string | null;
  readonly linkResources: readonly TimerLinkResource[];
  readonly registerToolbarActions: (
    actions: NotesWorkspaceToolbarActions | null
  ) => void;
}) {
  const [data, setData] = useState(initialData);
  const [folderFilter, setFolderFilter] = useState<
    string | null | "all" | "linked" | "pinned"
  >("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"RECENT" | "TITLE">("RECENT");
  const [trash, setTrash] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialNoteId);
  const [search, setSearch] = useState("");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTagName, setBulkTagName] = useState("");
  const [bulkTrashOpen, setBulkTrashOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(
    Boolean(initialNoteId)
  );
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(
    null
  );
  const [deleteFolder, setDeleteFolder] = useState<FolderItem | null>(null);
  const [deleteNote, setDeleteNote] = useState<NoteItem | null>(null);
  const [pending, setPending] = useState(false);
  const [loadedNote, setLoadedNote] = useState<FullNote | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const saveHandlerRef = useRef<(() => Promise<boolean>) | null>(null);
  const createNoteInFlight = useRef(false);
  const noteLoadSequence = useRef(0);
  const listLoadSequence = useRef(0);
  const previousQueryKey = useRef(`${false}|all|||RECENT`);
  const previousSelectionFilterKey = useRef("");

  const backToNotesList = useCallback(() => {
    setMobileEditorOpen(false);
    const save = saveHandlerRef.current?.();
    if (save) {
      save.catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("interprete:notes-editor-back", backToNotesList);
    return () =>
      window.removeEventListener(
        "interprete:notes-editor-back",
        backToNotesList
      );
  }, [backToNotesList]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (mobileEditorOpen && selectedId && !trash) {
      url.searchParams.set("view", "notes");
      url.searchParams.set("note", selectedId);
    } else {
      url.searchParams.delete("note");
    }
    const nextLocation = `${url.pathname}${url.search}${url.hash}`;
    if (
      nextLocation !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    ) {
      window.history.replaceState(window.history.state, "", nextLocation);
    }
  }, [mobileEditorOpen, selectedId, trash]);

  const reload = useCallback(
    async (
      nextTrash = trash,
      nextFolder: string | null | "all" | "linked" | "pinned" = folderFilter,
      nextSearch = search,
      nextTagId = tagFilter,
      nextSortOrder = sortOrder
    ) => {
      const sequence = ++listLoadSequence.current;
      previousQueryKey.current = `${nextTrash}|${nextFolder}|${nextSearch.trim()}|${nextTagId ?? ""}|${nextSortOrder}`;
      const next = await loadPlannerNotesAction({
        trash: nextTrash,
        search: nextSearch,
        sort: nextSortOrder,
        ...(nextTagId ? { tagId: nextTagId } : {}),
        ...(nextFolder === "all" ||
        nextFolder === "linked" ||
        nextFolder === "pinned"
          ? {}
          : { folderId: nextFolder }),
        ...(nextFolder === "linked" ? { linkedLessons: true } : {}),
        ...(nextFolder === "pinned" ? { pinnedOnly: true } : {}),
      });
      if (sequence === listLoadSequence.current) {
        setData(next);
      }
      return next;
    },
    [folderFilter, search, sortOrder, tagFilter, trash]
  );

  useEffect(() => {
    const queryKey = `${trash}|${folderFilter}|${search.trim()}|${tagFilter ?? ""}|${sortOrder}`;
    if (previousQueryKey.current === queryKey) {
      return;
    }
    previousQueryKey.current = queryKey;
    const timer = window.setTimeout(() => {
      reload(trash, folderFilter, search).catch((error) =>
        toast.error(clientError(error, "Não foi possível buscar as notas."))
      );
    }, 240);
    return () => window.clearTimeout(timer);
  }, [folderFilter, reload, search, sortOrder, tagFilter, trash]);

  useEffect(() => {
    if (
      !(
        selectedId &&
        (data.notes.some((note) => note.id === selectedId) ||
          selectedId === initialNoteId)
      )
    ) {
      setSelectedId(data.notes[0]?.id ?? null);
    }
  }, [data.notes, initialNoteId, selectedId]);

  useEffect(() => {
    if (trash || !selectedId) {
      setLoadedNote(null);
      setLoadingNote(false);
      return;
    }
    if (loadedNote?.id === selectedId) {
      return;
    }
    const sequence = ++noteLoadSequence.current;
    setLoadedNote(null);
    setLoadingNote(true);
    loadPlannerNoteAction(selectedId)
      .then((note) => {
        if (sequence !== noteLoadSequence.current) {
          return;
        }
        setLoadedNote(note);
        if (!note) {
          toast.error("A nota não está mais disponível.");
          setSelectedId(null);
        }
      })
      .catch((error) => {
        if (sequence === noteLoadSequence.current) {
          toast.error(clientError(error, "Não foi possível abrir a nota."));
          setSelectedId(null);
        }
      })
      .finally(() => {
        if (sequence === noteLoadSequence.current) {
          setLoadingNote(false);
        }
      });
    return () => {
      noteLoadSequence.current += 1;
    };
  }, [loadedNote?.id, selectedId, trash]);

  const visibleNotes = data.notes;
  const orderedFolders = useMemo(
    () =>
      data.folders
        .filter((folder) => !folder.parentId)
        .flatMap((folder) => [
          folder,
          ...data.folders.filter((child) => child.parentId === folder.id),
        ]),
    [data.folders]
  );
  const selectedSummary =
    visibleNotes.find((note) => note.id === selectedId) ?? null;
  const loadedSelectedNote = loadedNote?.id === selectedId ? loadedNote : null;
  const activeNote = trash ? selectedSummary : loadedSelectedNote;
  const allVisibleNotesSelected =
    visibleNotes.length > 0 &&
    visibleNotes.every((note) => selectedNoteIds.includes(note.id));
  const allSelectedNotesPinned =
    selectedNoteIds.length > 0 &&
    selectedNoteIds.every((id) =>
      visibleNotes.some((note) => note.id === id && note.pinnedAt)
    );

  const selectionFilterKey = `${folderFilter}|${search}|${tagFilter ?? ""}|${trash}`;
  useEffect(() => {
    if (previousSelectionFilterKey.current === selectionFilterKey) {
      return;
    }
    previousSelectionFilterKey.current = selectionFilterKey;
    setSelectedNoteIds([]);
  }, [selectionFilterKey]);

  const withPending = useCallback(async (operation: () => Promise<unknown>) => {
    setPending(true);
    try {
      await operation();
    } catch (error) {
      toast.error(clientError(error, "Não foi possível concluir esta ação."));
    } finally {
      setPending(false);
    }
  }, []);

  const applyBulkUpdate = (
    operation: BulkNoteOperation,
    extra: { folderId?: string | null; tagName?: string } = {}
  ) =>
    withPending(async () => {
      if (!selectedNoteIds.length) {
        return;
      }
      if (
        selectedId &&
        selectedNoteIds.includes(selectedId) &&
        (await saveHandlerRef.current?.()) === false
      ) {
        return;
      }
      await bulkUpdatePlannerNotesAction({
        noteIds: selectedNoteIds,
        operation,
        ...extra,
      });
      if (
        operation === "TRASH" &&
        selectedId &&
        selectedNoteIds.includes(selectedId)
      ) {
        setSelectedId(null);
        setLoadedNote(null);
        setMobileEditorOpen(false);
      } else if (selectedId && selectedNoteIds.includes(selectedId)) {
        setLoadedNote(await loadPlannerNoteAction(selectedId));
      }
      setSelectedNoteIds([]);
      setBulkTagOpen(false);
      setBulkTrashOpen(false);
      await reload(false);
      toast.success(getBulkUpdateMessage(operation));
    });

  const createNote = useCallback(() => {
    if (createNoteInFlight.current) {
      return Promise.resolve();
    }
    createNoteInFlight.current = true;
    return withPending(async () => {
      if ((await saveHandlerRef.current?.()) === false) {
        return;
      }
      const nextFolder =
        folderFilter === "linked" || folderFilter === "pinned"
          ? "all"
          : folderFilter;
      const note = await createPlannerNoteAction(
        nextFolder === "all" ? null : nextFolder
      );
      setFolderFilter(nextFolder);
      setTagFilter(null);
      const next = await reload(false, nextFolder, "", null, sortOrder);
      setTrash(false);
      setSearch("");
      setSelectedId(note.id);
      setMobileEditorOpen(true);
      if (!next.notes.some((item) => item.id === note.id)) {
        await reload(false, nextFolder, "", null, sortOrder);
      }
    }).finally(() => {
      createNoteInFlight.current = false;
    });
  }, [folderFilter, reload, sortOrder, withPending]);

  useEffect(() => {
    registerToolbarActions({ createNote });
    return () => registerToolbarActions(null);
  }, [createNote, registerToolbarActions]);

  const saveFolder = () =>
    withPending(async () => {
      if (!folderDialog) {
        return;
      }
      const result = folderDialog.id
        ? await renamePlannerNoteFolderAction({
            id: folderDialog.id,
            name: folderDialog.name,
            icon: folderDialog.icon ?? "folder",
          })
        : await createPlannerNoteFolderAction({
            name: folderDialog.name,
            icon: folderDialog.icon ?? "folder",
            parentId: folderDialog.parentId ?? null,
          });
      setFolderDialog(null);
      await reload(false);
      if (!folderDialog.id) {
        setFolderFilter(result.id);
        setTagFilter(null);
      }
      toast.success(folderDialog.id ? "Pasta renomeada." : "Pasta criada.");
    });

  const exportNote = () =>
    withPending(async () => {
      if (!activeNote) {
        return;
      }
      if ((await saveHandlerRef.current?.()) === false) {
        return;
      }
      const exported = await exportPlannerNoteMarkdownAction(activeNote.id);
      const blob = new Blob([exported.markdown], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${exported.title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "nota"}.md`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

  const duplicateNote = () =>
    withPending(async () => {
      if (!activeNote) {
        return;
      }
      if ((await saveHandlerRef.current?.()) === false) {
        return;
      }
      const duplicate = await duplicatePlannerNoteAction(activeNote.id);
      await reload(false, folderFilter, "");
      setTrash(false);
      setSearch("");
      setSelectedId(duplicate.id);
      setMobileEditorOpen(true);
      toast.success("Nota duplicada.");
    });

  const moveToTrash = () =>
    withPending(async () => {
      if (!activeNote) {
        return;
      }
      if ((await saveHandlerRef.current?.()) === false) {
        return;
      }
      await movePlannerNoteToTrashAction(activeNote.id);
      setSelectedId(null);
      setLoadedNote(null);
      setMobileEditorOpen(false);
      toast.success("Nota movida para a lixeira.");
      await reload(false);
    });

  const restoreNote = (note: NoteItem) =>
    withPending(async () => {
      await restorePlannerNoteAction(note.id);
      setTagFilter(null);
      await reload(false, "all", "", null, sortOrder);
      setSelectedId(note.id);
      setTrash(false);
      setFolderFilter("all");
      setTagFilter(null);
      setSearch("");
      setMobileEditorOpen(true);
    });

  const permanentlyDeleteNote = () =>
    withPending(async () => {
      if (!deleteNote) {
        return;
      }
      await deletePlannerNoteForeverAction(deleteNote.id);
      setDeleteNote(null);
      setSelectedId(null);
      await reload(true);
      toast.success("Nota excluída definitivamente.");
    });

  const permanentlyDeleteFolder = () =>
    withPending(async () => {
      if (!deleteFolder) {
        return;
      }
      await deletePlannerNoteFolderAction(deleteFolder.id);
      setDeleteFolder(null);
      setFolderFilter("all");
      setTagFilter(null);
      await reload(false);
      toast.success("Pasta excluída. As notas foram mantidas sem pasta.");
    });

  const toggleTrash = () => {
    const next = !trash;
    setTrash(next);
    setSelectedId(null);
    setMobileEditorOpen(false);
  };

  return (
    <section
      className="mt-3.5 overflow-visible md:mt-5"
      data-note-editor-open={String(mobileEditorOpen)}
      data-note-workspace
    >
      <div className="grid min-h-0 gap-4 md:min-h-[640px] md:grid-cols-[290px_minmax(0,1fr)] md:gap-5 lg:grid-cols-[200px_290px_minmax(0,1fr)]">
        <NoteFoldersSidebar
          data={data}
          folderFilter={folderFilter}
          orderedFolders={orderedFolders}
          setDeleteFolder={setDeleteFolder}
          setFolderDialog={setFolderDialog}
          setFolderFilter={setFolderFilter}
          setMobileEditorOpen={setMobileEditorOpen}
          setSelectedId={setSelectedId}
          setTagFilter={setTagFilter}
          setTrash={setTrash}
          tagFilter={tagFilter}
          toggleTrash={toggleTrash}
          trash={trash}
        />

        <NotesListPanel
          allSelectedNotesPinned={allSelectedNotesPinned}
          allVisibleNotesSelected={allVisibleNotesSelected}
          applyBulkUpdate={applyBulkUpdate}
          createNote={createNote}
          data={data}
          folderFilter={folderFilter}
          linkResources={linkResources}
          mobileEditorOpen={mobileEditorOpen}
          orderedFolders={orderedFolders}
          pending={pending}
          search={search}
          selectedId={selectedId}
          selectedNoteIds={selectedNoteIds}
          setBulkTagOpen={setBulkTagOpen}
          setBulkTrashOpen={setBulkTrashOpen}
          setDeleteFolder={setDeleteFolder}
          setFolderDialog={setFolderDialog}
          setFolderFilter={setFolderFilter}
          setMobileEditorOpen={setMobileEditorOpen}
          setSearch={setSearch}
          setSelectedId={setSelectedId}
          setSelectedNoteIds={setSelectedNoteIds}
          setSortOrder={setSortOrder}
          setTagFilter={setTagFilter}
          setTrash={setTrash}
          sortOrder={sortOrder}
          tagFilter={tagFilter}
          toggleTrash={toggleTrash}
          trash={trash}
        />

        <NoteWorkspaceEditorPanel
          folders={orderedFolders}
          linkResources={linkResources}
          loading={Boolean(!trash && selectedId && loadingNote)}
          mobileEditorOpen={mobileEditorOpen}
          note={trash ? null : loadedSelectedNote}
          onBack={() => setMobileEditorOpen(false)}
          onCreate={createNote}
          onDelete={setDeleteNote}
          onDuplicate={duplicateNote}
          onExport={exportNote}
          onMoveToTrash={moveToTrash}
          onPin={(noteId) =>
            withPending(async () => {
              await togglePlannerNotePinAction(noteId);
              setLoadedNote(await loadPlannerNoteAction(noteId));
              await reload(false);
            })
          }
          onRestore={restoreNote}
          pending={pending}
          saveHandlerRef={saveHandlerRef}
          selectedTrashNote={trash ? selectedSummary : null}
          trash={trash}
        />
      </div>
      <NotesWorkspaceDialogs
        applyBulkUpdate={applyBulkUpdate}
        bulkTagName={bulkTagName}
        bulkTagOpen={bulkTagOpen}
        bulkTrashOpen={bulkTrashOpen}
        deleteFolder={deleteFolder}
        deleteNote={deleteNote}
        folderDialog={folderDialog}
        pending={pending}
        permanentlyDeleteFolder={permanentlyDeleteFolder}
        permanentlyDeleteNote={permanentlyDeleteNote}
        saveFolder={saveFolder}
        selectedNoteIds={selectedNoteIds}
        setBulkTagName={setBulkTagName}
        setBulkTagOpen={setBulkTagOpen}
        setBulkTrashOpen={setBulkTrashOpen}
        setDeleteFolder={setDeleteFolder}
        setDeleteNote={setDeleteNote}
        setFolderDialog={setFolderDialog}
      />{" "}
    </section>
  );
}

export function LessonNotesPanel({
  initialData,
  lessonId,
  linkResources,
}: {
  readonly initialData: NotesData;
  readonly lessonId: string;
  readonly linkResources: readonly TimerLinkResource[];
}) {
  const [notes, setNotes] = useState(initialData.notes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadedNote, setLoadedNote] = useState<FullNote | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [pending, setPending] = useState(false);
  const saveHandlerRef = useRef<(() => Promise<boolean>) | null>(null);

  const reloadNotes = async () => {
    const next = await loadPlannerNotesAction({
      linkedResourceId: lessonId,
      limit: 6,
    });
    setNotes(next.notes);
    return next.notes;
  };

  const openNote = async (noteId: string) => {
    setSelectedId(noteId);
    setLoadingNote(true);
    try {
      const next = await loadPlannerNoteAction(noteId);
      setLoadedNote(next);
      if (!next) {
        setSelectedId(null);
        toast.error("A nota não está mais disponível.");
      }
    } catch (error) {
      setSelectedId(null);
      toast.error(clientError(error, "Não foi possível abrir a nota."));
    } finally {
      setLoadingNote(false);
    }
  };

  const withPending = async (operation: () => Promise<void>) => {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      await operation();
    } catch (error) {
      toast.error(clientError(error, "Não foi possível concluir esta ação."));
    } finally {
      setPending(false);
    }
  };

  const createNote = () =>
    withPending(async () => {
      const note = await createPlannerNoteForLessonAction(lessonId);
      await reloadNotes();
      await openNote(note.id);
      toast.success("Nota vinculada a esta aula.");
    });

  const backToList = () => {
    const save = saveHandlerRef.current?.();
    if (save) {
      save.catch(() => undefined);
    }
    setSelectedId(null);
    setLoadedNote(null);
  };

  const moveToTrash = () =>
    withPending(async () => {
      if (!loadedNote) {
        return;
      }
      if ((await saveHandlerRef.current?.()) === false) {
        return;
      }
      await movePlannerNoteToTrashAction(loadedNote.id);
      setSelectedId(null);
      setLoadedNote(null);
      await reloadNotes();
      toast.success("Nota movida para a lixeira.");
    });

  const duplicateNote = () =>
    withPending(async () => {
      if (!loadedNote) {
        return;
      }
      if ((await saveHandlerRef.current?.()) === false) {
        return;
      }
      const duplicate = await duplicatePlannerNoteAction(loadedNote.id);
      await reloadNotes();
      await openNote(duplicate.id);
      toast.success("Nota duplicada.");
    });

  const exportNote = () =>
    withPending(async () => {
      if (!loadedNote) {
        return;
      }
      if ((await saveHandlerRef.current?.()) === false) {
        return;
      }
      const exported = await exportPlannerNoteMarkdownAction(loadedNote.id);
      const url = URL.createObjectURL(
        new Blob([exported.markdown], { type: "text/markdown;charset=utf-8" })
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${exported.title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "nota"}.md`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

  const togglePin = (noteId: string) =>
    withPending(async () => {
      await togglePlannerNotePinAction(noteId);
      setLoadedNote(await loadPlannerNoteAction(noteId));
      await reloadNotes();
    });

  return (
    <section
      aria-label="Notas desta aula"
      className="grid min-h-0 gap-4"
      data-lesson-notes
    >
      {selectedId ? (
        <div className="flex items-center justify-between gap-2 border-[#E2D6D1] border-b pb-3">
          <Button
            className="-ml-2 min-h-11 px-2 text-[#6C4857]"
            onClick={backToList}
            type="button"
            variant="ghost"
          >
            <ArrowLeftIcon aria-hidden="true" className="mr-2 size-4" />
            Notas desta aula
          </Button>
          <a
            className="min-h-11 content-center font-semibold text-[#8C1535] text-sm underline underline-offset-4"
            href={`/ferramentas?view=notes&note=${encodeURIComponent(selectedId)}`}
          >
            Abrir em Notas
          </a>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium text-[#7A5A69] text-xs">
            Notas desta aula · {notes.length}
          </h3>
          <Button
            className="hidden min-h-11 px-0 text-[#8C1535] md:inline-flex"
            disabled={pending}
            onClick={createNote}
            type="button"
            variant="link"
          >
            <FilePlus2Icon aria-hidden="true" className="mr-1 size-4" />
            Nova
          </Button>
        </div>
      )}

      {selectedId ? (
        <NoteWorkspaceEditorPanel
          folders={initialData.folders}
          linkResources={linkResources}
          loading={loadingNote}
          mobileEditorOpen
          note={loadedNote?.id === selectedId ? loadedNote : null}
          onBack={backToList}
          onCreate={createNote}
          onDelete={() => undefined}
          onDuplicate={duplicateNote}
          onExport={exportNote}
          onMoveToTrash={moveToTrash}
          onPin={(noteId) => togglePin(noteId)}
          onRestore={() => undefined}
          pending={pending}
          saveHandlerRef={saveHandlerRef}
          selectedTrashNote={null}
          trash={false}
        />
      ) : (
        <>
          {notes.length ? (
            <div className="divide-y divide-[#E2D6D1] overflow-hidden rounded-lg border border-[#E2D6D1] bg-white">
              {notes.map((note) => (
                <button
                  className="block min-h-[84px] w-full px-4 py-3 text-left transition-colors hover:bg-[#FBF8F5]"
                  key={note.id}
                  onClick={() => openNote(note.id)}
                  type="button"
                >
                  <span className="block truncate font-semibold text-[#40222F] text-sm">
                    {noteTitle(note)}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[#7A5A69] text-sm leading-5">
                    {note.contentText || "Nota sem conteúdo"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-[#E2D6D1] bg-white px-4 py-7 text-center text-[#7A5A69] text-sm">
              Nenhuma nota vinculada a esta aula.
            </p>
          )}
          <Button
            className="h-12 w-full border-2 border-[#8C1535] text-[#8C1535] md:hidden"
            disabled={pending}
            onClick={createNote}
            type="button"
            variant="outline"
          >
            <FilePlus2Icon aria-hidden="true" className="mr-2 size-4" />
            Nova nota
          </Button>
        </>
      )}
      <output aria-live="polite" className="sr-only">
        {pending ? "Salvando nota" : ""}
      </output>
    </section>
  );
}
