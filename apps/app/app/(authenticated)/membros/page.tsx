import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { getMemberDirectory } from "@/lib/profile";

interface MembersPageProperties {
  readonly searchParams: Promise<{ q?: string }>;
}

const roleLabel = (role: string) => {
  if (role === "TEACHER") {
    return "Professor";
  }
  if (role === "ADMIN") {
    return "Admin";
  }
  return "Membro";
};

const whitespacePattern = /\s+/;

const initials = (value: string) =>
  value
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";

const MembersPage = async ({ searchParams }: MembersPageProperties) => {
  const { q = "" } = await searchParams;
  const members = await getMemberDirectory(q);

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1120px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <header className="max-w-3xl">
          <p className="brand-eyebrow">Escola · pessoas</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
            Quem está pensando junto?
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground leading-7 sm:text-lg">
            Encontre colegas, professores e outras pessoas que fazem parte do
            percurso do Interprete.
          </p>
        </header>

        <form className="mt-10 flex max-w-2xl gap-3" method="get">
          <label className="min-w-0 flex-1" htmlFor="members-search">
            <span className="sr-only">Buscar membros</span>
            <Input
              defaultValue={q}
              id="members-search"
              name="q"
              placeholder="Nome, identificação ou interesse"
            />
          </label>
          <Button type="submit">
            <SearchIcon aria-hidden="true" /> Buscar
          </Button>
        </form>

        <section aria-labelledby="members-heading" className="mt-14">
          <div className="flex items-end justify-between border-border border-b pb-4">
            <div>
              <p className="brand-eyebrow">Diretório</p>
              <h2 className="mt-2 font-display text-3xl" id="members-heading">
                Membros da escola
              </h2>
            </div>
            <span className="font-data text-muted-foreground text-xs">
              {members.length}
            </span>
          </div>

          {members.length === 0 ? (
            <div className="paper-surface mt-6 border p-8 sm:p-12">
              <p className="brand-eyebrow">Nenhuma pessoa encontrada</p>
              <h3 className="mt-4 font-display text-3xl">
                Tente outra palavra de busca.
              </h3>
              <p className="mt-3 max-w-xl text-muted-foreground leading-7">
                O diretório mostra apenas perfis reais que já foram criados na
                plataforma.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => {
                const name = member.displayName ?? member.username;

                return (
                  <Link
                    className="motion-card paper-surface group border p-5 hover:border-brand-action"
                    href={`/membros/${member.username}`}
                    key={member.username}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="size-12 shrink-0">
                        {member.avatarUrl ? (
                          <AvatarImage alt="" src={member.avatarUrl} />
                        ) : null}
                        <AvatarFallback className="bg-brand-structural text-primary-foreground">
                          {initials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-medium group-hover:text-brand-structural">
                            {name}
                          </h3>
                          {member.member.role !== "MEMBER" && (
                            <Badge className="text-[0.65rem]" variant="outline">
                              {roleLabel(member.member.role)}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 truncate text-muted-foreground text-sm">
                          @{member.username}
                        </p>
                      </div>
                    </div>
                    {member.headline && (
                      <p className="mt-5 line-clamp-2 text-muted-foreground text-sm leading-6">
                        {member.headline}
                      </p>
                    )}
                    {member.interests.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {member.interests.slice(0, 3).map((interest) => (
                          <Badge key={interest} variant="secondary">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default MembersPage;
