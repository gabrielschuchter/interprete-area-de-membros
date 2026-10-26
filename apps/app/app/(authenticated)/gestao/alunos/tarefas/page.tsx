import Link from "next/link";
import { getGestaoAssignmentOptions } from "@/lib/gestao-assignments";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { getGestaoCampaigns, getGestaoTasks } from "@/lib/gestao-tasks";
import {
  type CampaignStateKey,
  campaignKind,
  formatHours,
  type TaskRecurrence,
  type TaskStateKey,
  taskRecurrenceLabels,
  taskStateOptions,
} from "@/lib/gestao-tasks-domain";
import { GestaoFilterBar } from "../../gestao-filter-bar";
import { GestaoIcon } from "../../gestao-icon";
import {
  GoalMenu,
  NewGoalButton,
  NewTaskButton,
  TaskRowMenu,
} from "./task-dialogs";

const base = "/gestao/alunos/tarefas";

const resultMessages: Record<string, string> = {
  indisponivel: "Esse item não está mais disponível. Atualize a página.",
  "meta-arquivada": "Meta arquivada. Os alunos deixam de vê-la.",
  "meta-criada": "Meta coletiva salva.",
  "meta-publicada": "Meta publicada para os alunos.",
  "meta-retirada": "Meta retirada de publicação.",
  "tarefa-arquivada": "Tarefa arquivada.",
  "tarefa-criada":
    "Tarefa enviada. Os alunos recebem o aviso e a veem no Planejamento.",
};

const weekdayFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
  weekday: "short",
});
const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  timeZone: "America/Sao_Paulo",
});
const monthFormat = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: "America/Sao_Paulo",
});

const recurrenceDue: Record<TaskRecurrence, string> = {
  DAILY: "Todos os dias",
  MONTHLY: "Todo mês",
  ONCE: "Sem prazo",
  WEEKLY: "Toda semana",
};

const dueLabel = (row: {
  readonly dueAt: Date | null;
  readonly recurrence: TaskRecurrence;
}) => {
  if (row.recurrence === "ONCE") {
    return row.dueAt ? weekdayFormat.format(row.dueAt) : recurrenceDue.ONCE;
  }
  return recurrenceDue[row.recurrence];
};

const taskChips: Record<TaskStateKey, readonly [string, string]> = {
  active: ["check-circle", "active"],
  closed: ["clock", "muted"],
  scheduled: ["clock", "warn"],
};

const campaignChips: Record<CampaignStateKey, string> = {
  archived: "muted",
  closed: "muted",
  draft: "neutral",
  running: "active",
  scheduled: "warn",
};

const rangeLabel = (startsAt: Date, endsAt: Date) => {
  const sameMonth = monthFormat.format(startsAt) === monthFormat.format(endsAt);
  return sameMonth
    ? `${dayFormat.format(startsAt)} a ${dayFormat.format(endsAt)} ${monthFormat.format(endsAt)}`
    : `${dayFormat.format(startsAt)} ${monthFormat.format(startsAt)} a ${dayFormat.format(endsAt)} ${monthFormat.format(endsAt)}`;
};

type Campaign = Awaited<ReturnType<typeof getGestaoCampaigns>>[number];

const GoalCard = ({
  campaign,
  canManage,
}: {
  readonly campaign: Campaign;
  readonly canManage: boolean;
}) => {
  const percent = Math.min(
    100,
    Math.round((campaign.contributedMinutes / campaign.targetMinutes) * 100)
  );
  return (
    <article className="gk-goalcard">
      <header>
        <span className="gk-goalcard-kind">
          {campaignKind(campaign.startsAt, campaign.endsAt)} ·{" "}
          {rangeLabel(campaign.startsAt, campaign.endsAt)}
        </span>
        <span className="gk-chip" data-tone={campaignChips[campaign.state.key]}>
          {campaign.state.label}
        </span>
        {canManage ? (
          <GoalMenu
            archived={campaign.archivedAt !== null}
            campaignId={campaign.id}
            published={campaign.publishedAt !== null}
            title={campaign.title}
          />
        ) : null}
      </header>
      <h3>{campaign.title}</h3>
      <div aria-label={`${percent}% da meta`} className="gk-goalbar" role="img">
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="gk-goalfacts">
        <span>
          {formatHours(campaign.contributedMinutes)} de{" "}
          {formatHours(campaign.targetMinutes)} horas · soma dos alunos
        </span>
        <span>{percent}%</span>
      </p>
      <small>Mostra só o agregado, sem horas individuais.</small>
    </article>
  );
};

type TaskListRow = Awaited<ReturnType<typeof getGestaoTasks>>["rows"][number];

const TaskRow = ({ row }: { readonly row: TaskListRow }) => {
  const [icon, tone] = taskChips[row.state.key];
  const percent =
    row.recipients > 0 ? Math.round((row.completed / row.recipients) * 100) : 0;
  return (
    <tr>
      <td>
        <div className="gk-person">
          <span aria-hidden="true" className="gk-kindtile">
            <GestaoIcon name="check" size={18} />
          </span>
          <div>
            <span className="gk-qtitle">{row.title}</span>
            <small className="gk-qsub">
              {taskRecurrenceLabels[row.recurrence]} · enviada para{" "}
              {row.recipients} {row.recipients === 1 ? "aluno" : "alunos"}
            </small>
          </div>
        </div>
      </td>
      <td>{dueLabel(row)}</td>
      <td>
        <span className="gk-progress">
          <span className="gk-progress-bar">
            <span style={{ width: `${percent}%` }} />
          </span>
          <small>
            {row.completed}/{row.recipients}
          </small>
        </span>
      </td>
      <td>
        <span className="gk-chip" data-tone={tone}>
          <GestaoIcon name={icon as "check-circle"} size={12} />
          {row.state.label}
        </span>
      </td>
      <td className="gk-col-menu">
        <TaskRowMenu
          canArchive={row.state.label !== "Arquivada"}
          taskId={row.id}
          title={row.title}
        />
      </td>
    </tr>
  );
};

const TaskTable = ({
  filtered,
  rows,
}: {
  readonly filtered: boolean;
  readonly rows: readonly TaskListRow[];
}) => (
  <div className="gk-table-card">
    <table className="gk-table gk-qtable">
      <thead>
        <tr>
          <th>Tarefa</th>
          <th>Prazo</th>
          <th>Concluíram no período</th>
          <th>Estado</th>
          <th className="gk-col-menu" />
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row) => <TaskRow key={row.id} row={row} />)
        ) : (
          <tr>
            <td className="gk-empty-cell" colSpan={5}>
              {filtered
                ? "Nenhuma tarefa com esses filtros."
                : "Nenhuma tarefa ainda. Use “Nova tarefa” para orientar uma turma ou um aluno."}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const PagerLink = ({
  href,
  label,
}: {
  readonly href: string | null;
  readonly label: string;
}) =>
  href ? (
    <Link className="gk-btn" href={href} prefetch={false}>
      {label}
    </Link>
  ) : (
    <span aria-disabled="true" className="gk-btn" data-disabled="true">
      {label}
    </span>
  );

const GoalsEmpty = ({ canManage }: { readonly canManage: boolean }) => (
  <p className="gk-hint gk-goals-empty">
    Nenhuma meta coletiva cadastrada.
    {canManage
      ? " Use “Nova meta coletiva” para propor um objetivo à turma."
      : " Só a administração cria metas coletivas."}
  </p>
);

const GoalGrid = ({
  campaigns,
  canManage,
}: {
  readonly campaigns: readonly Campaign[];
  readonly canManage: boolean;
}) => (
  <div className="gk-goalgrid">
    {campaigns.length ? (
      campaigns.map((campaign) => (
        <GoalCard campaign={campaign} canManage={canManage} key={campaign.id} />
      ))
    ) : (
      <GoalsEmpty canManage={canManage} />
    )}
  </div>
);

const GestaoTasksPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const params = await searchParams;
  const { actor } = await requireGestaoAction("assignments.manage");
  const isGoals = params.aba === "metas";
  const canManageGoals = actor.role === "ADMIN";
  const [list, campaigns, options] = await Promise.all([
    getGestaoTasks(actor, {
      frequency: params.frequencia,
      page: params.pagina,
      query: params.q,
      state: params.estado,
    }),
    getGestaoCampaigns(isGoals ? 12 : 2),
    getGestaoAssignmentOptions(actor),
  ]);
  const message = params.resultado ? resultMessages[params.resultado] : null;
  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of [
      ["q", list.query],
      ["frequencia", list.frequency],
      ["estado", list.state],
      ["pagina", page > 1 ? String(page) : null],
    ] as const) {
      if (value) {
        next.set(key, value);
      }
    }
    return `${base}${next.size ? `?${next}` : ""}`;
  };
  const first = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const last = Math.min(list.page * list.pageSize, list.total);

  return (
    <section className="gt-page gk-tasks">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Tarefas e metas</h1>
          <p>
            Tarefas orientam uma ação com prazo ou frequência. Metas coletivas
            medem o esforço da turma.
          </p>
        </div>
        <div className="gk-head-actions">
          {canManageGoals ? <NewGoalButton /> : null}
          <NewTaskButton cohorts={options.cohorts} />
        </div>
      </header>

      {message ? <output className="gk-result">{message}</output> : null}

      <nav aria-label="Seções" className="gk-tabs">
        <Link
          aria-current={isGoals ? undefined : "page"}
          className="gk-tab"
          href={base}
          prefetch={false}
        >
          Tarefas
        </Link>
        <Link
          aria-current={isGoals ? "page" : undefined}
          className="gk-tab"
          href={`${base}?aba=metas`}
          prefetch={false}
        >
          Metas coletivas
        </Link>
      </nav>

      {isGoals ? (
        <GoalGrid campaigns={campaigns} canManage={canManageGoals} />
      ) : (
        <>
          <div className="gk-toolbar">
            <GestaoFilterBar
              placeholder="Buscar tarefas"
              query={list.query}
              selects={[
                {
                  label: "Frequência",
                  options: Object.entries(taskRecurrenceLabels),
                  param: "frequencia",
                  value: list.frequency ?? "",
                },
                {
                  label: "Estado",
                  options: taskStateOptions.map(([key, label]) => [key, label]),
                  param: "estado",
                  value: list.state ?? "",
                },
              ]}
            />
          </div>
          <TaskTable
            filtered={Boolean(list.query || list.frequency || list.state)}
            rows={list.rows}
          />
          <nav aria-label="Paginação das tarefas" className="gk-pager">
            <span>
              {list.total === 0
                ? "0 tarefas"
                : `${first} a ${last} de ${list.total}`}
            </span>
            <div>
              <PagerLink
                href={list.page > 1 ? pageHref(list.page - 1) : null}
                label="Anterior"
              />
              <PagerLink
                href={
                  list.page < list.pageCount ? pageHref(list.page + 1) : null
                }
                label="Próxima"
              />
            </div>
          </nav>

          <section aria-labelledby="gk-goals-heading" className="gk-goals">
            <div className="gk-goals-head">
              <h2 id="gk-goals-heading">Metas coletivas</h2>
              <Link
                className="gk-link-btn"
                href={`${base}?aba=metas`}
                prefetch={false}
              >
                Ver todas
              </Link>
            </div>
            <GoalGrid campaigns={campaigns} canManage={canManageGoals} />
          </section>
        </>
      )}
    </section>
  );
};

export default GestaoTasksPage;
