"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ExternalLinkIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  CommunityCalendarCategory,
  CommunityCalendarEntry,
} from "@/lib/community-meetings-calendar-domain";

export interface CommunityCalendarDay {
  readonly inMonth: boolean;
  readonly isToday: boolean;
  readonly key: string;
}

interface CommunityMeetingsCalendarProperties {
  readonly categories: readonly {
    readonly id: CommunityCalendarCategory;
    readonly label: string;
  }[];
  readonly days: readonly CommunityCalendarDay[];
  readonly entries: readonly CommunityCalendarEntry[];
  readonly monthLabel: string;
  readonly nextHref: string;
  readonly previousHref: string;
  readonly timezone: string;
  readonly todayHref: string;
}

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const maxChips = 3;

const dayNumber = (key: string) => Number(key.slice(8, 10));

const dayHeading = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${key}T12:00:00Z`));

const timeLabel = (entry: CommunityCalendarEntry, timezone: string) => {
  if (entry.allDay) {
    return "Dia todo";
  }
  const format = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(value));
  return entry.endsAt
    ? `${format(entry.startsAt)}–${format(entry.endsAt)}`
    : format(entry.startsAt);
};

const fullDateLabel = (entry: CommunityCalendarEntry, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  }).format(new Date(entry.startsAt));

const EntryActions = ({ entry }: { readonly entry: CommunityCalendarEntry }) =>
  entry.joinUrl || entry.href ? (
    <div className="cmc-actions">
      {entry.joinUrl ? (
        <a
          className="cmc-button cmc-button--primary"
          href={entry.joinUrl}
          rel="noreferrer"
          target="_blank"
        >
          Entrar <ExternalLinkIcon aria-hidden="true" />
        </a>
      ) : null}
      {entry.href ? (
        <Link className="cmc-button" href={entry.href} prefetch={false}>
          Ver detalhes
        </Link>
      ) : null}
    </div>
  ) : null;

const EntryDetail = ({
  entry,
  timezone,
}: {
  readonly entry: CommunityCalendarEntry;
  readonly timezone: string;
}) => (
  <div className="cmc-detail" data-category={entry.category}>
    <p className="cmc-detail__kind">
      <span aria-hidden="true" className="cmc-dot" />
      {entry.kindLabel}
      {entry.registered ? (
        <span className="cmc-registered">
          <CheckIcon aria-hidden="true" /> Você está inscrito
        </span>
      ) : null}
    </p>
    <h3 className="cmc-detail__title">{entry.title}</h3>
    <p className="cmc-detail__when">
      <ClockIcon aria-hidden="true" />
      <span className="first-letter:uppercase">
        {fullDateLabel(entry, timezone)}
      </span>
      {" · "}
      {timeLabel(entry, timezone)}
    </p>
    {entry.courseTitle ? (
      <p className="cmc-detail__meta">Curso: {entry.courseTitle}</p>
    ) : null}
    {entry.description ? (
      <p className="cmc-detail__description">{entry.description}</p>
    ) : null}
    <EntryActions entry={entry} />
  </div>
);

export const CommunityMeetingsCalendar = ({
  categories,
  days,
  entries,
  monthLabel,
  nextHref,
  previousHref,
  timezone,
  todayHref,
}: CommunityMeetingsCalendarProperties) => {
  const [hidden, setHidden] = useState<ReadonlySet<CommunityCalendarCategory>>(
    () => new Set()
  );
  const visibleEntries = useMemo(
    () => entries.filter((entry) => !hidden.has(entry.category)),
    [entries, hidden]
  );
  const entriesByDay = useMemo(() => {
    const grouped = new Map<string, CommunityCalendarEntry[]>();
    for (const entry of visibleEntries) {
      for (const key of entry.dateKeys) {
        grouped.set(key, [...(grouped.get(key) ?? []), entry]);
      }
    }
    return grouped;
  }, [visibleEntries]);
  const counts = useMemo(() => {
    const result = new Map<CommunityCalendarCategory, number>();
    for (const entry of entries) {
      result.set(entry.category, (result.get(entry.category) ?? 0) + 1);
    }
    return result;
  }, [entries]);

  const defaultDay =
    days.find((day) => day.isToday && day.inMonth)?.key ??
    days.find((day) => day.inMonth && entriesByDay.has(day.key))?.key ??
    days.find((day) => day.inMonth)?.key ??
    null;
  const [selectedDay, setSelectedDay] = useState<string | null>(defaultDay);
  const activeDay = selectedDay ?? defaultDay;
  const dayEntries = activeDay ? (entriesByDay.get(activeDay) ?? []) : [];

  const toggleCategory = (id: CommunityCalendarCategory) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <section aria-labelledby="cmc-month" className="cmc">
      <div className="cmc-toolbar">
        <div className="cmc-nav">
          <Link
            aria-label="Mês anterior"
            className="cmc-icon-button"
            href={previousHref}
            prefetch={false}
            scroll={false}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Link>
          <h2 className="cmc-month" id="cmc-month">
            {monthLabel}
          </h2>
          <Link
            aria-label="Próximo mês"
            className="cmc-icon-button"
            href={nextHref}
            prefetch={false}
            scroll={false}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Link>
          <Link
            className="cmc-button"
            href={todayHref}
            prefetch={false}
            scroll={false}
          >
            Hoje
          </Link>
        </div>
        <fieldset className="cmc-legend">
          <legend className="sr-only">Mostrar no calendário</legend>
          {categories.map((category) => (
            <button
              aria-pressed={!hidden.has(category.id)}
              className="cmc-legend__item"
              data-category={category.id}
              key={category.id}
              onClick={() => toggleCategory(category.id)}
              type="button"
            >
              <span aria-hidden="true" className="cmc-dot" />
              {category.label}
              <span className="cmc-legend__count">
                {counts.get(category.id) ?? 0}
              </span>
            </button>
          ))}
        </fieldset>
      </div>

      <div className="cmc-grid">
        <div aria-hidden="true" className="cmc-weekdays">
          {weekdays.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <ol className="cmc-days">
          {days.map((day) => {
            const items = entriesByDay.get(day.key) ?? [];
            const extra = items.length - maxChips;
            const label = `${dayHeading(day.key)}, ${
              items.length === 1 ? "1 item" : `${items.length} itens`
            }`;
            return (
              <li
                className="cmc-day"
                data-in-month={day.inMonth || undefined}
                data-selected={activeDay === day.key || undefined}
                data-today={day.isToday || undefined}
                key={day.key}
              >
                <button
                  aria-current={day.isToday ? "date" : undefined}
                  aria-label={label}
                  aria-pressed={activeDay === day.key}
                  className="cmc-day__number"
                  onClick={() => setSelectedDay(day.key)}
                  type="button"
                >
                  {dayNumber(day.key)}
                </button>
                {items.length > 0 ? (
                  <span aria-hidden="true" className="cmc-day__dots">
                    {items.slice(0, maxChips).map((entry) => (
                      <span
                        className="cmc-dot"
                        data-category={entry.category}
                        key={entry.key}
                      />
                    ))}
                  </span>
                ) : null}
                <div className="cmc-day__chips">
                  {items.slice(0, maxChips).map((entry) => (
                    <Popover key={entry.key}>
                      <PopoverTrigger asChild>
                        <button
                          className="cmc-chip"
                          data-category={entry.category}
                          type="button"
                        >
                          {entry.allDay ? null : (
                            <span className="cmc-chip__time">
                              {timeLabel(entry, timezone).slice(0, 5)}
                            </span>
                          )}
                          <span className="cmc-chip__title">{entry.title}</span>
                          {entry.registered ? (
                            <CheckIcon
                              aria-label="Você está inscrito"
                              className="cmc-chip__check"
                            />
                          ) : null}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="cmc-popover"
                        collisionPadding={16}
                        sideOffset={6}
                      >
                        <EntryDetail entry={entry} timezone={timezone} />
                      </PopoverContent>
                    </Popover>
                  ))}
                  {extra > 0 ? (
                    <button
                      className="cmc-more"
                      onClick={() => setSelectedDay(day.key)}
                      type="button"
                    >
                      +{extra} {extra === 1 ? "item" : "itens"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {activeDay ? (
        <div aria-live="polite" className="cmc-agenda">
          <h3 className="cmc-agenda__title first-letter:uppercase">
            {dayHeading(activeDay)}
          </h3>
          {dayEntries.length === 0 ? (
            <p className="cmc-agenda__empty">
              Nada marcado neste dia. Escolha outro dia na grade.
            </p>
          ) : (
            <ul className="cmc-agenda__list">
              {dayEntries.map((entry) => (
                <li key={entry.key}>
                  <EntryDetail entry={entry} timezone={timezone} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
};
