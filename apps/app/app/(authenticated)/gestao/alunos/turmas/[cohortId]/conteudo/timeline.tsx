import Link from "next/link";
import type {
  TimelineKind,
  TimelineStatus,
  TimelineWeek,
} from "@/lib/gestao-cohort-timeline";
import { GestaoIcon, type GestaoIconName } from "../../../../gestao-icon";

const rangeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Sao_Paulo",
});
const dayOnly = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  timeZone: "America/Sao_Paulo",
});
const kindIcons: Record<TimelineKind, GestaoIconName> = {
  lesson: "play-circle",
  course: "book",
  activity: "inbox",
  meeting: "video",
};
const statusView: Record<
  TimelineStatus,
  {
    readonly icon: GestaoIconName;
    readonly label: string;
    readonly tone: string;
  }
> = {
  released: { label: "Publicado", tone: "active", icon: "play-circle" },
  open: { label: "Em andamento", tone: "active", icon: "clock" },
  scheduled: { label: "Agendado", tone: "neutral", icon: "clock" },
  closed: { label: "Encerrada", tone: "neutral", icon: "archive" },
  draft: { label: "Rascunho", tone: "neutral", icon: "pencil" },
};

const rangeLabel = (week: TimelineWeek) =>
  `${dayOnly.format(week.start)} a ${rangeFormat.format(week.end).replace(".", "")}`;

export const CohortTimeline = ({
  weeks,
}: {
  readonly weeks: readonly TimelineWeek[];
}) => (
  <div className="gk-timeline">
    {weeks.map((week) => (
      <section className="gk-week" key={week.label + week.start.toISOString()}>
        <header>
          <strong>{week.label}</strong>
          <small>{rangeLabel(week)}</small>
        </header>
        <ul className="gk-week-card">
          {week.items.map((item) => {
            const view = statusView[item.status];
            return (
              <li key={item.id}>
                <span aria-hidden="true" className="gk-icon-tile">
                  <GestaoIcon name={kindIcons[item.kind]} size={18} />
                </span>
                <span className="gk-row-copy">
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                <span className="gk-chip" data-tone={view.tone}>
                  <GestaoIcon name={view.icon} size={12} strokeWidth={1.8} />
                  {view.label}
                </span>
                <Link
                  aria-label={`Abrir ${item.title}`}
                  className="gk-icon-btn gk-icon-btn--flat"
                  href={item.href}
                >
                  <GestaoIcon name="calendar" size={18} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    ))}
  </div>
);
