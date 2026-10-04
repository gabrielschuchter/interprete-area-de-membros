import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import Link from "next/link";
import { requireMemberId } from "@/lib/learning";
import {
  getMemberTaskHistory,
  getStudyDashboardData,
} from "@/lib/study-dashboard";
import {
  archivePersonalLearningTask,
  completeLearningTaskOccurrence,
  createPersonalLearningTask,
  savePersonalStudyGoal,
} from "./actions";

interface TasksPageProperties {
  readonly searchParams: Promise<{ readonly resultado?: string }>;
}

const recurrenceLabel: Record<string, string> = {
  DAILY: "Diária",
  MONTHLY: "Mensal",
  ONCE: "Uma vez",
  WEEKLY: "Semanal",
};

const TasksPage = async ({ searchParams }: TasksPageProperties) => {
  const [memberId, query] = await Promise.all([
    requireMemberId(),
    searchParams,
  ]);
  const [dashboard, history] = await Promise.all([
    getStudyDashboardData(memberId),
    getMemberTaskHistory(memberId),
  ]);
  const resultMessages: Record<string, string> = {
    "meta-salva": "Sua meta foi salva e entrou no histórico.",
    "tarefa-arquivada": "A tarefa pessoal foi arquivada.",
    "tarefa-criada": "A tarefa foi salva na sua conta.",
    "tarefa-concluida": "A conclusão foi registrada.",
  };
  const message = query.resultado ? resultMessages[query.resultado] : undefined;

  return (
    <main className="mx-auto w-full max-w-[1120px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
        href="/"
      >
        ← Início
      </Link>
      <header className="mt-8 max-w-3xl">
        <p className="brand-eyebrow">Seu percurso · metas e tarefas</p>
        <h1 className="mt-3 font-display text-5xl leading-none sm:text-6xl">
          Um passo de cada vez.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Suas metas e tarefas ficam na sua conta e acompanham você em qualquer
          dispositivo. O histórico registra o período em que cada tarefa foi
          concluída.
        </p>
      </header>

      {message && (
        <output className="mt-6 block rounded-md border border-brand-action/40 bg-brand-action/5 p-4 text-sm">
          {message}
        </output>
      )}

      <section aria-labelledby="goals-heading" className="mt-10">
        <div className="border-b pb-4">
          <p className="brand-eyebrow">Intenção própria</p>
          <h2 className="mt-2 font-display text-3xl" id="goals-heading">
            Metas de estudo
          </h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {(
            [
              ["WEEKLY", "Meta semanal", dashboard.goals.weeklyMinutes],
              ["MONTHLY", "Meta mensal", dashboard.goals.monthlyMinutes],
            ] as const
          ).map(([period, label, target]) => (
            <form
              action={savePersonalStudyGoal}
              className="rounded-xl border bg-card p-5 sm:p-6"
              key={period}
            >
              <input name="period" type="hidden" value={period} />
              <label className="grid gap-2" htmlFor={`goal-${period}`}>
                <span className="font-medium">{label} · minutos</span>
                <span className="text-muted-foreground text-sm">
                  {target
                    ? `Atual: ${Math.floor(target / 60)} h ${target % 60} min`
                    : "Escolha uma meta que faça sentido para você."}
                </span>
                <Input
                  defaultValue={target ?? ""}
                  id={`goal-${period}`}
                  max={100_800}
                  min={15}
                  name="targetMinutes"
                  placeholder="Ex.: 300"
                  required
                  type="number"
                />
              </label>
              <Button
                className="mt-4"
                size="sm"
                type="submit"
                variant="outline"
              >
                Salvar meta
              </Button>
            </form>
          ))}
        </div>
        {dashboard.campaign && (
          <article className="paper-surface mt-5 border border-brand-action/35 p-5 sm:p-7">
            <p className="brand-eyebrow">Objetivo coletivo dos alunos</p>
            <h3 className="mt-2 font-display text-2xl">
              {dashboard.campaign.title}
            </h3>
            {dashboard.campaign.description && (
              <p className="mt-2 max-w-2xl text-muted-foreground leading-6">
                {dashboard.campaign.description}
              </p>
            )}
            <p className="mt-4 font-data text-sm">
              {dashboard.campaign.contributedMinutes.toLocaleString("pt-BR")} de{" "}
              {dashboard.campaign.targetMinutes.toLocaleString("pt-BR")} minutos
              · {dashboard.campaign.memberCount} alunos elegíveis
            </p>
            <div
              aria-label={`${dashboard.campaign.contributedMinutes} de ${dashboard.campaign.targetMinutes} minutos estudados pela comunidade`}
              aria-valuemax={dashboard.campaign.targetMinutes}
              aria-valuemin={0}
              aria-valuenow={Math.min(
                dashboard.campaign.contributedMinutes,
                dashboard.campaign.targetMinutes
              )}
              className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-brand-action"
                style={{
                  width: `${Math.min(100, (dashboard.campaign.contributedMinutes / dashboard.campaign.targetMinutes) * 100)}%`,
                }}
              />
            </div>
          </article>
        )}
      </section>

      <section aria-labelledby="tasks-heading" className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
          <div>
            <p className="brand-eyebrow">Rotina persistente</p>
            <h2 className="mt-2 font-display text-3xl" id="tasks-heading">
              Tarefas
            </h2>
          </div>
          <Badge variant="outline">{dashboard.openTasks} em aberto</Badge>
        </div>
        {dashboard.tasks.length ? (
          <div className="mt-5 divide-y rounded-xl border bg-card">
            {dashboard.tasks.map((task) => (
              <article
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                key={task.id}
              >
                <div className="flex min-w-0 items-start gap-3">
                  {task.isCompleted ? (
                    <CheckCircle2Icon
                      aria-label="Concluída neste período"
                      className="mt-1 size-5 shrink-0 text-brand-action-text"
                    />
                  ) : (
                    <CircleIcon
                      aria-hidden="true"
                      className="mt-1 size-5 shrink-0 text-muted-foreground"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-medium">{task.title}</h3>
                    {task.description && (
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground text-sm leading-6">
                        {task.description}
                      </p>
                    )}
                    <p className="mt-2 text-muted-foreground text-xs">
                      {recurrenceLabel[task.recurrence] ?? "Tarefa"}
                      {task.dueAt
                        ? ` · prazo ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(task.dueAt)}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  {!task.isCompleted && (
                    <form action={completeLearningTaskOccurrence}>
                      <input name="taskId" type="hidden" value={task.id} />
                      <Button size="sm" type="submit">
                        Concluir
                      </Button>
                    </form>
                  )}
                  {task.createdByMemberId === memberId && (
                    <form action={archivePersonalLearningTask}>
                      <input name="taskId" type="hidden" value={task.id} />
                      <Button size="sm" type="submit" variant="ghost">
                        Arquivar
                      </Button>
                    </form>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed p-6 text-muted-foreground">
            Nenhuma tarefa ativa. Você pode criar uma para sua rotina ou receber
            uma do professor.
          </p>
        )}
      </section>

      <section
        aria-labelledby="create-task-heading"
        className="mt-12 rounded-xl border bg-card p-5 sm:p-7"
      >
        <p className="brand-eyebrow">Planejamento pessoal</p>
        <h2 className="mt-2 font-display text-2xl" id="create-task-heading">
          Criar uma tarefa
        </h2>
        <form action={createPersonalLearningTask} className="mt-5 grid gap-4">
          <label className="grid gap-2" htmlFor="personal-task-title">
            <span className="font-medium text-sm">Título</span>
            <Input
              id="personal-task-title"
              maxLength={180}
              name="title"
              required
            />
          </label>
          <label className="grid gap-2" htmlFor="personal-task-description">
            <span className="font-medium text-sm">Detalhes</span>
            <Textarea
              id="personal-task-description"
              maxLength={2000}
              name="description"
              rows={3}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2" htmlFor="personal-task-recurrence">
              <span className="font-medium text-sm">Frequência</span>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                id="personal-task-recurrence"
                name="recurrence"
              >
                <option value="ONCE">Uma vez</option>
                <option value="DAILY">Diária</option>
                <option value="WEEKLY">Semanal</option>
                <option value="MONTHLY">Mensal</option>
              </select>
            </label>
            <label className="grid gap-2" htmlFor="personal-task-due">
              <span className="font-medium text-sm">Prazo opcional</span>
              <Input id="personal-task-due" name="dueAt" type="date" />
            </label>
          </div>
          <Button className="w-fit" type="submit">
            Salvar tarefa
          </Button>
        </form>
      </section>

      <section aria-labelledby="task-history-heading" className="mt-14">
        <p className="brand-eyebrow">Registro</p>
        <h2 className="mt-2 font-display text-3xl" id="task-history-heading">
          Histórico de tarefas
        </h2>
        {history.length ? (
          <ul className="mt-5 divide-y border-y">
            {history.map((entry) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 py-4"
                key={`${entry.periodKey}:${entry.completedAt.toISOString()}`}
              >
                <span>{entry.task.title}</span>
                <span className="text-muted-foreground text-sm">
                  {recurrenceLabel[entry.task.recurrence]} ·{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "medium",
                    timeZone: "America/Sao_Paulo",
                  }).format(entry.completedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-muted-foreground text-sm">
            As conclusões registradas aparecerão aqui.
          </p>
        )}
      </section>
    </main>
  );
};

export default TasksPage;
