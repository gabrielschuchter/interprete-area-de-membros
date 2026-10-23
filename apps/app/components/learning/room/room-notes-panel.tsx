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
  ItalicIcon,
  ListIcon,
  MoreHorizontalIcon,
  PinIcon,
  PlusIcon,
  TimerIcon,
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

const savedAtLabel = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);

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

  const startNewNote = async () => {
    await autosave.flush();
    autosave.noteIdRef.current = null;
    autosave.versionRef.current = null;
    autosave.createdAtRef.current = new Date();
    autosave.pinnedRef.current = false;
    autosave.stampRef.current = null;
    autosave.setStatus("idle");
    setStamp(null);
    setEditingId(null);
    editor?.commands.setContent(emptyDocument);
    editor?.commands.focus();
  };

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
      stamp === null ? (controlsRef.current?.currentTime() ?? null) : null;
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

  return (
    <div className="room-notes">
      <a
        className="room-panel__link"
        href={
          editingId
            ? `/ferramentas?view=notes&note=${encodeURIComponent(editingId)}`
            : "/ferramentas?view=notes"
        }
      >
        {roomText("notesOpenInNotes")}
      </a>

      <div className="room-notes__composer">
        <div className="room-notes__toolbar">
          <button
            aria-label={roomText("notesStampAria")}
            aria-pressed={stamp !== null}
            className="room-notes__stamp"
            onClick={toggleStamp}
            type="button"
          >
            <TimerIcon aria-hidden="true" size={14} />
            {stamp === null
              ? roomText("notesStampNone")
              : formatVideoTimestamp(stamp)}
          </button>
          <span className="room-notes__format">
            <button
              aria-label={roomText("notesFormatBold")}
              aria-pressed={editor?.isActive("bold") ?? false}
              className="room-icon-button"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              type="button"
            >
              <BoldIcon aria-hidden="true" size={16} />
            </button>
            <button
              aria-label={roomText("notesFormatItalic")}
              aria-pressed={editor?.isActive("italic") ?? false}
              className="room-icon-button"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              type="button"
            >
              <ItalicIcon aria-hidden="true" size={16} />
            </button>
            <button
              aria-label={roomText("notesFormatList")}
              aria-pressed={editor?.isActive("bulletList") ?? false}
              className="room-icon-button"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              type="button"
            >
              <ListIcon aria-hidden="true" size={16} />
            </button>
          </span>
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
          <output className="room-notes__status" data-status={autosave.status}>
            {statusLabel[autosave.status]}
          </output>
          <button
            className="room-button room-button--secondary"
            onClick={() => startNewNote()}
            type="button"
          >
            <PlusIcon aria-hidden="true" size={14} />
            {roomText("notesNew")}
          </button>
        </div>
      </div>

      {trashed ? (
        <div aria-live="polite" className="room-notes__undo">
          <span>{roomText("notesTrashed")}</span>
          <button
            className="room-panel__link"
            onClick={() => undoTrash()}
            type="button"
          >
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

      {notes && notes.length === 0 && !loadError ? (
        <div className="room-notes__empty">
          <p className="room-notes__empty-title">
            {roomText("notesEmptyTitle")}
          </p>
          <p className="room-notes__empty-body">{roomText("notesEmptyBody")}</p>
        </div>
      ) : null}

      {notes && notes.length > 0 ? (
        <ul className="room-notes__list">
          {notes.map((note) => (
            <li
              className="room-note"
              data-editing={note.id === editingId ? "true" : undefined}
              key={note.id}
            >
              {note.videoTimeSeconds === null ? null : (
                <button
                  aria-label={roomText("notesMenuGoTo", {
                    tempo: formatVideoTimestamp(note.videoTimeSeconds),
                  })}
                  className="room-note__stamp"
                  onClick={() => seek(note.videoTimeSeconds ?? 0)}
                  type="button"
                >
                  {formatVideoTimestamp(note.videoTimeSeconds)}
                </button>
              )}
              <button
                className="room-note__body"
                onClick={() => openNote(note)}
                type="button"
              >
                <span className="room-note__text">
                  {note.contentText || "Nota sem conteúdo"}
                </span>
                <span className="room-note__meta">
                  {note.pinned ? (
                    <PinIcon aria-label="Fixada" size={12} />
                  ) : null}
                  {roomText("notesSavedAt", {
                    quando: savedAtLabel(note.updatedAt),
                  })}
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={roomText("notesMenuAria")}
                    className="room-icon-button"
                    type="button"
                  >
                    <MoreHorizontalIcon aria-hidden="true" size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
                    {roomText(note.pinned ? "notesMenuUnpin" : "notesMenuPin")}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a
                      href={`/ferramentas?view=notes&note=${encodeURIComponent(note.id)}`}
                    >
                      {roomText("notesOpenInNotes")}
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => trash(note)}>
                    {roomText("notesMenuTrash")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
