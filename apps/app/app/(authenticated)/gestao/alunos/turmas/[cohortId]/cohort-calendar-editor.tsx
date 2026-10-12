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
  type CohortCalendarCopyResult,
  copyGestaoCohortCalendarAgenda,
} from "./calendar-copy-actions";
import {
  createGestaoCohortCalendarFeed,
  revokeGestaoCohortCalendarFeed,
} from "./calendar-feed-actions";
import {
  type CohortCalendarOccurrenceResult,
  setGestaoCohortCalendarOccurrence,
} from "./calendar-occurrence-actions";
import { CohortMeetingDialog } from "./cohort-meeting-dialog";

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

const dateTimeInput = (value: Date | null) => {
  if (!value) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: cohortCalendarTimezone,
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
  onException,
  showTime,
}: {
  readonly archived: boolean;
  readonly item: CohortCalendarItem;
  readonly sourceEvent?: CalendarEvent;
  readonly onEdit: (event: CalendarEvent) => void;
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
        disabled={archived}
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
  onException,
  weekDays,
}: Pick<
  CalendarDisplayProps,
  "archived" | "events" | "items" | "onEdit" | "onException" | "weekDays"
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

const ListCalendarView = ({
  archived,
  events,
  items,
  onEdit,
  onException,
}: Pick<
  CalendarDisplayProps,
  "archived" | "events" | "items" | "onEdit" | "onException"
>) => (
  <ol className="gt-cohort-event-rows">
    {items.map((item) => {
      const event =
        item.sourceType === "event"
          ? events.find((candidate) => candidate.id === item.sourceId)
          : undefined;
      return (
        <li key={item.id}>
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
          <span
            className={`gt-status-pill gt-status-${item.status.toLowerCase()}`}
          >
            {item.sourceType === "event"
              ? statusLabel[item.status]
              : "Publicado"}
          </span>
          {event ? (
            <Button
              disabled={archived}
              onClick={() => onEdit(event)}
              type="button"
              variant="outline"
            >
              Editar
            </Button>
          ) : (
            <Link className="gt-calendar-open-link" href={item.href}>
              Abrir
            </Link>
          )}
          {item.recurrence !== "NONE" ? (
            <Button
              disabled={archived}
              onClick={() => onException(item)}
              type="button"
              variant="outline"
            >
              {item.cancelled ? "Restaurar data" : "Esta data"}
            </Button>
          ) : null}
        </li>
      );
    })}
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

const CalendarFeedControls = ({
  archived,
  cohortId,
}: {
  readonly archived: boolean;
  readonly cohortId: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  let createLabel = "Assinar calendário (.ics)";
  if (pending) {
    createLabel = "Gerando…";
  } else if (url) {
    createLabel = "Gerar novo link";
  }
  const createFeed = () => {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await createGestaoCohortCalendarFeed(cohortId);
      if (result.ok && result.url) {
        setUrl(result.url);
        setMessage(
          "Assinatura criada. Use o link em um aplicativo de calendário."
        );
      } else if (!result.ok) {
        setError(result.message);
      }
    });
  };
  const revokeFeed = () => {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await revokeGestaoCohortCalendarFeed(cohortId);
      if (result.ok) {
        setUrl(null);
        setMessage("Link revogado.");
      } else {
        setError(result.message);
      }
    });
  };
  const copyFeed = async () => {
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        new URL(url, window.location.origin).toString()
      );
      setMessage("Endereço copiado.");
    } catch {
      setError("Não foi possível copiar. Abra o link e copie o endereço.");
    }
  };

  return (
    <div className="gt-calendar-feed-controls">
      <div className="gt-cohort-event-actions">
        <Button
          disabled={archived || pending}
          onClick={createFeed}
          type="button"
        >
          {createLabel}
        </Button>
        <Button
          disabled={pending}
          onClick={revokeFeed}
          type="button"
          variant="outline"
        >
          Revogar link
        </Button>
      </div>
      {url ? (
        <div className="gt-cohort-event-actions">
          <a href={url}>Abrir calendário .ics</a>
          <Button onClick={copyFeed} type="button" variant="ghost">
            Copiar endereço
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="gt-error-summary" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <output aria-live="polite">{message}</output> : null}
    </div>
  );
};

const CalendarCopyConfirmation = ({
  onCancel,
  onConfirm,
  pending,
  sourceName,
}: {
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly pending: boolean;
  readonly sourceName: string;
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  return (
    <dialog
      aria-labelledby="gt-calendar-copy-heading"
      className="gt-confirmation-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          onCancel();
        }
      }}
      ref={dialogRef}
    >
      <h2 id="gt-calendar-copy-heading">Copiar agenda</h2>
      <p>
        Copiar os itens de “{sourceName}” para esta turma? Eventos serão criados
        como rascunhos. Encontros e prazos publicados ficarão visíveis para esta
        turma; liberações manterão as datas quando o curso estiver acessível.
        Alunos e convites não serão copiados.
      </p>
      <div className="gt-cohort-event-actions">
        <Button
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancelar
        </Button>
        <Button disabled={pending} onClick={onConfirm} type="button">
          {pending ? "Copiando…" : "Copiar agenda"}
        </Button>
      </div>
    </dialog>
  );
};

const CalendarCopyControls = ({
  archived,
  cohortId,
  copySources,
  expectedCohortVersion,
}: {
  readonly archived: boolean;
  readonly cohortId: string;
  readonly copySources: readonly CalendarCopySource[];
  readonly expectedCohortVersion: number;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sourceId, setSourceId] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [result, setResult] = useState<CohortCalendarCopyResult | null>(null);
  const selectedSource = copySources.find((source) => source.id === sourceId);
  const confirmCopy = () => {
    if (!selectedSource) {
      return;
    }
    setResult(null);
    const idempotencyKey = crypto.randomUUID();
    startTransition(async () => {
      const response = await copyGestaoCohortCalendarAgenda({
        sourceCohortId: selectedSource.id,
        destinationCohortId: cohortId,
        expectedDestinationVersion: expectedCohortVersion,
        idempotencyKey,
      });
      setResult(response);
      setConfirmationOpen(false);
      if (response.ok) {
        router.refresh();
      }
    });
  };
  const message = result?.ok
    ? `Agenda copiada: ${result.counts.eventsCreated} eventos em rascunho, ${result.counts.meetingsAdded} encontros, ${result.counts.activitiesAdded} prazos e ${result.counts.releasesCreated + result.counts.releasesUpdated} liberações. ${result.counts.releasesSkipped} liberações não foram copiadas porque o curso não está acessível nesta turma.`
    : null;

  return (
    <>
      <section
        aria-labelledby="gt-calendar-copy-controls-heading"
        className="gt-panel"
      >
        <h2 id="gt-calendar-copy-controls-heading">Copiar outra agenda</h2>
        <p>Use uma turma existente como ponto de partida para esta agenda.</p>
        <label className="gt-field" htmlFor="gt-calendar-copy-source">
          <span>Turma de origem</span>
          <select
            disabled={archived || pending || copySources.length === 0}
            id="gt-calendar-copy-source"
            onChange={(event) => setSourceId(event.target.value)}
            value={sourceId}
          >
            <option value="">Selecione uma turma</option>
            {copySources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={archived || pending || !selectedSource}
          onClick={() => setConfirmationOpen(true)}
          type="button"
          variant="outline"
        >
          Copiar agenda
        </Button>
        {copySources.length === 0 ? (
          <p>Não há outras turmas disponíveis para copiar.</p>
        ) : null}
        {result?.ok === false ? (
          <p className="gt-error-summary" role="alert">
            {result.message}
            {result.code === "conflict" ? (
              <Button
                onClick={() => router.refresh()}
                type="button"
                variant="link"
              >
                Atualizar turma
              </Button>
            ) : null}
          </p>
        ) : null}
        {message ? <output aria-live="polite">{message}</output> : null}
      </section>
      {confirmationOpen && selectedSource ? (
        <CalendarCopyConfirmation
          onCancel={() => setConfirmationOpen(false)}
          onConfirm={confirmCopy}
          pending={pending}
          sourceName={selectedSource.name}
        />
      ) : null}
    </>
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

const CalendarConfirmationDialog = ({
  confirmation,
  eventTitle,
  onCancel,
  onConfirm,
}: {
  readonly confirmation: PendingConfirmation;
  readonly eventTitle: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  return (
    <dialog
      aria-describedby="gt-calendar-confirmation-copy"
      aria-labelledby="gt-calendar-confirmation-title"
      aria-modal="true"
      className="gt-calendar-confirmation"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialogRef}
    >
      <h2 id="gt-calendar-confirmation-title">Confirmar ação</h2>
      <p id="gt-calendar-confirmation-copy">
        {confirmation.kind === "publish-form"
          ? "O evento ficará visível para os alunos matriculados nesta turma."
          : `Confirmar ${nextEventActionLabel(
              confirmation.status ?? "DRAFT"
            ).toLowerCase()} de “${eventTitle}”?`}
      </p>
      <div>
        <Button autoFocus onClick={onCancel} type="button" variant="outline">
          Cancelar
        </Button>
        <Button onClick={onConfirm} type="button">
          Confirmar
        </Button>
      </div>
    </dialog>
  );
};

type CalendarOccurrenceOperation = "move" | "cancel" | "restore";

const CalendarOccurrenceDialog = ({
  item,
  onCancel,
  onSave,
  pending,
  result,
}: {
  readonly item: CohortCalendarItem;
  readonly onCancel: () => void;
  readonly onSave: (
    operation: CalendarOccurrenceOperation,
    startsAtOverride: string,
    idempotencyKey: string
  ) => void;
  readonly pending: boolean;
  readonly result: CohortCalendarOccurrenceResult | null;
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const [operation, setOperation] =
    useState<CalendarOccurrenceOperation>("move");
  const [startsAtOverride, setStartsAtOverride] = useState(() =>
    dateTimeInput(item.startsAt)
  );
  const saveLabel =
    operation === "restore" ? "Restaurar data" : "Salvar alteração";
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  const submit = () => {
    idempotencyKey.current ??= crypto.randomUUID();
    onSave(operation, startsAtOverride, idempotencyKey.current);
  };

  return (
    <dialog
      aria-describedby="gt-calendar-occurrence-copy"
      aria-labelledby="gt-calendar-occurrence-title"
      aria-modal="true"
      className="gt-calendar-confirmation"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialogRef}
    >
      <h2 id="gt-calendar-occurrence-title">Ajustar esta ocorrência</h2>
      <p id="gt-calendar-occurrence-copy">
        {item.title} · {dateTimeLabel(item.startsAt)}. A mudança vale apenas
        para esta data.
      </p>
      <fieldset>
        <legend>O que deseja fazer?</legend>
        <label>
          <input
            checked={operation === "move"}
            name="cohort-calendar-occurrence-operation"
            onChange={() => {
              idempotencyKey.current = null;
              setOperation("move");
            }}
            type="radio"
          />
          Remarcar
        </label>
        {operation === "move" ? (
          <label>
            Nova data e horário
            <input
              autoFocus
              onChange={(event) => {
                idempotencyKey.current = null;
                setStartsAtOverride(event.currentTarget.value);
              }}
              required
              type="datetime-local"
              value={startsAtOverride}
            />
          </label>
        ) : null}
        <label>
          <input
            checked={operation === "cancel"}
            name="cohort-calendar-occurrence-operation"
            onChange={() => {
              idempotencyKey.current = null;
              setOperation("cancel");
            }}
            type="radio"
          />
          Cancelar somente esta data
        </label>
        {item.exceptionVersion !== null ? (
          <label>
            <input
              checked={operation === "restore"}
              name="cohort-calendar-occurrence-operation"
              onChange={() => {
                idempotencyKey.current = null;
                setOperation("restore");
              }}
              type="radio"
            />
            Restaurar a ocorrência original
          </label>
        ) : null}
      </fieldset>
      {result?.ok === false ? (
        <div className="gt-error-summary" role="alert">
          <p>{result.message}</p>
          {result.fields ? (
            <ul>
              {Object.entries(result.fields).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div>
        <Button
          autoFocus={operation !== "move"}
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Fechar
        </Button>
        <Button disabled={pending} onClick={submit} type="button">
          {pending ? "Salvando…" : saveLabel}
        </Button>
      </div>
    </dialog>
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
            onCreateMeeting={setMeetingDate}
            onEdit={beginEdit}
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
          onClose={() => setMeetingDate(null)}
        />
      ) : null}
      {confirmation ? (
        <CalendarConfirmationDialog
          confirmation={confirmation}
          eventTitle={
            events.find((event) => event.id === confirmation.eventId)?.title ??
            "evento"
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmRequestedAction}
        />
      ) : null}
      {occurrenceItem ? (
        <CalendarOccurrenceDialog
          item={occurrenceItem}
          onCancel={() => setOccurrenceItem(null)}
          onSave={saveOccurrence}
          pending={pending}
          result={occurrenceResult}
        />
      ) : null}
    </div>
  );
};
