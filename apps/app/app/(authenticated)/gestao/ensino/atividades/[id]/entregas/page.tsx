import Link from "next/link";
import { notFound } from "next/navigation";
import type { DeliveryRow } from "@/lib/gestao-activity-deliveries";
import { getGestaoActivityDeliveries } from "@/lib/gestao-activity-deliveries";
import { GestaoCrumbTail } from "../../../../gestao-crumbs";
import { GestaoFilterBar } from "../../../../gestao-filter-bar";
import { GestaoIcon } from "../../../../gestao-icon";
import { RemindButton } from "./remind-button";

interface Properties {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<{
    readonly correcao?: string;
    readonly entrega?: string;
    readonly pagina?: string;
    readonly q?: string;
    readonly turma?: string;
  }>;
}

const deliveryLabels = {
  DELIVERED: ["Entregue", "check-circle", "neutral"],
  LATE: ["Atrasada", "alert", "danger"],
  NOT_DELIVERED: ["Não entregue", "clock", "muted"],
} as const;

const correctionLabels = {
  PENDING: ["Pendente", "alert", "danger"],
  REVIEWED: ["Corrigida", "check-circle", "neutral"],
  WAITING: ["Aguardando", "clock", "muted"],
} as const;

const submittedFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

const whitespace = /\s+/;

const initials = (name: string) =>
  name
    .split(whitespace)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const Chip = ({
  spec,
}: {
  readonly spec: readonly [string, "alert" | "check-circle" | "clock", string];
}) => (
  <span className="gk-chip" data-tone={spec[2]}>
    <GestaoIcon name={spec[1]} size={12} />
    {spec[0]}
  </span>
);

const RowAction = ({
  activityId,
  row,
}: {
  readonly activityId: string;
  readonly row: DeliveryRow;
}) => {
  const queue = `/gestao/ensino/atividades/${activityId}/entregas/corrigir`;
  if (row.correction === "PENDING" && row.submissionId) {
    return (
      <Link
        className="gk-btn gk-btn--primary"
        href={`${queue}?entrega=${row.submissionId}`}
        prefetch={false}
      >
        Corrigir
      </Link>
    );
  }
  if (row.correction === "REVIEWED" && row.submissionId) {
    return (
      <Link
        className="gk-btn"
        href={`${queue}?estado=REVIEWED&entrega=${row.submissionId}`}
        prefetch={false}
      >
        Ver feedback
      </Link>
    );
  }
  return (
    <RemindButton
      activityId={activityId}
      className="gk-btn"
      label="Lembrar"
      memberId={row.memberId}
    />
  );
};

const GestaoActivityDeliveriesPage = async ({
  params,
  searchParams,
}: Properties) => {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getGestaoActivityDeliveries({
    activityId: id,
    cohortId: query.turma,
    correction: query.correcao,
    delivery: query.entrega,
    page: Number(query.pagina),
    query: query.q,
  });
  if (!data) {
    notFound();
  }
  const { activity, stats } = data;
  const base = `/gestao/ensino/atividades/${id}`;
  const percent = stats.total
    ? Math.round((stats.delivered / stats.total) * 100)
    : 0;
  const first = (data.page - 1) * data.pageSize + 1;
  const pageLink = (target: number) => {
    const next = new URLSearchParams();
    for (const key of ["q", "turma", "entrega", "correcao"] as const) {
      if (query[key]) {
        next.set(key, query[key] as string);
      }
    }
    next.set("pagina", String(target));
    return `${base}/entregas?${next}`;
  };
  const due = activity.dueAt
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "long",
        timeZone: "America/Sao_Paulo",
      }).format(activity.dueAt)
    : "sem prazo";

  return (
    <section className="gt-page gk-activities">
      <GestaoCrumbTail
        items={[{ href: base, label: activity.title }, { label: "Entrega" }]}
      />
      <header className="gk-head">
        <div className="gk-head-copy">
          <div className="gk-list-title">
            <h1>{activity.title}</h1>
            <span
              className="gk-chip"
              data-tone={activity.status === "PUBLISHED" ? "active" : "neutral"}
            >
              {activity.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
            </span>
          </div>
          <p>Prazo: {due}</p>
        </div>
        <div className="gk-head-actions">
          {activity.status === "PUBLISHED" ? (
            <RemindButton
              activityId={id}
              className="gk-btn"
              label="Enviar lembrete a quem não entregou"
            />
          ) : null}
        </div>
      </header>

      <nav aria-label="Seções da atividade" className="gk-tabs">
        <Link className="gk-tab" href={base} prefetch={false}>
          Detalhes
        </Link>
        <Link aria-current="page" className="gk-tab" href={`${base}/entregas`}>
          Entregas · {stats.delivered} de {stats.total}
        </Link>
      </nav>

      <div className="gk-stats">
        <article>
          <span>Entregues</span>
          <strong>
            {stats.delivered} de {stats.total}
          </strong>
          <small>{percent}%</small>
        </article>
        <article>
          <span>A corrigir</span>
          <strong>{stats.pending}</strong>
        </article>
        <article>
          <span>Corrigidas</span>
          <strong>{stats.reviewed}</strong>
        </article>
        <article>
          <span>Atrasadas</span>
          <strong>{stats.late}</strong>
          <small>
            {activity.dueAt ? `prazo ${due}` : "sem prazo definido"}
          </small>
        </article>
      </div>

      <div className="gk-toolbar">
        <GestaoFilterBar
          placeholder="Buscar aluno"
          query={data.query}
          selects={[
            {
              label: "Turma",
              options: data.cohortOptions.map((c) => [c.id, c.name] as const),
              param: "turma",
              value: query.turma ?? "",
            },
            {
              label: "Entrega",
              options: [
                ["DELIVERED", "Entregue"],
                ["NOT_DELIVERED", "Não entregue"],
                ["LATE", "Atrasada"],
              ],
              param: "entrega",
              value: query.entrega ?? "",
            },
            {
              label: "Correção",
              options: [
                ["PENDING", "Pendente"],
                ["REVIEWED", "Corrigida"],
                ["WAITING", "Aguardando"],
              ],
              param: "correcao",
              value: query.correcao ?? "",
            },
          ]}
        />
      </div>

      <div className="gk-table-card">
        <table className="gk-table gk-qtable">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Turma</th>
              <th>Entrega</th>
              <th>Enviada em</th>
              <th>Correção</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.rows.length ? (
              data.rows.map((row) => (
                <tr key={row.memberId}>
                  <td>
                    <div className="gk-person">
                      <span className="gk-avatar gk-avatar--lg">
                        {initials(row.name)}
                      </span>
                      <strong>{row.name}</strong>
                    </div>
                  </td>
                  <td>{row.cohort ?? <span className="gk-dash">—</span>}</td>
                  <td>
                    <Chip spec={deliveryLabels[row.delivery]} />
                  </td>
                  <td>
                    {row.submittedAt ? (
                      submittedFormatter.format(row.submittedAt)
                    ) : (
                      <span className="gk-dash">—</span>
                    )}
                  </td>
                  <td>
                    <Chip spec={correctionLabels[row.correction]} />
                  </td>
                  <td className="gk-col-action">
                    <RowAction activityId={id} row={row} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="gk-empty-cell" colSpan={6}>
                  {stats.total
                    ? "Nenhum aluno corresponde aos filtros."
                    : "Esta atividade ainda não tem destinatários."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginação das entregas" className="gk-pager">
        <span>
          {data.totalCount === 0
            ? "0 alunos"
            : `${first} a ${Math.min(data.page * data.pageSize, data.totalCount)} de ${data.totalCount}`}
        </span>
        <div>
          {data.page > 1 ? (
            <Link className="gk-btn" href={pageLink(data.page - 1)}>
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className="gk-btn" data-disabled="true">
              Anterior
            </span>
          )}
          {data.page < data.totalPages ? (
            <Link className="gk-btn" href={pageLink(data.page + 1)}>
              Próxima
            </Link>
          ) : (
            <span aria-disabled="true" className="gk-btn" data-disabled="true">
              Próxima
            </span>
          )}
        </div>
      </nav>
    </section>
  );
};

export default GestaoActivityDeliveriesPage;
