"use client";

import {
  ArrowLeftIcon,
  ClipboardListIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LinkIcon,
  ListVideoIcon,
  NotebookPenIcon,
  TimerIcon,
  XIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { setRoomLessonCompleted } from "@/app/(authenticated)/cursos/room-actions";
import type { RoomLessonData, RoomMaterial } from "@/lib/room";
import { type RoomOutlineItem, withLessonCompleted } from "@/lib/room-outline";
import { roomText } from "./room-copy";
import { RoomLessonsPanel } from "./room-lessons-panel";
import { type RoomPanelKey, useRoomPanel } from "./room-panel-context";
import { RoomPlayer, type RoomPlayerControls } from "./room-player";

// TipTap and the timer only load when their panel opens.
const panelLoading = () => (
  <output className="room-notes__status">{roomText("playerLoading")}</output>
);
const RoomNotesPanel = dynamic(
  () => import("./room-notes-panel").then((module) => module.RoomNotesPanel),
  { loading: panelLoading, ssr: false }
);
const RoomTimePanel = dynamic(
  () => import("./room-time-panel").then((module) => module.RoomTimePanel),
  { loading: panelLoading, ssr: false }
);

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

interface RoomViewProperties {
  readonly document: ReactNode;
  readonly moduleNumber: number;
  readonly room: RoomLessonData;
}

const COLLAPSIBLE_DESCRIPTION = 240;

const panelTitles: Record<RoomPanelKey, string> = {
  aulas: roomText("aulasTitle"),
  notas: roomText("notesTitle"),
  tempo: roomText("dockTempo"),
};

const dockLabels: Record<RoomPanelKey, string> = {
  aulas: roomText("dockAulas"),
  notas: roomText("dockNotas"),
  tempo: roomText("dockTempo"),
};

const materialIcon = (kind: RoomMaterial["kind"]) => {
  if (kind === "activity") {
    return <ClipboardListIcon aria-hidden="true" size={18} />;
  }
  if (kind === "link") {
    return <LinkIcon aria-hidden="true" size={18} />;
  }
  return <FileTextIcon aria-hidden="true" size={18} />;
};

const MaterialRow = ({ material }: { readonly material: RoomMaterial }) => {
  const content = (
    <>
      {materialIcon(material.kind)}
      <span className="room-material__title">{material.title}</span>
      <span className="room-material__type">{material.label}</span>
      {material.external ? (
        <ExternalLinkIcon aria-hidden="true" size={14} />
      ) : null}
    </>
  );
  if (!material.href) {
    return (
      <span aria-disabled="true" className="room-material">
        {content}
      </span>
    );
  }
  if (material.external) {
    return (
      <a
        aria-label={`${material.title}, link externo, abre em nova aba`}
        className="room-material"
        href={material.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {content}
      </a>
    );
  }
  return (
    <Link className="room-material" href={material.href}>
      {content}
    </Link>
  );
};

const About = ({
  description,
  document,
}: {
  readonly description: string | null;
  readonly document: ReactNode;
}) => {
  const [collapsed, setCollapsed] = useState(true);
  if (!(description || document)) {
    return null;
  }
  const collapsible =
    !document && (description?.length ?? 0) > COLLAPSIBLE_DESCRIPTION;
  return (
    <section
      aria-labelledby="room-about"
      className="room__section room__about"
      data-collapsed={collapsible && collapsed ? "true" : undefined}
    >
      <h2 className="room__h2" id="room-about">
        {roomText("about")}
      </h2>
      {description ? <p className="room__about-text">{description}</p> : null}
      {document}
      {collapsible && collapsed ? (
        <button
          className="room__about-more"
          onClick={() => setCollapsed(false)}
          type="button"
        >
          {roomText("readMore")}
        </button>
      ) : null}
    </section>
  );
};

export const RoomView = ({
  document,
  moduleNumber,
  room,
}: RoomViewProperties) => {
  const { panel, setPanel } = useRoomPanel();
  const [outline, setOutline] = useState(room.outline);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const controlsRef = useRef<RoomPlayerControls | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const allItems = outline.groups.flatMap(({ items }) => items);
  const currentIndex = allItems.findIndex(({ isCurrent }) => isCurrent);
  const previousHref =
    currentIndex > 0 ? (allItems[currentIndex - 1]?.href ?? null) : null;
  const courseHref = `/cursos/${room.course.slug}`;

  const openPanel = (key: RoomPanelKey, trigger: HTMLButtonElement) => {
    if (panel === key) {
      setPanel(null);
      setAnnouncement(roomText("panelClosed"));
      return;
    }
    triggerRef.current = trigger;
    setPanel(key);
    setAnnouncement(roomText("panelOpened", { nome: panelTitles[key] }));
  };

  const closePanel = useCallback(() => {
    setPanel(null);
    setAnnouncement(roomText("panelClosed"));
    triggerRef.current?.focus();
  }, [setPanel]);

  // N opens the notes from anywhere in the room except while typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "n" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTypingTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      setPanel("notas");
      setAnnouncement(roomText("panelOpened", { nome: panelTitles.notas }));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setPanel]);

  useEffect(() => {
    if (!panel) {
      return;
    }
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePanel, panel]);

  const toggleLesson = (item: RoomOutlineItem, completed: boolean) => {
    const before = outline;
    setOutline(withLessonCompleted(outline, item.id, completed));
    setPending((current) => new Set(current).add(item.id));
    setRoomLessonCompleted({ completed, lessonId: item.id })
      .then((result) => {
        if (!result.ok) {
          throw new Error(result.message);
        }
        setAnnouncement(roomText(completed ? "marked" : "unmarked"));
      })
      .catch(() => {
        setOutline(before);
        setAnnouncement(roomText("saveError"));
      })
      .finally(() =>
        setPending((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        })
      );
  };

  const showMaterials = () =>
    globalThis.document
      .getElementById("room-materials")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  const dockButton = (key: RoomPanelKey, icon: ReactNode) => (
    <button
      aria-pressed={panel === key}
      className="room-dock__button"
      key={key}
      onClick={(event) => openPanel(key, event.currentTarget)}
      type="button"
    >
      {icon}
      {dockLabels[key]}
    </button>
  );
  const dockButtons = [
    dockButton("aulas", <ListVideoIcon aria-hidden="true" size={20} />),
    ...(room.locked
      ? []
      : [
          dockButton("notas", <NotebookPenIcon aria-hidden="true" size={20} />),
          dockButton("tempo", <TimerIcon aria-hidden="true" size={20} />),
        ]),
  ];

  return (
    <div className="room" data-panel-open={panel ? "true" : "false"}>
      <main className="room__main">
        <div className="room__inner">
          <Link className="room__back" href={room.back.href}>
            <ArrowLeftIcon aria-hidden="true" size={16} />
            {room.back.label}
          </Link>
          <header className="room__head">
            <h1 className="room__title">{room.title}</h1>
            <p className="room__subtitle">
              {roomText("subtitle", {
                curso: room.course.title,
                modulo: room.module.title,
                n: moduleNumber,
              })}
            </p>
          </header>
          <div aria-hidden="true" className="room__meander" />
          <RoomPlayer
            controlsRef={controlsRef}
            courseHref={courseHref}
            hasMaterials={room.materials.length > 0}
            initialState={room.initialPlayerState}
            lessonId={room.id}
            onShowMaterials={showMaterials}
            position={room.position}
            previousHref={previousHref}
            releasesAt={room.releasesAt}
            startAtSeconds={room.startAtSeconds}
            title={room.title}
            video={room.video}
          />
          <div className="room__body">
            <div className="room__read">
              {room.locked ? null : (
                <About description={room.description} document={document} />
              )}
              {room.materials.length > 0 ? (
                <section
                  aria-labelledby="room-materials-title"
                  className="room__section room__materials"
                  id="room-materials"
                >
                  <h2 className="room__h2" id="room-materials-title">
                    {roomText("materials")}
                  </h2>
                  <ul>
                    {room.materials.map((material) => (
                      <li key={material.id}>
                        <MaterialRow material={material} />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      {panel ? (
        <>
          <button
            aria-label={roomText("panelClose")}
            className="room__scrim"
            onClick={closePanel}
            tabIndex={-1}
            type="button"
          />
          <aside
            aria-label={roomText("panelAria", { nome: panelTitles[panel] })}
            className="room__panel"
            ref={panelRef}
            tabIndex={-1}
          >
            <div className="room-panel__header">
              <button
                className="room-icon-button room-sheet__back"
                onClick={closePanel}
                type="button"
              >
                <ArrowLeftIcon aria-hidden="true" size={20} />
                <span className="sr-only">{roomText("panelBack")}</span>
              </button>
              <h2 className="room-panel__title">{panelTitles[panel]}</h2>
              <div className="room-panel__header-actions">
                {panel === "notas" ? (
                  <a
                    className="room-panel__link"
                    href="/ferramentas?view=notes"
                  >
                    {roomText("notesOpenInNotes")}
                  </a>
                ) : null}
                <button
                  aria-label={roomText("panelClose")}
                  className="room-icon-button room-panel__close"
                  onClick={closePanel}
                  type="button"
                >
                  <XIcon aria-hidden="true" size={18} />
                </button>
              </div>
            </div>
            {panel === "aulas" ? (
              <RoomLessonsPanel
                courseTitle={room.course.title}
                onToggle={toggleLesson}
                outline={outline}
                pending={pending}
              />
            ) : null}
            {panel === "notas" && !room.locked ? (
              <RoomNotesPanel
                controlsRef={controlsRef}
                lessonId={room.id}
                onAnnounce={setAnnouncement}
              />
            ) : null}
            {panel === "tempo" && !room.locked ? (
              <RoomTimePanel lessonId={room.id} />
            ) : null}
          </aside>
        </>
      ) : null}

      <nav aria-label={roomText("dockAria")} className="room__dock">
        {dockButtons}
      </nav>
      <nav aria-label={roomText("dockAria")} className="room-mobile-bar">
        {dockButtons}
      </nav>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
};
