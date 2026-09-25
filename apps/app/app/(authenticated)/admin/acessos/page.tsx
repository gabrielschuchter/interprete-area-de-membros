import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { getAccessAdminOverview } from "@/lib/access-admin";
import { requireAdmin } from "@/lib/authorization";
import { removeAccessGrant, setAccessGrant } from "../actions";

const resourceTypeLabel: Record<string, string> = {
  COURSE: "curso",
  MODULE: "módulo",
  LESSON: "aula",
  ASSET: "material/gravação",
};

const AccessAdminPage = async () => {
  await requireAdmin();
  const { members, resources } = await getAccessAdminOverview();
  const resourceLabels = new Map(
    resources.map((resource) => [
      `${resource.type}:${resource.id}`,
      resource.label,
    ])
  );

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <header className="flex flex-col justify-between gap-6 border-border border-b pb-8 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <p className="brand-eyebrow">Admin · acessos</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            Quem pode estudar o quê.
          </h1>
          <p className="mt-5 text-muted-foreground leading-7">
            Conceda acesso por curso, módulo, aula ou material. O acesso ao pai
            é herdado pelos descendentes, e as gravações individuais continuam
            restritas ao membro autorizado.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/membros">Gerenciar papéis</Link>
        </Button>
      </header>

      <section
        aria-labelledby="grant-heading"
        className="paper-surface mt-10 border p-5 sm:p-6"
      >
        <div className="flex flex-col gap-2 border-border border-b pb-4">
          <h2 className="font-display text-3xl" id="grant-heading">
            Conceder acesso
          </h2>
          <p className="text-muted-foreground text-sm">
            A operação é validada no servidor e é idempotente: repetir a
            concessão não cria duplicatas.
          </p>
        </div>

        {members.length === 0 || resources.length === 0 ? (
          <p className="mt-5 text-muted-foreground text-sm">
            {members.length === 0
              ? "Nenhum membro sincronizado ainda. A pessoa precisa entrar uma vez para o Clerk criar o perfil interno."
              : "Nenhum conteúdo importado ou publicado está disponível para concessão."}
          </p>
        ) : (
          <form
            action={setAccessGrant}
            className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
          >
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Membro</span>
              <select
                className="h-10 rounded-md border border-input bg-background px-3"
                name="memberId"
                required
              >
                <option value="">Escolha uma pessoa</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName ??
                      member.profile?.username ??
                      member.id}
                    {member.email ? ` · ${member.email}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Conteúdo</span>
              <select
                className="h-10 min-w-0 rounded-md border border-input bg-background px-3"
                name="resourceId"
                required
              >
                <option value="">Escolha um recurso</option>
                {resources.map((resource) => (
                  <option
                    key={`${resource.type}:${resource.id}`}
                    value={`${resource.type}:${resource.id}`}
                  >
                    {resource.label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit">Conceder acesso</Button>
          </form>
        )}
      </section>

      <section aria-labelledby="members-access-heading" className="mt-10">
        <div className="flex items-end justify-between border-border border-b pb-3">
          <h2 className="font-display text-3xl" id="members-access-heading">
            Acessos atuais
          </h2>
          <span className="font-data text-muted-foreground text-xs">
            {members.length.toString().padStart(2, "0")}
          </span>
        </div>

        {members.length === 0 ? (
          <div className="paper-surface mt-5 border p-8">
            <p className="text-muted-foreground">
              Ainda não há membros para administrar.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {members.map((member) => (
              <article className="paper-surface border p-5" key={member.id}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h3 className="font-medium">
                      {member.displayName ??
                        member.profile?.username ??
                        "Membro sem nome"}
                    </h3>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {member.profile
                        ? `@${member.profile.username}`
                        : "Perfil ainda não configurado"}
                      {member.email ? ` · ${member.email}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {member.accessGrants.length} concessões
                  </Badge>
                </div>

                {member.accessGrants.length === 0 ? (
                  <p className="mt-5 border-border border-t pt-4 text-muted-foreground text-sm">
                    Nenhum acesso direto. Membros sem concessão não recebem o
                    conteúdo importado.
                  </p>
                ) : (
                  <ul className="mt-5 grid gap-2 border-border border-t pt-4">
                    {member.accessGrants.map((grant) => {
                      const key = `${grant.resourceType}:${grant.resourceId}`;
                      return (
                        <li
                          className="flex flex-col justify-between gap-3 border-border border-b pb-2 last:border-b-0 sm:flex-row sm:items-center"
                          key={grant.id}
                        >
                          <div>
                            <p className="text-sm">
                              {resourceLabels.get(key) ?? "Recurso removido"}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {resourceTypeLabel[grant.resourceType] ??
                                grant.resourceType}{" "}
                              · {grant.permission.toLowerCase()}
                            </p>
                          </div>
                          <form action={removeAccessGrant}>
                            <input
                              name="grantId"
                              type="hidden"
                              value={grant.id}
                            />
                            <Button size="sm" type="submit" variant="ghost">
                              Remover
                            </Button>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default AccessAdminPage;
