import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ExternalLinkIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMemberId } from "@/lib/learning";
import { getPublishedMeeting } from "@/lib/meetings";

interface MeetingPageProperties {
  readonly params: Promise<{ id: string }>;
}

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

const MeetingPage = async ({ params }: MeetingPageProperties) => {
  const { id } = await params;
  const memberId = await requireMemberId();
  const meeting = await getPublishedMeeting(id, memberId);

  if (!meeting) {
    notFound();
  }

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[960px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href="/encontros">
            <ArrowLeftIcon aria-hidden="true" /> Voltar para encontros
          </Link>
        </Button>

        <article className="paper-surface mt-8 border p-6 shadow-[var(--shadow-paper)] sm:p-10 lg:p-14">
          <Badge>{meetingKindLabel(meeting.kind)}</Badge>
          <h1 className="mt-5 font-display text-5xl leading-tight sm:text-6xl">
            {meeting.title}
          </h1>
          <p className="mt-6 flex items-start gap-2 font-data text-brand-structural text-sm leading-6">
            <CalendarDaysIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            {formatDate(meeting.startsAt, meeting.timezone)}
          </p>
          {meeting.endsAt ? (
            <p className="mt-2 text-muted-foreground text-sm">
              Duração:{" "}
              {Math.max(
                1,
                Math.round(
                  (meeting.endsAt.getTime() - meeting.startsAt.getTime()) /
                    60_000
                )
              )}{" "}
              minutos
            </p>
          ) : null}
          {meeting.recurrenceRule ? (
            <p className="mt-2 text-muted-foreground text-sm">
              Recorrência: {meeting.recurrenceRule}
            </p>
          ) : null}
          {meeting.description && (
            <p className="mt-8 max-w-2xl whitespace-pre-wrap text-muted-foreground leading-7">
              {meeting.description}
            </p>
          )}
          {meeting.teacherProfile && (
            <p className="mt-8 border-border border-t pt-5 text-muted-foreground text-sm">
              Com{" "}
              {meeting.teacherProfile.displayName ??
                meeting.teacherProfile.username}
              {meeting.teacherProfile.headline
                ? ` · ${meeting.teacherProfile.headline}`
                : ""}
            </p>
          )}
          {meeting.course && (
            <p className="mt-3 text-muted-foreground text-sm">
              Percurso relacionado: {meeting.course.title}
            </p>
          )}
          {meeting.relatedActivity ? (
            <p className="mt-3 text-muted-foreground text-sm">
              Atividade relacionada:{" "}
              <Link
                className="underline"
                href={`/atividades/${meeting.relatedActivity.slug}`}
              >
                {meeting.relatedActivity.title}
              </Link>
            </p>
          ) : null}
          {meeting.relatedLibraryItem ? (
            <p className="mt-3 text-muted-foreground text-sm">
              Leitura relacionada: {meeting.relatedLibraryItem.title}
            </p>
          ) : null}
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={meeting.joinUrl} rel="noreferrer" target="_blank">
                Entrar no encontro <ExternalLinkIcon aria-hidden="true" />
              </a>
            </Button>
            {meeting.recordingUrl && (
              <Button asChild size="lg" variant="outline">
                <a href={meeting.recordingUrl} rel="noreferrer" target="_blank">
                  Assistir gravação <ExternalLinkIcon aria-hidden="true" />
                </a>
              </Button>
            )}
          </div>
        </article>
      </main>
    </div>
  );
};

export default MeetingPage;
