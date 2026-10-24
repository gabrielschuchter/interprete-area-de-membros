import Link from "next/link";
import type {
  OverviewAttentionItem,
  OverviewMeeting,
  OverviewMovement,
} from "@/lib/gestao-overview-extras";
import { GestaoIcon, type GestaoIconName } from "./gestao-icon";

const icons: Record<OverviewAttentionItem["icon"], GestaoIconName> = {
  inbox: "inbox",
  alert: "alert-circle",
  meeting: "video",
  draft: "pencil",
  video: "video",
  people: "users",
};

const avatarTones = ["#410230", "#6a1a3a", "#8c3a52"] as const;
const initialsPattern = /\s+/;

const initialsOf = (name: string) =>
  name
    .trim()
    .split(initialsPattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

const toneOf = (name: string) => {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return avatarTones[hash % avatarTones.length];
};

const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  timeZone: "America/Sao_Paulo",
});
const monthFormat = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: "America/Sao_Paulo",
});
const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const minuteMs = 60_000;

export const relativeTime = (at: Date, now: Date) => {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - at.getTime()) / minuteMs)
  );
  if (minutes < 60) {
    return minutes <= 1 ? "agora" : `há ${minutes} min`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `há ${hours} h`;
  }
  const days = Math.round(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
};

export const AttentionRow = ({
  item,
}: {
  readonly item: OverviewAttentionItem;
}) => {
  return (
    <div className="go-attention-row" data-attention-item={item.id}>
      <span
        className="go-attention-icon"
        data-tone={item.icon === "alert" ? "danger" : "default"}
      >
        <GestaoIcon name={icons[item.icon]} />
      </span>
      <div className="go-attention-copy">
        <h3>{item.title}</h3>
        <p>{item.detail}</p>
      </div>
      <Link className="go-outline-action" href={item.href} prefetch={false}>
        {item.action}
      </Link>
    </div>
  );
};

export const UpcomingMeetings = ({
  meetings,
}: {
  readonly meetings: readonly OverviewMeeting[];
}) => (
  <section aria-labelledby="overview-meetings" className="go-panel">
    <div className="go-week-heading">
      <h2 id="overview-meetings">Próximos encontros</h2>
      <Link href="/gestao/comunidade/encontros">Agenda</Link>
    </div>
    {meetings.length === 0 ? (
      <p className="gx-empty">Nenhum encontro marcado para as suas turmas.</p>
    ) : (
      <ul className="gx-meetings">
        {meetings.map((meeting) => (
          <li key={meeting.id}>
            <span aria-hidden="true" className="gx-date">
              <small>
                {monthFormat.format(meeting.startsAt).replace(".", "")}
              </small>
              <strong>{dayFormat.format(meeting.startsAt)}</strong>
            </span>
            <span className="gx-meeting-copy">
              <strong>{meeting.title}</strong>
              <span>{timeFormat.format(meeting.startsAt)} · online</span>
            </span>
            <span
              className="gx-chip"
              data-tone={meeting.draft ? "neutral" : "scheduled"}
            >
              <GestaoIcon
                name={meeting.draft ? "pencil" : "clock"}
                size={12}
                strokeWidth={1.8}
              />
              {meeting.draft ? "Rascunho" : "Agendado"}
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const RecentMovement = ({
  movement,
  now,
}: {
  readonly movement: readonly OverviewMovement[];
  readonly now: Date;
}) => (
  <section aria-labelledby="overview-movement" className="go-panel">
    <div className="go-panel-heading">
      <h2 id="overview-movement">Movimentação recente</h2>
    </div>
    {movement.length === 0 ? (
      <p className="gx-empty">
        Entregas e aulas concluídas dos seus alunos aparecem aqui.
      </p>
    ) : (
      <ul className="go-movement">
        {movement.map((event) => (
          <li key={event.id}>
            <span
              aria-hidden="true"
              className="go-avatar"
              style={{ background: toneOf(event.who) }}
            >
              {initialsOf(event.who)}
            </span>
            <span className="go-movement-copy">
              <b>{event.who}</b> {event.verb}{" "}
              <Link href={event.href} prefetch={false}>
                {event.object}
              </Link>
            </span>
            <time dateTime={event.at.toISOString()}>
              {relativeTime(event.at, now)}
            </time>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const Institutional = ({
  data,
}: {
  readonly data: {
    readonly expiringGrants: number;
    readonly newMembers: number;
    readonly publishedBadges: number;
  };
}) => (
  <section aria-labelledby="overview-institutional" className="go-panel">
    <div className="go-week-heading">
      <h2 id="overview-institutional">Institucional</h2>
    </div>
    <ul className="go-institutional">
      {[
        {
          href: "/gestao/administracao/membros",
          label: `Novos membros: ${data.newMembers} nos últimos 7 dias`,
        },
        {
          href: "/gestao/administracao/acessos",
          label: `Acessos que expiram em 7 dias: ${data.expiringGrants}`,
        },
        {
          href: "/gestao/administracao/medalhas",
          label: `Medalhas publicadas: ${data.publishedBadges}`,
        },
      ].map((row) => (
        <li key={row.href}>
          <Link href={row.href} prefetch={false}>
            <span>{row.label}</span>
            <GestaoIcon name="chevron-right" size={16} strokeWidth={1.8} />
          </Link>
        </li>
      ))}
    </ul>
  </section>
);
