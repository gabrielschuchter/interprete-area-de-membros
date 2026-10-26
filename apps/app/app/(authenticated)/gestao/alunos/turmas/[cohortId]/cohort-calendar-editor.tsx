"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  VideoIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  type CohortCalendarDateConflict,
  type CohortCalendarItem,
  type CohortCalendarItemType,
  cohortCalendarEventColors,
  cohortCalendarEventLastDate,
  cohortCalendarMonthGridLength,
  cohortCalendarTimezone,
  filterCohortCalendarItems,
} from "@/lib/cohort-calendar-domain";
import {
  type CohortCalendarActionResult,
  saveGestaoCohortCalendarEvent,
  setGestaoCohortCalendarEventStatus,
} from "./calendar-actions";
import {
  type CohortCalendarOccurrenceResult,
  setGestaoCohortCalendarOccurrence,
} from "./calendar-occurrence-actions";
import type { CalendarOccurrenceOperation } from "./cohort-calendar-dialogs";

// Only mounted after a day or meeting is opened, so it stays out of the
// route's initial JavaScript.
const CohortMeetingDialog = dynamic(() =>
  import("./cohort-meeting-dialog").then((module) => module.CohortMeetingDialog)
);
const CalendarFeedControls = dynamic(() =>
  import("./cohort-calendar-panels").then(
    (module) => module.CalendarFeedControls
  )
);
const CalendarCopyControls = dynamic(() =>
  import("./cohort-calendar-panels").then(
    (module) => module.CalendarCopyControls
  )
);
const CalendarConfirmationDialog = dynamic(() =>
  import("./cohort-calendar-dialogs").then(
    (module) => module.CalendarConfirmationDialog
  )
);
const CalendarOccurrenceDialog = dynamic(() =>
  import("./cohort-calendar-dialogs").then(
    (module) => module.CalendarOccurrenceDialog
  )
);

interface CalendarCopySource {
  readonly id: string;
  readonly name: string;
}

const calendarLayerOptions = [
  { type: "meeting", label: "Encontros", color: "#8C1535" },
  { type: "activity", label: "Prazos", color: "#C1323F" },
  { type: "lesson-release", label: "Liberações de aulas", color: "#410230" },
  { type: "event", label: "Eventos da turma", color: "#6B5B64" },
] as const satisfies readonly {
  readonly type: CohortCalendarItemType;
  readonly label: string;
  readonly color: string;
}[];

interface CalendarEvent {
  readonly allDay: boolean;
  readonly color: string;
  readonly description: string | null;
  readonly endsAt: Date | null;
  readonly id: string;
  readonly publishedAt: Date | null;
  readonly recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  readonly recurrenceUntil: Date | null;
  readonly startsAt: Date;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readonly title: string;
  readonly version: number;
}

interface EventForm {
  allDay: boolean;
  color: string;
  description: string;
  endsAt: string;
  recurrence: CalendarEvent["recurrence"];
  recurrenceUntil: string;
  startsAt: string;
  title: string;
}

interface PendingConfirmation {
  readonly eventId?: string;
  readonly kind: "publish-form" | "status";
  readonly status?: CalendarEvent["status"];
}

const emptyForm = (): EventForm => ({
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  recurrence: "NONE",
  recurrenceUntil: "",
  allDay: false,
  color: "#6B5B64",
});

const dateParts = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: cohortCalendarTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
  };
};

const dateTimeInput = (
  value: Date | null,
  timezone = cohortCalendarTimezone
) => {
  if (!value) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

const dateKey = (value: Date) => {
  const parts = dateParts(value);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

const keyForParts = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const getDisplayEndKey = (event: {
  readonly allDay: boolean;
  readonly endsAt: Date | null;
  readonly startsAt: Date;
}) => cohortCalendarEventLastDate(event);

const dateLabel = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: cohortCalendarTimezone,
    dateStyle: "full",
  }).format(value);
const calendarDateAtNoon = (year: number, month: number, day = 1) =>
  new Date(Date.UTC(year, month - 1, day, 12));

const dateTimeLabel = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: cohortCalendarTimezone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);

const statusLabel = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
} as const;
const monthKeyPattern = /^\d{4}-(0[1-9]|1[0-2])$/u;

const nextEventStatus = (status: CalendarEvent["status"]) => {
  if (status === "DRAFT") {
    return "PUBLISHED" as const;
  }
  if (status === "PUBLISHED") {
    return "ARCHIVED" as const;
  }
  return "DRAFT" as const;
};

const nextEventActionLabel = (status: CalendarEvent["status"]) => {
  if (status === "DRAFT") {
    return "Publicar";
  }
  if (status === "PUBLISHED") {
    return "Arquivar";
  }
  return "Restaurar";
};

interface CalendarDay {
  readonly inMonth: boolean;
  readonly key: string;
  readonly number: number;
}

interface CalendarDisplayProps {
  readonly archived: boolean;
  readonly days: readonly CalendarDay[];
  readonly events: readonly CalendarEvent[];
  readonly items: readonly CohortCalendarItem[];
  readonly onCreate: (date: string) => void;
  readonly onCreateMeeting: (date: string) => void;
  readonly onEdit: (event: CalendarEvent) => void;
  readonly onEditMeeting: (meetingId: string) => void;
  readonly onException: (item: CohortCalendarItem) => void;
  readonly view: "month" | "week" | "list";
  readonly weekDays: readonly string[];
}

const itemsForCalendarDay = (
  items: readonly CohortCalendarItem[],
  day: string
) =>
  items.filter(
    (item) => dateKey(item.startsAt) <= day && getDisplayEndKey(item) >= day
  );

const CalendarEventTile = ({
  archived,
  item,
  sourceEvent,
  onEdit,
  onEditMeeting,
  onException,
  showTime,
}: {
  readonly archived: boolean;
  readonly item: CohortCalendarItem;
  readonly sourceEvent?: CalendarEvent;
  readonly onEdit: (event: CalendarEvent) => void;
  readonly onEditMeeting: (meetingId: string) => void;
  readonly onException: (item: CohortCalendarItem) => void;
  readonly showTime: boolean;
}) => {
  const labels = {
    activity: "Prazo",
    event: "Evento",
    meeting: "Encontro",
    "lesson-release": "Libera",
  } as const;
  const label = labels[item.sourceType];
  let timeLabel = "";
  if (showTime) {
    timeLabel = item.allDay ? "Dia inteiro" : dateTimeLabel(item.startsAt);
  } else if (item.sourceType === "event" && item.status !== "ARCHIVED") {
    timeLabel = item.status === "DRAFT" ? statusLabel[item.status] : "";
  }
  const meta = [
    item.cancelled ? "Cancelado" : "",
    item.recurrence !== "NONE" ? "Repetição" : "",
    timeLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const tile = (
    <>
      <span>
        {label} · {item.title}
      </span>
      {meta ? <small>{meta}</small> : null}
    </>
  );
  if (item.recurrence !== "NONE") {
    return (
      <button
        aria-label={`${item.cancelled ? "Restaurar ou ajustar" : "Ajustar"} ocorrência: ${item.title}, ${dateTimeLabel(item.startsAt)}`}
        className="gt-cohort-calendar-event"
        data-cancelled={String(item.cancelled)}
        data-status={item.status.toLowerCase()}
        disabled={archived || item.status === "ARCHIVED"}
        key={item.id}
        onClick={() => onException(item)}
        style={{ borderLeftColor: item.color }}
        type="button"
      >
        {tile}
      </button>
    );
  }
  if (item.sourceType === "event" && sourceEvent) {
    return (
      <button
        className="gt-cohort-calendar-event"
        data-status={item.status.toLowerCase()}
        disabled={archived}
        key={item.id}
        onClick={() => onEdit(sourceEvent)}
        style={{ borderLeftColor: item.color }}
        type="button"
      >
        {tile}
      </button>
    );
  }
  if (item.sourceType === "meeting") {
    return (
      <button
        aria-label={`Editar encontro: ${item.title}, ${dateTimeLabel(item.startsAt)}`}
        className="gt-cohort-calendar-event"
        data-status={item.status.toLowerCase()}
        disabled={archived || item.status === "ARCHIVED"}
        key={item.id}
        onClick={() => onEditMeeting(item.sourceId)}
        style={{ borderLeftColor: item.color }}
        type="button"
      >
        {tile}
      </button>
    );
  }
  return (
    <Link
      aria-label={`${label}: ${item.title}, ${dateTimeLabel(item.startsAt)}`}
      className="gt-cohort-calendar-event"
      data-status={item.status.toLowerCase()}
      href={item.href}
      key={item.id}
      style={{ borderLeftColor: item.color }}
    >
      {tile}
    </Link>
  );
};

const MonthCalendarView = ({
  archived,
  days,
  events,
  items,
  onCreate,
  onCreateMeeting,
  onEdit,
  onEditMeeting,
  onException,
}: Pick<
  CalendarDisplayProps,
  | "archived"
  | "days"
  | "events"
  | "items"
  | "onCreate"
  | "onCreateMeeting"
  | "onEdit"
  | "onEditMeeting"
  | "onException"
>) => (
  <div className="gt-cohort-month-grid">
    {(["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const).map(
      (weekday) => (
        <div className="gt-cohort-weekday" key={weekday}>
          {weekday}
        </div>
      )
    )}
    {days.map((day) => {
      const dayEvents = itemsForCalendarDay(items, day.key);
      const label = dateLabel(new Date(`${day.key}T12:00:00Z`));
      return (
        <section
          aria-label={label}
          className="gt-cohort-day"
          data-outside-month={String(!day.inMonth)}
          key={day.key}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Adicionar à turma em ${label}`}
                className="gt-cohort-day-number"
                disabled={archived}
                type="button"
              >
                {day.number}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="gt-calendar-day-menu">
              <DropdownMenuLabel>{label}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onCreateMeeting(day.key)}>
                <VideoIcon aria-hidden="true" /> Novo encontro
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onCreate(day.key)}>
                <CalendarIcon aria-hidden="true" /> Evento da turma
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="gt-cohort-day-events">
            {dayEvents.slice(0, 3).map((item) => (
              <CalendarEventTile
                archived={archived}
                item={item}
                key={item.id}
                onEdit={onEdit}
                onEditMeeting={onEditMeeting}
                onException={onException}
                showTime={false}
                sourceEvent={
                  item.sourceType === "event"
                    ? events.find((event) => event.id === item.sourceId)
                    : undefined
                }
              />
            ))}
            {dayEvents.length > 3 ? (
              <span className="gt-cohort-more-events">
                +{dayEvents.length - 3} itens
              </span>
            ) : null}
          </div>
        </section>
      );
    })}
  </div>
);

const WeekCalendarView = ({
  archived,
  events,
  items,
  onEdit,
  onEditMeeting,
  onException,
  weekDays,
}: Pick<
  CalendarDisplayProps,
  | "archived"
  | "events"
  | "items"
  | "onEdit"
  | "onEditMeeting"
  | "onException"
  | "weekDays"
>) => (
  <div className="gt-cohort-week-view">
    {weekDays.map((day) => {
      const dayEvents = itemsForCalendarDay(items, day);
      return (
        <section className="gt-cohort-week-day" key={day}>
          <h3>{dateLabel(new Date(`${day}T12:00:00Z`))}</h3>
          {dayEvents.length ? (
            dayEvents.map((item) => (
              <CalendarEventTile
                archived={archived}
                item={item}
                key={item.id}
                onEdit={onEdit}
                onEditMeeting={onEditMeeting}
                onException={onException}
                showTime
                sourceEvent={
                  item.sourceType === "event"
                    ? events.find((event) => event.id === item.sourceId)
                    : undefined
                }
              />
            ))
          ) : (
            <span className="gt-cohort-week-empty">Sem eventos</span>
          )}
        </section>
      );
    })}
  </div>
);

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

const ListCalendarView = ({
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

const CalendarDisplay = (props: CalendarDisplayProps) => {
  if (props.view === "month") {
    return <MonthCalendarView {...props} />;
  }
  if (props.view === "week") {
    return <WeekCalendarView {...props} />;
  }
  return <ListCalendarView {...props} />;
};

interface CalendarEditorSidebarProps {
  readonly activeStudentCount: number;
  readonly archived: boolean;
  readonly cohortId: string;
  readonly conflicts: readonly CohortCalendarDateConflict[];
  readonly conflictsLimited: boolean;
  readonly copySources: readonly CalendarCopySource[];
  readonly eventFormVisible: boolean;
  readonly eventId: string | null;
  readonly eventPublished: boolean;
  readonly events: readonly CalendarEvent[];
  readonly expectedCohortVersion: number;
  readonly form: EventForm;
  readonly onChange: <K extends keyof EventForm>(
    key: K,
    value: EventForm[K]
  ) => void;
  readonly onClose: () => void;
  readonly onCreate: () => void;
  readonly onPublish: () => void;
  readonly onRefresh: () => void;
  readonly onSaveDraft: () => void;
  readonly onStatusChange: (
    event: CalendarEvent,
    status: CalendarEvent["status"]
  ) => void;
  readonly pending: boolean;
  readonly result: CohortCalendarActionResult | null;
}

const calendarFieldError = (
  result: CohortCalendarActionResult | null,
  name: "title" | "startsAt" | "endsAt"
) => (result?.ok === false ? result.fields?.[name] : undefined);

const CalendarFieldError = ({
  name,
  result,
}: {
  readonly name: "title" | "startsAt" | "endsAt";
  readonly result: CohortCalendarActionResult | null;
}) => {
  const error = calendarFieldError(result, name);
  return error ? <em className="gt-field-error">{error}</em> : null;
};

const CalendarResultMessages = ({
  onRefresh,
  result,
}: {
  readonly onRefresh: () => void;
  readonly result: CohortCalendarActionResult | null;
}) => {
  if (result?.ok === false) {
    return (
      <>
        <p className="gt-error-summary" role="alert">
          {result.message}
        </p>
        {result.code === "conflict" ? (
          <Button onClick={onRefresh} type="button" variant="outline">
            Atualizar versões e conferir
          </Button>
        ) : null}
      </>
    );
  }
  return result?.ok === true ? (
    <output className="gt-success-message">Alteração salva.</output>
  ) : null;
};

const CalendarStatusPanel = ({
  archived,
  events,
  onStatusChange,
  pending,
}: Pick<
  CalendarEditorSidebarProps,
  "archived" | "events" | "onStatusChange" | "pending"
>) => {
  if (events.length === 0) {
    return null;
  }
  return (
    <section className="gt-panel">
      <div className="gt-panel-heading">
        <h2>Publicação</h2>
      </div>
      <ul className="gt-cohort-status-list">
        {events.slice(0, 8).map((event) => (
          <li key={event.id}>
            <span>
              <strong>{event.title}</strong>
              <small>{statusLabel[event.status]}</small>
            </span>
            <Button
              disabled={pending || archived}
              onClick={() =>
                onStatusChange(event, nextEventStatus(event.status))
              }
              type="button"
              variant={event.status === "DRAFT" ? "outline" : "ghost"}
            >
              {nextEventActionLabel(event.status)}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
};

const calendarConflictSummary = (conflict: CohortCalendarDateConflict) => {
  const names = {
    event: ["um evento da turma", "eventos da turma"],
    meeting: ["um encontro", "encontros"],
    activity: ["um prazo de atividade", "prazos de atividade"],
    "lesson-release": ["uma liberação de aula", "liberações de aula"],
  } as const;
  const types = ["meeting", "activity", "lesson-release", "event"] as const;
  const parts = types.flatMap((type) => {
    const count = conflict.sourceCounts[type] ?? 0;
    if (count === 0) {
      return [];
    }
    return [count === 1 ? names[type][0] : `${count} ${names[type][1]}`];
  });
  const kinds = parts.join(" e ");
  const capitalizedKinds = kinds
    ? `${kinds.slice(0, 1).toLocaleUpperCase("pt-BR")}${kinds.slice(1)}`
    : "Itens da turma";
  return `${conflict.eventCount} itens no mesmo dia. ${capitalizedKinds}. Não bloqueia.`;
};

const CalendarConflictPanel = ({
  conflicts,
  limited,
}: {
  readonly conflicts: readonly CohortCalendarDateConflict[];
  readonly limited: boolean;
}) => {
  let content: ReactNode;
  if (limited) {
    content = (
      <p>
        Há muitos eventos publicados neste período para comparar de uma vez.
        Revise a lista completa antes de publicar.
      </p>
    );
  } else if (conflicts.length === 0) {
    content = <p>Não há eventos publicados no mesmo dia neste período.</p>;
  } else {
    content = (
      <>
        <p>
          Estes avisos são informativos e não impedem salvar ou publicar.
          Confira os horários antes de confirmar.
        </p>
        <ul className="gt-calendar-conflict-list">
          {conflicts.map((conflict) => (
            <li key={conflict.day}>
              <strong>
                {dateLabel(new Date(`${conflict.day}T12:00:00Z`))}
              </strong>
              <span>{calendarConflictSummary(conflict)}</span>
              <small>{conflict.titles.join(" · ")}</small>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <section
      aria-labelledby="gt-calendar-conflicts-heading"
      aria-live="polite"
      className="gt-panel gt-calendar-conflicts"
    >
      <div className="gt-panel-heading">
        <h2 id="gt-calendar-conflicts-heading">Conflitos de data</h2>
      </div>
      {content}
    </section>
  );
};

const CalendarEditorSidebar = ({
  activeStudentCount,
  archived,
  cohortId,
  copySources,
  conflicts,
  conflictsLimited,
  eventId,
  eventPublished,
  eventFormVisible,
  events,
  expectedCohortVersion,
  form,
  onChange,
  onCreate,
  onClose,
  onPublish,
  onRefresh,
  onSaveDraft,
  onStatusChange,
  pending,
  result,
}: CalendarEditorSidebarProps) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const requestPublish = () => {
    if (formRef.current?.reportValidity()) {
      onPublish();
    }
  };
  let saveLabel = "Salvar rascunho";
  if (pending) {
    saveLabel = "Salvando…";
  } else if (eventPublished) {
    saveLabel = "Salvar alterações";
  }

  return (
    <aside className="gt-calendar-aside">
      {eventFormVisible ? (
        <section className="gt-panel">
          <div className="gt-panel-heading">
            <h2>{eventId ? "Editar evento" : "Novo evento da turma"}</h2>
            <div className="gt-calendar-form-heading-actions">
              {eventId ? (
                <Button onClick={onCreate} type="button" variant="ghost">
                  Novo
                </Button>
              ) : null}
              <Button onClick={onClose} type="button" variant="ghost">
                Fechar
              </Button>
            </div>
          </div>
          {archived ? (
            <p className="gt-panel-copy">
              A turma está arquivada. O calendário permanece em modo de leitura.
            </p>
          ) : (
            <form
              className="gt-cohort-event-form"
              onSubmit={(event) => {
                event.preventDefault();
                onSaveDraft();
              }}
              ref={formRef}
            >
              <label className="gt-field">
                <span>Título</span>
                <input
                  aria-invalid={Boolean(calendarFieldError(result, "title"))}
                  maxLength={140}
                  onChange={(event) => onChange("title", event.target.value)}
                  required
                  value={form.title}
                />
                <CalendarFieldError name="title" result={result} />
              </label>
              <label className="gt-field">
                <span>Início · horário de Brasília</span>
                <input
                  aria-invalid={Boolean(calendarFieldError(result, "startsAt"))}
                  onChange={(event) => onChange("startsAt", event.target.value)}
                  required
                  type="datetime-local"
                  value={form.startsAt}
                />
                <CalendarFieldError name="startsAt" result={result} />
              </label>
              <label className="gt-field">
                <span>Término · opcional</span>
                <input
                  aria-invalid={Boolean(calendarFieldError(result, "endsAt"))}
                  onChange={(event) => onChange("endsAt", event.target.value)}
                  type="datetime-local"
                  value={form.endsAt}
                />
                <CalendarFieldError name="endsAt" result={result} />
              </label>
              <label className="gt-field">
                <span>Repetição</span>
                <select
                  onChange={(event) =>
                    onChange(
                      "recurrence",
                      event.target.value as EventForm["recurrence"]
                    )
                  }
                  value={form.recurrence}
                >
                  <option value="NONE">Não se repete</option>
                  <option value="DAILY">Diária</option>
                  <option value="WEEKLY">Semanal</option>
                  <option value="MONTHLY">Mensal</option>
                </select>
              </label>
              {form.recurrence !== "NONE" ? (
                <label className="gt-field">
                  <span>Repetir até · opcional</span>
                  <input
                    onChange={(event) =>
                      onChange("recurrenceUntil", event.target.value)
                    }
                    type="datetime-local"
                    value={form.recurrenceUntil}
                  />
                </label>
              ) : null}
              <label className="gt-cohort-event-checkbox">
                <input
                  checked={form.allDay}
                  onChange={(event) => onChange("allDay", event.target.checked)}
                  type="checkbox"
                />
                <span>Dia inteiro</span>
              </label>
              <label className="gt-field">
                <span>Descrição</span>
                <textarea
                  maxLength={4000}
                  onChange={(event) =>
                    onChange("description", event.target.value)
                  }
                  rows={3}
                  value={form.description}
                />
              </label>
              <label className="gt-field">
                <span>Cor</span>
                <select
                  onChange={(event) => onChange("color", event.target.value)}
                  value={form.color}
                >
                  {cohortCalendarEventColors.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <div className="gt-cohort-event-actions">
                <Button disabled={pending} type="submit" variant="outline">
                  {saveLabel}
                </Button>
                {eventPublished ? null : (
                  <Button
                    disabled={pending}
                    onClick={requestPublish}
                    type="button"
                  >
                    {pending ? "Salvando…" : "Publicar para alunos"}
                  </Button>
                )}
              </div>
              <CalendarResultMessages onRefresh={onRefresh} result={result} />
            </form>
          )}
        </section>
      ) : null}
      <section className="gt-panel gt-calendar-publish-help">
        <h2>O que os alunos veem</h2>
        <p>
          Este é o calendário da turma. Todos os {activeStudentCount} alunos
          veem o mesmo, mais o que for individual. Rascunhos (tracejados) não
          aparecem para eles.
        </p>
        <CalendarFeedControls archived={archived} cohortId={cohortId} />
        <Link href="/planejamento">Ver o Planejamento do aluno</Link>
      </section>
      <CalendarConflictPanel conflicts={conflicts} limited={conflictsLimited} />
      <CalendarCopyControls
        archived={archived}
        cohortId={cohortId}
        copySources={copySources}
        expectedCohortVersion={expectedCohortVersion}
      />
      <CalendarStatusPanel
        archived={archived}
        events={events}
        onStatusChange={onStatusChange}
        pending={pending}
      />
    </aside>
  );
};

export const CohortCalendarEditor = ({
  activeStudentCount,
  archived,
  cohortId,
  cohortName,
  copySources,
  conflicts,
  conflictsLimited,
  expectedCohortVersion,
  events,
  items,
  itemsLimited,
  monthKey,
  page,
  totalPages,
  totalCount,
}: {
  readonly activeStudentCount: number;
  readonly archived: boolean;
  readonly cohortId: string;
  readonly cohortName: string;
  readonly copySources: readonly CalendarCopySource[];
  readonly conflicts: readonly CohortCalendarDateConflict[];
  readonly conflictsLimited: boolean;
  readonly expectedCohortVersion: number;
  readonly events: readonly CalendarEvent[];
  readonly items: readonly CohortCalendarItem[];
  readonly itemsLimited: boolean;
  readonly monthKey: string;
  readonly page: number;
  readonly totalPages: number;
  readonly totalCount: number;
}) => {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [monthYear, monthValue] = monthKey.split("-").map(Number);
  const monthDate = calendarDateAtNoon(monthYear, monthValue);
  const now = dateParts(new Date());
  const [month, setMonth] = useState(monthDate);
  const [focusDate, setFocusDate] = useState(() =>
    monthDate.getUTCFullYear() === now.year &&
    monthDate.getUTCMonth() + 1 === now.month
      ? calendarDateAtNoon(now.year, now.month, now.day)
      : monthDate
  );
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [visibleLayers, setVisibleLayers] = useState<
    ReadonlySet<CohortCalendarItemType>
  >(() => new Set(calendarLayerOptions.map(({ type }) => type)));
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventFormVisible, setEventFormVisible] = useState(false);
  const [meetingDate, setMeetingDate] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [result, setResult] = useState<CohortCalendarActionResult | null>(null);
  const [occurrenceItem, setOccurrenceItem] =
    useState<CohortCalendarItem | null>(null);
  const [occurrenceResult, setOccurrenceResult] =
    useState<CohortCalendarOccurrenceResult | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(
    null
  );
  const editingEvent = events.find((event) => event.id === eventId);

  useEffect(() => {
    const [year, monthValue] = monthKey.split("-").map(Number);
    const nextMonth = calendarDateAtNoon(year, monthValue);
    setMonth(nextMonth);
    setFocusDate((current) =>
      current.getUTCFullYear() === year &&
      current.getUTCMonth() + 1 === monthValue
        ? current
        : nextMonth
    );
  }, [monthKey]);

  const monthParts = {
    year: month.getUTCFullYear(),
    month: month.getUTCMonth() + 1,
  };
  const days = useMemo(() => {
    const first = new Date(Date.UTC(monthParts.year, monthParts.month - 1, 1));
    const offset = first.getUTCDay();
    const gridLength = cohortCalendarMonthGridLength(
      monthParts.year,
      monthParts.month
    );
    return Array.from({ length: gridLength }, (_, index) => {
      const day = new Date(
        Date.UTC(monthParts.year, monthParts.month - 1, 1 - offset + index)
      );
      return {
        key: keyForParts(
          day.getUTCFullYear(),
          day.getUTCMonth() + 1,
          day.getUTCDate()
        ),
        number: day.getUTCDate(),
        inMonth:
          day.getUTCFullYear() === monthParts.year &&
          day.getUTCMonth() + 1 === monthParts.month,
      };
    });
  }, [monthParts.month, monthParts.year]);
  const weekDays = useMemo(() => {
    const offset = focusDate.getUTCDay();
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(
        Date.UTC(
          focusDate.getUTCFullYear(),
          focusDate.getUTCMonth(),
          focusDate.getUTCDate() - offset + index
        )
      );
      return keyForParts(
        day.getUTCFullYear(),
        day.getUTCMonth() + 1,
        day.getUTCDate()
      );
    });
  }, [focusDate]);
  const itemsForVisibleLayers = useMemo(
    () => filterCohortCalendarItems(items, Array.from(visibleLayers)),
    [items, visibleLayers]
  );
  const displayItems = useMemo(
    () =>
      view === "list"
        ? itemsForVisibleLayers
        : itemsForVisibleLayers.filter((item) => {
            const start = dateKey(item.startsAt);
            const end = getDisplayEndKey(item);
            const first =
              view === "week" ? (weekDays[0] ?? "") : (days[0]?.key ?? "");
            const last =
              view === "week"
                ? (weekDays.at(-1) ?? "")
                : (days.at(-1)?.key ?? "");
            return start <= last && end >= first;
          }),
    [days, itemsForVisibleLayers, view, weekDays]
  );

  const toggleCalendarLayer = (type: CohortCalendarItemType) => {
    setVisibleLayers((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const beginCreate = (date?: string) => {
    idempotencyKey.current = null;
    setEventId(null);
    if (date) {
      setFocusDate(new Date(`${date}T12:00:00Z`));
    }
    setForm({
      ...emptyForm(),
      startsAt: date ? `${date}T09:00` : "",
    });
    setResult(null);
    setEventFormVisible(true);
  };

  const beginCreateMeeting = (date: string) => {
    setOccurrenceItem(null);
    setOccurrenceResult(null);
    setMeetingId(null);
    setMeetingDate(date);
  };

  const beginEditMeeting = (id: string) => {
    setOccurrenceItem(null);
    setOccurrenceResult(null);
    setMeetingId(id);
    const item = items.find(
      (candidate) =>
        candidate.sourceType === "meeting" && candidate.sourceId === id
    );
    setMeetingDate(dateKey(item?.startsAt ?? new Date()));
  };

  const closeMeetingDialog = () => {
    setMeetingDate(null);
    setMeetingId(null);
  };

  const beginEdit = (event: CalendarEvent) => {
    idempotencyKey.current = null;
    setEventId(event.id);
    setForm({
      title: event.title,
      description: event.description ?? "",
      startsAt: dateTimeInput(event.startsAt),
      endsAt: dateTimeInput(event.endsAt),
      recurrence: event.recurrence,
      recurrenceUntil: dateTimeInput(event.recurrenceUntil),
      allDay: event.allDay,
      color: event.color,
    });
    setResult(null);
    setEventFormVisible(true);
  };

  const beginOccurrence = (item: CohortCalendarItem) => {
    if (
      !item.occurrenceKey ||
      item.sourceRevision === null ||
      (item.sourceType !== "event" && item.sourceType !== "meeting")
    ) {
      return;
    }
    setOccurrenceResult(null);
    setOccurrenceItem(item);
  };

  const saveOccurrence = (
    operation: CalendarOccurrenceOperation,
    startsAtOverride: string,
    requestKey: string
  ) => {
    const item = occurrenceItem;
    if (
      !item?.occurrenceKey ||
      item.sourceRevision === null ||
      (item.sourceType !== "event" && item.sourceType !== "meeting")
    ) {
      return;
    }
    startTransition(async () => {
      const saved = await setGestaoCohortCalendarOccurrence({
        cohortId,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        occurrenceStartsAt: item.occurrenceKey,
        expectedCohortVersion,
        expectedSourceRevision: item.sourceRevision,
        expectedExceptionVersion: item.exceptionVersion ?? 0,
        operation,
        startsAtOverride,
        idempotencyKey: requestKey,
      });
      setOccurrenceResult(saved);
      if (saved.ok) {
        setOccurrenceItem(null);
        router.refresh();
      }
    });
  };

  const updateForm = <K extends keyof EventForm>(
    key: K,
    value: EventForm[K]
  ) => {
    idempotencyKey.current = null;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = (status: "DRAFT" | "PUBLISHED") => {
    idempotencyKey.current ??= crypto.randomUUID();
    startTransition(async () => {
      const saved = await saveGestaoCohortCalendarEvent({
        cohortId,
        ...(eventId ? { eventId } : {}),
        expectedCohortVersion,
        ...(eventId
          ? {
              expectedEventVersion: events.find((event) => event.id === eventId)
                ?.version,
            }
          : {}),
        title: form.title,
        description: form.description || null,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        recurrence: form.recurrence,
        recurrenceUntil: form.recurrenceUntil,
        allDay: form.allDay,
        color: form.color,
        status,
        idempotencyKey: idempotencyKey.current,
      });
      setResult(saved);
      if (saved.ok) {
        idempotencyKey.current = null;
        setEventId(saved.eventId);
        const savedMonth = form.startsAt.slice(0, 7);
        if (monthKeyPattern.test(savedMonth)) {
          router.push(`?month=${savedMonth}`);
        }
        router.refresh();
      }
    });
  };

  const changeStatus = (
    event: CalendarEvent,
    status: CalendarEvent["status"]
  ) => {
    startTransition(async () => {
      const changed = await setGestaoCohortCalendarEventStatus({
        cohortId,
        eventId: event.id,
        expectedCohortVersion,
        expectedEventVersion: event.version,
        status,
        idempotencyKey: crypto.randomUUID(),
      });
      setResult(changed);
      if (changed.ok) {
        router.refresh();
      }
    });
  };

  const requestStatusChange = (
    event: CalendarEvent,
    status: CalendarEvent["status"]
  ) => setConfirmation({ kind: "status", eventId: event.id, status });

  const confirmRequestedAction = () => {
    const action = confirmation;
    setConfirmation(null);
    if (!action) {
      return;
    }
    if (action.kind === "publish-form") {
      submit("PUBLISHED");
      return;
    }
    const event = events.find((item) => item.id === action.eventId);
    if (event && action.status) {
      changeStatus(event, action.status);
    }
  };

  const saveDraft = () => {
    if (editingEvent?.status === "PUBLISHED") {
      setConfirmation({ kind: "publish-form" });
    } else {
      submit("DRAFT");
    }
  };

  const moveMonth = (amount: number) => {
    const next = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + amount, 1, 12)
    );
    const nextKey = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
    router.push(`?month=${nextKey}`);
    setMonth(next);
    setFocusDate(next);
  };

  const moveToToday = () => {
    const today = dateParts(new Date());
    const todayMonth = calendarDateAtNoon(today.year, today.month);
    const todayKey = `${today.year}-${String(today.month).padStart(2, "0")}`;
    setMonth(todayMonth);
    setFocusDate(calendarDateAtNoon(today.year, today.month, today.day));
    router.push(`?month=${todayKey}`);
  };

  return (
    <div className="gt-calendar-workspace">
      <section className="gt-panel gt-calendar-main">
        <div className="gt-panel-heading gt-calendar-heading">
          <div>
            <h2>Agenda da turma</h2>
            <p>Encontros, eventos, prazos e liberações em um só calendário.</p>
          </div>
          <Button
            disabled={archived}
            onClick={() => beginCreate()}
            type="button"
          >
            <PlusIcon aria-hidden="true" /> Novo evento
          </Button>
        </div>
        <nav
          aria-label="Controles do calendário"
          className="gt-calendar-toolbar"
        >
          <div className="gt-calendar-month-nav">
            <Button
              onClick={moveToToday}
              size="sm"
              type="button"
              variant="outline"
            >
              Hoje
            </Button>
            <Button
              aria-label="Mês anterior"
              onClick={() => moveMonth(-1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <strong>
              {new Intl.DateTimeFormat("pt-BR", {
                month: "long",
                year: "numeric",
                timeZone: cohortCalendarTimezone,
              }).format(month)}
            </strong>
            <Button
              aria-label="Próximo mês"
              onClick={() => moveMonth(1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
          <fieldset className="gt-calendar-views">
            <legend>Visualização</legend>
            {(["month", "week", "list"] as const).map((item) => (
              <button
                aria-pressed={view === item}
                className="gt-calendar-view-button"
                key={item}
                onClick={() => setView(item)}
                type="button"
              >
                {{ month: "Mês", week: "Semana", list: "Lista" }[item]}
              </button>
            ))}
          </fieldset>
        </nav>
        <fieldset className="gt-calendar-layers">
          <legend className="sr-only">Camadas do calendário</legend>
          {calendarLayerOptions.map((layer) => {
            const visible = visibleLayers.has(layer.type);
            return (
              <button
                aria-pressed={visible}
                className="gt-calendar-layer"
                key={layer.type}
                onClick={() => toggleCalendarLayer(layer.type)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="gt-calendar-layer-check"
                  data-active={visible}
                >
                  {visible ? <CheckIcon /> : null}
                </span>
                <span
                  aria-hidden="true"
                  className="gt-calendar-layer-color"
                  style={{ backgroundColor: layer.color }}
                />
                {layer.label}
              </button>
            );
          })}
        </fieldset>
        <section
          aria-label="Agenda da turma"
          className="gt-calendar-event-list"
        >
          <CalendarDisplay
            archived={archived}
            days={days}
            events={events}
            items={displayItems}
            onCreate={beginCreate}
            onCreateMeeting={beginCreateMeeting}
            onEdit={beginEdit}
            onEditMeeting={beginEditMeeting}
            onException={beginOccurrence}
            view={view}
            weekDays={weekDays}
          />
        </section>
        {itemsLimited ? (
          <output className="gt-error-summary">
            A agenda tem mais itens do que esta janela consegue carregar. Revise
            o período em partes para conferir todos os registros.
          </output>
        ) : null}
        {totalPages > 1 ? (
          <nav
            aria-label="Páginas de eventos"
            className="gt-calendar-pagination"
          >
            <Button
              disabled={page <= 1}
              onClick={() => router.push(`?month=${monthKey}&page=${page - 1}`)}
              type="button"
              variant="outline"
            >
              Anteriores
            </Button>
            <span>
              Página {page} de {totalPages} · {totalCount} eventos
            </span>
            <Button
              disabled={page >= totalPages}
              onClick={() => router.push(`?month=${monthKey}&page=${page + 1}`)}
              type="button"
              variant="outline"
            >
              Próximos
            </Button>
          </nav>
        ) : null}
      </section>

      <CalendarEditorSidebar
        activeStudentCount={activeStudentCount}
        archived={archived}
        cohortId={cohortId}
        conflicts={conflicts}
        conflictsLimited={conflictsLimited}
        copySources={copySources}
        eventFormVisible={eventFormVisible}
        eventId={eventId}
        eventPublished={editingEvent?.status === "PUBLISHED"}
        events={events}
        expectedCohortVersion={expectedCohortVersion}
        form={form}
        onChange={updateForm}
        onClose={() => setEventFormVisible(false)}
        onCreate={() => beginCreate()}
        onPublish={() => setConfirmation({ kind: "publish-form" })}
        onRefresh={() => router.refresh()}
        onSaveDraft={saveDraft}
        onStatusChange={requestStatusChange}
        pending={pending}
        result={result}
      />
      {meetingDate ? (
        <CohortMeetingDialog
          cohortId={cohortId}
          cohortName={cohortName}
          date={meetingDate}
          expectedCohortVersion={expectedCohortVersion}
          meetingId={meetingId ?? undefined}
          onClose={closeMeetingDialog}
        />
      ) : null}
      {confirmation ? (
        <CalendarConfirmationDialog
          message={
            confirmation.kind === "publish-form"
              ? "O evento ficará visível para os alunos matriculados nesta turma."
              : `Confirmar ${nextEventActionLabel(
                  confirmation.status ?? "DRAFT"
                ).toLowerCase()} de “${
                  events.find((event) => event.id === confirmation.eventId)
                    ?.title ?? "evento"
                }”?`
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmRequestedAction}
        />
      ) : null}
      {occurrenceItem ? (
        <CalendarOccurrenceDialog
          initialStartsAt={dateTimeInput(
            occurrenceItem.startsAt,
            occurrenceItem.timezone
          )}
          item={occurrenceItem}
          itemLabel={`${occurrenceItem.title} · ${dateTimeLabel(occurrenceItem.startsAt)}`}
          onCancel={() => setOccurrenceItem(null)}
          onEditMeeting={beginEditMeeting}
          onSave={saveOccurrence}
          pending={pending}
          result={occurrenceResult}
        />
      ) : null}
    </div>
  );
};
