import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckSquareIcon,
  FileTextIcon,
  type LucideIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { Stagger } from "@/components/motion/motion";
import { getAdminOverview } from "@/lib/admin-overview";
import { communityPostHref } from "@/lib/community";

const formatDate = (date: Date, timezone = "America/Sao_Paulo") =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);

const memberName = (member: {
  readonly displayName: string | null;
  readonly email: string | null;
}) => member.displayName ?? member.email ?? "Membro";

const statusLabel = (status: string) => {
  if (status === "PUBLISHED") {
    return "Publicado";
  }

  if (status === "ARCHIVED") {
    return "Arquivado";
  }

  return "Rascunho";
};

const summaryCards: Array<{
  readonly label: string;
  readonly Icon: LucideIcon;
}> = [
  { label: "Alunos ativos", Icon: UsersIcon },
  { label: "Cursos publicados", Icon: FileTextIcon },
  { label: "Aguardando feedback", Icon: CheckSquareIcon },
  { label: "Próximos encontros", Icon: CalendarDaysIcon },
];

const AdminPage = async () => {
  const overview = await getAdminOverview();
  const nextMeeting = overview.upcomingMeetings[0];

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <header className="max-w-3xl">
        <p className="brand-eyebrow">Professor · visão geral</p>
        <span aria-hidden="true" className="brand-rule mt-4" />
        <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
          O que merece sua atenção agora?
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Um ponto de partida para acompanhar pessoas, conteúdo e conversas sem
          precisar abrir cada área separadamente.
        </p>
      </header>

      <Stagger
        aria-label="Resumo"
        className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {summaryCards.map(({ label, Icon }, index) => {
          const values = [
            overview.counts.activeMembers,
            overview.counts.publishedCourses,
            overview.counts.pendingFeedback,
            overview.upcomingMeetings.length,
          ];

          return (
            <article
              className="motion-card paper-surface border p-5"
              key={label}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="brand-eyebrow">{label}</p>
                <Icon
                  aria-hidden="true"
                  className="size-5 text-brand-gesture"
                />
              </div>
              <p className="mt-5 font-display text-4xl">{values[index]}</p>
            </article>
          );
        })}
      </Stagger>

      <section aria-labelledby="attention-heading" className="mt-10">
        <div className="flex items-end justify-between border-border border-b pb-3">
          <h2 className="font-display text-3xl" id="attention-heading">
            O que merece atenção
          </h2>
          <span className="font-data text-muted-foreground text-xs">agora</span>
        </div>
        <Stagger className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <article className="motion-card paper-surface border p-5">
            <p className="brand-eyebrow">Feedback</p>
            <h3 className="mt-3 font-display text-2xl">
              {overview.counts.pendingFeedback === 0
                ? "Nenhuma entrega pendente."
                : `${overview.counts.pendingFeedback} entrega${overview.counts.pendingFeedback === 1 ? "" : "s"} para ler.`}
            </h3>
            <Link
              className="mt-5 inline-flex items-center gap-2 text-primary text-sm underline underline-offset-4"
              href="/admin/activities"
            >
              Abrir atividades
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          </article>
          <article className="motion-card paper-surface border p-5">
            <p className="brand-eyebrow">Próximo encontro</p>
            <h3 className="mt-3 font-display text-2xl">
              {nextMeeting?.title ?? "Nenhum encontro próximo."}
            </h3>
            {nextMeeting && (
              <p className="mt-3 text-muted-foreground text-sm">
                {formatDate(nextMeeting.startsAt, nextMeeting.timezone)}
              </p>
            )}
            <Link
              className="mt-5 inline-flex items-center gap-2 text-primary text-sm underline underline-offset-4"
              href="/admin/meetings"
            >
              Abrir agenda
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          </article>
          <article className="motion-card paper-surface border p-5">
            <p className="brand-eyebrow">Conteúdo</p>
            <h3 className="mt-3 font-display text-2xl">
              {overview.counts.drafts === 0
                ? "Nenhum rascunho pendente."
                : `${overview.counts.drafts} item${overview.counts.drafts === 1 ? "" : "s"} em rascunho.`}
            </h3>
            <Link
              className="mt-5 inline-flex items-center gap-2 text-primary text-sm underline underline-offset-4"
              href="/admin/learning"
            >
              Organizar conteúdo
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          </article>
          <article className="motion-card paper-surface border p-5">
            <p className="brand-eyebrow">Prazo</p>
            <h3 className="mt-3 font-display text-2xl">
              {overview.counts.overdue === 0
                ? "Nenhuma entrega atrasada."
                : `${overview.counts.overdue} entrega${overview.counts.overdue === 1 ? "" : "s"} atrasada${overview.counts.overdue === 1 ? "" : "s"}.`}
            </h3>
            <Link
              className="mt-5 inline-flex items-center gap-2 text-primary text-sm underline underline-offset-4"
              href="/admin/activities"
            >
              Ver pendências
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          </article>
        </Stagger>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)] lg:items-start">
        <section aria-labelledby="meetings-heading">
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="meetings-heading">
              Próximos encontros
            </h2>
            <Link
              className="text-muted-foreground text-sm underline underline-offset-4"
              href="/admin/meetings"
            >
              Ver todos
            </Link>
          </div>
          <div className="mt-5 divide-y border-border border-y">
            {overview.upcomingMeetings.length === 0 ? (
              <p className="py-5 text-muted-foreground">
                Nenhum encontro publicado.
              </p>
            ) : (
              overview.upcomingMeetings.slice(0, 4).map((meeting) => (
                <article
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                  key={meeting.id}
                >
                  <div>
                    <p className="brand-eyebrow">
                      {meeting.kind.toLowerCase()}
                    </p>
                    <h3 className="mt-2 font-display text-2xl">
                      {meeting.title}
                    </h3>
                    <p className="mt-2 text-muted-foreground text-sm">
                      {formatDate(meeting.startsAt, meeting.timezone)}
                      {meeting.teacher
                        ? ` · ${memberName(meeting.teacher)}`
                        : ""}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/encontros/${meeting.id}`}>Abrir</Link>
                  </Button>
                </article>
              ))
            )}
          </div>
        </section>

        <section aria-labelledby="feedback-heading">
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="feedback-heading">
              Atividades para corrigir
            </h2>
          </div>
          <div className="mt-5 divide-y border-border border-y">
            {overview.pendingFeedback.length === 0 ? (
              <p className="py-5 text-muted-foreground">Tudo em dia.</p>
            ) : (
              overview.pendingFeedback.slice(0, 4).map((submission) => (
                <Link
                  className="block py-5 transition-colors hover:text-brand-structural"
                  href={`/admin/activities#${submission.id}`}
                  key={submission.id}
                >
                  <p className="brand-eyebrow">
                    {memberName(submission.member)}
                  </p>
                  <h3 className="mt-2 font-medium">
                    {submission.activity.title}
                  </h3>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Enviado em{" "}
                    {formatDate(submission.submittedAt ?? submission.updatedAt)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="content-heading">
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="content-heading">
              Conteúdo recente
            </h2>
            <Link
              className="text-muted-foreground text-sm underline underline-offset-4"
              href="/admin/learning"
            >
              Gerenciar
            </Link>
          </div>
          <div className="mt-5 divide-y border-border border-y">
            {overview.recentLessons.length === 0 ? (
              <p className="py-5 text-muted-foreground">
                Nenhuma aula criada ainda.
              </p>
            ) : (
              overview.recentLessons.map((lesson) => (
                <div
                  className="flex items-center justify-between gap-4 py-4"
                  key={lesson.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{lesson.title}</p>
                    <p className="mt-1 truncate text-muted-foreground text-sm">
                      {lesson.module.course.title} · {lesson.module.title}
                    </p>
                  </div>
                  <Badge
                    variant={
                      lesson.status === "PUBLISHED" ? "default" : "outline"
                    }
                  >
                    {statusLabel(lesson.status)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </section>

        <section aria-labelledby="community-heading">
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="community-heading">
              Comunidade recente
            </h2>
            <Link
              className="text-muted-foreground text-sm underline underline-offset-4"
              href="/admin/community"
            >
              Moderar
            </Link>
          </div>
          <div className="mt-5 divide-y border-border border-y">
            {overview.recentPosts.length === 0 ? (
              <p className="py-5 text-muted-foreground">
                Nenhuma publicação recente.
              </p>
            ) : (
              overview.recentPosts.map((post) => (
                <Link
                  className="block py-4 transition-colors hover:text-brand-structural"
                  href={communityPostHref(post)}
                  key={post.id}
                >
                  <p className="brand-eyebrow">
                    {post.space?.title ?? "Comunidade"}
                  </p>
                  <h3 className="mt-2 font-medium">{post.title}</h3>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {post.author?.displayName ??
                      post.author?.username ??
                      "Membro"}{" "}
                    · {formatDate(post.publishedAt ?? post.updatedAt)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default AdminPage;
