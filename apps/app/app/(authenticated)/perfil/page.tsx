import { currentUser } from "@repo/auth/server";
import { database } from "@repo/database";

const roleLabel = (role: string) => {
  if (role === "TEACHER") {
    return "Professor";
  }
  if (role === "ADMIN") {
    return "Admin";
  }
  return "Estudante";
};

import { Badge } from "@repo/design-system/components/ui/badge";
import {
  BookOpenIcon,
  CheckCircle2Icon,
  MailIcon,
  UserRoundIcon,
} from "lucide-react";
import { getMemberRole } from "@/lib/authorization";
import { requireMemberId } from "@/lib/learning";
import { MemberHeader } from "../components/member-header";

const ProfilePage = async () => {
  const memberId = await requireMemberId();
  const [user, role, completedLessons, enrollments] = await Promise.all([
    currentUser(),
    getMemberRole(memberId),
    database.lessonProgress.count({ where: { memberId, status: "COMPLETED" } }),
    database.enrollment.count({ where: { memberId } }),
  ]);
  const name = user?.fullName ?? user?.firstName ?? "Estudante";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <div className="min-h-svh bg-background">
      <MemberHeader section="Perfil" />
      <main className="mx-auto w-full max-w-[1120px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <header className="max-w-3xl">
          <p className="brand-eyebrow">Caderno do estudante · identidade</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
            Seu lugar no percurso.
          </h1>
          <p className="mt-5 max-w-2xl text-muted-foreground leading-7">
            Este espaço reúne os dados essenciais da sua conta e uma leitura
            simples do caminho que você já percorreu.
          </p>
        </header>
        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="paper-surface border p-6 sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="grid size-14 place-items-center rounded-full bg-brand-structural text-primary-foreground">
                  <UserRoundIcon aria-hidden="true" />
                </div>
                <div>
                  <p className="brand-eyebrow">Membro</p>
                  <h2 className="mt-1 font-display text-3xl">{name}</h2>
                </div>
              </div>
              <Badge variant="outline">{roleLabel(role)}</Badge>
            </div>
            <div className="mt-10 grid gap-4 border-border border-t pt-6 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <MailIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 text-brand-action"
                />
                <div>
                  <p className="brand-eyebrow">E-mail</p>
                  <p className="mt-2 break-all text-sm">
                    {email || "Gerenciado pelo Clerk"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BookOpenIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 text-brand-action"
                />
                <div>
                  <p className="brand-eyebrow">Cursos iniciados</p>
                  <p className="mt-2 text-sm">{enrollments}</p>
                </div>
              </div>
            </div>
          </section>
          <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="paper-surface border p-6">
              <CheckCircle2Icon
                aria-hidden="true"
                className="size-5 text-brand-action"
              />
              <p className="mt-5 font-data text-3xl text-brand-structural">
                {completedLessons}
              </p>
              <p className="mt-2 text-muted-foreground text-sm">
                aulas concluídas
              </p>
            </div>
            <div className="paper-surface border p-6">
              <p className="brand-eyebrow">Conta</p>
              <p className="mt-3 font-display text-2xl">Acesso protegido</p>
              <p className="mt-2 text-muted-foreground text-sm leading-6">
                Sua identidade e sessão são administradas pelo Clerk.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
