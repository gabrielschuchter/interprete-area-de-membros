import { database, LearningTaskRecurrence } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { requireStaff } from "@/lib/authorization";
import {
  createAssignedLearningTask,
  createStudyCampaign,
  setStudyCampaignPublication,
} from "../../tarefas/actions";

interface AdminStudyPageProperties {
  readonly searchParams: Promise<{ readonly resultado?: string }>;
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);

const campaignStatusLabel = (campaign: {
  readonly archivedAt: Date | null;
  readonly publishedAt: Date | null;
}) => {
  if (campaign.archivedAt) {
    return "Arquivada";
  }
  return campaign.publishedAt ? "Publicada" : "Rascunho";
};

const AdminStudyPage = async ({ searchParams }: AdminStudyPageProperties) => {
  await requireStaff();
  const [query, students, campaigns] = await Promise.all([
    searchParams,
    database.member.findMany({
      where: { role: "MEMBER", deactivatedAt: null },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      take: 500,
      select: { id: true, displayName: true, email: true },
    }),
    database.studyCampaign.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        targetMinutes: true,
        startsAt: true,
        endsAt: true,
        publishedAt: true,
        archivedAt: true,
      },
    }),
  ]);
  const messages: Record<string, string> = {
    "campanha-atualizada": "A publicação da meta coletiva foi atualizada.",
    "campanha-criada": "A meta coletiva foi salva.",
    "tarefa-atribuida":
      "A tarefa foi atribuída e notificações duráveis foram enfileiradas.",
  };

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
        href="/admin"
      >
        ← Área do professor
      </Link>
      <header className="mt-8 max-w-3xl">
        <p className="brand-eyebrow">Gestão acadêmica</p>
        <h1 className="mt-3 font-display text-5xl leading-none">
          Metas e tarefas
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Crie tarefas individuais ou para a fotografia atual de todos os
          alunos, e publique um objetivo coletivo medido pelo tempo de estudo
          ativo.
        </p>
      </header>
      {query.resultado && messages[query.resultado] && (
        <output className="mt-6 block rounded-md border border-brand-action/40 bg-brand-action/5 p-4 text-sm">
          {messages[query.resultado]}
        </output>
      )}

      <section
        aria-labelledby="assign-task-heading"
        className="mt-10 rounded-xl border bg-card p-5 sm:p-8"
      >
        <p className="brand-eyebrow">Orientação para alunos</p>
        <h2 className="mt-2 font-display text-3xl" id="assign-task-heading">
          Atribuir uma tarefa
        </h2>
        <form action={createAssignedLearningTask} className="mt-6 grid gap-5">
          <label className="grid gap-2" htmlFor="assigned-task-title">
            <span className="font-medium text-sm">Título</span>
            <Input
              id="assigned-task-title"
              maxLength={180}
              name="title"
              required
            />
          </label>
          <label className="grid gap-2" htmlFor="assigned-task-description">
            <span className="font-medium text-sm">Descrição</span>
            <Textarea
              id="assigned-task-description"
              maxLength={2000}
              name="description"
              rows={3}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2" htmlFor="assigned-task-recurrence">
              <span className="font-medium text-sm">Frequência</span>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                id="assigned-task-recurrence"
                name="recurrence"
              >
                <option value={LearningTaskRecurrence.ONCE}>Uma vez</option>
                <option value={LearningTaskRecurrence.DAILY}>Diária</option>
                <option value={LearningTaskRecurrence.WEEKLY}>Semanal</option>
                <option value={LearningTaskRecurrence.MONTHLY}>Mensal</option>
              </select>
            </label>
            <label className="grid gap-2" htmlFor="assigned-task-due">
              <span className="font-medium text-sm">Prazo opcional</span>
              <Input id="assigned-task-due" name="dueAt" type="date" />
            </label>
          </div>
          <fieldset className="grid gap-3">
            <legend className="font-medium text-sm">Público</legend>
            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <input
                className="mt-1 accent-primary"
                defaultChecked
                name="audience"
                type="radio"
                value="SELECTED_MEMBERS"
              />
              <span>Alunos selecionados</span>
            </label>
            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <input
                className="mt-1 accent-primary"
                name="audience"
                type="radio"
                value="ALL_MEMBERS"
              />
              <span>Todos os alunos existentes no momento da atribuição</span>
            </label>
          </fieldset>
          <label className="grid gap-2" htmlFor="assigned-task-members">
            <span className="font-medium text-sm">
              Escolha um ou mais alunos
            </span>
            <select
              className="min-h-44 rounded-md border bg-background px-3 py-2 text-sm"
              id="assigned-task-members"
              multiple
              name="memberIds"
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.displayName ?? student.email ?? student.id}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground text-xs">
              {students.length} alunos ativos. A seleção será registrada como
              fotografia do público.
            </span>
          </label>
          <Button className="w-fit" type="submit">
            Atribuir tarefa
          </Button>
        </form>
      </section>

      <section
        aria-labelledby="campaign-heading"
        className="mt-12 rounded-xl border bg-card p-5 sm:p-8"
      >
        <p className="brand-eyebrow">Objetivo coletivo</p>
        <h2 className="mt-2 font-display text-3xl" id="campaign-heading">
          Criar meta dos alunos
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6">
          A contribuição soma intervalos educacionais ativos dos alunos no
          período. O dashboard mostra apenas o agregado, sem horas individuais.
        </p>
        <form action={createStudyCampaign} className="mt-6 grid gap-4">
          <label className="grid gap-2" htmlFor="campaign-title">
            <span className="font-medium text-sm">Título</span>
            <Input id="campaign-title" maxLength={180} name="title" required />
          </label>
          <label className="grid gap-2" htmlFor="campaign-description">
            <span className="font-medium text-sm">Descrição</span>
            <Textarea
              id="campaign-description"
              maxLength={2000}
              name="description"
              rows={3}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2" htmlFor="campaign-target">
              <span className="font-medium text-sm">
                Objetivo total · minutos
              </span>
              <Input
                id="campaign-target"
                max={100_800}
                min={15}
                name="targetMinutes"
                required
                type="number"
              />
            </label>
            <label className="grid gap-2" htmlFor="campaign-start">
              <span className="font-medium text-sm">
                Início · horário de Brasília
              </span>
              <Input
                id="campaign-start"
                name="startsAt"
                required
                type="datetime-local"
              />
            </label>
            <label className="grid gap-2" htmlFor="campaign-end">
              <span className="font-medium text-sm">
                Fim · horário de Brasília
              </span>
              <Input
                id="campaign-end"
                name="endsAt"
                required
                type="datetime-local"
              />
            </label>
          </div>
          <label className="flex items-start gap-3 rounded-md border p-4 text-sm leading-6">
            <input
              className="mt-1 accent-primary"
              name="published"
              type="checkbox"
              value="true"
            />
            <span>Publicar agora para todos os alunos elegíveis.</span>
          </label>
          <Button className="w-fit" type="submit">
            Salvar meta coletiva
          </Button>
        </form>
      </section>

      <section aria-labelledby="campaign-list-heading" className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
          <div>
            <p className="brand-eyebrow">Persistidas no banco</p>
            <h2
              className="mt-2 font-display text-3xl"
              id="campaign-list-heading"
            >
              Metas coletivas
            </h2>
          </div>
          <Badge variant="outline">{campaigns.length} registros</Badge>
        </div>
        {campaigns.length ? (
          <div className="mt-5 divide-y rounded-xl border bg-card">
            {campaigns.map((campaign) => (
              <article
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                key={campaign.id}
              >
                <div>
                  <h3 className="font-medium">{campaign.title}</h3>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {campaign.targetMinutes.toLocaleString("pt-BR")} minutos ·{" "}
                    {formatDate(campaign.startsAt)} a{" "}
                    {formatDate(campaign.endsAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge
                    variant={campaign.publishedAt ? "default" : "secondary"}
                  >
                    {campaignStatusLabel(campaign)}
                  </Badge>
                  {!campaign.archivedAt && (
                    <form action={setStudyCampaignPublication}>
                      <input
                        name="campaignId"
                        type="hidden"
                        value={campaign.id}
                      />
                      <input
                        name="published"
                        type="hidden"
                        value={campaign.publishedAt ? "false" : "true"}
                      />
                      <Button size="sm" type="submit" variant="outline">
                        {campaign.publishedAt
                          ? "Retirar publicação"
                          : "Publicar"}
                      </Button>
                    </form>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-muted-foreground">
            Nenhuma meta coletiva cadastrada.
          </p>
        )}
      </section>
    </main>
  );
};

export default AdminStudyPage;
