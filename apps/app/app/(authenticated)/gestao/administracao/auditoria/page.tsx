import Link from "next/link";
import { forbidden } from "next/navigation";
import {
  gestaoAuditLabels,
  listGestaoAudit,
  listGestaoAuditActors,
} from "@/lib/gestao-audit";
import { GestaoFilterBar } from "../../gestao-filter-bar";

const base = "/gestao/administracao/auditoria";
const whitespace = /\s+/;

const periods = [
  ["7", "Últimos 7 dias"],
  ["30", "Últimos 30 dias"],
  ["90", "Últimos 90 dias"],
] as const;

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? undefined : value;

const initials = (name: string) =>
  name
    .split(whitespace)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const GestaoAuditPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  if (Object.values(params).some(Array.isArray)) {
    forbidden();
  }
  const period = periods.find(([value]) => value === params.periodo)?.[0];
  const filters = {
    action: single(params.acao)?.slice(0, 80),
    actorId: single(params.quem)?.slice(0, 255),
    page: Number(single(params.pagina)) || 1,
    periodDays: period ? Number(period) : null,
    query: single(params.q)?.slice(0, 120),
  };
  const [audit, actors] = await Promise.all([
    listGestaoAudit(filters),
    listGestaoAuditActors(),
  ]);
  const query = new URLSearchParams();
  for (const [key, value] of [
    ["acao", filters.action],
    ["periodo", period],
    ["q", filters.query],
    ["quem", filters.actorId],
  ] as const) {
    if (value) {
      query.set(key, value);
    }
  }
  const pageHref = (target: number) => {
    const next = new URLSearchParams(query);
    if (target > 1) {
      next.set("pagina", String(target));
    }
    const text = next.toString();
    return `${base}${text ? `?${text}` : ""}`;
  };
  const first = audit.total === 0 ? 0 : (audit.page - 1) * audit.pageSize + 1;
  const last = Math.min(audit.total, audit.page * audit.pageSize);

  return (
    <section className="gt-page">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Registro de atividades</h1>
          <p>
            Mudanças sensíveis, com autor e data: papéis, acessos, turmas,
            publicações e integrações.
          </p>
        </div>
        <div className="gk-head-actions">
          <a
            className="gk-btn gk-btn--wide"
            href={`${base}/exportar${query.size ? `?${query}` : ""}`}
          >
            Exportar (.csv)
          </a>
        </div>
      </header>

      <div className="gk-toolbar">
        <GestaoFilterBar
          placeholder="Buscar no registro"
          query={filters.query ?? ""}
          selects={[
            {
              label: "Quem",
              options: actors.map((actor) => [actor.id, actor.name]),
              param: "quem",
              value: filters.actorId ?? "",
            },
            {
              label: "Ação",
              options: Object.entries(gestaoAuditLabels).map(
                ([value, label]) => [value, label]
              ),
              param: "acao",
              value: filters.action ?? "",
            },
            {
              label: "Período",
              options: periods.map(([value, label]) => [value, label]),
              param: "periodo",
              value: period ?? "",
            },
          ]}
        />
      </div>

      {audit.rows.length === 0 ? (
        <div className="gk-table-card">
          <p className="gk-empty-cell">
            {query.size
              ? "Nenhuma atividade encontrada. Ajuste ou limpe os filtros."
              : "As ações feitas na Gestão passam a aparecer aqui."}
          </p>
        </div>
      ) : (
        <div className="gk-table-card">
          <table className="gk-table gk-qtable">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>Ação</th>
                <th>Objeto</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {audit.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <time dateTime={row.at.toISOString()}>
                      {dateFormat.format(row.at)}
                    </time>
                  </td>
                  <td>
                    <span className="gk-person">
                      <span
                        aria-hidden="true"
                        className="gk-avatar gk-avatar--lg"
                      >
                        {initials(row.actor)}
                      </span>
                      <span className="gk-qtitle">{row.actor}</span>
                    </span>
                  </td>
                  <td>
                    <strong>{row.label}</strong>
                  </td>
                  <td>{row.object}</td>
                  <td className="gk-qsub">{row.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Páginas" className="gk-pager">
        <span>
          {first} a {last} de {audit.total}
        </span>
        <span className="gk-pager-actions">
          {audit.page > 1 ? (
            <Link
              className="gk-btn"
              href={pageHref(audit.page - 1)}
              prefetch={false}
            >
              Anterior
            </Link>
          ) : null}
          {audit.page < audit.pages ? (
            <Link
              className="gk-btn"
              href={pageHref(audit.page + 1)}
              prefetch={false}
            >
              Próxima
            </Link>
          ) : null}
        </span>
      </nav>
    </section>
  );
};

export default GestaoAuditPage;
