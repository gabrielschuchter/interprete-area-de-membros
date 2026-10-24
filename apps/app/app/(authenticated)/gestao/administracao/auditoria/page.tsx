import Link from "next/link";
import { forbidden } from "next/navigation";
import { gestaoAuditLabels, listGestaoAudit } from "@/lib/gestao-audit";
import { GestaoPageHeading } from "../../gestao-shell";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? undefined : value;

const GestaoAuditPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  if (Object.values(params).some(Array.isArray)) {
    forbidden();
  }
  const filters = {
    action: single(params.acao)?.slice(0, 80),
    from: single(params.de)?.slice(0, 10),
    to: single(params.ate)?.slice(0, 10),
    query: single(params.q)?.slice(0, 120),
    page: Number(single(params.pagina)) || 1,
  };
  const audit = await listGestaoAudit(filters);
  const filterParams = new URLSearchParams();
  for (const [key, value] of [
    ["acao", filters.action],
    ["de", filters.from],
    ["ate", filters.to],
    ["q", filters.query],
  ] as const) {
    if (value) {
      filterParams.set(key, value);
    }
  }
  const pageHref = (target: number) => {
    const next = new URLSearchParams(filterParams);
    if (target > 1) {
      next.set("pagina", String(target));
    }
    const text = next.toString();
    return `/gestao/administracao/auditoria${text ? `?${text}` : ""}`;
  };
  return (
    <section className="gx-page">
      <GestaoPageHeading
        description="Quem fez o quê na Gestão. Somente leitura. Cada linha vem de um evento gravado no momento da ação."
        eyebrow="Gestão · Administração"
        title="Registro de atividades"
      >
        <a
          className="gx-button-outline"
          href={`/gestao/administracao/auditoria/exportar${filterParams.size ? `?${filterParams}` : ""}`}
        >
          Exportar CSV
        </a>
      </GestaoPageHeading>
      <form
        action="/gestao/administracao/auditoria"
        className="gx-filters"
        method="get"
      >
        <input
          aria-label="Buscar por quem fez"
          defaultValue={filters.query}
          maxLength={120}
          name="q"
          placeholder="Quem fez (nome ou e-mail)"
          type="search"
        />
        <select
          aria-label="Ação"
          defaultValue={filters.action ?? ""}
          name="acao"
        >
          <option value="">Todas as ações</option>
          {Object.entries(gestaoAuditLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          aria-label="De"
          defaultValue={filters.from}
          name="de"
          type="date"
        />
        <input
          aria-label="Até"
          defaultValue={filters.to}
          name="ate"
          type="date"
        />
        <button className="gx-button" type="submit">
          Filtrar
        </button>
        {filterParams.size ? (
          <Link className="gx-link" href="/gestao/administracao/auditoria">
            Limpar filtros
          </Link>
        ) : null}
      </form>
      {audit.rows.length === 0 ? (
        <div className="gestao-empty-state">
          <h2>Nenhuma atividade encontrada</h2>
          <p>
            {filterParams.size
              ? "Ajuste ou limpe os filtros para ver outros registros."
              : "As ações feitas na Gestão passam a aparecer aqui."}
          </p>
        </div>
      ) : (
        <div className="gx-card">
          <div className="gx-table-wrap">
            <table className="gx-table">
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">Quem</th>
                  <th scope="col">Ação</th>
                  <th scope="col">Objeto</th>
                </tr>
              </thead>
              <tbody>
                {audit.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <time dateTime={row.at.toISOString()}>
                        {dateTimeFormat.format(row.at)}
                      </time>
                    </td>
                    <td>{row.actor}</td>
                    <td>{row.label}</td>
                    <td>{row.aggregate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Páginas" className="gx-pagination">
            <span>
              {audit.total} {audit.total === 1 ? "registro" : "registros"}
            </span>
            <span>
              {audit.page > 1 ? (
                <Link className="gx-link" href={pageHref(audit.page - 1)}>
                  Anterior
                </Link>
              ) : null}{" "}
              Página {Math.min(audit.page, audit.pages)} de {audit.pages}{" "}
              {audit.page < audit.pages ? (
                <Link className="gx-link" href={pageHref(audit.page + 1)}>
                  Próxima
                </Link>
              ) : null}
            </span>
          </nav>
        </div>
      )}
    </section>
  );
};

export default GestaoAuditPage;
