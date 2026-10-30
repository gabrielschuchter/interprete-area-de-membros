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
import type { FormEvent } from "react";
import { useEffect, useId, useState } from "react";
import type { getPlannerDashboard } from "@/lib/planner";

type PlannerData = Awaited<ReturnType<typeof getPlannerDashboard>>;
type PlannerTask = PlannerData["tasks"][number];
type PlannerEvent = PlannerData["events"][number];
type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

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
export function TaskEditorDialog({
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
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

export function EventEditorDialog({
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

  const submit = async (formEvent: FormEvent<HTMLFormElement>) => {
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
