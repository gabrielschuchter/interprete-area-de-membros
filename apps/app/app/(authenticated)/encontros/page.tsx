import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ExternalLinkIcon,
} from "lucide-react";
import Link from "next/link";
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

const MeetingsPage = async () => {
  const memberId = await requireMemberId();
  const { upcoming, past, calendar } = await getMeetings(memberId);
  const nextMeeting = upcoming[0];

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <header className="max-w-3xl">
          <p className="brand-eyebrow">Sala de aula · encontros</p>
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
          }))}
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
              {past.map((meeting) => (
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
                  {meeting.recordingUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={meeting.recordingUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Ver gravação <ExternalLinkIcon aria-hidden="true" />
                      </a>
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      Sem gravação
                    </span>
                  )}
                </div>
              ))}
            </Stagger>
          )}
        </section>
      </main>
    </div>
  );
};

export default MeetingsPage;
