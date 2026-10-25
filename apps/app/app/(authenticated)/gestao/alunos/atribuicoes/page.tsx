import Link from "next/link";
import { getGestaoAssignmentList } from "@/lib/gestao-assignments";
import {
  type AssignmentStateKey,
  assignmentDueOptions,
  assignmentIconName,
  assignmentTabs,
  assignmentTypeLabels,
  type GestaoAssignmentRow,
} from "@/lib/gestao-assignments-domain";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { GestaoFilterBar } from "../../gestao-filter-bar";
import { GestaoIcon } from "../../gestao-icon";
import { AssignmentRowMenu } from "./assignment-row-menu";

const base = "/gestao/alunos/atribuicoes";

const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const monthFormat = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: "America/Sao_Paulo",
});

const shortDate = (date: Date) =>
  `${dayFormat.format(date)} ${monthFormat.format(date)}`;

const resultMessages: Record<string, string> = {
  created: "Atribuição enviada. Os avisos já estão na fila de entrega.",
  invalida: "Não foi possível concluir a operação. Atualize a página.",
  replayed: "Este envio já havia sido registrado; nada foi duplicado.",
  revogada: "Atribuição revogada. O registro continua no histórico.",
};

const stateChips: Record<AssignmentStateKey, readonly [string, string]> = {
  active: ["check-circle", "active"],
  done: ["check-circle", "ok"],
  expired: ["clock", "muted"],
  late: ["alert-circle", "danger"],
  revoked: ["x", "muted"],
  scheduled: ["clock", "warn"],
};

const dueLabel = (row: GestaoAssignmentRow) => {
  if (row.state.key === "scheduled" && row.availableAt) {
    return `libera ${shortDate(row.availableAt)}`;
  }
  return row.dueAt ? shortDate(row.dueAt) : "Sem prazo";
};

const Row = ({ row }: { readonly row: GestaoAssignmentRow }) => {
  const [icon, tone] = stateChips[row.state.key];
  const done = row.live > 0 ? Math.round((row.completed / row.live) * 100) : 0;
  return (
    <tr data-attention={row.state.key === "late"}>
      <td>
        <div className="gk-person">
          <span aria-hidden="true" className="gk-kindtile">
            <GestaoIcon name={assignmentIconName(row.type)} size={18} />
          </span>
          <div>
            {row.targetHref ? (
              <Link
                className="gk-qtitle"
                href={row.targetHref}
                prefetch={false}
              >
                {row.title}
              </Link>
            ) : (
              <span className="gk-qtitle">{row.title}</span>
            )}
            <small className="gk-qsub">{assignmentTypeLabels[row.type]}</small>
          </div>
        </div>
      </td>
      <td>{row.recipients}</td>
      <td>{dueLabel(row)}</td>
      <td>
        <span className="gk-progress">
          <span className="gk-progress-bar">
            <span style={{ width: `${done}%` }} />
          </span>
          <small>
            {row.completed}/{row.live}
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
        <AssignmentRowMenu
          batchId={row.id}
          canRevoke={row.state.key !== "revoked"}
          recipients={row.live}
          title={row.title}
        />
      </td>
    </tr>
  );
};

const GestaoAssignmentsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const params = await searchParams;
  const { actor } = await requireGestaoAction("assignments.manage");
  const list = await getGestaoAssignmentList(actor, {
    due: params.prazo,
    page: params.pagina,
    query: params.q,
    tab: params.aba,
    type: params.tipo,
  });
  const message = params.resultado ? resultMessages[params.resultado] : null;
  const hrefFor = (overrides: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const current: Record<string, string | null> = {
      aba: list.tab === "active" ? null : list.tab,
      pagina: null,
      prazo: list.due,
      q: list.query || null,
      tipo: list.type,
      ...overrides,
    };
    for (const [key, value] of Object.entries(current)) {
      if (value) {
        next.set(key, value);
      }
    }
    return `${base}${next.size ? `?${next}` : ""}`;
  };
  const first = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const last = Math.min(list.page * list.pageSize, list.total);

  return (
    <section className="gt-page gk-assignments">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Atribuições</h1>
          <p>
            Orientar alguém a estudar um conteúdo e acompanhar quem concluiu.
          </p>
        </div>
        <div className="gk-head-actions">
          <Link
            className="gk-btn gk-btn--primary gk-btn--wide"
            href={`${base}/nova`}
            prefetch={false}
          >
            <GestaoIcon name="plus" size={16} /> Nova atribuição
          </Link>
        </div>
      </header>

      {message ? <output className="gk-result">{message}</output> : null}

      <nav aria-label="Estado das atribuições" className="gk-tabs">
        {assignmentTabs.map(([key, label]) => (
          <Link
            aria-current={list.tab === key ? "page" : undefined}
            className="gk-tab"
            href={hrefFor({ aba: key === "active" ? null : key })}
            key={key}
            prefetch={false}
          >
            {label}
            {list.tabCounts[key] > 0 ? (
              <span className="gk-tab-count">{list.tabCounts[key]}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="gk-toolbar">
        <GestaoFilterBar
          placeholder="Buscar conteúdo ou aluno"
          query={list.query}
          selects={[
            {
              label: "Tipo",
              options: Object.entries(assignmentTypeLabels),
              param: "tipo",
              value: list.type ?? "",
            },
            {
              label: "Prazo",
              options: assignmentDueOptions.map(([key, label]) => [key, label]),
              param: "prazo",
              value: list.due ?? "",
            },
          ]}
        />
      </div>

      <div className="gk-table-card">
        <table className="gk-table gk-qtable">
          <thead>
            <tr>
              <th>Conteúdo</th>
              <th>Destinatários</th>
              <th>Prazo</th>
              <th>Concluíram</th>
              <th>Estado</th>
              <th className="gk-col-menu" />
            </tr>
          </thead>
          <tbody>
            {list.rows.length ? (
              list.rows.map((row) => <Row key={row.id} row={row} />)
            ) : (
              <tr>
                <td className="gk-empty-cell" colSpan={6}>
                  {list.query || list.type || list.due
                    ? "Nenhuma atribuição com esses filtros."
                    : "Nenhuma atribuição nesta aba. Use “Nova atribuição” para orientar uma turma ou um aluno."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginação das atribuições" className="gk-pager">
        <span>
          {list.total === 0
            ? "0 atribuições"
            : `${first} a ${last} de ${list.total}`}
        </span>
        <div>
          {list.page > 1 ? (
            <Link
              className="gk-btn"
              href={hrefFor({ pagina: String(list.page - 1) })}
              prefetch={false}
            >
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className="gk-btn" data-disabled="true">
              Anterior
            </span>
          )}
          {list.page < list.pageCount ? (
            <Link
              className="gk-btn"
              href={hrefFor({ pagina: String(list.page + 1) })}
              prefetch={false}
            >
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

export default GestaoAssignmentsPage;
