import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminMemberDetail } from "@/lib/admin-students";
import { requireStaff } from "@/lib/authorization";
import { communityPostHref } from "@/lib/community";

interface AdminMemberDetailPageProperties {
  readonly params: Promise<{ id: string }>;
}

const initials = (name: string | null) =>
  (name ?? "M")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const roleLabel: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Professor",
  MEMBER: "Membro",
};

const date = (value: Date | null, timezone = "America/Sao_Paulo") =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeZone: timezone,
      }).format(value)
    : "—";

const AdminMemberDetailPage = async ({
  params,
}: AdminMemberDetailPageProperties) => {
  await requireStaff();
  const { id } = await params;
  const member = await getAdminMemberDetail(id);

  if (!member) {
    notFound();
  }

  const displayName = member.displayName ?? member.email ?? "Membro";

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Button asChild size="sm" variant="ghost">
        <Link href="/admin/membros">
          <ArrowLeftIcon aria-hidden="true" /> Voltar para membros
        </Link>
      </Button>
      <header className="mt-8 flex flex-col gap-6 border-border border-b pb-8 md:flex-row md:items-center">
        <Avatar className="size-20">
          <AvatarImage alt="" src={member.avatarUrl ?? undefined} />
          <AvatarFallback>{initials(member.displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="brand-eyebrow">Aluno · perfil de acompanhamento</p>
            <Badge variant="outline">{roleLabel[member.role]}</Badge>
          </div>
          <h1 className="mt-3 font-display text-5xl leading-none">
            {displayName}
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">
            {member.profile?.username ? `@${member.profile.username} · ` : ""}
            {member.email ?? "Email não sincronizado"} · entrou em{" "}
            {date(member.createdAt)}
          </p>
          {member.profile?.headline && (
            <p className="mt-2 text-muted-foreground">
              {member.profile.headline}
            </p>
          )}
        </div>
        <Button asChild className="md:ml-auto" variant="outline">
          <Link href="/admin/acessos">Ajustar acessos</Link>
        </Button>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section
          aria-labelledby="access-heading"
          className="paper-surface border p-6"
        >
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="access-heading">
              Acessos liberados
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              {member.accessGrants.length}
            </span>
          </div>
          {member.accessGrants.length === 0 ? (
            <p className="mt-5 text-muted-foreground text-sm">
              Nenhum acesso direto concedido.
            </p>
          ) : (
            <ul className="mt-5 divide-y border-border border-y">
              {member.accessGrants.map((grant) => (
                <li
                  className="flex items-center justify-between gap-4 py-4"
                  key={grant.id}
                >
                  <div>
                    <p className="font-medium">{grant.label}</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {grant.resourceType} · {grant.permission}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {grant.expiresAt
                      ? `até ${date(grant.expiresAt)}`
                      : "sem prazo"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="activity-heading"
          className="paper-surface border p-6"
        >
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="activity-heading">
              Atividades
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              {member.assignments.length} atribuídas
            </span>
          </div>
          {member.assignments.length === 0 ? (
            <p className="mt-5 text-muted-foreground text-sm">
              Nenhuma atividade atribuída.
            </p>
          ) : (
            <ul className="mt-5 divide-y border-border border-y">
              {member.assignments.map((assignment) => (
                <li
                  className="flex items-center justify-between gap-4 py-4"
                  key={assignment.activity.id}
                >
                  <div>
                    <p className="font-medium">{assignment.activity.title}</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Prazo: {date(assignment.dueAt)}
                    </p>
                  </div>
                  <Link
                    className="text-brand-structural text-xs underline underline-offset-4"
                    href={`/atividades/${assignment.activity.slug}`}
                  >
                    Abrir
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="progress-heading"
          className="paper-surface border p-6"
        >
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="progress-heading">
              Percurso
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              {member.progress.length} registros
            </span>
          </div>
          {member.progress.length === 0 ? (
            <p className="mt-5 text-muted-foreground text-sm">
              Ainda não há progresso registrado.
            </p>
          ) : (
            <ul className="mt-5 divide-y border-border border-y">
              {member.progress.map((item) => (
                <li
                  className="flex items-center justify-between gap-4 py-4"
                  key={item.lesson.slug}
                >
                  <div>
                    <p className="font-medium">{item.lesson.title}</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {item.lesson.module.course.title} ·{" "}
                      {item.lesson.module.title}
                    </p>
                  </div>
                  <Badge
                    variant={
                      item.status === "COMPLETED" ? "default" : "outline"
                    }
                  >
                    {item.status === "COMPLETED" ? "Concluída" : "Em andamento"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="submissions-heading"
          className="paper-surface border p-6"
        >
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="submissions-heading">
              Entregas e feedback
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              {member.submissions.length}
            </span>
          </div>
          {member.submissions.length === 0 ? (
            <p className="mt-5 text-muted-foreground text-sm">
              Nenhuma entrega registrada.
            </p>
          ) : (
            <ul className="mt-5 divide-y border-border border-y">
              {member.submissions.map((submission) => (
                <li className="py-4" key={submission.id}>
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">{submission.activity.title}</p>
                    <Badge
                      variant={submission.feedback ? "default" : "outline"}
                    >
                      {submission.feedback
                        ? "Feedback enviado"
                        : submission.status}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-muted-foreground text-sm">
                    {submission.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="meetings-heading"
          className="paper-surface border p-6"
        >
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="meetings-heading">
              Encontros
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              {member.meetings.length}
            </span>
          </div>
          {member.meetings.length === 0 ? (
            <p className="mt-5 text-muted-foreground text-sm">
              Nenhum encontro individual atribuído.
            </p>
          ) : (
            <ul className="mt-5 divide-y border-border border-y">
              {member.meetings.map((meeting) => (
                <li
                  className="flex items-center justify-between gap-4 py-4"
                  key={meeting.id}
                >
                  <div>
                    <p className="font-medium">{meeting.title}</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {date(meeting.startsAt, meeting.timezone)} ·{" "}
                      {meeting.kind}
                    </p>
                  </div>
                  <Link
                    className="text-brand-structural text-xs underline underline-offset-4"
                    href={`/encontros/${meeting.id}`}
                  >
                    Abrir
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="community-heading"
          className="paper-surface border p-6"
        >
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="community-heading">
              Comunidade
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              {member.posts.length}
            </span>
          </div>
          {member.posts.length === 0 ? (
            <p className="mt-5 text-muted-foreground text-sm">
              Este membro ainda não publicou.
            </p>
          ) : (
            <ul className="mt-5 divide-y border-border border-y">
              {member.posts.map((post) => (
                <li
                  className="flex items-center justify-between gap-4 py-4"
                  key={post.id}
                >
                  <div>
                    <p className="font-medium">{post.title}</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {post.space?.title ?? "Feed geral"} · {post.status}
                    </p>
                  </div>
                  {post.status === "PUBLISHED" && (
                    <Link
                      className="text-brand-structural text-xs underline underline-offset-4"
                      href={communityPostHref(post)}
                    >
                      Abrir
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
};

export default AdminMemberDetailPage;
