import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  ExternalLinkIcon,
  VideoIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CommunityNavigation } from "@/components/community/community-navigation";
import { MeetingsCalendar } from "@/components/meetings/meetings-calendar";
import { Stagger } from "@/components/motion/motion";
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

const MeetingDateBlock = ({
  date,
  timezone,
}: {
  readonly date: Date;
  readonly timezone: string;
}) => {
  const dateParts = meetingDateParts(date, timezone);

  return (
    <time className="community-meeting-row__date" dateTime={date.toISOString()}>
      <span className="sr-only">{formatDate(date, timezone)}</span>
      <span className="community-meeting-row__weekday">
        {dateParts.weekday}
      </span>
      <span className="community-meeting-row__month">{dateParts.month}</span>
      <span className="community-meeting-row__day">{dateParts.day}</span>
    </time>
  );
};

const CommunityUpcomingMeetingRow = ({
  meeting,
}: {
  readonly meeting: CommunityUpcomingMeeting;
}) => {
  const isRegistered = meeting.participants.length > 0;
  const canJoin = Date.now() >= meeting.startsAt.getTime() - 15 * 60 * 1000;
  let action = (
    <Button disabled size="sm">
      Entrar no encontro
    </Button>
  );

  if (isRegistered) {
    action = (
      <Button asChild size="sm" variant="outline">
        <Link href={`/encontros/${meeting.id}`}>Ver detalhes</Link>
      </Button>
    );
  } else if (canJoin) {
    action = (
      <Button asChild size="sm">
        <a href={meeting.joinUrl} rel="noreferrer" target="_blank">
          Entrar no encontro
        </a>
      </Button>
    );
  }

  return (
    <li>
      <article className="community-meeting-row community-meeting-row--upcoming">
        <MeetingDateBlock date={meeting.startsAt} timezone={meeting.timezone} />
        <div className="community-meeting-row__body">
          <p className="brand-eyebrow">{meetingKindLabel(meeting.kind)}</p>
          <h3 className="mt-1 font-display text-xl sm:text-2xl">
            {meeting.title}
          </h3>
          <p className="community-meeting-row__meta">
            <ClockIcon aria-hidden="true" />
            {meetingTimeShort(meeting.startsAt, meeting.timezone)} · online
          </p>
          {meeting.description ? (
            <p className="mt-2 line-clamp-2 text-muted-foreground text-sm leading-6">
              {meeting.description}
            </p>
          ) : null}
        </div>
        <div className="community-meeting-row__actions">
          {isRegistered ? (
            <Badge variant="outline">Inscrito</Badge>
          ) : (
            <Badge variant="outline">
              {meetingCountdown(meeting.startsAt)}
            </Badge>
          )}
          {action}
        </div>
      </article>
    </li>
  );
};

const CommunityPastMeetingRow = ({
  meeting,
}: {
  readonly meeting: CommunityPastMeeting;
}) => {
  const recording = meeting.recordings[0];
  const recordingHref = recording
    ? `/comunidade/encontros/gravacoes?asset=${encodeURIComponent(recording.asset.id)}`
    : meeting.recordingUrl;
  const hasRecording = Boolean(recording || meeting.recordingUrl);
  let action = (
    <div className="community-meeting-row__actions">
      <Badge variant="outline">Sem gravação</Badge>
      <Button asChild size="sm" variant="outline">
        <Link href={`/encontros/${meeting.id}`}>Ver detalhes</Link>
      </Button>
    </div>
  );

  if (recordingHref) {
    const recordingLink = recording ? (
      <Link href={recordingHref}>
        Ver gravação <ArrowRightIcon aria-hidden="true" />
      </Link>
    ) : (
      <a href={recordingHref} rel="noreferrer" target="_blank">
        Ver gravação <ArrowRightIcon aria-hidden="true" />
      </a>
    );
    action = (
      <div className="community-meeting-row__actions">
        <Badge variant="outline">
          <VideoIcon aria-hidden="true" /> Gravado
        </Badge>
        <Button asChild size="sm" variant="outline">
          {recordingLink}
        </Button>
      </div>
    );
  }

  return (
    <li>
      <article className="community-meeting-row community-meeting-row--past">
        <MeetingDateBlock date={meeting.startsAt} timezone={meeting.timezone} />
        {recording?.thumbnailUrl ? (
          <div className="community-meeting-row__thumbnail">
            <Image
              alt=""
              className="object-cover"
              fill
              loading="lazy"
              sizes="(max-width: 767px) 100vw, 132px"
              src={recording.thumbnailUrl}
              unoptimized
            />
            <span aria-hidden="true" className="community-meeting-row__play">
              <VideoIcon />
            </span>
          </div>
        ) : null}
        <div className="community-meeting-row__body">
          <p className="brand-eyebrow">
            {hasRecording ? "Gravação disponível" : "Encontro anterior"}
          </p>
          <h3 className="mt-1 font-display text-xl sm:text-2xl">
            {meeting.title}
          </h3>
        </div>
        {action}
      </article>
    </li>
  );
};

interface MeetingsPageContentProperties {
  readonly inCommunity?: boolean;
}

const MeetingsPage = async ({
  inCommunity = false,
}: MeetingsPageContentProperties) => {
  const memberId = await requireMemberId();
  const { upcoming, past, calendar } = await getMeetings(memberId, undefined, {
    includeCalendar: !inCommunity,
  });
  const nextMeeting = upcoming[0];

  if (inCommunity) {
    return (
      <div className="community-page min-h-svh bg-background">
        <main className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          <CommunityNavigation active="meetings" />
          <header className="community-meetings-page__intro mt-7 flex flex-col gap-4 border-border border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-4xl leading-tight sm:text-5xl">
                Encontros
              </h1>
              <p className="mt-2 text-muted-foreground leading-7">
                Encontros ao vivo e as gravações dos anteriores.
              </p>
            </div>
          </header>

          <section
            aria-labelledby="community-upcoming-heading"
            className="community-meetings-section mt-9"
          >
            <h2
              className="community-meetings-section__title border-border border-b pb-3 font-display text-3xl"
              id="community-upcoming-heading"
            >
              Próximos
            </h2>
            {upcoming.length === 0 ? (
              <p className="mt-5 border-b py-5 text-muted-foreground">
                Nenhum encontro futuro foi publicado.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {upcoming.map((meeting) => (
                  <CommunityUpcomingMeetingRow
                    key={meeting.id}
                    meeting={meeting}
                  />
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="community-past-heading"
            className="community-meetings-section community-meetings-section--past mt-12"
          >
            <div className="flex items-end justify-between border-border border-b pb-3">
              <h2
                className="community-meetings-section__title font-display text-3xl"
                id="community-past-heading"
              >
                Anteriores
              </h2>
              <Link
                className="community-meetings-archive-link community-meetings-archive-link--heading inline-flex items-center gap-2 font-medium text-brand-structural text-sm"
                href="/comunidade/encontros/gravacoes"
              >
                Minhas gravações <ArrowRightIcon aria-hidden="true" />
              </Link>
            </div>
            {past.length === 0 ? (
              <p className="mt-5 border-b py-5 text-muted-foreground">
                As gravações aparecerão aqui depois dos encontros.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {past.map((meeting) => (
                  <CommunityPastMeetingRow key={meeting.id} meeting={meeting} />
                ))}
              </ul>
            )}
            <Link
              className="community-meetings-archive-link community-meetings-archive-link--footer"
              href="/comunidade/encontros/gravacoes"
            >
              <VideoIcon aria-hidden="true" />
              Minhas gravações
              <ArrowRightIcon aria-hidden="true" />
            </Link>
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
        {inCommunity ? <CommunityNavigation active="meetings" /> : null}
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
          recordingsBasePath={
            inCommunity
              ? "/comunidade/encontros/gravacoes"
              : "/encontros/gravacoes"
          }
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
                            (inCommunity
                              ? "/comunidade/encontros/gravacoes"
                              : "/encontros/gravacoes") +
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
