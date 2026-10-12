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
import { Input } from "@repo/design-system/components/ui/input";
import { toast } from "@repo/design-system/lib/toast";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cohortCalendarEventDateRange } from "@/lib/cohort-calendar-domain";
import type { getPlannerDashboard } from "@/lib/planner";
import {
  changePlannerTaskStatusAction,
  deletePlannerEventAction,
  deletePlannerTaskAction,
  duplicatePlannerEventAction,
  duplicatePlannerTaskAction,
  loadPlannerAction,
  restorePlannerTaskAction,
  savePlannerColumnAction,
  savePlannerEventAction,
  savePlannerGoalAction,
  savePlannerTaskAction,
} from "./actions";

type PlannerData = Awaited<ReturnType<typeof getPlannerDashboard>>;
type PlannerTask = PlannerData["tasks"][number];
type PlannerEvent = PlannerData["events"][number];
type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
type PlannerView = "goals" | "tasks" | "board" | "calendar";
type CalendarMode = "month" | "week" | "day" | "list";

const HTTP_SCHEME_PATTERN = /^https?:/;
const WEEKDAY_LABELS = [
  { key: "sunday", label: "D" },
  { key: "monday", label: "S" },
  { key: "tuesday", label: "T" },
  { key: "wednesday", label: "Q" },
  { key: "thursday", label: "Q" },
  { key: "friday", label: "S" },
  { key: "saturday", label: "S" },
] as const;

const taskStatusOptions: Array<{ id: TaskStatus; label: string }> = [
  { id: "TODO", label: "A fazer" },
  { id: "IN_PROGRESS", label: "Em andamento" },
  { id: "DONE", label: "Concluída" },
];

const localInputValue = (date: Date | null | undefined, timezone: string) => {
  if (!date) {
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
  }).formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
};

const isoFromLocalInput = (value: string, timezone: string) => {
  if (!value) {
    return null;
  }
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = (datePart ?? "").split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const read = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    guess +=
      target -
      Date.UTC(
        read("year"),
        read("month") - 1,
        read("day"),
        read("hour"),
        read("minute"),
        read("second")
      );
  }
  return new Date(guess).toISOString();
};

const dateLabel = (value: Date | null, timezone: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }).format(value)
    : "Sem prazo";

const dateKeyInTimezone = (value: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${read("year")}-${read("month")}-${read("day")}`;
};

const localDateKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

const dateFromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const addUtcDays = (date: Date, days: number) =>
  new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days
    )
  );

const sundayFor = (date: Date) => addUtcDays(date, -date.getUTCDay());

const visibleCalendarEnd = (
  mode: CalendarMode,
  focusDate: Date,
  monthGridEnd: Date
) => {
  if (mode === "list") {
    return addUtcDays(focusDate, 30);
  }
  if (mode === "day") {
    return addUtcDays(focusDate, 1);
  }
  if (mode === "week") {
    return addUtcDays(sundayFor(focusDate), 7);
  }
  return monthGridEnd;
};

const calendarDayButtonClass = (
  selected: boolean,
  today: boolean,
  currentMonth: boolean
) => {
  if (selected) {
    return "bg-[#8C1535] text-white";
  }
  if (today) {
    return "border border-[#8C1535] text-[#8C1535]";
  }
  return currentMonth
    ? "text-[#40222F] hover:bg-[#F8F4F1]"
    : "text-[#BFA9A3] hover:bg-[#F8F4F1]";
};

const minutesAtTimezone = (value: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return read("hour") * 60 + read("minute");
};

const cohortEventEndMinute = (
  event: {
    readonly allDay: boolean;
    readonly endsAt: Date | null;
  },
  timezone: string,
  dayKey: string
) => {
  if (event.allDay || !event.endsAt) {
    return null;
  }
  if (dateKeyInTimezone(event.endsAt, timezone) !== dayKey) {
    return 1440;
  }
  return minutesAtTimezone(event.endsAt, timezone);
};

const cohortEventCalendarRecords = (
  events: readonly PlannerData["cohortEvents"][number][],
  timezone: string,
  visibleStartKey: string,
  visibleEndKey: string
) =>
  events.flatMap((cohortEvent) => {
    const eventDates = cohortCalendarEventDateRange(cohortEvent, timezone);
    const firstKey =
      eventDates.first < visibleStartKey ? visibleStartKey : eventDates.first;
    const lastKey =
      eventDates.last > visibleEndKey ? visibleEndKey : eventDates.last;
    if (firstKey > lastKey) {
      return [];
    }

    const firstDate = dateFromKey(firstKey);
    const dayCount =
      Math.floor(
        (dateFromKey(lastKey).getTime() - firstDate.getTime()) / 86_400_000
      ) + 1;
    return Array.from({ length: dayCount }, (_, index) => {
      const dayKey = localDateKey(addUtcDays(firstDate, index));
      const isFirstDay = dayKey === eventDates.first;
      const isLastDay = dayKey === eventDates.last;
      let startMinute: number | null = null;
      if (!cohortEvent.allDay) {
        startMinute = isFirstDay
          ? minutesAtTimezone(cohortEvent.startsAt, timezone)
          : 0;
      }
      let endMinute: number | null = null;
      if (!cohortEvent.allDay && cohortEvent.endsAt) {
        endMinute = isLastDay
          ? cohortEventEndMinute(cohortEvent, timezone, dayKey)
          : 1440;
      }
      return {
        key: `cohort-event:${cohortEvent.id}:${dayKey}`,
        dateKey: dayKey,
        startMinute,
        endMinute,
        kind: "cohortEvent" as const,
        title: cohortEvent.title,
        cohortEvent,
      };
    });
  });

interface CalendarBlockPlacement {
  readonly key: string;
  readonly showLabel: boolean;
  readonly style: CSSProperties;
}
type CalendarTimeFormatter = (value: Date | null) => string;

const CalendarRecordTitle = ({
  block,
  title,
}: {
  readonly block?: CalendarBlockPlacement;
  readonly title: string;
}) =>
  block && !block.showLabel ? (
    <span className="sr-only">{title}</span>
  ) : (
    <span className="font-medium">{title}</span>
  );

const CalendarTaskTime = ({
  formatTime,
  dueAt,
}: {
  readonly formatTime: CalendarTimeFormatter;
  readonly dueAt: Date | null;
}) =>
  dueAt ? (
    <span className="ml-1 text-[#7A5A69]">{formatTime(dueAt)}</span>
  ) : null;

const CalendarEventTime = ({
  block,
  event,
  formatTime,
}: {
  readonly block?: CalendarBlockPlacement;
  readonly event: PlannerEvent;
  readonly formatTime: CalendarTimeFormatter;
}) => {
  if (block) {
    return null;
  }
  if (event.allDay) {
    return <span className="ml-1">Dia todo</span>;
  }
  return (
    <span className="ml-1">
      {formatTime(event.startsAt)}–{formatTime(event.endsAt)}
    </span>
  );
};

const CalendarMeetingTime = ({
  block,
  meeting,
  formatTime,
}: {
  readonly block?: CalendarBlockPlacement;
  readonly formatTime: CalendarTimeFormatter;
  readonly meeting: PlannerData["meetings"][number];
}) =>
  block ? null : (
    <span className="ml-1">
      {formatTime(meeting.startsAt)}–{formatTime(meeting.endsAt)}
    </span>
  );

const calendarEventClass = (block?: CalendarBlockPlacement) =>
  `${block ? "absolute z-10 overflow-hidden px-1 py-0.5 text-[10px]" : "block w-full px-2 py-1.5 pl-1.5 text-xs"} truncate rounded-md border-l-[3px] bg-[#F1EBE8] text-left text-[#6C4857] hover:bg-[#EAE0DC]`;

const calendarMeetingClass = (block?: CalendarBlockPlacement) =>
  `${block ? "absolute z-10 overflow-hidden px-1 py-0.5 text-[10px]" : "block px-2 py-1.5 text-xs"} truncate rounded-md bg-[#FBF3F4] text-[#8C1535] hover:bg-[#F9E8EB]`;

const localMidnightAtTimezone = (date: Date, timezone: string) => {
  const target = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
  let guess = target;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const read = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const actual = Date.UTC(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour"),
      read("minute"),
      read("second")
    );
    guess += target - actual;
  }
  return new Date(guess);
};

const monthLabel = (month: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(month);

const statusClass = (status: TaskStatus) => {
  if (status === "DONE") {
    return "border-[#D9E4D7] bg-[#F2F7F0] text-[#426044]";
  }
  if (status === "IN_PROGRESS") {
    return "border-[#E8C8D0] bg-[#FBF3F4] text-[#8C1535]";
  }
  return "border-[#E2D6D1] bg-white text-[#7A5A69]";
};

const priorityClass = (priority: PlannerTask["priority"]) => {
  if (priority === "HIGH") {
    return "bg-[#F9E8EB] text-[#A8182A]";
  }
  if (priority === "MEDIUM") {
    return "bg-[#F7EEF0] text-[#8C1535]";
  }
  return "bg-[#F1EBE8] text-[#7A5A69]";
};

const priorityLabel = (priority: PlannerTask["priority"]) => {
  if (priority === "HIGH") {
    return "Alta";
  }
  if (priority === "MEDIUM") {
    return "Média";
  }
  return "Baixa";
};

const showError = (error: unknown) =>
  toast.error(
    error instanceof Error ? error.message : "Não foi possível salvar agora."
  );

function TaskEditorDialog({
  onClose,
  onSave,
  open,
  parentTaskId,
  task,
  timezone,
}: {
  readonly onClose: () => void;
  readonly onSave: (input: Record<string, unknown>) => Promise<void>;
  readonly open: boolean;
  readonly parentTaskId?: string | null;
  readonly task: PlannerTask | null;
  readonly timezone: string;
}) {
  const fieldId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [category, setCategory] = useState("");
  const [recurrence, setRecurrence] = useState("NONE");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState("");
  const [scope, setScope] = useState<"occurrence" | "series">("occurrence");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setDueAt(localInputValue(task?.dueAt ?? null, timezone));
    setPriority(task?.priority ?? "MEDIUM");
    setStatus(task?.status ?? "TODO");
    setCategory(task?.category ?? "");
    setRecurrence(task?.recurrence ?? "NONE");
    setRecurrenceUntil(
      localInputValue(task?.recurrenceUntil ?? null, timezone)
    );
    setReminderMinutes(task?.reminderMinutes?.toString() ?? "");
    setScope("occurrence");
  }, [open, task, timezone]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...(task ? { id: task.id } : {}),
        title,
        description: description || null,
        dueAt: isoFromLocalInput(dueAt, timezone),
        priority,
        status,
        category: category || null,
        recurrence:
          task?.occurrenceKey && scope === "occurrence" ? "NONE" : recurrence,
        recurrenceUntil: isoFromLocalInput(recurrenceUntil, timezone),
        reminderMinutes:
          reminderMinutes === "" ? null : Number(reminderMinutes),
        parentTaskId: parentTaskId ?? null,
        ...(task?.recurrence !== "NONE" &&
        task?.occurrenceKey &&
        scope === "occurrence"
          ? { occurrenceAt: task.occurrenceKey }
          : {}),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };
  let dialogTitle = "Nova tarefa";
  if (parentTaskId) {
    dialogTitle = "Nova subtarefa";
  }
  if (task) {
    dialogTitle = "Editar tarefa";
  }

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent className="max-h-[90vh] max-w-[min(94vw,620px)] overflow-y-auto border-[#E2D6D1] bg-[#F8F4F1] p-0">
        <form className="p-5 sm:p-7" onSubmit={submit}>
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-3xl text-[#40222F]">
              {dialogTitle}
            </DialogTitle>
            <DialogDescription className="text-[#7A5A69]">
              Tarefas pessoais ficam visíveis apenas para você.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-4">
            <label
              className="grid gap-1.5 font-medium text-[#40222F] text-sm"
              htmlFor={`${fieldId}-title`}
            >
              Título
              <Input
                autoFocus
                id={`${fieldId}-title`}
                maxLength={180}
                onChange={(event) => setTitle(event.target.value)}
                required
                value={title}
              />
            </label>
            <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
              Descrição
              <textarea
                className="min-h-24 rounded-md border border-[#E2D6D1] bg-white p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#8C1535]"
                maxLength={8000}
                onChange={(event) => setDescription(event.target.value)}
                value={description}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className="grid gap-1.5 font-medium text-[#40222F] text-sm"
                htmlFor={`${fieldId}-due`}
              >
                Prazo
                <Input
                  id={`${fieldId}-due`}
                  onChange={(event) => setDueAt(event.target.value)}
                  type="datetime-local"
                  value={dueAt}
                />
              </label>
              <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
                Prioridade
                <select
                  className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
                  onChange={(event) => setPriority(event.target.value)}
                  value={priority}
                >
                  <option value="HIGH">Alta</option>
                  <option value="MEDIUM">Média</option>
                  <option value="LOW">Baixa</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
                Estado
                <select
                  className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
                  onChange={(event) =>
                    setStatus(event.target.value as TaskStatus)
                  }
                  value={status}
                >
                  {taskStatusOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="grid gap-1.5 font-medium text-[#40222F] text-sm"
                htmlFor={`${fieldId}-category`}
              >
                Categoria
                <Input
                  id={`${fieldId}-category`}
                  maxLength={80}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Ex.: leitura"
                  value={category}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
                Repetir
                <select
                  className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
                  disabled={Boolean(task?.occurrenceKey)}
                  onChange={(event) => setRecurrence(event.target.value)}
                  value={recurrence}
                >
                  <option value="NONE">Não repetir</option>
                  <option value="DAILY">Todos os dias</option>
                  <option value="WEEKLY">Toda semana</option>
                  <option value="MONTHLY">Todo mês</option>
                </select>
              </label>
              <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
                Lembrar
                <select
                  className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
                  onChange={(event) => setReminderMinutes(event.target.value)}
                  value={reminderMinutes}
                >
                  <option value="">Sem lembrete</option>
                  <option value="0">No prazo</option>
                  <option value="15">15 minutos antes</option>
                  <option value="60">1 hora antes</option>
                  <option value="1440">1 dia antes</option>
                </select>
              </label>
            </div>
            {recurrence !== "NONE" ? (
              <label
                className="grid gap-1.5 font-medium text-[#40222F] text-sm"
                htmlFor={`${fieldId}-recurrence-until`}
              >
                Repetir até (opcional)
                <Input
                  id={`${fieldId}-recurrence-until`}
                  onChange={(event) => setRecurrenceUntil(event.target.value)}
                  type="date"
                  value={recurrenceUntil.slice(0, 10)}
                />
              </label>
            ) : null}
            {task?.recurrence !== "NONE" && task?.occurrenceKey ? (
              <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
                Aplicar edição
                <select
                  className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
                  onChange={(event) =>
                    setScope(event.target.value as "occurrence" | "series")
                  }
                  value={scope}
                >
                  <option value="occurrence">Só nesta ocorrência</option>
                  <option value="series">Em toda a série</option>
                </select>
              </label>
            ) : null}
            <p className="text-[#7A5A69] text-xs">Fuso horário: {timezone}</p>
          </div>
          <DialogFooter className="mt-6 flex-row justify-end gap-2 sm:justify-end">
            <Button onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? "Salvando…" : "Salvar tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EventEditorDialog({
  event,
  onClose,
  onDelete,
  onDuplicate,
  onSave,
  open,
  timezone,
}: {
  readonly event: PlannerEvent | null;
  readonly onClose: () => void;
  readonly onDelete: (event: PlannerEvent) => void;
  readonly onDuplicate: (event: PlannerEvent) => Promise<void>;
  readonly onSave: (input: Record<string, unknown>) => Promise<void>;
  readonly open: boolean;
  readonly timezone: string;
}) {
  const fieldId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState("#7A5A69");
  const [allDay, setAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState("NONE");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState("");
  const [scope, setScope] = useState<"occurrence" | "series">("occurrence");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(event?.title ?? "");
    setDescription(event?.description ?? "");
    setStartsAt(localInputValue(event?.startsAt ?? null, timezone));
    setEndsAt(localInputValue(event?.endsAt ?? null, timezone));
    setLocation(event?.location ?? "");
    setColor(event?.color ?? "#7A5A69");
    setAllDay(event?.allDay ?? false);
    setRecurrence(event?.recurrence ?? "NONE");
    setRecurrenceUntil(
      localInputValue(event?.recurrenceUntil ?? null, timezone)
    );
    setReminderMinutes(event?.reminderMinutes?.toString() ?? "");
    setScope("occurrence");
  }, [event, open, timezone]);

  const submit = async (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!(startsAt && endsAt)) {
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...(event ? { id: event.id } : {}),
        title,
        description: description || null,
        startsAt: isoFromLocalInput(startsAt, timezone),
        endsAt: isoFromLocalInput(endsAt, timezone),
        timezone,
        color,
        location: location || null,
        allDay,
        recurrence:
          event?.occurrenceKey && scope === "occurrence" ? "NONE" : recurrence,
        recurrenceUntil: isoFromLocalInput(recurrenceUntil, timezone),
        reminderMinutes:
          reminderMinutes === "" ? null : Number(reminderMinutes),
        kind: "PERSONAL",
        ...(event?.recurrence !== "NONE" &&
        event?.occurrenceKey &&
        scope === "occurrence"
          ? { occurrenceStartsAt: event.occurrenceKey }
          : {}),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent className="max-h-[90vh] max-w-[min(94vw,620px)] overflow-y-auto border-[#E2D6D1] bg-[#F8F4F1] p-0">
        <form className="p-5 sm:p-7" onSubmit={submit}>
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-3xl text-[#40222F]">
              {event ? "Editar evento" : "Novo evento"}
            </DialogTitle>
            <DialogDescription className="text-[#7A5A69]">
              Este evento pessoal aparece somente no seu calendário.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-4">
            <label
              className="grid gap-1.5 font-medium text-[#40222F] text-sm"
              htmlFor={`${fieldId}-title`}
            >
              Título
              <Input
                autoFocus
                id={`${fieldId}-title`}
                maxLength={180}
                onChange={(input) => setTitle(input.target.value)}
                required
                value={title}
              />
            </label>
            <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
              Descrição
              <textarea
                className="min-h-20 rounded-md border border-[#E2D6D1] bg-white p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#8C1535]"
                maxLength={8000}
                onChange={(input) => setDescription(input.target.value)}
                value={description}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className="grid gap-1.5 font-medium text-[#40222F] text-sm"
                htmlFor={`${fieldId}-starts`}
              >
                Começa
                <Input
                  id={`${fieldId}-starts`}
                  onChange={(input) => setStartsAt(input.target.value)}
                  required
                  type="datetime-local"
                  value={startsAt}
                />
              </label>
              <label
                className="grid gap-1.5 font-medium text-[#40222F] text-sm"
                htmlFor={`${fieldId}-ends`}
              >
                Termina
                <Input
                  id={`${fieldId}-ends`}
                  onChange={(input) => setEndsAt(input.target.value)}
                  required
                  type="datetime-local"
                  value={endsAt}
                />
              </label>
            </div>
            <label
              className="grid gap-1.5 font-medium text-[#40222F] text-sm"
              htmlFor={`${fieldId}-location`}
            >
              Local ou link
              <Input
                id={`${fieldId}-location`}
                maxLength={300}
                onChange={(input) => setLocation(input.target.value)}
                value={location}
              />
            </label>
            <label
              className="flex items-center gap-3 font-medium text-[#40222F] text-sm"
              htmlFor={`${fieldId}-color`}
            >
              Cor do evento
              <input
                aria-label="Cor do evento"
                className="size-10 cursor-pointer rounded-md border border-[#E2D6D1] bg-white p-1"
                id={`${fieldId}-color`}
                onChange={(input) => setColor(input.target.value)}
                type="color"
                value={color}
              />
              <span className="font-mono text-[#7A5A69] text-xs">{color}</span>
            </label>
            <label className="flex min-h-10 items-center gap-2 text-[#40222F] text-sm">
              <input
                checked={allDay}
                onChange={(input) => setAllDay(input.target.checked)}
                type="checkbox"
              />{" "}
              O dia todo
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
                Repetir
                <select
                  className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
                  disabled={Boolean(event?.occurrenceKey)}
                  onChange={(input) => setRecurrence(input.target.value)}
                  value={recurrence}
                >
                  <option value="NONE">Não repetir</option>
                  <option value="DAILY">Todos os dias</option>
                  <option value="WEEKLY">Toda semana</option>
                  <option value="MONTHLY">Todo mês</option>
                </select>
              </label>
              <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
                Lembrar
                <select
                  className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
                  onChange={(input) => setReminderMinutes(input.target.value)}
                  value={reminderMinutes}
                >
                  <option value="">Sem lembrete</option>
                  <option value="0">No início</option>
                  <option value="15">15 minutos antes</option>
                  <option value="60">1 hora antes</option>
                  <option value="1440">1 dia antes</option>
                </select>
              </label>
            </div>
            {recurrence !== "NONE" ? (
              <label
                className="grid gap-1.5 font-medium text-[#40222F] text-sm"
                htmlFor={`${fieldId}-recurrence-until`}
              >
                Repetir até (opcional)
                <Input
                  id={`${fieldId}-recurrence-until`}
                  onChange={(input) => setRecurrenceUntil(input.target.value)}
                  type="date"
                  value={recurrenceUntil.slice(0, 10)}
                />
              </label>
            ) : null}
            {event?.recurrence !== "NONE" && event?.occurrenceKey ? (
              <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
                Aplicar edição
                <select
                  className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
                  onChange={(input) =>
                    setScope(input.target.value as "occurrence" | "series")
                  }
                  value={scope}
                >
                  <option value="occurrence">Só nesta ocorrência</option>
                  <option value="series">Em toda a série</option>
                </select>
              </label>
            ) : null}
            <p className="text-[#7A5A69] text-xs">Fuso horário: {timezone}</p>
          </div>
          <DialogFooter className="mt-6 flex-row justify-end gap-2 sm:justify-end">
            {event ? (
              <>
                <Button
                  className="mr-auto"
                  onClick={() => onDelete(event)}
                  type="button"
                  variant="ghost"
                >
                  Excluir
                </Button>
                <Button
                  disabled={saving}
                  onClick={() => onDuplicate(event)}
                  type="button"
                  variant="outline"
                >
                  Duplicar
                </Button>
              </>
            ) : null}
            <Button onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? "Salvando…" : "Salvar evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlannerWorkspaceContent({
  data,
  selectedEventId,
  selectedEventOccurrence,
  selectedTaskId,
  selectedTaskOccurrence,
  view,
}: {
  readonly data: PlannerData;
  readonly selectedEventId: string | null;
  readonly selectedEventOccurrence: string | null;
  readonly selectedTaskId: string | null;
  readonly selectedTaskOccurrence: string | null;
  readonly view: PlannerView;
}) {
  const router = useRouter();
  const [currentData, setCurrentData] = useState(data);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  const [editingEvent, setEditingEvent] = useState<PlannerEvent | null>(null);
  const [newSubtaskParent, setNewSubtaskParent] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState("ALL");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [calendarFocusDate, setCalendarFocusDate] = useState(() =>
    dateFromKey(dateKeyInTimezone(new Date(), data.preferences.timezone))
  );
  const [calendarNow, setCalendarNow] = useState(() => new Date());
  const [calendarFeedUrl, setCalendarFeedUrl] = useState<string | null>(null);
  const [calendarFeedPending, setCalendarFeedPending] = useState(false);
  const calendarMonth = new Date(
    Date.UTC(
      calendarFocusDate.getUTCFullYear(),
      calendarFocusDate.getUTCMonth(),
      1
    )
  );
  const plannerLoadSequence = useRef(0);
  const [mobileBoardStatus, setMobileBoardStatus] =
    useState<TaskStatus>("TODO");
  const [draggedTask, setDraggedTask] = useState<{
    id: string;
    occurrenceAt?: string;
  } | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<PlannerTask | null>(
    null
  );
  const [deleteEventTarget, setDeleteEventTarget] =
    useState<PlannerEvent | null>(null);
  const [columnDraft, setColumnDraft] = useState<{
    status: TaskStatus;
    label: string;
    color: string;
  } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [enabledLayers, setEnabledLayers] = useState({
    tasks: true,
    events: true,
    meetings: true,
    cohortEvents: true,
    activities: true,
    lessonReleases: true,
    studySessions: true,
    goals: true,
  });

  useEffect(() => setCurrentData(data), [data]);

  useEffect(() => {
    const interval = window.setInterval(
      () => setCalendarNow(new Date()),
      60_000
    );
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (view === "tasks" && selectedTaskId) {
      const matchingTasks = currentData.tasks.filter(
        (item) => item.id === selectedTaskId
      );
      const task = selectedTaskOccurrence
        ? matchingTasks.find(
            (item) => item.occurrenceKey === selectedTaskOccurrence
          )
        : matchingTasks[0];
      if (task) {
        setEditingTask(task);
        setTaskDialogOpen(true);
      }
    }
    if (view === "calendar" && selectedEventId) {
      const matchingEvents = currentData.events.filter(
        (item) => item.id === selectedEventId
      );
      const event = selectedEventOccurrence
        ? matchingEvents.find(
            (item) => item.occurrenceKey === selectedEventOccurrence
          )
        : matchingEvents[0];
      if (event) {
        setEditingEvent(event);
        setEventDialogOpen(true);
      }
    }
  }, [
    currentData.events,
    currentData.tasks,
    selectedEventId,
    selectedEventOccurrence,
    selectedTaskId,
    selectedTaskOccurrence,
    view,
  ]);

  useEffect(() => {
    if (view !== "calendar") {
      return;
    }
    const monthFirst = new Date(
      Date.UTC(
        calendarFocusDate.getUTCFullYear(),
        calendarFocusDate.getUTCMonth(),
        1
      )
    );
    const firstDay = sundayFor(monthFirst);
    const monthGridEnd = addUtcDays(firstDay, 42);
    const visibleEnd = visibleCalendarEnd(
      calendarMode,
      calendarFocusDate,
      monthGridEnd
    );
    const dayAfterLast = visibleEnd > monthGridEnd ? visibleEnd : monthGridEnd;
    const start = localMidnightAtTimezone(
      firstDay,
      currentData.preferences.timezone
    );
    const end = new Date(
      localMidnightAtTimezone(
        dayAfterLast,
        currentData.preferences.timezone
      ).getTime() - 1
    );
    const sequence = ++plannerLoadSequence.current;
    loadPlannerAction({
      start: start.toISOString(),
      end: end.toISOString(),
    })
      .then((nextData) => {
        if (sequence === plannerLoadSequence.current) {
          setCurrentData(nextData);
        }
      })
      .catch(showError);
    return () => {
      plannerLoadSequence.current += 1;
    };
  }, [calendarFocusDate, calendarMode, currentData.preferences.timezone, view]);

  const columnFor = (status: TaskStatus) =>
    currentData.columns.find((column) => column.status === status);
  const refreshCurrentRoute = () => router.refresh();

  const createCalendarFeedLink = async () => {
    setCalendarFeedPending(true);
    try {
      const response = await fetch("/api/planner/calendar-feed", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as {
        token?: string;
        error?: string;
      };
      if (!(response.ok && payload.token)) {
        throw new Error(payload.error ?? "Não foi possível criar o link.");
      }
      const feedUrl = new URL(
        `/api/planner/calendar-feed?token=${encodeURIComponent(payload.token)}`,
        window.location.origin
      ).toString();
      setCalendarFeedUrl(feedUrl);
      toast.success("Link privado do calendário pronto para copiar.");
    } catch (error) {
      showError(error);
    } finally {
      setCalendarFeedPending(false);
    }
  };

  const copyCalendarFeedLink = async () => {
    if (!calendarFeedUrl) {
      return;
    }
    if (!navigator.clipboard?.writeText) {
      toast.info("Selecione o link para copiá-lo.");
      return;
    }
    try {
      await navigator.clipboard.writeText(calendarFeedUrl);
      toast.success("Link copiado.");
    } catch {
      toast.error("Selecione e copie o link acima.");
    }
  };

  const saveTask = async (input: Record<string, unknown>) => {
    setPending("task");
    try {
      if (typeof input.occurrenceAt === "string") {
        const { savePlannerTaskOccurrenceAction } = await import("./actions");
        await savePlannerTaskOccurrenceAction(input);
      } else {
        await savePlannerTaskAction(input);
      }
      toast.success(input.id ? "Tarefa atualizada." : "Tarefa criada.");
      refreshCurrentRoute();
    } catch (error) {
      showError(error);
      throw error;
    } finally {
      setPending(null);
    }
  };

  const updateTaskStatus = async (
    task: PlannerTask | { id: string; occurrenceKey?: string | null },
    status: TaskStatus
  ) => {
    setPending(`status:${task.id}`);
    try {
      await changePlannerTaskStatusAction({
        id: task.id,
        status,
        ...(task.occurrenceKey ? { occurrenceAt: task.occurrenceKey } : {}),
      });
      setCurrentData((previous) => ({
        ...previous,
        tasks: previous.tasks.map((item) =>
          item.id === task.id &&
          item.occurrenceKey === (task.occurrenceKey ?? null)
            ? {
                ...item,
                status,
                completedAt: status === "DONE" ? new Date() : null,
              }
            : item
        ),
      }));
      toast.success("Estado atualizado.");
    } catch (error) {
      showError(error);
    } finally {
      setPending(null);
    }
  };

  const deleteTask = async (scope: "occurrence" | "series") => {
    if (!deleteTaskTarget) {
      return;
    }
    const target = deleteTaskTarget;
    setPending(`delete:${target.id}`);
    try {
      await deletePlannerTaskAction({
        id: target.id,
        ...(scope === "occurrence" && target.occurrenceKey
          ? { occurrenceAt: target.occurrenceKey }
          : {}),
      });
      setCurrentData((previous) => ({
        ...previous,
        tasks:
          scope === "series" || !target.occurrenceKey
            ? previous.tasks.filter((task) => task.id !== target.id)
            : previous.tasks.filter(
                (task) =>
                  !(
                    task.id === target.id &&
                    task.occurrenceKey === target.occurrenceKey
                  )
              ),
      }));
      if (scope === "series" || !target.occurrenceKey) {
        toast.success("Tarefa removida.", {
          action: {
            label: "Desfazer",
            onClick: () => {
              restorePlannerTaskAction(target.id)
                .then(() => router.refresh())
                .catch(showError);
            },
          },
        });
      } else {
        toast.success("Ocorrência removida.");
      }
      setDeleteTaskTarget(null);
    } catch (error) {
      showError(error);
    } finally {
      setPending(null);
    }
  };

  const saveEvent = async (input: Record<string, unknown>) => {
    setPending("event");
    try {
      let savedEventId: string | null = null;
      const startsAt =
        typeof input.startsAt === "string" ? new Date(input.startsAt) : null;
      const endsAt =
        typeof input.endsAt === "string" ? new Date(input.endsAt) : null;
      const conflicts =
        startsAt && endsAt && endsAt > startsAt
          ? [
              ...currentData.events
                .filter(
                  (event) =>
                    event.id !== input.id ||
                    (typeof input.occurrenceStartsAt === "string" &&
                      event.occurrenceKey !== input.occurrenceStartsAt)
                )
                .filter(
                  (event) => startsAt < event.endsAt && endsAt > event.startsAt
                )
                .map((event) => event.title),
              ...currentData.meetings
                .filter(
                  (meeting) =>
                    startsAt <
                      (meeting.endsAt ??
                        new Date(meeting.startsAt.getTime() + 30 * 60_000)) &&
                    endsAt > meeting.startsAt
                )
                .map((meeting) => meeting.title),
              ...currentData.tasks
                .filter((task) => task.status !== "DONE" && task.dueAt)
                .filter(
                  (task) =>
                    task.dueAt && task.dueAt >= startsAt && task.dueAt < endsAt
                )
                .map((task) => task.title),
              ...currentData.activities
                .filter(
                  (activity) =>
                    activity.dueAt >= startsAt && activity.dueAt < endsAt
                )
                .map((activity) => activity.title),
            ].slice(0, 3)
          : [];
      if (typeof input.occurrenceStartsAt === "string") {
        const { savePlannerEventOccurrenceAction } = await import("./actions");
        const saved = await savePlannerEventOccurrenceAction(input);
        savedEventId = saved.id;
      } else {
        const saved = await savePlannerEventAction(input);
        savedEventId = saved.id;
      }
      if (!input.id && savedEventId) {
        toast.success("Evento criado.", {
          action: {
            label: "Desfazer",
            onClick: () => {
              deletePlannerEventAction({ id: savedEventId as string })
                .then(() => refreshCurrentRoute())
                .then(() => toast.info("Criação do evento desfeita."))
                .catch(showError);
            },
          },
        });
      } else {
        toast.success("Evento atualizado.");
      }
      if (conflicts.length) {
        toast.warning(
          `Conflito de horário com ${conflicts.join(", ")}. O evento foi salvo.`
        );
      }
      refreshCurrentRoute();
    } catch (error) {
      showError(error);
      throw error;
    } finally {
      setPending(null);
    }
  };

  const deleteEvent = async (scope: "occurrence" | "series") => {
    if (!deleteEventTarget) {
      return;
    }
    const target = deleteEventTarget;
    setPending(`delete-event:${target.id}`);
    try {
      await deletePlannerEventAction({
        id: target.id,
        ...(scope === "occurrence" && target.occurrenceKey
          ? { occurrenceAt: target.occurrenceKey }
          : {}),
      });
      setCurrentData((previous) => ({
        ...previous,
        events:
          scope === "series" || !target.occurrenceKey
            ? previous.events.filter((event) => event.id !== target.id)
            : previous.events.filter(
                (event) =>
                  !(
                    event.id === target.id &&
                    event.occurrenceKey === target.occurrenceKey
                  )
              ),
      }));
      toast.success(
        scope === "series" ? "Série de eventos removida." : "Evento removido."
      );
      setDeleteEventTarget(null);
    } catch (error) {
      showError(error);
    } finally {
      setPending(null);
    }
  };

  const visibleTasks = useMemo(() => {
    const now = Date.now();
    return currentData.tasks.filter((task) => {
      if (taskFilter === "OPEN") {
        return task.status !== "DONE";
      }
      if (taskFilter === "DONE") {
        return task.status === "DONE";
      }
      if (taskFilter === "OVERDUE") {
        return Boolean(
          task.dueAt && task.dueAt.getTime() < now && task.status !== "DONE"
        );
      }
      return true;
    });
  }, [currentData.tasks, taskFilter]);

  const taskCard = (task: PlannerTask, dense = false) => {
    const statusLabel = columnFor(task.status)?.label ?? "A fazer";
    return (
      <article
        className="rounded-lg border border-[#E2D6D1] bg-white p-4 shadow-[0_1px_2px_rgba(64,34,47,.04)]"
        key={`${task.id}:${task.occurrenceKey ?? "single"}`}
      >
        <div className="flex items-start gap-3">
          <button
            aria-label={`Arrastar tarefa ${task.title}`}
            className="mt-0.5 grid size-5 shrink-0 cursor-grab place-items-center rounded text-[#7A5A69] active:cursor-grabbing"
            draggable={view === "board"}
            onDragEnd={() => setDraggedTask(null)}
            onDragStart={(event) => {
              setDraggedTask({
                id: task.id,
                occurrenceAt: task.occurrenceKey ?? undefined,
              });
              event.dataTransfer.setData(
                "text/plain",
                `${task.id}|${task.occurrenceKey ?? ""}`
              );
              event.dataTransfer.effectAllowed = "move";
            }}
            title="Arraste para outra coluna"
            type="button"
          >
            <span aria-hidden="true">⠿</span>
          </button>
          <button
            aria-label={
              (task.status === "DONE" ? "Reabrir: " : "Concluir: ") + task.title
            }
            className={
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded border" +
              (task.status === "DONE"
                ? "border-[#8C1535] bg-[#8C1535] text-white"
                : "border-[#BFA9A3] bg-white text-transparent hover:border-[#8C1535]")
            }
            disabled={pending === `status:${task.id}`}
            onClick={() => {
              updateTaskStatus(task, task.status === "DONE" ? "TODO" : "DONE");
            }}
            type="button"
          >
            <CheckIcon aria-hidden="true" className="size-3" />
          </button>
          <div className="min-w-0 flex-1">
            <button
              className={
                "block max-w-full text-left font-medium text-[#40222F] hover:text-[#8C1535]" +
                (task.status === "DONE" ? "line-through opacity-70" : "")
              }
              onClick={() => {
                setEditingTask(task);
                setTaskDialogOpen(true);
              }}
              type="button"
            >
              {task.title}
            </button>
            {!dense && task.description ? (
              <p className="mt-1 line-clamp-2 text-[#7A5A69] text-sm">
                {task.description}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[#7A5A69] text-xs">
              <span
                className={`rounded-full border px-2 py-1${statusClass(task.status)}`}
              >
                {statusLabel}
              </span>
              <span
                className={`rounded-full px-2 py-1${priorityClass(task.priority)}`}
              >
                {priorityLabel(task.priority)}
              </span>
              <span>
                {dateLabel(task.dueAt, currentData.preferences.timezone)}
              </span>
              {task.recurrence !== "NONE" ? (
                <span className="rounded-full bg-[#F1EBE8] px-2 py-1">
                  Repetida
                </span>
              ) : null}
              {task.category ? <span>· {task.category}</span> : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1">
              {task.subtasks.map((subtask) => (
                <button
                  aria-label={
                    (subtask.status === "DONE"
                      ? "Reabrir subtarefa: "
                      : "Concluir subtarefa: ") + subtask.title
                  }
                  className={
                    "flex min-h-8 items-center gap-2 rounded px-2 text-xs hover:bg-[#F8F4F1]" +
                    (subtask.status === "DONE"
                      ? "text-[#7A5A69] line-through"
                      : "text-[#40222F]")
                  }
                  key={subtask.id}
                  onClick={() => {
                    updateTaskStatus(
                      { id: subtask.id },
                      subtask.status === "DONE" ? "TODO" : "DONE"
                    );
                  }}
                  type="button"
                >
                  <span
                    className={
                      "size-3 rounded-sm border" +
                      (subtask.status === "DONE"
                        ? "border-[#8C1535] bg-[#8C1535]"
                        : "border-[#BFA9A3] bg-white")
                    }
                  />
                  {subtask.title}
                </button>
              ))}
              <button
                className="min-h-8 rounded px-2 text-[#8C1535] text-xs hover:bg-[#FBF3F4]"
                hidden={dense}
                onClick={() => {
                  setEditingTask(null);
                  setNewSubtaskParent(task.id);
                  setTaskDialogOpen(true);
                }}
                type="button"
              >
                + Subtarefa
              </button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <label
              className={
                view === "board"
                  ? "grid gap-1 text-[#7A5A69] text-[10px]"
                  : "sr-only"
              }
            >
              Mover para
              <select
                aria-label={`Mover ${task.title} para um estado`}
                className={
                  view === "board"
                    ? "h-8 max-w-32 rounded-md border border-[#E2D6D1] bg-white px-2 text-[#40222F] text-xs"
                    : ""
                }
                onChange={(event) => {
                  updateTaskStatus(task, event.target.value as TaskStatus);
                }}
                value={task.status}
              >
                {taskStatusOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {columnFor(item.id)?.label ?? item.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              aria-label={`Duplicar ${task.title}`}
              className="size-8 text-[#7A5A69]"
              onClick={() => {
                duplicatePlannerTaskAction(task.id)
                  .then(() => router.refresh())
                  .catch(showError);
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <CopyIcon aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label={`Editar ${task.title}`}
              className="size-8 text-[#7A5A69]"
              onClick={() => {
                setEditingTask(task);
                setTaskDialogOpen(true);
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <PencilIcon aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label={`Excluir ${task.title}`}
              className="size-8 text-[#A8182A]"
              onClick={() => setDeleteTaskTarget(task)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Trash2Icon aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      </article>
    );
  };
  const eventFormSave = async (input: Record<string, unknown>) =>
    saveEvent(input);
  const duplicateEvent = async (event: PlannerEvent) => {
    setPending(`duplicate-event:${event.id}`);
    try {
      await duplicatePlannerEventAction(event.id);
      setEventDialogOpen(false);
      setEditingEvent(null);
      toast.success("Evento duplicado.");
      refreshCurrentRoute();
    } catch (error) {
      showError(error);
    } finally {
      setPending(null);
    }
  };
  const taskFormSave = async (input: Record<string, unknown>) =>
    saveTask(input);
  const eventEditor = (event: PlannerEvent | null, open: boolean) => (
    <EventEditorDialog
      event={event}
      onClose={() => {
        setEventDialogOpen(false);
        setEditingEvent(null);
      }}
      onDelete={(target) => {
        setDeleteEventTarget(target);
        setEventDialogOpen(false);
      }}
      onDuplicate={duplicateEvent}
      onSave={eventFormSave}
      open={open}
      timezone={currentData.preferences.timezone}
    />
  );

  const dateButtons = (direction: -1 | 1) => {
    setCalendarFocusDate((current) => {
      if (calendarMode === "month") {
        return new Date(
          Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth() + direction,
            1
          )
        );
      }
      if (calendarMode === "week") {
        return addUtcDays(current, direction * 7);
      }
      if (calendarMode === "list") {
        return addUtcDays(current, direction * 30);
      }
      return addUtcDays(current, direction);
    });
  };

  const calendarRecords = useMemo(() => {
    const timezone = currentData.preferences.timezone;
    const visibleStart = sundayFor(
      new Date(
        Date.UTC(
          calendarFocusDate.getUTCFullYear(),
          calendarFocusDate.getUTCMonth(),
          1
        )
      )
    );
    const visibleDays = 42;
    const visibleStartKey = localDateKey(visibleStart);
    const visibleEndKey = localDateKey(
      addUtcDays(visibleStart, visibleDays - 1)
    );
    const goalRecords = Array.from({ length: visibleDays }, (_, index) => {
      const date = addUtcDays(visibleStart, index);
      const dayKey = localDateKey(date);
      const lastDay = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
      ).getUTCDate();
      return currentData.goals.flatMap((goal) => {
        const periodEnds =
          (goal.period === "WEEKLY" && date.getUTCDay() === 0) ||
          (goal.period === "MONTHLY" && date.getUTCDate() === lastDay);
        if (!periodEnds) {
          return [];
        }
        return [
          {
            key: `goal:${goal.id}:${dayKey}`,
            dateKey: dayKey,
            startMinute: null,
            endMinute: null,
            kind: "goal" as const,
            title: goal.period === "WEEKLY" ? "Meta semanal" : "Meta mensal",
            goal,
          },
        ];
      });
    }).flat();
    return [
      ...(enabledLayers.tasks
        ? currentData.tasks.map((task) => ({
            key: `task:${task.id}:${task.occurrenceKey ?? "single"}`,
            dateKey: task.dueAt
              ? dateKeyInTimezone(task.dueAt, timezone)
              : null,
            startMinute: task.dueAt
              ? minutesAtTimezone(task.dueAt, timezone)
              : null,
            endMinute: null,
            kind: "task" as const,
            title: task.title,
            task,
          }))
        : []),
      ...(enabledLayers.events
        ? currentData.events.map((event) => {
            const startDateKey = dateKeyInTimezone(event.startsAt, timezone);
            let endMinute: number | null = null;
            if (!event.allDay && event.endsAt) {
              endMinute =
                dateKeyInTimezone(event.endsAt, timezone) === startDateKey
                  ? minutesAtTimezone(event.endsAt, timezone)
                  : 1440;
            }
            return {
              key: `event:${event.id}:${event.occurrenceKey}`,
              dateKey: startDateKey,
              startMinute: event.allDay
                ? null
                : minutesAtTimezone(event.startsAt, timezone),
              endMinute,
              kind: "event" as const,
              title: event.title,
              event,
            };
          })
        : []),
      ...(enabledLayers.meetings
        ? currentData.meetings.map((meeting) => {
            const endsAt =
              meeting.endsAt ??
              new Date(meeting.startsAt.getTime() + 30 * 60_000);
            return {
              key: `meeting:${meeting.id}:${meeting.occurrenceKey ?? meeting.startsAt.toISOString()}`,
              dateKey: dateKeyInTimezone(meeting.startsAt, timezone),
              startMinute: minutesAtTimezone(meeting.startsAt, timezone),
              endMinute:
                dateKeyInTimezone(endsAt, timezone) ===
                dateKeyInTimezone(meeting.startsAt, timezone)
                  ? minutesAtTimezone(endsAt, timezone)
                  : 1440,
              kind: "meeting" as const,
              title: meeting.title,
              meeting,
            };
          })
        : []),
      ...(enabledLayers.cohortEvents
        ? cohortEventCalendarRecords(
            currentData.cohortEvents,
            timezone,
            visibleStartKey,
            visibleEndKey
          )
        : []),
      ...(enabledLayers.activities
        ? currentData.activities.map((activity) => ({
            key: `activity:${activity.id}`,
            dateKey: dateKeyInTimezone(activity.dueAt, timezone),
            startMinute: minutesAtTimezone(activity.dueAt, timezone),
            endMinute: null,
            kind: "activity" as const,
            title: activity.title,
            activity,
          }))
        : []),
      ...(enabledLayers.lessonReleases
        ? currentData.lessonReleases.map((lessonRelease) => ({
            key: `lesson-release:${lessonRelease.id}`,
            dateKey: dateKeyInTimezone(lessonRelease.releaseAt, timezone),
            startMinute: minutesAtTimezone(lessonRelease.releaseAt, timezone),
            endMinute: null,
            kind: "lessonRelease" as const,
            title: lessonRelease.title,
            lessonRelease,
          }))
        : []),
      ...(enabledLayers.studySessions
        ? currentData.studySessions.map((studySession) => ({
            key: `study:${studySession.id}`,
            dateKey: dateKeyInTimezone(studySession.startedAt, timezone),
            startMinute: minutesAtTimezone(studySession.startedAt, timezone),
            endMinute: null,
            kind: "study" as const,
            title: studySession.title,
            studySession,
          }))
        : []),
      ...(enabledLayers.goals ? goalRecords : []),
    ];
  }, [
    calendarFocusDate,
    currentData.activities,
    currentData.cohortEvents,
    currentData.events,
    currentData.goals,
    currentData.lessonReleases,
    currentData.meetings,
    currentData.preferences.timezone,
    currentData.studySessions,
    currentData.tasks,
    enabledLayers,
  ]);

  const calendarWeekStart = sundayFor(calendarFocusDate);
  const calendarWeekDates = Array.from({ length: 7 }, (_, index) =>
    addUtcDays(calendarWeekStart, index)
  );
  const calendarDayLabel = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(
      date
    );
  let calendarHeading = monthLabel(calendarMonth);
  if (calendarMode === "week") {
    calendarHeading = `${calendarDayLabel(calendarWeekStart, { day: "numeric", month: "short" })}– ${calendarDayLabel(addUtcDays(calendarWeekStart, 6), { day: "numeric", month: "short", year: "numeric" })}`;
  } else if (calendarMode === "day") {
    calendarHeading = calendarDayLabel(calendarFocusDate, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } else if (calendarMode === "list") {
    calendarHeading = `Agenda · ${calendarDayLabel(calendarFocusDate, { day: "numeric", month: "short" })}– ${calendarDayLabel(addUtcDays(calendarFocusDate, 29), { day: "numeric", month: "short", year: "numeric" })}`;
  }
  let calendarStepLabel = "mês";
  if (calendarMode === "week") {
    calendarStepLabel = "semana";
  }
  if (calendarMode === "day") {
    calendarStepLabel = "dia";
  }
  if (calendarMode === "list") {
    calendarStepLabel = "30 dias";
  }
  const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
  const calendarTime = (date: Date | null) =>
    date
      ? new Intl.DateTimeFormat("pt-BR", {
          timeZone: currentData.preferences.timezone,
          hour: "2-digit",
          minute: "2-digit",
        }).format(date)
      : "--:--";
  const calendarRecordControl = (
    record: (typeof calendarRecords)[number],
    block?: CalendarBlockPlacement
  ) => {
    switch (record.kind) {
      case "task":
        return (
          <button
            className="block w-full truncate rounded-md bg-[#F7EEF0] px-2 py-1.5 text-left text-[#410230] text-xs hover:bg-[#F0E2E8]"
            key={record.key}
            onClick={() => {
              setEditingTask(record.task);
              setTaskDialogOpen(true);
            }}
            type="button"
          >
            <span className="font-medium">{record.title}</span>
            <CalendarTaskTime
              dueAt={record.task.dueAt}
              formatTime={calendarTime}
            />
          </button>
        );
      case "event":
        return (
          <button
            aria-label={`${record.title}, ${calendarTime(record.event.startsAt)} a ${calendarTime(record.event.endsAt)}`}
            className={calendarEventClass(block)}
            key={block?.key ?? record.key}
            onClick={() => {
              setEditingEvent(record.event);
              setEventDialogOpen(true);
            }}
            style={{ ...block?.style, borderLeftColor: record.event.color }}
            type="button"
          >
            <CalendarRecordTitle block={block} title={record.title} />
            <CalendarEventTime
              block={block}
              event={record.event}
              formatTime={calendarTime}
            />
          </button>
        );
      case "activity":
        return (
          <a
            className="block w-full truncate rounded-md bg-[#FCEBED] px-2 py-1.5 text-left text-[#A8182A] text-xs hover:bg-[#F9DDE1]"
            href={record.activity.href}
            key={record.key}
            title="Abrir atividade"
          >
            <span className="font-medium">{record.title}</span>
            <span className="ml-1">{calendarTime(record.activity.dueAt)}</span>
          </a>
        );
      case "lessonRelease":
        return (
          <a
            className="block w-full truncate rounded-md bg-[#EFF5F1] px-2 py-1.5 text-left text-[#456D58] text-xs hover:bg-[#E4EFE7]"
            href={record.lessonRelease.href}
            key={record.key}
            title="Abrir aula liberada"
          >
            <span className="font-medium">Aula liberada: {record.title}</span>
            <span className="ml-1">
              {calendarTime(record.lessonRelease.releaseAt)}
            </span>
          </a>
        );
      case "study":
        return (
          <a
            className="block w-full truncate rounded-md bg-[#F4EAE4] px-2 py-1.5 text-left text-[#8D5F46] text-xs hover:bg-[#EEDDD2]"
            href={record.studySession.href}
            key={record.key}
            title="Abrir origem da sessão de estudo"
          >
            <span className="font-medium">{record.title}</span>
            <span className="ml-1">
              {calendarTime(record.studySession.startedAt)} ·{" "}
              {Math.round(record.studySession.seconds / 60)} min
            </span>
          </a>
        );
      case "goal":
        return (
          <a
            className="block w-full truncate rounded-md bg-[#F5EAF0] px-2 py-1.5 text-left text-[#6A1A3A] text-xs hover:bg-[#EEDDE6]"
            href="/planejamento?view=goals"
            key={record.key}
            title={`${record.title} · ${record.goal.targetMinutes} minutos`}
          >
            <span className="font-medium">{record.title}</span>
            <span className="ml-1">
              Prazo · {record.goal.targetMinutes} min
            </span>
          </a>
        );
      case "meeting":
        return (
          <a
            aria-label={`${record.title}, ${calendarTime(record.meeting.startsAt)} a ${calendarTime(record.meeting.endsAt)}`}
            className={calendarMeetingClass(block)}
            href={record.meeting.joinUrl}
            key={block?.key ?? record.key}
            rel="noreferrer"
            style={block?.style}
            target="_blank"
            title="Encontro da comunidade"
          >
            <CalendarRecordTitle block={block} title={record.title} />
            <CalendarMeetingTime
              block={block}
              formatTime={calendarTime}
              meeting={record.meeting}
            />
          </a>
        );
      case "cohortEvent":
        return (
          <div
            className="block w-full truncate rounded-md border-[#6B5B64] border-l-2 bg-[#F1EBEE] px-2 py-1.5 text-left text-[#51424A] text-xs"
            key={record.key}
            title={record.cohortEvent.description ?? "Evento da turma"}
          >
            <span className="font-medium">{record.title}</span>
            {record.cohortEvent.allDay ? null : (
              <span className="ml-1">
                {calendarTime(record.cohortEvent.startsAt)}
              </span>
            )}
          </div>
        );
      default:
        return null;
    }
  };
  const calendarTimedBlock = (
    record: (typeof calendarRecords)[number],
    hour: number
  ) => {
    if (
      record.startMinute === null ||
      record.endMinute === null ||
      record.endMinute <= record.startMinute ||
      (record.kind !== "event" && record.kind !== "meeting")
    ) {
      return calendarRecordControl(record);
    }
    const hourStart = hour * 60;
    const hourEnd = hourStart + 60;
    const visibleStart = Math.max(record.startMinute, hourStart);
    const visibleEnd = Math.min(record.endMinute, hourEnd);
    if (visibleEnd <= visibleStart) {
      return null;
    }
    const startsInThisHour =
      record.startMinute >= hourStart && record.startMinute < hourEnd;
    return calendarRecordControl(record, {
      key: `${record.key}:hour-${hour}`,
      showLabel: startsInThisHour,
      style: {
        height: `${Math.max(18, (visibleEnd - visibleStart) * 0.8)}px`,
        left: "4px",
        right: "4px",
        top: `${(visibleStart - hourStart) * 0.8}px`,
      },
    });
  };
  const agendaRecords = calendarRecords
    .filter(
      (record) =>
        record.dateKey &&
        record.dateKey >= localDateKey(calendarFocusDate) &&
        record.dateKey < localDateKey(addUtcDays(calendarFocusDate, 30))
    )
    .sort(
      (left, right) =>
        (left.dateKey ?? "").localeCompare(right.dateKey ?? "") ||
        (left.startMinute ?? -1) - (right.startMinute ?? -1)
    );

  const activeTaskOccurrence = currentData.tasks.find(
    (task) =>
      task.id === editingTask?.id &&
      task.occurrenceKey === editingTask?.occurrenceKey
  );
  const activeEventOccurrence = currentData.events.find(
    (event) =>
      event.id === editingEvent?.id &&
      event.occurrenceKey === editingEvent?.occurrenceKey
  );

  const renderGoalCard = (period: "WEEKLY" | "MONTHLY") => {
    const goal = currentData.goals.find((item) => item.period === period);
    const minutes =
      period === "WEEKLY"
        ? currentData.stats.weeklyMinutes
        : currentData.stats.monthlyMinutes;
    const target = goal?.targetMinutes ?? 0;
    const percent =
      target > 0 ? Math.min(100, Math.round((minutes / target) * 100)) : 0;
    return (
      <article
        className="rounded-xl border border-[#E2D6D1] bg-white p-5 sm:p-6"
        key={period}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="brand-eyebrow text-[#8C1535]">
              Meta {period === "WEEKLY" ? "semanal" : "mensal"}
            </p>
            <h2 className="mt-2 font-display text-2xl text-[#40222F]">
              {minutes.toLocaleString("pt-BR")} min estudados
            </h2>
          </div>
          <span className="font-mono text-[#7A5A69] text-sm">
            {target > 0 ? `${percent}%` : "—"}
          </span>
        </div>
        <div
          aria-label={`${percent}% da meta alcançada`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percent}
          className="mt-5 h-2 overflow-hidden rounded-full bg-[#F1EBE8]"
          role="progressbar"
        >
          <span
            className="block h-full rounded-full bg-[#8C1535] transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const targetMinutes = Number(formData.get("targetMinutes"));
            savePlannerGoalAction({ period, targetMinutes })
              .then(() => {
                toast.success("Meta salva.");
                router.refresh();
              })
              .catch(showError);
          }}
        >
          <label
            className="grid gap-1 text-[#7A5A69] text-xs"
            htmlFor={`${period}-goal-minutes`}
          >
            Meta em minutos
            <Input
              className="w-36"
              defaultValue={goal?.targetMinutes ?? ""}
              id={`${period}-goal-minutes`}
              max={10_080}
              min={1}
              name="targetMinutes"
              placeholder="Definir"
              required
              type="number"
            />
          </label>
          <Button type="submit">
            {goal ? "Atualizar meta" : "Criar meta"}
          </Button>
        </form>
        {goal ? null : (
          <p className="mt-3 text-[#7A5A69] text-xs">
            A meta começa a contar apenas os minutos de estudo realmente salvos.
          </p>
        )}
      </article>
    );
  };

  const renderGoalsPanel = () => (
    <>
      {view === "goals" ? (
        <div>
          <div className="grid gap-4 lg:grid-cols-2">
            {(["WEEKLY", "MONTHLY"] as const).map(renderGoalCard)}
          </div>
          <section
            aria-labelledby="planner-progress-heading"
            className="mt-6 rounded-xl border border-[#E2D6D1] bg-[#F8F4F1] p-5 sm:p-6"
          >
            <p className="brand-eyebrow text-[#8C1535]">Progresso registrado</p>
            <h2
              className="mt-2 font-display text-2xl text-[#40222F]"
              id="planner-progress-heading"
            >
              O que você concluiu
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Aulas", currentData.stats.completedLessons],
                ["Atividades entregues", currentData.stats.submittedActivities],
                [
                  "Tarefas atribuídas concluídas",
                  currentData.stats.completedAssignedTasks,
                ],
                [
                  "Tarefas pessoais concluídas",
                  currentData.stats.completedPlannerTasks,
                ],
              ].map(([label, count]) => (
                <div
                  className="rounded-lg border border-[#E2D6D1] bg-white p-4"
                  key={label}
                >
                  <p className="text-[#7A5A69] text-sm">{label}</p>
                  <p className="mt-1 font-display text-3xl text-[#40222F]">
                    {count}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[#7A5A69] text-xs">
              Os totais vêm de registros persistidos de estudo, aulas,
              atividades e tarefas.
            </p>
          </section>
        </div>
      ) : null}
    </>
  );

  const renderTasksPanel = () => (
    <>
      {view === "tasks" ? (
        <section aria-labelledby="planner-tasks-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="brand-eyebrow text-[#8C1535]">Seu trabalho</p>
              <h2
                className="mt-1 font-display text-3xl text-[#40222F]"
                id="planner-tasks-heading"
              >
                Tarefas
              </h2>
            </div>
            <Button
              onClick={() => {
                setEditingTask(null);
                setNewSubtaskParent(null);
                setTaskDialogOpen(true);
              }}
              type="button"
            >
              <PlusIcon aria-hidden="true" className="size-4" /> Nova tarefa
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {[
              { id: "ALL", label: "Todas" },
              { id: "OPEN", label: "Em aberto" },
              { id: "OVERDUE", label: "Atrasadas" },
              { id: "DONE", label: "Concluídas" },
            ].map((filter) => (
              <button
                className={`rounded-full border px-4 py-2 text-sm ${taskFilter === filter.id ? "border-[#8C1535] bg-[#8C1535] text-white" : "border-[#E2D6D1] bg-white text-[#40222F] hover:bg-[#F8F4F1]"}`}
                key={filter.id}
                onClick={() => setTaskFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {visibleTasks.length ? (
              visibleTasks.map((task) => taskCard(task))
            ) : (
              <div className="rounded-xl border border-[#CDBBB5] border-dashed bg-white/70 px-5 py-12 text-center">
                <p className="font-display text-2xl text-[#40222F]">
                  Nenhuma tarefa nesta lista
                </p>
                <p className="mt-2 text-[#7A5A69] text-sm">
                  Crie uma tarefa para organizar seu próximo passo.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </>
  );

  const renderBoardPanel = () => (
    <>
      {view === "board" ? (
        <section aria-labelledby="planner-board-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="brand-eyebrow text-[#8C1535]">Quadro de tarefas</p>
              <h2
                className="mt-1 font-display text-3xl text-[#40222F]"
                id="planner-board-heading"
              >
                Seu fluxo
              </h2>
            </div>
            <Button
              onClick={() => {
                setEditingTask(null);
                setNewSubtaskParent(null);
                setTaskDialogOpen(true);
              }}
              type="button"
            >
              <PlusIcon aria-hidden="true" className="size-4" /> Nova tarefa
            </Button>
          </div>
          <label className="mt-4 grid gap-1 text-[#7A5A69] text-sm md:hidden">
            Coluna
            <select
              className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
              onChange={(event) =>
                setMobileBoardStatus(event.target.value as TaskStatus)
              }
              value={mobileBoardStatus}
            >
              {taskStatusOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {columnFor(item.id)?.label ?? item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {currentData.columns.map((column) => {
              const tasks = currentData.tasks.filter(
                (task) => task.status === column.status
              );
              return (
                <Fragment key={column.status}>
                  {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Native drop target complements the task state select used by keyboard and touch users. */}
                  <section
                    aria-label={column.label}
                    className={`min-h-72 rounded-xl border border-[#E2D6D1] bg-[#F8F4F1] p-3 md:block ${mobileBoardStatus === column.status ? "block" : "hidden"}`}
                    key={column.status}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const raw = event.dataTransfer.getData("text/plain");
                      const [id, occurrenceAt] = raw.split("|");
                      if (!id) {
                        return;
                      }
                      const dragged = currentData.tasks.find(
                        (task) =>
                          task.id === id &&
                          (task.occurrenceKey ?? "") === (occurrenceAt ?? "")
                      );
                      if (dragged) {
                        updateTaskStatus(dragged, column.status);
                      }
                      setDraggedTask(null);
                    }}
                  >
                    <header className="mb-3 flex items-center justify-between gap-2 px-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: column.color }}
                        />
                        <h3 className="truncate font-semibold text-[#40222F]">
                          {column.label}
                        </h3>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[#7A5A69] text-xs">
                          {tasks.length}
                        </span>
                      </div>
                      <Button
                        aria-label={`Editar coluna ${column.label}`}
                        className="size-8 text-[#7A5A69]"
                        onClick={() =>
                          setColumnDraft({
                            status: column.status,
                            label: column.label,
                            color: column.color,
                          })
                        }
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <PencilIcon aria-hidden="true" className="size-4" />
                      </Button>
                    </header>
                    <div className="space-y-3">
                      {tasks.map((task) => taskCard(task, true))}
                      {tasks.length === 0 ? (
                        <p className="rounded-lg border border-[#D9C9C3] border-dashed px-3 py-8 text-center text-[#7A5A69] text-xs">
                          Arraste um cartão ou crie uma tarefa.
                        </p>
                      ) : null}
                    </div>
                    <Button
                      className="mt-3 w-full justify-start text-[#8C1535]"
                      onClick={() => {
                        setEditingTask(null);
                        setNewSubtaskParent(null);
                        setTaskDialogOpen(true);
                      }}
                      type="button"
                      variant="ghost"
                    >
                      <PlusIcon aria-hidden="true" className="size-4" />{" "}
                      Adicionar tarefa
                    </Button>
                  </section>
                </Fragment>
              );
            })}
          </div>
          {draggedTask ? (
            <output aria-live="polite" className="sr-only">
              Cartão selecionado. Solte sobre uma coluna para alterar o estado.
            </output>
          ) : null}
        </section>
      ) : null}
    </>
  );

  const renderMonthCalendar = () => (
    <>
      {calendarMode === "month" && (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#E2D6D1] bg-white">
          <div className="grid grid-cols-7 border-[#E2D6D1] border-b bg-[#F8F4F1] text-center font-medium text-[#7A5A69] text-xs">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
              <div className="py-3" key={day}>
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 42 }, (_, index) => {
              const first = new Date(
                Date.UTC(
                  calendarMonth.getUTCFullYear(),
                  calendarMonth.getUTCMonth(),
                  1
                )
              );
              const sundayOffset = first.getUTCDay();
              const cellDate = new Date(
                Date.UTC(
                  first.getUTCFullYear(),
                  first.getUTCMonth(),
                  1 - sundayOffset + index
                )
              );
              const key = localDateKey(cellDate);
              const records = calendarRecords.filter(
                (record) => record.dateKey === key
              );
              const isCurrentMonth =
                cellDate.getUTCMonth() === calendarMonth.getUTCMonth();
              return (
                <div
                  className={`min-h-28 border-[#EFE7E3] border-r border-b p-1.5 sm:min-h-36 sm:p-2 ${isCurrentMonth ? "bg-white" : "bg-[#FCFAF9]"}`}
                  key={key}
                >
                  <button
                    aria-label={`Abrir ${calendarDayLabel(cellDate, { weekday: "long", day: "numeric", month: "long" })}`}
                    className={`mb-1 ml-auto block rounded px-1 text-right text-xs hover:bg-[#F8F4F1] ${isCurrentMonth ? "text-[#40222F]" : "text-[#BFA9A3]"}`}
                    onClick={() => {
                      setCalendarFocusDate(cellDate);
                      setCalendarMode("day");
                    }}
                    type="button"
                  >
                    {cellDate.getUTCDate()}
                  </button>
                  <div className="space-y-1">
                    {records
                      .slice(0, 3)
                      .map((record) => calendarRecordControl(record))}
                    {records.length > 3 ? (
                      <p className="px-1 text-[#7A5A69] text-[0.64rem]">
                        +{records.length - 3} mais
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  const renderAgendaCalendar = () => (
    <>
      {calendarMode === "list" && (
        <div className="mt-4 space-y-5">
          {agendaRecords.length ? (
            agendaRecords.map((record, index) => {
              const previousDate =
                index > 0 ? agendaRecords[index - 1]?.dateKey : null;
              return (
                <div key={record.key}>
                  {record.dateKey !== previousDate ? (
                    <h3 className="mt-5 mb-2 font-display text-[#40222F] text-lg capitalize">
                      {calendarDayLabel(dateFromKey(record.dateKey ?? ""), {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </h3>
                  ) : null}
                  {calendarRecordControl(record)}
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-[#CDBBB5] border-dashed bg-white px-5 py-12 text-center text-[#7A5A69]">
              Nada programado neste período.
            </p>
          )}
        </div>
      )}
    </>
  );

  const renderTimeGridCalendar = () => (
    <>
      {(calendarMode === "week" || calendarMode === "day") && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[#E2D6D1] bg-white">
          <div
            className={
              calendarMode === "week" ? "min-w-[980px]" : "min-w-[320px]"
            }
          >
            <div
              className={`sticky top-0 z-10 grid border-[#E2D6D1] border-b bg-[#F8F4F1] ${calendarMode === "week" ? "grid-cols-[64px_repeat(7,minmax(0,1fr))]" : "grid-cols-[64px_minmax(0,1fr)]"}`}
            >
              <div className="px-2 py-3 text-center text-[#7A5A69] text-[10px]">
                Fuso
              </div>
              {(calendarMode === "week"
                ? calendarWeekDates
                : [calendarFocusDate]
              ).map((date) => (
                <div
                  className="border-[#E2D6D1] border-l px-2 py-2 text-center"
                  key={localDateKey(date)}
                >
                  <span className="block text-[#7A5A69] text-[10px] uppercase">
                    {calendarDayLabel(date, { weekday: "short" })}
                  </span>
                  <span className="font-display text-[#40222F] text-lg">
                    {calendarDayLabel(date, {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
            <div
              className={`grid border-[#E2D6D1] border-b bg-[#FCFAF9] ${calendarMode === "week" ? "grid-cols-[64px_repeat(7,minmax(0,1fr))]" : "grid-cols-[64px_minmax(0,1fr)]"}`}
            >
              <div className="px-2 py-2 text-[#7A5A69] text-[10px]">
                Dia todo
              </div>
              {(calendarMode === "week"
                ? calendarWeekDates
                : [calendarFocusDate]
              ).map((date) => {
                const dayKey = localDateKey(date);
                const allDayRecords = calendarRecords.filter(
                  (record) =>
                    record.dateKey === dayKey && record.startMinute === null
                );
                return (
                  <div
                    className="min-h-10 space-y-1 border-[#EFE7E3] border-l p-1"
                    key={dayKey}
                  >
                    {allDayRecords.map((record) =>
                      calendarRecordControl(record)
                    )}
                  </div>
                );
              })}
            </div>
            {Array.from({ length: 16 }, (_, index) => index + 7).map((hour) => (
              <div
                className={`grid min-h-12 border-[#EFE7E3] border-b ${calendarMode === "week" ? "grid-cols-[64px_repeat(7,minmax(0,1fr))]" : "grid-cols-[64px_minmax(0,1fr)]"}`}
                key={hourLabel(hour)}
              >
                <div className="pt-1 pr-2 text-right font-mono text-[#947A83] text-[10px]">
                  {hourLabel(hour)}
                </div>
                {(calendarMode === "week"
                  ? calendarWeekDates
                  : [calendarFocusDate]
                ).map((date) => {
                  const dayKey = localDateKey(date);
                  const nowDayKey = dateKeyInTimezone(
                    calendarNow,
                    currentData.preferences.timezone
                  );
                  const nowMinutes = minutesAtTimezone(
                    calendarNow,
                    currentData.preferences.timezone
                  );
                  const nowHour = Math.floor(nowMinutes / 60);
                  const hourRecords = calendarRecords.filter((record) => {
                    if (
                      record.dateKey !== dayKey ||
                      record.startMinute === null
                    ) {
                      return false;
                    }
                    const hourStart = hour * 60;
                    const hourEnd = hourStart + 60;
                    return record.endMinute !== null &&
                      record.endMinute > record.startMinute
                      ? record.startMinute < hourEnd &&
                          record.endMinute > hourStart
                      : record.startMinute >= hourStart &&
                          record.startMinute < hourEnd;
                  });
                  return (
                    <div
                      className="relative h-12 border-[#EFE7E3] border-l p-1"
                      key={dayKey}
                    >
                      {hourRecords.map((record) =>
                        calendarTimedBlock(record, hour)
                      )}
                      {dayKey === nowDayKey &&
                      nowHour === hour &&
                      nowHour >= 7 &&
                      nowHour < 23 ? (
                        <div
                          aria-label={`Agora, ${calendarTime(calendarNow)}`}
                          className="pointer-events-none absolute inset-x-0 z-20 border-[#D62839] border-t-2"
                          role="img"
                          style={{ top: `${(nowMinutes % 60) * 0.8}px` }}
                        >
                          <span className="absolute -top-[5px] -left-1 size-2 rounded-full bg-[#D62839]" />
                          <span className="sr-only">Horário atual</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderMiniCalendar = () => {
    const monthStart = new Date(
      Date.UTC(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth(), 1)
    );
    const gridStart = sundayFor(monthStart);
    const layers = [
      { key: "meetings", label: "Encontros", color: "#8C1535" },
      {
        key: "cohortEvents",
        label: "Eventos da turma",
        color: "#6B5B64",
      },
      { key: "activities", label: "Atividades", color: "#D62839" },
      {
        key: "lessonReleases",
        label: "Aulas liberadas",
        color: "#456D58",
      },
      { key: "tasks", label: "Tarefas", color: "#410230" },
      {
        key: "studySessions",
        label: "Sessões de estudo",
        color: "#B0785A",
      },
      { key: "goals", label: "Metas", color: "#6A1A3A" },
      { key: "events", label: "Pessoais", color: "#7A5A69" },
    ] as const;
    const recordColors: Record<
      (typeof calendarRecords)[number]["kind"],
      string
    > = {
      meeting: "#8C1535",
      cohortEvent: "#6B5B64",
      activity: "#D62839",
      lessonRelease: "#456D58",
      task: "#410230",
      study: "#B0785A",
      goal: "#6A1A3A",
      event: "#7A5A69",
    };

    return (
      <aside className="hidden min-w-0 rounded-xl border border-[#E2D6D1] bg-white p-4 lg:block">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-[#40222F] text-lg capitalize">
            {monthLabel(calendarMonth)}
          </h3>
          <div className="flex items-center gap-1">
            <Button
              aria-label="Mês anterior"
              className="size-8"
              onClick={() =>
                setCalendarFocusDate(
                  new Date(
                    Date.UTC(
                      calendarMonth.getUTCFullYear(),
                      calendarMonth.getUTCMonth() - 1,
                      1
                    )
                  )
                )
              }
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronLeftIcon aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="Próximo mês"
              className="size-8"
              onClick={() =>
                setCalendarFocusDate(
                  new Date(
                    Date.UTC(
                      calendarMonth.getUTCFullYear(),
                      calendarMonth.getUTCMonth() + 1,
                      1
                    )
                  )
                )
              }
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronRightIcon aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-[#7A5A69] text-[10px]">
          {WEEKDAY_LABELS.map(({ key, label }) => (
            <span key={key}>{label}</span>
          ))}
          {Array.from({ length: 42 }, (_, index) => {
            const date = addUtcDays(gridStart, index);
            const key = localDateKey(date);
            const dayRecords = calendarRecords.filter(
              (record) => record.dateKey === key
            );
            const colors = [
              ...new Set(
                dayRecords.map((record) =>
                  record.kind === "event"
                    ? record.event.color
                    : recordColors[record.kind]
                )
              ),
            ].slice(0, 3);
            const isCurrentMonth =
              date.getUTCMonth() === calendarMonth.getUTCMonth();
            const isToday =
              key ===
              dateKeyInTimezone(calendarNow, currentData.preferences.timezone);
            return (
              <button
                aria-label={`${calendarDayLabel(date, { weekday: "long", day: "numeric", month: "long" })}${dayRecords.length ? `, ${dayRecords.length} itens` : ""}`}
                aria-pressed={key === localDateKey(calendarFocusDate)}
                className={`relative mx-auto grid size-8 place-items-center rounded-full text-xs ${calendarDayButtonClass(key === localDateKey(calendarFocusDate), isToday, isCurrentMonth)}`}
                key={key}
                onClick={() => setCalendarFocusDate(date)}
                type="button"
              >
                {date.getUTCDate()}
                {colors.length ? (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 flex gap-0.5"
                  >
                    {colors.map((color) => (
                      <span
                        className="size-1 rounded-full"
                        key={color}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <h4 className="mt-5 border-[#EEE6E2] border-t pt-4 font-medium text-[#40222F] text-sm">
          Camadas
        </h4>
        <div className="mt-2 grid gap-2">
          {layers.map((layer) => (
            <label
              className="inline-flex min-h-8 items-center gap-2 text-[#40222F] text-sm"
              key={layer.key}
            >
              <input
                checked={enabledLayers[layer.key]}
                onChange={(event) =>
                  setEnabledLayers((current) => ({
                    ...current,
                    [layer.key]: event.target.checked,
                  }))
                }
                style={{ accentColor: layer.color }}
                type="checkbox"
              />
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: layer.color }}
              />
              {layer.label}
            </label>
          ))}
        </div>
        <div className="mt-4 border-[#EEE6E2] border-t pt-4">
          <Button
            className="w-full justify-start text-left"
            disabled={calendarFeedPending}
            onClick={createCalendarFeedLink}
            type="button"
            variant="outline"
          >
            <CopyIcon aria-hidden="true" className="size-4" />
            {calendarFeedPending
              ? "Criando link…"
              : "Assinar calendário (.ics)"}
          </Button>
          <p className="mt-2 text-[#7A5A69] text-xs leading-relaxed">
            Link privado com eventos e prazos do seu calendário. Criar outro
            link revoga o anterior.
          </p>
          {calendarFeedUrl ? (
            <div className="mt-3 grid gap-2">
              <Input
                aria-label="Link privado para assinar o calendário"
                className="text-xs"
                onFocus={(event) => event.currentTarget.select()}
                readOnly
                value={calendarFeedUrl}
              />
              <div className="flex gap-2">
                <Button
                  className="min-h-9 flex-1"
                  onClick={copyCalendarFeedLink}
                  type="button"
                  variant="outline"
                >
                  Copiar link
                </Button>
                <a
                  className="inline-flex min-h-9 items-center rounded-md bg-[#8C1535] px-3 font-medium text-sm text-white hover:bg-[#74102C]"
                  href={calendarFeedUrl.replace(HTTP_SCHEME_PATTERN, "webcal:")}
                >
                  Assinar
                </a>
              </div>
            </div>
          ) : null}
        </div>
        <p className="mt-4 border-[#EEE6E2] border-t pt-3 text-[#7A5A69] text-xs">
          Fuso: {currentData.preferences.timezone}
        </p>
      </aside>
    );
  };

  const renderCalendarPanel = () => (
    <>
      {view === "calendar" ? (
        <section aria-labelledby="planner-calendar-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="brand-eyebrow text-[#8C1535]">Sua agenda pessoal</p>
              <h2
                className="mt-1 font-display text-3xl text-[#40222F] capitalize"
                id="planner-calendar-heading"
              >
                Calendário
              </h2>
            </div>
            <Button
              onClick={() => {
                setEditingEvent(null);
                setEventDialogOpen(true);
              }}
              type="button"
            >
              <PlusIcon aria-hidden="true" className="size-4" /> Novo evento
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                aria-label={`Anterior: ${calendarStepLabel}`}
                className="size-10"
                onClick={() => dateButtons(-1)}
                size="icon"
                variant="outline"
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
              <span
                aria-live="polite"
                className="min-w-52 text-center font-display text-[#40222F] text-xl capitalize"
              >
                {calendarHeading}
              </span>
              <Button
                aria-label={`Próximo: ${calendarStepLabel}`}
                className="size-10"
                onClick={() => dateButtons(1)}
                size="icon"
                variant="outline"
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
              <Button
                className="min-h-10 px-3 text-sm"
                onClick={() =>
                  setCalendarFocusDate(
                    dateFromKey(
                      dateKeyInTimezone(
                        new Date(),
                        currentData.preferences.timezone
                      )
                    )
                  )
                }
                type="button"
                variant="outline"
              >
                Hoje
              </Button>
            </div>
            <div
              aria-label="Visão do calendário"
              className="flex flex-wrap gap-1"
              role="toolbar"
            >
              {(
                [
                  { id: "month", label: "Mês" },
                  { id: "week", label: "Semana" },
                  { id: "day", label: "Dia" },
                  { id: "list", label: "Agenda" },
                ] as const
              ).map((item) => (
                <button
                  aria-pressed={calendarMode === item.id}
                  className={`rounded-md border px-3 py-2 text-sm ${calendarMode === item.id ? "border-[#8C1535] bg-[#8C1535] text-white" : "border-[#E2D6D1] bg-white text-[#40222F]"}`}
                  key={item.id}
                  onClick={() => setCalendarMode(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
            {renderMiniCalendar()}
            <div className="min-w-0">
              <div className="flex flex-wrap gap-3 border-[#E2D6D1] border-y py-3 lg:hidden">
                {(
                  [
                    { key: "meetings", label: "Encontros", color: "#8C1535" },
                    {
                      key: "cohortEvents",
                      label: "Eventos da turma",
                      color: "#6B5B64",
                    },
                    {
                      key: "activities",
                      label: "Atividades",
                      color: "#D62839",
                    },
                    {
                      key: "lessonReleases",
                      label: "Aulas liberadas",
                      color: "#456D58",
                    },
                    { key: "tasks", label: "Tarefas", color: "#410230" },
                    {
                      key: "studySessions",
                      label: "Sessões de estudo",
                      color: "#B0785A",
                    },
                    { key: "goals", label: "Metas", color: "#6A1A3A" },
                    { key: "events", label: "Pessoais", color: "#7A5A69" },
                  ] as const
                ).map((layer) => (
                  <label
                    className="inline-flex min-h-8 items-center gap-2 text-[#40222F] text-sm"
                    key={layer.key}
                  >
                    <input
                      checked={enabledLayers[layer.key]}
                      onChange={(event) =>
                        setEnabledLayers((current) => ({
                          ...current,
                          [layer.key]: event.target.checked,
                        }))
                      }
                      style={{ accentColor: layer.color }}
                      type="checkbox"
                    />
                    {layer.label}
                  </label>
                ))}
                <span className="ml-auto self-center text-[#7A5A69] text-xs">
                  Fuso: {currentData.preferences.timezone}
                </span>
              </div>
              <div className="mt-3 grid gap-2 lg:hidden">
                <Button
                  className="justify-start"
                  disabled={calendarFeedPending}
                  onClick={createCalendarFeedLink}
                  type="button"
                  variant="outline"
                >
                  <CopyIcon aria-hidden="true" className="size-4" />
                  {calendarFeedPending
                    ? "Criando link…"
                    : "Assinar calendário (.ics)"}
                </Button>
                {calendarFeedUrl ? (
                  <div className="grid gap-2">
                    <Input
                      aria-label="Link privado para assinar o calendário"
                      onFocus={(event) => event.currentTarget.select()}
                      readOnly
                      value={calendarFeedUrl}
                    />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={copyCalendarFeedLink}
                        type="button"
                        variant="outline"
                      >
                        Copiar link
                      </Button>
                      <a
                        className="inline-flex min-h-9 items-center rounded-md bg-[#8C1535] px-3 font-medium text-sm text-white"
                        href={calendarFeedUrl.replace(
                          HTTP_SCHEME_PATTERN,
                          "webcal:"
                        )}
                      >
                        Assinar
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
              {renderMonthCalendar()}
              {renderAgendaCalendar()}
              {renderTimeGridCalendar()}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );

  return (
    <section className="mt-8 space-y-6">
      {renderGoalsPanel()}

      {renderTasksPanel()}

      {renderBoardPanel()}

      {renderCalendarPanel()}

      <TaskEditorDialog
        onClose={() => {
          setTaskDialogOpen(false);
          setEditingTask(null);
          setNewSubtaskParent(null);
        }}
        onSave={taskFormSave}
        open={taskDialogOpen}
        parentTaskId={newSubtaskParent}
        task={activeTaskOccurrence ?? editingTask}
        timezone={currentData.preferences.timezone}
      />
      {eventEditor(activeEventOccurrence ?? editingEvent, eventDialogOpen)}

      <Dialog
        onOpenChange={(open) => !open && setDeleteTaskTarget(null)}
        open={Boolean(deleteTaskTarget)}
      >
        <DialogContent className="max-w-md border-[#E2D6D1] bg-[#F8F4F1]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#40222F]">
              Excluir tarefa?
            </DialogTitle>
            <DialogDescription>
              Você poderá desfazer a exclusão da tarefa inteira logo depois.
            </DialogDescription>
          </DialogHeader>
          <p className="text-[#7A5A69] text-sm">{deleteTaskTarget?.title}</p>
          <DialogFooter className="flex-row flex-wrap justify-end gap-2 sm:justify-end">
            <Button
              onClick={() => setDeleteTaskTarget(null)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            {deleteTaskTarget?.recurrence !== "NONE" &&
            deleteTaskTarget?.occurrenceKey ? (
              <Button
                disabled={pending?.startsWith("delete:")}
                onClick={() => {
                  deleteTask("occurrence");
                }}
                type="button"
                variant="outline"
              >
                Só esta ocorrência
              </Button>
            ) : null}
            <Button
              disabled={pending?.startsWith("delete:")}
              onClick={() => {
                deleteTask("series");
              }}
              type="button"
            >
              {deleteTaskTarget?.recurrence !== "NONE" &&
              deleteTaskTarget?.occurrenceKey
                ? "Toda a série"
                : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => !open && setDeleteEventTarget(null)}
        open={Boolean(deleteEventTarget)}
      >
        <DialogContent className="max-w-md border-[#E2D6D1] bg-[#F8F4F1]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#40222F]">
              Excluir evento?
            </DialogTitle>
            <DialogDescription>
              Esta ação será confirmada antes de remover o evento do calendário.
            </DialogDescription>
          </DialogHeader>
          <p className="text-[#7A5A69] text-sm">{deleteEventTarget?.title}</p>
          <DialogFooter className="flex-row flex-wrap justify-end gap-2 sm:justify-end">
            <Button
              onClick={() => setDeleteEventTarget(null)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            {deleteEventTarget?.recurrence !== "NONE" &&
            deleteEventTarget?.occurrenceKey ? (
              <Button
                disabled={pending?.startsWith("delete-event:")}
                onClick={() => {
                  deleteEvent("occurrence");
                }}
                type="button"
                variant="outline"
              >
                Só esta ocorrência
              </Button>
            ) : null}
            <Button
              disabled={pending?.startsWith("delete-event:")}
              onClick={() => {
                deleteEvent("series");
              }}
              type="button"
            >
              {deleteEventTarget?.recurrence !== "NONE" &&
              deleteEventTarget?.occurrenceKey
                ? "Toda a série"
                : "Excluir evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => !open && setColumnDraft(null)}
        open={Boolean(columnDraft)}
      >
        <DialogContent className="max-w-md border-[#E2D6D1] bg-[#F8F4F1]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#40222F]">
              Editar coluna
            </DialogTitle>
            <DialogDescription>
              Os três estados permanecem fixos; personalize o nome e a cor.
            </DialogDescription>
          </DialogHeader>
          {columnDraft ? (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                savePlannerColumnAction(columnDraft)
                  .then((column) => {
                    setCurrentData((previous) => ({
                      ...previous,
                      columns: previous.columns.map((item) =>
                        item.status === column.status
                          ? {
                              ...item,
                              label: column.label,
                              color: column.color,
                            }
                          : item
                      ),
                    }));
                    setColumnDraft(null);
                    toast.success("Coluna atualizada.");
                  })
                  .catch(showError);
              }}
            >
              <label className="grid gap-1.5 text-sm">
                Nome
                <input
                  className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
                  maxLength={40}
                  onChange={(event) =>
                    setColumnDraft({
                      ...columnDraft,
                      label: event.target.value,
                    })
                  }
                  required
                  value={columnDraft.label}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                Cor
                <input
                  className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
                  onChange={(event) =>
                    setColumnDraft({
                      ...columnDraft,
                      color: event.target.value,
                    })
                  }
                  pattern="^#[0-9a-fA-F]{6}$"
                  required
                  value={columnDraft.color}
                />
              </label>
              <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
                <Button
                  onClick={() => setColumnDraft(null)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button type="submit">Salvar coluna</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export const PlannerWorkspace = (props: {
  readonly data: PlannerData;
  readonly selectedEventId: string | null;
  readonly selectedEventOccurrence: string | null;
  readonly selectedTaskId: string | null;
  readonly selectedTaskOccurrence: string | null;
  readonly view: string;
}) => (
  <PlannerWorkspaceContent
    data={props.data}
    selectedEventId={props.selectedEventId}
    selectedEventOccurrence={props.selectedEventOccurrence}
    selectedTaskId={props.selectedTaskId}
    selectedTaskOccurrence={props.selectedTaskOccurrence}
    view={props.view as PlannerView}
  />
);
