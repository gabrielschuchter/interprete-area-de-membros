import Link from "next/link";
import { forbidden } from "next/navigation";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  type GestaoNoticeRow,
  getGestaoNoticeList,
} from "@/lib/gestao-notices";
import {
  gestaoNoticeAudienceFromParam,
  gestaoNoticeAudienceOptions,
  gestaoNoticePeriodLabel,
  gestaoNoticeStateLabels,
  gestaoNoticeTabFromParam,
  gestaoNoticeTabs,
} from "@/lib/gestao-notices-domain";
import { GestaoFilterBar } from "../../gestao-filter-bar";
import { GestaoIcon, type GestaoIconName } from "../../gestao-icon";
import { NoticeRowMenu } from "./row-menu";

const base = "/gestao/comunidade/avisos";

const resultMessages: Record<string, string> = {
  agendado: "Aviso agendado. Ele aparece para os membros na data escolhida.",
  publicado: "Aviso publicado. As notificações já estão na fila de entrega.",
  rascunho: "Rascunho salvo. Nada aparece para os alunos antes de publicar.",
  salvo: "Alterações salvas.",
};

const stateChips: Record<
  GestaoNoticeRow["state"],
  readonly [GestaoIconName, string]
> = {
  draft: ["pencil", "neutral"],
  ended: ["archive", "muted"],
  published: ["check-circle", "active"],
  scheduled: ["clock", "warn"],
};

const Row = ({ row }: { readonly row: GestaoNoticeRow }) => {
  const [icon, tone] = stateChips[row.state];
  return (
    <tr>
      <td>
        <div className="gk-person">
          <span aria-hidden="true" className="gk-kindtile">
            <GestaoIcon name="bell" size={18} />
          </span>
          <div>
            <Link
              className="gk-qtitle"
              href={`${base}/${row.id}`}
              prefetch={false}
            >
              {row.title}
            </Link>
            <small className="gk-qsub">
              {row.href ? `Link: ${row.href}` : "Sem link"}
            </small>
          </div>
        </div>
      </td>
      <td>{row.audienceLabel}</td>
      <td>{gestaoNoticePeriodLabel(row.startsAt, row.endsAt)}</td>
      <td>
        {row.isPinned ? (
          <span className="gk-chip gk-chip--outline" data-tone="active">
            Fixado
          </span>
        ) : (
          "—"
        )}
      </td>
      <td>
        <span className="gk-chip" data-tone={tone}>
          <GestaoIcon name={icon} size={12} />
          {gestaoNoticeStateLabels[row.state]}
        </span>
      </td>
      <td className="gk-col-menu">
        <NoticeRowMenu
          id={row.id}
          isPinned={row.isPinned}
          state={row.state}
          title={row.title}
        />
      </td>
    </tr>
  );
};

const GestaoNoticesPage = async ({
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
  const tab = gestaoNoticeTabFromParam(read("aba"));
  const audience = gestaoNoticeAudienceFromParam(read("publico"));
  const list = await getGestaoNoticeList({
    audience,
    page: read("pagina"),
    query: read("q"),
    tab,
  });
  const message = resultMessages[read("resultado") ?? ""];
  const hrefFor = (overrides: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const current: Record<string, string | null> = {
      aba: tab === "all" ? null : tab,
      pagina: null,
      publico: audience,
      q: list.query || null,
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
  const filtered = Boolean(list.query || audience);

  return (
    <section className="gt-page gk-assignments">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Avisos</h1>
          <p>Comunicados institucionais, diferentes de uma publicação comum.</p>
        </div>
        <div className="gk-head-actions">
          <Link
            className="gk-btn gk-btn--primary gk-btn--wide"
            href={`${base}/novo`}
            prefetch={false}
          >
            Novo aviso
          </Link>
        </div>
      </header>

      {message ? <output className="gk-result">{message}</output> : null}

      <nav aria-label="Estado dos avisos" className="gk-tabs">
        {gestaoNoticeTabs.map(([key, label]) => (
          <Link
            aria-current={tab === key ? "page" : undefined}
            className="gk-tab"
            href={hrefFor({ aba: key === "all" ? null : key })}
            key={key}
            prefetch={false}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="gk-toolbar">
        <GestaoFilterBar
          placeholder="Buscar avisos"
          query={list.query}
          selects={[
            {
              label: "Público",
              options: gestaoNoticeAudienceOptions.map(([key, label]) => [
                key,
                label,
              ]),
              param: "publico",
              value: audience ?? "",
            },
          ]}
        />
      </div>

      <div className="gk-table-card">
        <table className="gk-table gk-qtable">
          <thead>
            <tr>
              <th>Aviso</th>
              <th>Para</th>
              <th>Período</th>
              <th>Marcas</th>
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
                  {filtered
                    ? "Nenhum aviso com esses filtros."
                    : "Nenhum aviso nesta aba. Use “Novo aviso” para comunicar algo à comunidade."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {list.pageCount > 1 ? (
        <nav aria-label="Paginação dos avisos" className="gk-pager">
          <span>{`${first} a ${last} de ${list.total}`}</span>
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
      ) : null}
    </section>
  );
};

export default GestaoNoticesPage;
