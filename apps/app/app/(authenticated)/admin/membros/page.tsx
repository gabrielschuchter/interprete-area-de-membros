import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { getStaffMembers } from "@/lib/profile";
import { setMemberRole } from "../actions";

const roleLabel: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Professor",
  MEMBER: "Membro",
};

const initials = (name: string | null) =>
  (name ?? "M")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const AdminMembersPage = async () => {
  const members = await getStaffMembers();

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <header className="flex flex-col justify-between gap-6 border-border border-b pb-8 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <p className="brand-eyebrow">Admin · membros</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            Quem está na escola.
          </h1>
          <p className="mt-5 text-muted-foreground leading-7">
            Consulte a identidade pública e ajuste papéis de acesso sem expor
            dados privados na comunidade.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/membros">Abrir diretório público</Link>
        </Button>
      </header>

      <section aria-labelledby="members-heading" className="mt-10">
        <div className="flex items-end justify-between border-border border-b pb-3">
          <h2 className="font-display text-3xl" id="members-heading">
            Membros cadastrados
          </h2>
          <span className="font-data text-muted-foreground text-xs">
            {members.length.toString().padStart(2, "0")}
          </span>
        </div>

        {members.length === 0 ? (
          <div className="paper-surface mt-5 border p-8">
            <p className="text-muted-foreground">
              Nenhum membro sincronizado ainda. O perfil é criado quando uma
              pessoa autenticada entra na área de membros.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {members.map((member) => (
              <article
                className="paper-surface flex flex-col gap-5 border p-5 sm:flex-row sm:items-center sm:justify-between"
                key={member.id}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar className="size-12 shrink-0">
                    <AvatarImage
                      alt=""
                      src={
                        member.profile?.username
                          ? (member.avatarUrl ?? undefined)
                          : undefined
                      }
                    />
                    <AvatarFallback>
                      {initials(member.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium">
                        {member.displayName ?? "Membro sem nome"}
                      </h3>
                      <Badge variant="outline">{roleLabel[member.role]}</Badge>
                    </div>
                    <p className="mt-1 truncate text-muted-foreground text-sm">
                      {member.profile
                        ? `@${member.profile.username}`
                        : "Perfil ainda não configurado"}
                      {member.profile?.headline
                        ? ` · ${member.profile.headline}`
                        : ""}
                    </p>
                    <p className="mt-1 truncate text-muted-foreground text-xs">
                      {member.email ?? "Email não sincronizado"}
                    </p>
                  </div>
                </div>

                <form
                  action={setMemberRole}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input name="memberId" type="hidden" value={member.id} />
                  <label className="block" htmlFor={`role-${member.id}`}>
                    <span className="sr-only">
                      Papel de {member.displayName ?? "membro"}
                    </span>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      defaultValue={member.role}
                      id={`role-${member.id}`}
                      name="role"
                    >
                      <option value="MEMBER">Membro</option>
                      <option value="TEACHER">Professor</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </label>
                  <Button size="sm" type="submit" variant="outline">
                    Salvar papel
                  </Button>
                  {member.profile && (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/membros/${member.profile.username}`}>
                        Ver perfil
                      </Link>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/membros/${member.id}`}>
                      Acompanhar aluno
                    </Link>
                  </Button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default AdminMembersPage;
