"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  ClockIcon,
  ItalicIcon,
  ListIcon,
  MoreHorizontalIcon,
  PinIcon,
} from "lucide-react";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  loadPlannerNoteAction,
  loadPlannerNotesAction,
  movePlannerNoteToTrashAction,
  restorePlannerNoteAction,
  savePlannerNoteAction,
  togglePlannerNotePinAction,
} from "@/app/(authenticated)/ferramentas/actions";
import { formatVideoTimestamp, sortRoomNotes } from "@/lib/room-notes";
import { roomText } from "./room-copy";
import type { RoomPlayerControls } from "./room-player";

interface RoomNote {
  readonly contentText: string;
  readonly createdAt: Date;
  readonly id: string;
  readonly pinned: boolean;
  readonly updatedAt: Date;
  readonly videoTimeSeconds: number | null;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface RoomNotesPanelProperties {
  readonly controlsRef: MutableRefObject<RoomPlayerControls | null>;
  readonly lessonId: string;
  readonly onAnnounce: (message: string) => void;
}

const AUTOSAVE_MS = 900;
const RETRY_MS = 4000;
const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const toRoomNote = (note: {
  contentText: string;
  createdAt: Date | string;
  id: string;
  pinnedAt: Date | string | null;
  updatedAt: Date | string;
  videoTimeSeconds?: number | null;
}): RoomNote => ({
  contentText: note.contentText,
  createdAt: new Date(note.createdAt),
  id: note.id,
  pinned: note.pinnedAt !== null,
  updatedAt: new Date(note.updatedAt),
  videoTimeSeconds: note.videoTimeSeconds ?? null,
});

const noteTitle = (text: string) => {
  const firstLine = text.trim().split("\n")[0]?.trim() ?? "";
  return firstLine ? firstLine.slice(0, 80) : "Nota da aula";
};

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Sao_Paulo",
});
const shortDay = (date: Date) => dayFormatter.format(date).replace(" de ", " ");
const dayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    date
  );

// "Hoje, 09:40", "Ontem" or "21 out." as the board shows them.
export const savedAtLabel = (date: Date, now = new Date()) => {
  if (dayKey(date) === dayKey(now)) {
    return `Hoje, ${timeFormatter.format(date)}`;
  }
  if (dayKey(date) === dayKey(new Date(now.getTime() - 86_400_000))) {
    return "Ontem";
  }
  return shortDay(date);
};

const statusLabel: Record<SaveStatus, string> = {
  error: roomText("notesStatusError"),
  idle: "",
  saved: roomText("notesStatusSaved"),
  saving: roomText("notesStatusSaving"),
};

// Composer state lives in refs so the debounced save always sees the latest
// note id and version, even while a previous save is still in flight.
const useNoteAutosave = ({
  lessonId,
  onSaved,
}: {
  readonly lessonId: string;
  readonly onSaved: (note: RoomNote) => void;
}) => {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const noteIdRef = useRef<string | null>(null);
  const versionRef = useRef<string | null>(null);
  const createdAtRef = useRef<Date>(new Date());
  const pinnedRef = useRef(false);
  const stampRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainRef = useRef(Promise.resolve());
  const readRef = useRef<() => { json: JSONContent; text: string }>(() => ({
    json: emptyDocument,
    text: "",
  }));

  const saveNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    chainRef.current = chainRef.current.then(async () => {
      const { json, text } = readRef.current();
      if (!(noteIdRef.current || text.trim())) {
        return;
      }
      setStatus("saving");
      try {
        const saved = await savePlannerNoteAction({
          contentJson: json,
          expectedUpdatedAt: versionRef.current,
          id: noteIdRef.current ?? undefined,
          linkedResourceId: lessonId,
          linkedResourceType: "LESSON",
          title: noteTitle(text),
          videoTimeSeconds: stampRef.current,
        });
        const updatedAt = new Date(saved.updatedAt);
        noteIdRef.current = saved.id;
        versionRef.current = updatedAt.toISOString();
        setStatus("saved");
        onSaved({
          contentText: text.replace(/\s+/g, " ").trim(),
          createdAt: createdAtRef.current,
          id: saved.id,
          pinned: pinnedRef.current,
          updatedAt,
          videoTimeSeconds: stampRef.current,
        });
      } catch {
        setStatus("error");
        timerRef.current = setTimeout(() => saveNow(), RETRY_MS);
      }
    });
    return chainRef.current;
  }, [lessonId, onSaved]);

  const schedule = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => saveNow(), AUTOSAVE_MS);
  }, [saveNow]);

  const flush = useCallback(
    () => (timerRef.current ? saveNow() : chainRef.current),
    [saveNow]
  );

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        saveNow().catch(() => undefined);
      }
    },
    [saveNow]
  );

  return {
    createdAtRef,
    flush,
    noteIdRef,
    pinnedRef,
    readRef,
    schedule,
    setStatus,
    stampRef,
    status,
    versionRef,
  };
};

export const RoomNotesPanel = ({
  controlsRef,
  lessonId,
  onAnnounce,
}: RoomNotesPanelProperties) => {
  const [notes, setNotes] = useState<readonly RoomNote[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stamp, setStamp] = useState<number | null>(null);
  const [trashed, setTrashed] = useState<RoomNote | null>(null);
  const capturedRef = useRef<number | null>(null);

  const upsert = useCallback((note: RoomNote) => {
    setNotes((current) => {
      const rest = (current ?? []).filter(({ id }) => id !== note.id);
      return sortRoomNotes([note, ...rest]);
    });
    setEditingId(note.id);
  }, []);
  const autosave = useNoteAutosave({ lessonId, onSaved: upsert });

  const editor = useEditor({
    content: emptyDocument,
    editorProps: {
      attributes: {
        "aria-label": roomText("notesPlaceholder"),
        class: "room-notes__editor",
      },
    },
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
        strike: false,
      }),
    ],
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    onFocus: () => {
      if (!autosave.noteIdRef.current && autosave.stampRef.current === null) {
        const now = controlsRef.current?.currentTime() ?? null;
        capturedRef.current = now;
        autosave.stampRef.current = now;
        setStamp(now);
      }
    },
    onUpdate: () => autosave.schedule(),
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    autosave.readRef.current = () => ({
      json: editor.getJSON(),
      text: editor.getText({ blockSeparator: "\n" }),
    });
  }, [autosave.readRef, editor]);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await loadPlannerNotesAction({
        limit: 100,
        linkedResourceId: lessonId,
      });
      setNotes(sortRoomNotes(data.notes.map(toRoomNote)));
    } catch {
      setLoadError(true);
    }
  }, [lessonId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const resetComposer = () => {
    autosave.noteIdRef.current = null;
    autosave.versionRef.current = null;
    autosave.createdAtRef.current = new Date();
    autosave.pinnedRef.current = false;
    autosave.stampRef.current = null;
    capturedRef.current = null;
    autosave.setStatus("idle");
    setStamp(null);
    setEditingId(null);
    editor?.commands.setContent(emptyDocument);
  };

  const startNewNote = async () => {
    await autosave.flush();
    resetComposer();
    editor?.commands.focus();
  };

  // Leaving the composer closes it: a saved note stays in the list, an empty
  // one is discarded, and the next focus opens a fresh composer.
  const composerRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef(resetComposer);
  resetRef.current = resetComposer;
  useEffect(() => {
    const node = composerRef.current;
    if (!node) {
      return;
    }
    const onFocusOut = (event: globalThis.FocusEvent) => {
      if (node.contains(event.relatedTarget as Node | null)) {
        return;
      }
      autosave
        .flush()
        .then(() => resetRef.current())
        .catch(() => undefined);
    };
    node.addEventListener("focusout", onFocusOut);
    return () => node.removeEventListener("focusout", onFocusOut);
  }, [autosave.flush]);

  const openNote = async (note: RoomNote) => {
    if (note.id === editingId) {
      editor?.commands.focus();
      return;
    }
    await autosave.flush();
    try {
      const full = await loadPlannerNoteAction(note.id);
      if (!full) {
        throw new Error("missing");
      }
      autosave.noteIdRef.current = full.id;
      autosave.versionRef.current = new Date(full.updatedAt).toISOString();
      autosave.createdAtRef.current = new Date(full.createdAt);
      autosave.pinnedRef.current = full.pinnedAt !== null;
      autosave.stampRef.current = full.videoTimeSeconds ?? null;
      autosave.setStatus("idle");
      setStamp(full.videoTimeSeconds ?? null);
      setEditingId(full.id);
      editor?.commands.setContent(full.contentJson as JSONContent);
      editor?.commands.focus("end");
    } catch {
      onAnnounce(roomText("notesActionError"));
    }
  };

  const toggleStamp = () => {
    const next =
      stamp === null
        ? (capturedRef.current ?? controlsRef.current?.currentTime() ?? null)
        : null;
    autosave.stampRef.current = next;
    setStamp(next);
    if (autosave.noteIdRef.current) {
      autosave.schedule();
    }
  };

  const togglePin = async (note: RoomNote) => {
    try {
      const result = await togglePlannerNotePinAction(note.id);
      const pinned = result.pinnedAt !== null;
      if (note.id === autosave.noteIdRef.current) {
        autosave.pinnedRef.current = pinned;
      }
      setNotes((current) =>
        sortRoomNotes(
          (current ?? []).map((item) =>
            item.id === note.id ? { ...item, pinned } : item
          )
        )
      );
    } catch {
      onAnnounce(roomText("notesActionError"));
    }
  };

  const trash = async (note: RoomNote) => {
    if (note.id === autosave.noteIdRef.current) {
      await autosave.flush();
    }
    try {
      await movePlannerNoteToTrashAction(note.id);
      setNotes((current) => (current ?? []).filter(({ id }) => id !== note.id));
      setTrashed(note);
      onAnnounce(roomText("notesTrashed"));
      if (note.id === autosave.noteIdRef.current) {
        await startNewNote();
      }
    } catch {
      onAnnounce(roomText("notesActionError"));
    }
  };

  const undoTrash = async () => {
    if (!trashed) {
      return;
    }
    try {
      await restorePlannerNoteAction(trashed.id);
      upsert(trashed);
      setEditingId(autosave.noteIdRef.current);
      setTrashed(null);
    } catch {
      onAnnounce(roomText("notesActionError"));
    }
  };

  const seek = (seconds: number) => controlsRef.current?.seekTo(seconds);
  const hasNotes = Boolean(notes && notes.length > 0);

  return (
    <div className="room-notes">
      <div className="room-notes__composer" ref={composerRef}>
        <div className="room-notes__stamp-row">
          <button
            aria-label={roomText("notesStampAria")}
            aria-pressed={stamp !== null}
            className="room-chip"
            data-none={stamp === null ? "true" : undefined}
            onClick={toggleStamp}
            type="button"
          >
            {stamp === null ? (
              roomText("notesStampNone")
            ) : (
              <>
                <ClockIcon aria-hidden="true" size={12} />
                {formatVideoTimestamp(stamp)}
              </>
            )}
          </button>
          {stamp === null ? null : (
            <span className="room-notes__stamp-label">
              {roomText("notesStampHint")}
            </span>
          )}
        </div>
        <div className="room-notes__field">
          {editor?.isEmpty ? (
            <span aria-hidden="true" className="room-notes__placeholder">
              {roomText("notesPlaceholder")}
            </span>
          ) : null}
          <EditorContent editor={editor} />
        </div>
        <div className="room-notes__footer">
          <button
            aria-label={roomText("notesFormatBold")}
            aria-pressed={editor?.isActive("bold") ?? false}
            className="room-notes__format"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            type="button"
          >
            <BoldIcon aria-hidden="true" size={16} />
          </button>
          <button
            aria-label={roomText("notesFormatItalic")}
            aria-pressed={editor?.isActive("italic") ?? false}
            className="room-notes__format"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            type="button"
          >
            <ItalicIcon aria-hidden="true" size={16} />
          </button>
          <button
            aria-label={roomText("notesFormatList")}
            aria-pressed={editor?.isActive("bulletList") ?? false}
            className="room-notes__format"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            type="button"
          >
            <ListIcon aria-hidden="true" size={16} />
          </button>
          <output className="room-notes__status" data-status={autosave.status}>
            {statusLabel[autosave.status]}
          </output>
        </div>
      </div>

      {trashed ? (
        <div aria-live="polite" className="room-notes__undo">
          <span>{roomText("notesTrashed")}</span>
          <button onClick={() => undoTrash()} type="button">
            {roomText("notesUndo")}
          </button>
        </div>
      ) : null}

      {loadError ? (
        <div className="room-notes__empty">
          <p className="room-notes__empty-title">
            {roomText("notesLoadErrorTitle")}
          </p>
          <button
            className="room-button room-button--secondary"
            onClick={() => load()}
            type="button"
          >
            {roomText("retry")}
          </button>
        </div>
      ) : null}

      {notes && !hasNotes && !loadError ? (
        <div className="room-notes__empty">
          <p className="room-notes__empty-title">
            {roomText("notesEmptyTitle")}
          </p>
          <p className="room-notes__empty-body">{roomText("notesEmptyBody")}</p>
          <button
            className="room-button room-button--secondary"
            onClick={() => startNewNote()}
            type="button"
          >
            {roomText("notesEmptyCta")}
          </button>
        </div>
      ) : null}

      {hasNotes ? (
        <ul className="room-notes__list">
          {notes?.map((note) => (
            <li
              className="room-note"
              data-editing={note.id === editingId ? "true" : undefined}
              key={note.id}
            >
              <div className="room-note__top">
                {note.videoTimeSeconds === null ? (
                  <span className="room-note__none">
                    {roomText("notesStampNone")}
                  </span>
                ) : (
                  <button
                    aria-label={roomText("notesMenuGoTo", {
                      tempo: formatVideoTimestamp(note.videoTimeSeconds),
                    })}
                    className="room-chip"
                    onClick={() => seek(note.videoTimeSeconds ?? 0)}
                    type="button"
                  >
                    {formatVideoTimestamp(note.videoTimeSeconds)}
                  </button>
                )}
                <span className="room-note__spacer" />
                {note.pinned ? (
                  <span className="room-note__pin">
                    <PinIcon aria-label="Fixada" size={14} />
                  </span>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={roomText("notesMenuAria")}
                      className="room-note__more"
                      type="button"
                    >
                      <MoreHorizontalIcon aria-hidden="true" size={18} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="room-menu">
                    {note.videoTimeSeconds === null ? null : (
                      <DropdownMenuItem
                        onSelect={() => seek(note.videoTimeSeconds ?? 0)}
                      >
                        {roomText("notesMenuGoTo", {
                          tempo: formatVideoTimestamp(note.videoTimeSeconds),
                        })}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => togglePin(note)}>
                      {roomText(
                        note.pinned ? "notesMenuUnpin" : "notesMenuPin"
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="room-menu__danger"
                      onSelect={() => trash(note)}
                    >
                      {roomText("notesMenuTrash")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button
                className="room-note__body"
                onClick={() => openNote(note)}
                type="button"
              >
                {note.contentText || "Nota sem conteúdo"}
              </button>
              <span className="room-note__meta">
                {roomText("notesSavedAt", {
                  quando: savedAtLabel(note.updatedAt),
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
