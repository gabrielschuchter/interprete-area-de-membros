import Link from "next/link";
import { forbidden } from "next/navigation";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  type GestaoPublicationRow,
  getGestaoPublicationList,
} from "@/lib/gestao-publications";
import {
  gestaoInitials,
  gestaoPublicationMarkFromParam,
  gestaoPublicationMarks,
  gestaoPublicationTabFromParam,
  gestaoPublicationTabs,
  gestaoRelativeDay,
} from "@/lib/gestao-publications-domain";
import { GestaoFilterBar } from "../../gestao-filter-bar";
import { GestaoIcon } from "../../gestao-icon";
import { PublicationRowMenu } from "./row-menu";

const base = "/gestao/comunidade/publicacoes";

const Row = ({
  now,
  row,
}: {
  readonly now: Date;
  readonly row: GestaoPublicationRow;
}) => {
  const archived = row.status === "ARCHIVED";
  return (
    <tr>
      <td>
        <div className="gk-person">
          <span aria-hidden="true" className="gk-avatar gk-avatar--lg">
            {gestaoInitials(row.authorName)}
          </span>
          <div>
            <Link className="gk-qtitle" href={row.href} prefetch={false}>
              {row.title}
            </Link>
            <small className="gk-qsub">{row.spaceTitle}</small>
          </div>
        </div>
      </td>
      <td>{row.authorName}</td>
      <td>{gestaoRelativeDay(row.createdAt, now)}</td>
      <td>
        {row.isPinned || row.isFeatured ? (
          <span className="gk-chiprow">
            {row.isPinned ? (
              <span className="gk-chip gk-chip--outline" data-tone="active">
                Fixada
              </span>
            ) : null}
            {row.isFeatured ? (
              <span className="gk-chip gk-chip--outline" data-tone="active">
                Destaque
              </span>
            ) : null}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td>
        <span className="gk-chip" data-tone={archived ? "muted" : "active"}>
          <GestaoIcon name={archived ? "archive" : "check-circle"} size={12} />
          {archived ? "Arquivado" : "Publicado"}
        </span>
      </td>
      <td className="gk-col-menu">
        <PublicationRowMenu
          href={row.href}
          id={row.id}
          isFeatured={row.isFeatured}
          isPinned={row.isPinned}
          status={row.status}
          title={row.title}
        />
      </td>
    </tr>
  );
};

const ReportedPanel = () => (
  <>
    <div className="gk-table-card">
      <table className="gk-table gk-qtable">
        <thead>
          <tr>
            <th>Publicação</th>
            <th>Motivo</th>
            <th>Denúncias</th>
            <th>Recebida</th>
            <th className="gk-col-menu" />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="gk-empty-cell" colSpan={5}>
              Nenhuma denúncia por aqui. O botão de denunciar ainda não existe
              para os membros; quando entrar, as denúncias chegam a esta lista
              com as ações Manter e Arquivar.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div className="gk-info-box">
      <GestaoIcon name="check-circle" size={18} />
      <div>
        <strong>Ao arquivar, o autor recebe um aviso com o motivo.</strong>
        <span>O conteúdo fica preservado e pode ser restaurado.</span>
      </div>
    </div>
  </>
);

const GestaoPublicationsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  if (Object.values(params).some(Array.isArray)) {
    forbidden();
  }
  const read = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;
  await requireGestaoAction("community.moderate");
  const tab = gestaoPublicationTabFromParam(read("aba"));
  const mark = gestaoPublicationMarkFromParam(read("marca"));
  const query = read("q")?.slice(0, 120) ?? "";
  const list = await getGestaoPublicationList({
    mark,
    page: read("pagina"),
    query,
    space: read("grupo"),
    tab,
  });
  const now = new Date();
  const hrefFor = (overrides: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const current: Record<string, string | null> = {
      aba: tab === "published" ? null : tab,
      grupo: read("grupo") ?? null,
      marca: mark,
      pagina: null,
      q: query || null,
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
  const filtered = Boolean(query || read("grupo") || mark);

  return (
    <section className="gt-page gk-assignments">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Publicações</h1>
          <p>
            Moderação das publicações dos membros. Rascunhos privados não
            aparecem aqui.
          </p>
        </div>
        <div className="gk-head-actions">
          <Link
            className="gk-btn gk-btn--wide"
            href="/comunidade"
            prefetch={false}
          >
            Abrir feed da comunidade
          </Link>
        </div>
      </header>

      <nav aria-label="Situação das publicações" className="gk-tabs">
        {gestaoPublicationTabs.map(([key, label]) => (
          <Link
            aria-current={tab === key ? "page" : undefined}
            className="gk-tab"
            href={hrefFor({
              aba: key === "published" ? null : key,
              grupo: null,
              marca: null,
              pagina: null,
              q: null,
            })}
            key={key}
            prefetch={false}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "reported" ? (
        <ReportedPanel />
      ) : (
        <>
          <div className="gk-toolbar">
            <GestaoFilterBar
              placeholder="Buscar publicações"
              query={query}
              selects={[
                {
                  label: "Grupo",
                  options: [
                    ["feed", "Feed geral"],
                    ...list.spaces.map((space): readonly [string, string] => [
                      space.id,
                      space.title,
                    ]),
                  ],
                  param: "grupo",
                  value: read("grupo") ?? "",
                },
                {
                  label: "Marca",
                  options: gestaoPublicationMarks.map(([key, label]) => [
                    key,
                    label,
                  ]),
                  param: "marca",
                  value: mark ?? "",
                },
              ]}
            />
          </div>

          <div className="gk-table-card">
            <table className="gk-table gk-qtable">
              <thead>
                <tr>
                  <th>Publicação</th>
                  <th>Autor</th>
                  <th>Data</th>
                  <th>Marcas</th>
                  <th>Estado</th>
                  <th className="gk-col-menu" />
                </tr>
              </thead>
              <tbody>
                {list.rows.length ? (
                  list.rows.map((row) => (
                    <Row key={row.id} now={now} row={row} />
                  ))
                ) : (
                  <tr>
                    <td className="gk-empty-cell" colSpan={6}>
                      {filtered
                        ? "Nenhuma publicação com esses filtros."
                        : "Nenhuma publicação nesta aba."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <nav aria-label="Paginação das publicações" className="gk-pager">
            <span>
              {list.total === 0
                ? "0 publicações"
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
              ) : null}
              {list.page < list.pageCount ? (
                <Link
                  className="gk-btn"
                  href={hrefFor({ pagina: String(list.page + 1) })}
                  prefetch={false}
                >
                  Próxima
                </Link>
              ) : null}
            </div>
          </nav>
        </>
      )}
    </section>
  );
};

export default GestaoPublicationsPage;
