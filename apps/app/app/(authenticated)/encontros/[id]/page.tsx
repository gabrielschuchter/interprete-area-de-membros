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
import { MemberHeader } from "../../components/member-header";

interface MeetingPageProperties {
  readonly params: Promise<{ id: string }>;
}

const formatDate = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);

const MeetingPage = async ({ params }: MeetingPageProperties) => {
  const { id } = await params;
  const memberId = await requireMemberId();
  const meeting = await getPublishedMeeting(id, memberId);

  if (!meeting) {
    notFound();
  }

  return (
    <div className="min-h-svh bg-background">
      <MemberHeader section="Encontros" />
      <main className="mx-auto w-full max-w-[960px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href="/encontros">
            <ArrowLeftIcon aria-hidden="true" /> Voltar para encontros
          </Link>
        </Button>

        <article className="paper-surface mt-8 border p-6 shadow-[var(--shadow-paper)] sm:p-10 lg:p-14">
          <Badge>Encontro</Badge>
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
