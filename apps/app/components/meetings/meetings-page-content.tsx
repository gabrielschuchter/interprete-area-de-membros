import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  ClockIcon,
  ExternalLinkIcon,
  ListIcon,
  VideoIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CommunityMeetingsCalendar } from "@/components/meetings/community-meetings-calendar";
import { MeetingsCalendar } from "@/components/meetings/meetings-calendar";
import { Stagger } from "@/components/motion/motion";
import { getCommunityMeetingsCalendar } from "@/lib/community-meetings-calendar";
import {
  type CalendarMonth,
  calendarMonthParam,
  communityCalendarCategories,
  resolveCalendarMonth,
  shiftCalendarMonth,
} from "@/lib/community-meetings-calendar-domain";
import { requireMemberId } from "@/lib/learning";
import { getMeetings } from "@/lib/meetings";

const formatDate = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);

const meetingKindLabel = (kind: string) => {
  if (kind === "INDIVIDUAL") {
    return "Mentoria individual";
  }
  if (kind === "GROUP") {
    return "Encontro em grupo";
  }
  if (kind === "LESSON") {
    return "Aula";
  }
  return "Encontro";
};

const meetingDateParts = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    weekday: "short",
    timeZone: timezone,
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return {
    day: values.day ?? "",
    month: (values.month ?? "").replaceAll(".", "").toLocaleUpperCase("pt-BR"),
    weekday: (values.weekday ?? "")
      .replaceAll(".", "")
      .toLocaleUpperCase("pt-BR"),
  };
};

const meetingTimeShort = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);

const meetingCountdown = (date: Date) => {
  const days = Math.max(
    0,
    Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  );
  if (days === 0) {
    return "Hoje";
  }
  if (days === 1) {
    return "Em 1 dia";
  }
  return `Em ${days} dias`;
};

type CommunityUpcomingMeeting = Awaited<
  ReturnType<typeof getMeetings>
>["upcoming"][number];
type CommunityPastMeeting = Awaited<
  ReturnType<typeof getMeetings>
>["past"][number];

const meetingDayLine = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    weekday: "long",
    timeZone: timezone,
  }).format(date);

const MeetingDate = ({
  date,
  timezone,
}: {
  readonly date: Date;
  readonly timezone: string;
}) => {
  const dateParts = meetingDateParts(date, timezone);
  return (
    <time className="cm-date" dateTime={date.toISOString()}>
      <span className="sr-only">{formatDate(date, timezone)}</span>
      <span aria-hidden="true" className="cm-date__day">
        {dateParts.day}
      </span>
      <span aria-hidden="true" className="cm-date__month">
        {dateParts.month}
      </span>
    </time>
  );
};

/** Próximo encontro: o único destaque da página. */
const CommunityNextMeeting = ({
  meeting,
}: {
  readonly meeting: CommunityUpcomingMeeting;
}) => {
  const isRegistered = meeting.participants.length > 0;
  const canJoin = Date.now() >= meeting.startsAt.getTime() - 15 * 60 * 1000;
  return (
    <article className="cm-next">
      <MeetingDate date={meeting.startsAt} timezone={meeting.timezone} />
      <div className="cm-next__body">
        <p className="cm-next__kicker">
          {meetingKindLabel(meeting.kind)} ·{" "}
          {isRegistered
            ? "Você está inscrito"
            : meetingCountdown(meeting.startsAt)}
        </p>
        <h3 className="cm-next__title">{meeting.title}</h3>
        <p className="cm-next__meta">
          <ClockIcon aria-hidden="true" />
          <span className="first-letter:uppercase">
            {meetingDayLine(meeting.startsAt, meeting.timezone)}
          </span>
          {" · "}
          {meetingTimeShort(meeting.startsAt, meeting.timezone)} · online
        </p>
        {meeting.description ? (
          <p className="cm-next__description">{meeting.description}</p>
        ) : null}
        <div className="cm-next__actions">
          {canJoin ? (
            <Button asChild>
              <a href={meeting.joinUrl} rel="noreferrer" target="_blank">
                Entrar no encontro <ExternalLinkIcon aria-hidden="true" />
              </a>
            </Button>
          ) : null}
          <Button asChild variant={canJoin ? "ghost" : "outline"}>
            <Link href={`/encontros/${meeting.id}`}>Ver detalhes</Link>
          </Button>
        </div>
      </div>
    </article>
  );
};

type MeetingRowMeeting = CommunityPastMeeting | CommunityUpcomingMeeting;

/** Linha de lista: a linha inteira é o link; sem botões nem divisores extras. */
const CommunityMeetingRow = ({
  meeting,
  past,
}: {
  readonly meeting: MeetingRowMeeting;
  readonly past: boolean;
}) => {
  const recording =
    past && "recordings" in meeting ? meeting.recordings[0] : undefined;
  const externalRecording =
    past && !recording && "recordingUrl" in meeting
      ? meeting.recordingUrl
      : null;
  const hasRecording = Boolean(recording || externalRecording);
  let status = `${meetingTimeShort(meeting.startsAt, meeting.timezone)} · online`;
  if (past) {
    status = hasRecording ? "Gravação disponível" : "Sem gravação";
  }
  const content = (
    <>
      <MeetingDate date={meeting.startsAt} timezone={meeting.timezone} />
      <span className="cm-row__body">
        <span className="cm-row__title">{meeting.title}</span>
        <span
          className="cm-row__meta"
          data-recording={hasRecording || undefined}
        >
          {hasRecording ? <VideoIcon aria-hidden="true" /> : null}
          {status}
        </span>
      </span>
      {recording?.thumbnailUrl ? (
        <span aria-hidden="true" className="cm-row__thumb">
          <Image
            alt=""
            className="object-cover"
            fill
            loading="lazy"
            sizes="96px"
            src={recording.thumbnailUrl}
            unoptimized
          />
        </span>
      ) : null}
      <ChevronRightIcon aria-hidden="true" className="cm-row__chevron" />
    </>
  );
  if (externalRecording) {
    return (
      <li>
        <a
          className="cm-row"
          href={externalRecording}
          rel="noreferrer"
          target="_blank"
        >
          {content}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link
        className="cm-row"
        href={
          recording
            ? `/gravacoes?asset=${encodeURIComponent(recording.asset.id)}`
            : `/encontros/${meeting.id}`
        }
      >
        {content}
      </Link>
    </li>
  );
};

interface MeetingsPageContentProperties {
  /** `AAAA-MM` do calendário; sem valor, o mês corrente. */
  readonly calendarMonth?: string;
  readonly inCommunity?: boolean;
  readonly view?: "calendar" | "list";
}

const calendarHref = (month?: CalendarMonth) =>
  `/comunidade/encontros?ver=calendario${month ? `&mes=${calendarMonthParam(month)}` : ""}`;

const MeetingsViewSwitch = ({
  view,
}: {
  readonly view: "calendar" | "list";
}) => (
  <nav aria-label="Como ver os encontros" className="cm-views">
    <Link
      aria-current={view === "list" ? "page" : undefined}
      href="/comunidade/encontros"
      prefetch={false}
      scroll={false}
    >
      <ListIcon aria-hidden="true" /> Lista
    </Link>
    <Link
      aria-current={view === "calendar" ? "page" : undefined}
      href={calendarHref()}
      prefetch={false}
      scroll={false}
    >
      <CalendarDaysIcon aria-hidden="true" /> Calendário
    </Link>
  </nav>
);

const CommunityMeetingsCalendarSection = async ({
  memberId,
  month,
}: {
  readonly memberId: string;
  readonly month?: string;
}) => {
  const selected = resolveCalendarMonth(month);
  const calendar = await getCommunityMeetingsCalendar(memberId, selected);
  return (
    <CommunityMeetingsCalendar
      categories={communityCalendarCategories}
      days={calendar.days}
      entries={calendar.entries}
      key={calendarMonthParam(selected)}
      monthLabel={calendar.monthLabel}
      nextHref={calendarHref(shiftCalendarMonth(selected, 1))}
      previousHref={calendarHref(shiftCalendarMonth(selected, -1))}
      timezone={calendar.timezone}
      todayHref={calendarHref()}
    />
  );
};

const MeetingsPage = async ({
  calendarMonth,
  inCommunity = false,
  view = "list",
}: MeetingsPageContentProperties) => {
  const memberId = await requireMemberId();
  if (inCommunity && view === "calendar") {
    return (
      <div className="community-page min-h-svh bg-background">
        <main className="community-shell community-meetings-shell cm-page cm-page--calendar mx-auto w-full">
          <header className="cm-intro">
            <h1 className="font-display text-4xl leading-tight sm:text-5xl">
              Encontros
            </h1>
            <p>Encontros, aulas, workshops e eventos da sua turma no mês.</p>
            <MeetingsViewSwitch view="calendar" />
          </header>
          <CommunityMeetingsCalendarSection
            memberId={memberId}
            month={calendarMonth}
          />
        </main>
      </div>
    );
  }
  const { upcoming, past, calendar } = await getMeetings(memberId, undefined, {
    includeCalendar: !inCommunity,
  });
  const nextMeeting = upcoming[0];

  if (inCommunity) {
    const [featured, ...laterUpcoming] = upcoming;
    return (
      <div className="community-page min-h-svh bg-background">
        <main className="community-shell community-meetings-shell cm-page mx-auto w-full">
          <header className="cm-intro">
            <h1 className="font-display text-4xl leading-tight sm:text-5xl">
              Encontros
            </h1>
            <p>Encontros ao vivo e as gravações dos anteriores.</p>
            <MeetingsViewSwitch view="list" />
          </header>

          <section
            aria-labelledby="community-upcoming-heading"
            className="cm-section"
          >
            <h2 className="cm-section__title" id="community-upcoming-heading">
              Próximos
            </h2>
            {featured ? (
              <>
                <CommunityNextMeeting meeting={featured} />
                {laterUpcoming.length > 0 ? (
                  <ul className="cm-list">
                    {laterUpcoming.map((meeting) => (
                      <CommunityMeetingRow
                        key={meeting.id}
                        meeting={meeting}
                        past={false}
                      />
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <div className="cm-empty">
                <CalendarDaysIcon aria-hidden="true" />
                <div>
                  <p className="cm-empty__title">Nenhum encontro marcado</p>
                  <p>
                    Quando a escola marcar o próximo, ele aparece aqui com dia,
                    horário e link para entrar.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section
            aria-labelledby="community-past-heading"
            className="cm-section"
          >
            <div className="cm-section__head">
              <h2 className="cm-section__title" id="community-past-heading">
                Anteriores
              </h2>
              <Link className="cm-section__link" href="/gravacoes">
                Minhas gravações <ArrowRightIcon aria-hidden="true" />
              </Link>
            </div>
            {past.length === 0 ? (
              <div className="cm-empty">
                <VideoIcon aria-hidden="true" />
                <div>
                  <p className="cm-empty__title">Nada por aqui ainda</p>
                  <p>As gravações aparecem aqui depois dos encontros.</p>
                </div>
              </div>
            ) : (
              <ul className="cm-list">
                {past.map((meeting) => (
                  <CommunityMeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    past
                  />
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <main
        className={
          "mx-auto w-full px-5 py-8 sm:px-8 lg:px-12 lg:py-12" +
          (inCommunity ? "max-w-[1120px]" : "max-w-[1280px] py-10 lg:py-16")
        }
      >
        <header className="max-w-3xl">
          <p className="brand-eyebrow">
            {inCommunity
              ? "Comunidade · encontros"
              : "Sala de aula · encontros"}
          </p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
            Aprender também acontece ao vivo.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground leading-7 sm:text-lg">
            Chegue com uma pergunta, uma anotação e tempo para escutar. Os
            próximos encontros aparecem primeiro.
          </p>
        </header>
        {nextMeeting ? (
          <section className="paper-surface mt-14 border border-brand-structural/35 p-6 shadow-[var(--shadow-paper)] sm:p-10">
            <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div className="max-w-2xl">
                <Badge>Próximo encontro</Badge>
                <h2 className="mt-5 font-display text-4xl leading-tight sm:text-5xl">
                  {nextMeeting.title}
                </h2>
                <p className="mt-4 flex items-start gap-2 font-data text-brand-structural text-sm leading-6">
                  <CalendarDaysIcon
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  {formatDate(nextMeeting.startsAt, nextMeeting.timezone)}
                </p>
                <p className="mt-2 text-muted-foreground text-sm">
                  {meetingKindLabel(nextMeeting.kind)}
                  {nextMeeting.endsAt
                    ? ` · ${Math.max(1, Math.round((nextMeeting.endsAt.getTime() - nextMeeting.startsAt.getTime()) / 60_000))} min`
                    : ""}
                </p>
                {nextMeeting.description && (
                  <p className="mt-5 text-muted-foreground leading-7">
                    {nextMeeting.description}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" variant="outline">
                  <Link href={`/encontros/${nextMeeting.id}`}>
                    Ver detalhes
                  </Link>
                </Button>
                <Button asChild size="lg">
                  <a
                    href={nextMeeting.joinUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Entrar no encontro <ExternalLinkIcon aria-hidden="true" />
                  </a>
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <div className="paper-surface mt-14 border p-8 sm:p-12">
            <p className="brand-eyebrow">Nenhum encontro agendado</p>
            <h2 className="mt-4 font-display text-3xl">
              A próxima sala ainda não foi marcada.
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
              Quando um encontro for publicado, data, contexto e acesso
              aparecerão aqui sem exigir busca.
            </p>
          </div>
        )}
        <MeetingsCalendar
          meetings={calendar.map((meeting) => ({
            id: meeting.id,
            title: meeting.title,
            description: meeting.description,
            startsAt: meeting.startsAt.toISOString(),
            endsAt: meeting.endsAt?.toISOString() ?? null,
            timezone: meeting.timezone,
            joinUrl: meeting.joinUrl,
            recordingUrl: meeting.recordingUrl,
            recurrenceRule: meeting.recurrenceRule,
            kind: meeting.kind,
            course: meeting.course
              ? { title: meeting.course.title, slug: meeting.course.slug }
              : null,
            relatedActivity: meeting.relatedActivity
              ? {
                  title: meeting.relatedActivity.title,
                  slug: meeting.relatedActivity.slug,
                }
              : null,
            relatedLibraryItem: meeting.relatedLibraryItem
              ? { title: meeting.relatedLibraryItem.title }
              : null,
            recordings: meeting.recordings.map((recording) => ({
              id: recording.id,
              assetId: recording.asset.id,
              title: recording.originalTitle ?? recording.asset.title,
            })),
          }))}
          recordingsBasePath={"/gravacoes"}
        />
        <section aria-labelledby="upcoming-heading" className="mt-14">
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="upcoming-heading">
              Depois dele
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              {upcoming.length.toString().padStart(2, "0")}
            </span>
          </div>
          <Stagger className="mt-5 grid gap-4 md:grid-cols-2">
            {upcoming.slice(1).map((meeting) => (
              <article
                className="motion-card paper-surface border p-6"
                key={meeting.id}
              >
                <p className="brand-eyebrow">
                  {formatDate(meeting.startsAt, meeting.timezone)}
                </p>
                <h3 className="mt-3 font-display text-2xl">{meeting.title}</h3>
                {meeting.description && (
                  <p className="mt-3 text-muted-foreground leading-6">
                    {meeting.description}
                  </p>
                )}
                <a
                  className="mt-5 inline-flex items-center gap-2 font-medium text-brand-structural text-sm"
                  href={meeting.joinUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir acesso{" "}
                  <ArrowRightIcon aria-hidden="true" className="size-4" />
                </a>
                <Link
                  className="mt-3 inline-flex items-center gap-2 text-muted-foreground text-sm underline underline-offset-4"
                  href={`/encontros/${meeting.id}`}
                >
                  Ver detalhes
                </Link>
              </article>
            ))}
          </Stagger>
        </section>
        <section aria-labelledby="past-heading" className="mt-14">
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="past-heading">
              Encontros passados
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              {past.length.toString().padStart(2, "0")}
            </span>
          </div>
          {past.length === 0 ? (
            <p className="mt-5 text-muted-foreground">
              As gravações aparecerão aqui quando houver encontros anteriores.
            </p>
          ) : (
            <Stagger className="mt-5 divide-y border-border border-y">
              {past.map((meeting) => {
                const internalRecording = meeting.recordings[0];
                return (
                  <div
                    className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center"
                    key={meeting.id}
                  >
                    <div>
                      <p className="brand-eyebrow">
                        {formatDate(meeting.startsAt, meeting.timezone)}
                      </p>
                      <h3 className="mt-2 font-display text-2xl">
                        {meeting.title}
                      </h3>
                      <Link
                        className="mt-2 inline-flex text-brand-structural text-sm underline underline-offset-4"
                        href={`/encontros/${meeting.id}`}
                      >
                        Ver detalhes
                      </Link>
                    </div>
                    {internalRecording ? (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={
                            "/gravacoes" +
                            "?asset=" +
                            encodeURIComponent(internalRecording.asset.id)
                          }
                        >
                          Ver gravação <ArrowRightIcon aria-hidden="true" />
                        </Link>
                      </Button>
                    ) : null}
                    {!internalRecording && meeting.recordingUrl ? (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={meeting.recordingUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Ver gravação <ExternalLinkIcon aria-hidden="true" />
                        </a>
                      </Button>
                    ) : null}
                    {internalRecording || meeting.recordingUrl ? null : (
                      <span className="text-muted-foreground text-sm">
                        Sem gravação
                      </span>
                    )}
                  </div>
                );
              })}
            </Stagger>
          )}
        </section>
      </main>
    </div>
  );
};

export default MeetingsPage;
