"use client";

import { ChevronDownIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import type { RoomOutline, RoomOutlineItem } from "@/lib/room-outline";
import { RoomTemple } from "./room-art";
import { roomReleaseDateShort, roomText } from "./room-copy";

interface RoomLessonsPanelProperties {
  readonly courseTitle: string;
  readonly onToggle: (item: RoomOutlineItem, completed: boolean) => void;
  readonly outline: RoomOutline;
  readonly pending: ReadonlySet<string>;
}

// Board: the current row keeps its duration and adds "assistindo" in wine.
const itemMeta = (item: RoomOutlineItem): ReactNode => {
  const duration = item.durationMinutes
    ? roomText("metaDuration", { min: item.durationMinutes })
    : null;
  if (item.status === "locked" && item.releasesAt) {
    return roomText("metaLocked", {
      data: roomReleaseDateShort(item.releasesAt),
    });
  }
  if (item.status === "current") {
    const watching = (
      <span className="room-lesson__watching">{roomText("metaWatching")}</span>
    );
    return duration ? (
      <>
        {duration} · {watching}
      </>
    ) : (
      watching
    );
  }
  if (item.status === "unavailable") {
    return roomText("metaUnavailable");
  }
  if (item.status === "no_video") {
    return roomText("metaNoVideo");
  }
  return duration;
};

const LessonThumb = ({ item }: { readonly item: RoomOutlineItem }) => (
  <span aria-hidden="true" className="room-thumb">
    <RoomTemple />
    <span className="room-thumb__label">{item.ordinal}</span>
    {item.inProgressPercent === null ? null : (
      <span className="room-thumb__bar">
        <span style={{ width: `${item.inProgressPercent}%` }} />
      </span>
    )}
    {item.locked ? (
      <span className="room-thumb__lock">
        <LockIcon size={16} />
      </span>
    ) : null}
  </span>
);

const LessonRow = ({
  item,
  onToggle,
  pending,
}: {
  readonly item: RoomOutlineItem;
  readonly onToggle: RoomLessonsPanelProperties["onToggle"];
  readonly pending: boolean;
}) => {
  const meta = itemMeta(item);
  const text = (
    <>
      <LessonThumb item={item} />
      <span className="room-lesson__text">
        <span className="room-lesson__title">{item.title}</span>
        {meta ? <span className="room-lesson__meta">{meta}</span> : null}
      </span>
    </>
  );

  return (
    <li
      className="room-lesson"
      data-current={item.isCurrent ? "true" : undefined}
    >
      <label className="room-lesson__check">
        <input
          aria-label={roomText(
            item.completed ? "checkboxUnmark" : "checkboxMark",
            { n: item.ordinal }
          )}
          checked={item.completed}
          disabled={item.locked || pending}
          onChange={(event) => onToggle(item, event.target.checked)}
          type="checkbox"
        />
      </label>
      {item.href ? (
        <Link
          aria-current={item.isCurrent ? "page" : undefined}
          className="room-lesson__link"
          href={item.href}
        >
          {text}
        </Link>
      ) : (
        <span className="room-lesson__link">{text}</span>
      )}
    </li>
  );
};

export const RoomLessonsPanel = ({
  courseTitle,
  onToggle,
  outline,
  pending,
}: RoomLessonsPanelProperties) => {
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        outline.groups
          .filter(({ defaultOpen }) => defaultOpen)
          .map(({ id }) => id)
      )
  );
  const percent =
    outline.totalCount > 0
      ? Math.round((outline.completedCount / outline.totalCount) * 100)
      : 0;
  const toggleGroup = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <>
      <div className="room-outline__course">
        <p className="room-outline__course-title">{courseTitle}</p>
        <div className="room-outline__progress">
          <div aria-hidden="true" className="room-outline__bar">
            <span style={{ width: `${percent}%` }} />
          </div>
          <span className="room-outline__count">
            {roomText("progress", {
              c: outline.completedCount,
              t: outline.totalCount,
            })}
          </span>
        </div>
      </div>
      <ul className="room-outline__groups">
        {outline.groups.map((group) => {
          const expanded = open.has(group.id);
          const listId = `room-group-${group.id}`;
          return (
            <li key={group.id}>
              <button
                aria-controls={listId}
                aria-expanded={expanded}
                className="room-outline__group-toggle"
                onClick={() => toggleGroup(group.id)}
                type="button"
              >
                <span className="room-outline__group-title">{group.title}</span>
                <span className="room-outline__group-count">
                  {roomText("groupCount", {
                    c: group.completedCount,
                    t: group.totalCount,
                  })}
                </span>
                <ChevronDownIcon aria-hidden="true" size={16} />
              </button>
              {expanded ? (
                <ul className="room-outline__items" id={listId}>
                  {group.items.map((item) => (
                    <LessonRow
                      item={item}
                      key={item.id}
                      onToggle={onToggle}
                      pending={pending.has(item.id)}
                    />
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
};
