"use client";

import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import type { CohortCalendarItem } from "@/lib/cohort-calendar-domain";
import type {
  CalendarDisplayProps,
  CalendarEvent,
} from "./cohort-calendar-editor";

const dateTimeLabel = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);

const statusLabel = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
} as const;
const CalendarListPrimaryAction = ({
  archived,
  event,
  item,
  onEdit,
  onEditMeeting,
}: {
  readonly archived: boolean;
  readonly event: CalendarEvent | undefined;
  readonly item: CohortCalendarItem;
  readonly onEdit: (event: CalendarEvent) => void;
  readonly onEditMeeting: (meetingId: string) => void;
}) => {
  if (event) {
    return (
      <Button
        disabled={archived}
        onClick={() => onEdit(event)}
        type="button"
        variant="outline"
      >
        Editar
      </Button>
    );
  }
  if (item.sourceType === "meeting") {
    return (
      <Button
        aria-label={`Editar encontro: ${item.title}`}
        disabled={archived || item.status === "ARCHIVED"}
        onClick={() => onEditMeeting(item.sourceId)}
        type="button"
        variant="outline"
      >
        Editar
      </Button>
    );
  }
  return (
    <Link className="gt-calendar-open-link" href={item.href}>
      Abrir
    </Link>
  );
};

const CalendarListOccurrenceAction = ({
  archived,
  item,
  onException,
}: {
  readonly archived: boolean;
  readonly item: CohortCalendarItem;
  readonly onException: (item: CohortCalendarItem) => void;
}) => {
  if (item.recurrence === "NONE") {
    return null;
  }
  return (
    <Button
      disabled={archived || item.status === "ARCHIVED"}
      onClick={() => onException(item)}
      type="button"
      variant="outline"
    >
      {item.cancelled ? "Restaurar data" : "Esta data"}
    </Button>
  );
};

const CalendarListRow = ({
  archived,
  events,
  item,
  onEdit,
  onEditMeeting,
  onException,
}: {
  readonly archived: boolean;
  readonly events: readonly CalendarEvent[];
  readonly item: CohortCalendarItem;
  readonly onEdit: (event: CalendarEvent) => void;
  readonly onEditMeeting: (meetingId: string) => void;
  readonly onException: (item: CohortCalendarItem) => void;
}) => {
  const event =
    item.sourceType === "event"
      ? events.find((candidate) => candidate.id === item.sourceId)
      : undefined;
  return (
    <li>
      <span
        aria-hidden="true"
        className="gt-cohort-event-dot"
        style={{ backgroundColor: item.color }}
      />
      <span className="gt-cohort-event-copy">
        <strong>{item.title}</strong>
        <small>
          {item.cancelled ? "Cancelado · " : ""}
          {item.allDay ? "Dia inteiro" : dateTimeLabel(item.startsAt)}
          {item.endsAt ? ` · até ${dateTimeLabel(item.endsAt)}` : ""}
          {item.recurrence !== "NONE" ? " · recorrente" : ""}
        </small>
      </span>
      <span className={`gt-status-pill gt-status-${item.status.toLowerCase()}`}>
        {statusLabel[item.status]}
      </span>
      <CalendarListPrimaryAction
        archived={archived}
        event={event}
        item={item}
        onEdit={onEdit}
        onEditMeeting={onEditMeeting}
      />
      <CalendarListOccurrenceAction
        archived={archived}
        item={item}
        onException={onException}
      />
    </li>
  );
};

export const CohortCalendarListView = ({
  archived,
  events,
  items,
  onEdit,
  onEditMeeting,
  onException,
}: Pick<
  CalendarDisplayProps,
  "archived" | "events" | "items" | "onEdit" | "onEditMeeting" | "onException"
>) => (
  <ol className="gt-cohort-event-rows">
    {items.map((item) => (
      <CalendarListRow
        archived={archived}
        events={events}
        item={item}
        key={item.id}
        onEdit={onEdit}
        onEditMeeting={onEditMeeting}
        onException={onException}
      />
    ))}
    {items.length === 0 ? (
      <li className="gt-panel-empty">Não há itens neste período.</li>
    ) : null}
  </ol>
);
