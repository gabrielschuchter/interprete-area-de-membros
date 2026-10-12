"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
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
  cohortCalendarEventColors,
  cohortCalendarEventLastDate,
  cohortCalendarTimezone,
} from "@/lib/cohort-calendar-domain";
import {
  type CohortCalendarActionResult,
  saveGestaoCohortCalendarEvent,
  setGestaoCohortCalendarEventStatus,
} from "./calendar-actions";

interface CalendarEvent {
  readonly allDay: boolean;
  readonly color: string;
  readonly description: string | null;
  readonly endsAt: Date | null;
  readonly id: string;
  readonly publishedAt: Date | null;
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

const getDisplayEndKey = (event: CalendarEvent) => {
  return cohortCalendarEventLastDate(event);
};

const dateLabel = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: cohortCalendarTimezone,
    dateStyle: "full",
  }).format(value);

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

const eventTileLabel = (event: CalendarEvent, showTime: boolean) => {
  if (showTime) {
    return event.allDay ? "Dia inteiro" : dateTimeLabel(event.startsAt);
  }
  return event.status === "PUBLISHED" ? "Publicado" : "Rascunho";
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
  readonly onCreate: (date: string) => void;
  readonly onEdit: (event: CalendarEvent) => void;
  readonly view: "month" | "week" | "list";
  readonly weekDays: readonly string[];
}

const eventsForCalendarDay = (events: readonly CalendarEvent[], day: string) =>
  events.filter(
    (event) => dateKey(event.startsAt) <= day && getDisplayEndKey(event) >= day
  );

const CalendarEventTile = ({
  archived,
  event,
  onEdit,
  showTime,
}: {
  readonly archived: boolean;
  readonly event: CalendarEvent;
  readonly onEdit: (event: CalendarEvent) => void;
  readonly showTime: boolean;
}) => (
  <button
    className="gt-cohort-calendar-event"
    data-status={event.status.toLowerCase()}
    disabled={archived}
    key={event.id}
    onClick={() => onEdit(event)}
    style={{ borderLeftColor: event.color }}
    type="button"
  >
    <span>{event.title}</span>
    <small>{eventTileLabel(event, showTime)}</small>
  </button>
);

const MonthCalendarView = ({
  archived,
  days,
  events,
  onCreate,
  onEdit,
}: Pick<
  CalendarDisplayProps,
  "archived" | "days" | "events" | "onCreate" | "onEdit"
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
      const dayEvents = eventsForCalendarDay(events, day.key);
      const label = dateLabel(new Date(`${day.key}T12:00:00Z`));
      return (
        <section
          aria-label={label}
          className="gt-cohort-day"
          data-outside-month={String(!day.inMonth)}
          key={day.key}
        >
          <button
            aria-label={`Criar evento em ${label}`}
            className="gt-cohort-day-number"
            disabled={archived}
            onClick={() => onCreate(day.key)}
            type="button"
          >
            {day.number}
          </button>
          <div className="gt-cohort-day-events">
            {dayEvents.slice(0, 3).map((event) => (
              <CalendarEventTile
                archived={archived}
                event={event}
                key={event.id}
                onEdit={onEdit}
                showTime={false}
              />
            ))}
            {dayEvents.length > 3 ? (
              <span className="gt-cohort-more-events">
                +{dayEvents.length - 3} eventos
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
  onEdit,
  weekDays,
}: Pick<
  CalendarDisplayProps,
  "archived" | "events" | "onEdit" | "weekDays"
>) => (
  <div className="gt-cohort-week-view">
    {weekDays.map((day) => {
      const dayEvents = eventsForCalendarDay(events, day);
      return (
        <section className="gt-cohort-week-day" key={day}>
          <h3>{dateLabel(new Date(`${day}T12:00:00Z`))}</h3>
          {dayEvents.length ? (
            dayEvents.map((event) => (
              <CalendarEventTile
                archived={archived}
                event={event}
                key={event.id}
                onEdit={onEdit}
                showTime
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
  onEdit,
}: Pick<CalendarDisplayProps, "archived" | "events" | "onEdit">) => (
  <ol className="gt-cohort-event-rows">
    {events.map((event) => (
      <li key={event.id}>
        <span
          aria-hidden="true"
          className="gt-cohort-event-dot"
          style={{ backgroundColor: event.color }}
        />
        <span className="gt-cohort-event-copy">
          <strong>{event.title}</strong>
          <small>
            {event.allDay ? "Dia inteiro" : dateTimeLabel(event.startsAt)}
            {event.endsAt ? ` · até ${dateTimeLabel(event.endsAt)}` : ""}
          </small>
        </span>
        <span
          className={`gt-status-pill gt-status-${event.status.toLowerCase()}`}
        >
          {statusLabel[event.status]}
        </span>
        <Button
          disabled={archived}
          onClick={() => onEdit(event)}
          type="button"
          variant="outline"
        >
          Editar
        </Button>
      </li>
    ))}
    {events.length === 0 ? (
      <li className="gt-panel-empty">Não há eventos neste período.</li>
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
  readonly archived: boolean;
  readonly conflicts: readonly CohortCalendarDateConflict[];
  readonly conflictsLimited: boolean;
  readonly eventId: string | null;
  readonly eventPublished: boolean;
  readonly events: readonly CalendarEvent[];
  readonly form: EventForm;
  readonly onChange: <K extends keyof EventForm>(
    key: K,
    value: EventForm[K]
  ) => void;
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
              <span>{conflict.titles.join(" · ")}</span>
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
  archived,
  conflicts,
  conflictsLimited,
  eventId,
  eventPublished,
  events,
  form,
  onChange,
  onCreate,
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
      <section className="gt-panel">
        <div className="gt-panel-heading">
          <h2>{eventId ? "Editar evento" : "Nova na turma"}</h2>
          {eventId ? (
            <Button onClick={onCreate} type="button" variant="ghost">
              Novo
            </Button>
          ) : null}
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
      <section className="gt-panel gt-calendar-publish-help">
        <h2>Visibilidade dos alunos</h2>
        <p>
          Somente eventos publicados aparecem no Planejamento e no arquivo de
          calendário pessoal. Rascunhos permanecem privados à equipe.
        </p>
        <Link href="/planejamento">Ver o Planejamento do aluno</Link>
      </section>
      <CalendarConflictPanel conflicts={conflicts} limited={conflictsLimited} />
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

export const CohortCalendarEditor = ({
  archived,
  cohortId,
  conflicts,
  conflictsLimited,
  expectedCohortVersion,
  events,
  monthKey,
  page,
  totalPages,
  totalCount,
}: {
  readonly archived: boolean;
  readonly cohortId: string;
  readonly conflicts: readonly CohortCalendarDateConflict[];
  readonly conflictsLimited: boolean;
  readonly expectedCohortVersion: number;
  readonly events: readonly CalendarEvent[];
  readonly monthKey: string;
  readonly page: number;
  readonly totalPages: number;
  readonly totalCount: number;
}) => {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  const monthDate = new Date(`${monthKey}-01T12:00:00Z`);
  const now = dateParts(new Date());
  const [month, setMonth] = useState(monthDate);
  const [focusDate, setFocusDate] = useState(() =>
    monthDate.getUTCFullYear() === now.year &&
    monthDate.getUTCMonth() + 1 === now.month
      ? new Date(Date.UTC(now.year, now.month - 1, now.day))
      : monthDate
  );
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [eventId, setEventId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [result, setResult] = useState<CohortCalendarActionResult | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(
    null
  );
  const editingEvent = events.find((event) => event.id === eventId);

  useEffect(() => {
    const [year, monthValue] = monthKey.split("-").map(Number);
    const nextMonth = new Date(Date.UTC(year, monthValue - 1, 1));
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
    return Array.from({ length: 42 }, (_, index) => {
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
  const displayEvents = useMemo(
    () =>
      view === "list"
        ? events
        : events.filter((event) => {
            const start = dateKey(event.startsAt);
            const end = getDisplayEndKey(event);
            const first =
              view === "week" ? (weekDays[0] ?? "") : (days[0]?.key ?? "");
            const last =
              view === "week"
                ? (weekDays.at(-1) ?? "")
                : (days.at(-1)?.key ?? "");
            return start <= last && end >= first;
          }),
    [days, events, view, weekDays]
  );

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
  };

  const beginEdit = (event: CalendarEvent) => {
    idempotencyKey.current = null;
    setEventId(event.id);
    setForm({
      title: event.title,
      description: event.description ?? "",
      startsAt: dateTimeInput(event.startsAt),
      endsAt: dateTimeInput(event.endsAt),
      allDay: event.allDay,
      color: event.color,
    });
    setResult(null);
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
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + amount, 1)
    );
    const nextKey = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
    router.push(`?month=${nextKey}`);
    setMonth(next);
    setFocusDate(next);
  };

  const moveToToday = () => {
    const today = dateParts(new Date());
    const todayMonth = new Date(Date.UTC(today.year, today.month - 1, 1));
    const todayKey = `${today.year}-${String(today.month).padStart(2, "0")}`;
    setMonth(todayMonth);
    setFocusDate(new Date(Date.UTC(today.year, today.month - 1, today.day)));
    router.push(`?month=${todayKey}`);
  };

  return (
    <div className="gt-calendar-workspace">
      <section className="gt-panel gt-calendar-main">
        <div className="gt-panel-heading gt-calendar-heading">
          <div>
            <h2>Encontros e calendário</h2>
            <p>
              Eventos publicados desta turma aparecem no Planejamento e no
              calendário pessoal dos alunos.
            </p>
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
        <section
          aria-label="Eventos da turma"
          className="gt-calendar-event-list"
        >
          <CalendarDisplay
            archived={archived}
            days={days}
            events={displayEvents}
            onCreate={beginCreate}
            onEdit={beginEdit}
            view={view}
            weekDays={weekDays}
          />
        </section>
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
        archived={archived}
        conflicts={conflicts}
        conflictsLimited={conflictsLimited}
        eventId={eventId}
        eventPublished={editingEvent?.status === "PUBLISHED"}
        events={events}
        form={form}
        onChange={updateForm}
        onCreate={() => beginCreate()}
        onPublish={() => setConfirmation({ kind: "publish-form" })}
        onRefresh={() => router.refresh()}
        onSaveDraft={saveDraft}
        onStatusChange={requestStatusChange}
        pending={pending}
        result={result}
      />
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
    </div>
  );
};
