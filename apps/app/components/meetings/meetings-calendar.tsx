"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

export interface CalendarMeeting {
  readonly course: { readonly title: string; readonly slug: string } | null;
  readonly description: string | null;
  readonly endsAt: string | null;
  readonly id: string;
  readonly joinUrl: string;
  readonly kind: string;
  readonly recordingUrl: string | null;
  readonly relatedActivity: {
    readonly title: string;
    readonly slug: string;
  } | null;
  readonly relatedLibraryItem: { readonly title: string } | null;
  readonly startsAt: string;
  readonly timezone: string;
  readonly title: string;
}

interface MeetingsCalendarProperties {
  readonly meetings: readonly CalendarMeeting[];
}

const kindLabels: Record<string, string> = {
  INDIVIDUAL: "Mentoria individual",
  LESSON: "Aula",
  GROUP: "Encontro em grupo",
  WORKSHOP: "Workshop",
  FEEDBACK: "Sessão de feedback",
  OTHER: "Encontro",
};

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const startOfWeek = (date: Date) => {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(0, 0, 0, 0);
  return result;
};

const formatTime = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));

const formatDate = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));

export const MeetingsCalendar = ({ meetings }: MeetingsCalendarProperties) => {
  const today = new Date();
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(
    new Date(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const [selected, setSelected] = useState<CalendarMeeting | null>(null);

  const days = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return day;
      });
    }

    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [anchor, view]);

  const meetingsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarMeeting[]>();
    for (const meeting of meetings) {
      const key = dateKey(new Date(meeting.startsAt));
      grouped.set(key, [...(grouped.get(key) ?? []), meeting]);
    }
    return grouped;
  }, [meetings]);

  const shift = (amount: number) => {
    const next = new Date(anchor);
    if (view === "week") {
      next.setDate(next.getDate() + amount * 7);
    } else {
      next.setMonth(next.getMonth() + amount);
    }
    setAnchor(next);
    setSelected(null);
  };

  const heading =
    view === "week"
      ? `${days[0]?.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} — ${days[6]?.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`
      : anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <section aria-labelledby="calendar-heading" className="mt-14">
      <div className="flex flex-col gap-4 border-border border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="brand-eyebrow">Agenda viva</p>
          <h2 className="mt-2 font-display text-3xl" id="calendar-heading">
            {heading}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setAnchor(new Date())}
            size="sm"
            variant="outline"
          >
            Hoje
          </Button>
          <Button
            aria-label="Período anterior"
            onClick={() => shift(-1)}
            size="icon"
            variant="ghost"
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            aria-label="Próximo período"
            onClick={() => shift(1)}
            size="icon"
            variant="ghost"
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
          <div className="flex rounded-sm border p-1">
            <Button
              onClick={() => setView("month")}
              size="sm"
              variant={view === "month" ? "default" : "ghost"}
            >
              Mês
            </Button>
            <Button
              onClick={() => setView("week")}
              size="sm"
              variant={view === "week" ? "default" : "ghost"}
            >
              Semana
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-sm border bg-background">
        <div className="grid grid-cols-7 border-border border-b bg-muted/30">
          {(["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const).map(
            (label) => (
              <div
                className="px-2 py-2 text-center font-data text-[10px] text-muted-foreground uppercase tracking-[0.16em] sm:px-3"
                key={label}
              >
                {label}
              </div>
            )
          )}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayMeetings = meetingsByDay.get(dateKey(day)) ?? [];
            const isToday = dateKey(day) === dateKey(today);
            const isCurrentMonth = day.getMonth() === anchor.getMonth();
            return (
              <div
                className={`min-h-24 border-border border-r border-b p-1.5 sm:min-h-32 sm:p-2 ${isCurrentMonth ? "" : "bg-muted/10 text-muted-foreground/50"}`}
                key={dateKey(day)}
              >
                <div
                  className={`mb-1 flex size-6 items-center justify-center rounded-full font-data text-xs ${isToday ? "bg-brand-structural text-primary-foreground" : ""}`}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayMeetings.map((meeting) => (
                    <button
                      className="block w-full rounded-sm border border-brand-action/25 bg-brand-action/10 px-1.5 py-1 text-left text-[10px] leading-tight transition-colors hover:bg-brand-action/20 sm:text-xs"
                      key={meeting.id}
                      onClick={() => setSelected(meeting)}
                      type="button"
                    >
                      <span className="font-data text-[9px] text-brand-structural sm:text-[10px]">
                        {formatTime(meeting.startsAt, meeting.timezone)}
                      </span>
                      <span className="mt-0.5 block truncate font-medium">
                        {meeting.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected ? (
        <div className="paper-surface mt-5 border border-brand-structural/30 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="brand-eyebrow">
                {kindLabels[selected.kind] ?? "Encontro"}
              </p>
              <h3 className="mt-2 font-display text-3xl">{selected.title}</h3>
            </div>
            <Button
              aria-label="Fechar detalhe"
              onClick={() => setSelected(null)}
              size="icon"
              variant="ghost"
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-4 font-data text-brand-structural text-sm">
            {formatDate(selected.startsAt, selected.timezone)}
            {selected.endsAt
              ? ` — ${formatTime(selected.endsAt, selected.timezone)}`
              : ""}
          </p>
          {selected.description ? (
            <p className="mt-4 max-w-2xl whitespace-pre-wrap text-muted-foreground leading-7">
              {selected.description}
            </p>
          ) : null}
          {selected.course ? (
            <p className="mt-4 text-muted-foreground text-sm">
              Percurso: {selected.course.title}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild size="sm">
              <a href={selected.joinUrl} rel="noreferrer" target="_blank">
                Abrir acesso
              </a>
            </Button>
            {selected.recordingUrl ? (
              <Button asChild size="sm" variant="outline">
                <a
                  href={selected.recordingUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Ver gravação
                </a>
              </Button>
            ) : null}
            {selected.relatedActivity ? (
              <Button asChild size="sm" variant="ghost">
                <a href={`/atividades/${selected.relatedActivity.slug}`}>
                  Atividade relacionada
                </a>
              </Button>
            ) : null}
            {selected.relatedLibraryItem ? (
              <span className="self-center text-muted-foreground text-sm">
                Leitura: {selected.relatedLibraryItem.title}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
