import { type ActivityDeliveryKind, ContentStatus } from "@repo/database";
import Link from "next/link";
import { listGestaoActivities } from "@/lib/gestao-activities";
import { GestaoFilterBar } from "../../gestao-filter-bar";
import { GestaoIcon } from "../../gestao-icon";
import { ActivityRowMenu } from "./activity-row-menu";

const statusNames: Record<ContentStatus, string> = {
  ARCHIVED: "Arquivado",
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
};

const statusIcons = {
  ARCHIVED: "archive",
  DRAFT: "pencil",
  PUBLISHED: "check-circle",
} as const;

const deliveryNames: Record<ActivityDeliveryKind, string> = {
  FILE: "Envio de arquivo",
  TEXT: "Resposta em texto",
  TEXT_AND_FILE: "Texto e arquivo",
};

const tabs = [
  ["ALL", "Todas"],
  [ContentStatus.PUBLISHED, "Publicadas"],
  [ContentStatus.DRAFT, "Rascunhos"],
  [ContentStatus.ARCHIVED, "Arquivadas"],
] as const;

const dueOptions = [
  ["UPCOMING", "Com prazo futuro"],
  ["OVERDUE", "Prazo vencido"],
  ["NONE", "Sem prazo"],
] as const;

const resultMessages: Record<string, string> = {
  conflito:
    "A atividade mudou em outra sessão. Atualize a lista antes de tentar novamente.",
  "dados-invalidos": "Revise os campos enviados.",
  "estado-atualizado": "Estado da atividade atualizado.",
  "nao-encontrada": "A atividade não está mais disponível.",
};

const dueFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

const dueLabel = (value: Date | null) =>
  value
    ? dueFormatter.format(value).replace(".", "").replace(" de ", " ")
    : "Sem prazo";

interface Properties {
  readonly searchParams: Promise<{
    readonly curso?: string;
    readonly estado?: string;
    readonly pagina?: string;
    readonly prazo?: string;
    readonly q?: string;
    readonly resultado?: string;
  }>;
}

type Row = Awaited<
  ReturnType<typeof listGestaoActivities>
>["activities"][number];

const tabHref = (
  status: string,
  params: Awaited<Properties["searchParams"]>
) => {
  const next = new URLSearchParams();
  for (const key of ["q", "curso", "prazo"] as const) {
    if (params[key]) {
      next.set(key, params[key] as string);
    }
  }
  if (status !== "ALL") {
    next.set("estado", status);
  }
  return `/gestao/ensino/atividades${next.size ? `?${next}` : ""}`;
};

const Recipients = ({ row }: { readonly row: Row }) => {
  const first = row.cohortTargets[0]?.cohort.name;
  if (!(row.directRecipientCount || first)) {
    return <span className="gk-dash">—</span>;
  }
  return (
    <span>
      {row.directRecipientCount
        ? `${row.directRecipientCount} ${row.directRecipientCount === 1 ? "aluno" : "alunos"}`
        : first}
      {row.directRecipientCount && first ? (
        <small className="gk-qsub">
          {first}
          {row.cohortCount > 1 ? ` +${row.cohortCount - 1}` : ""}
        </small>
      ) : null}
    </span>
  );
};

const Deliveries = ({ row }: { readonly row: Row }) => {
  const total = row.directRecipientCount || row.counts.all;
  if (!total) {
    return <span className="gk-dash">—</span>;
  }
  const done = Math.min(total, row.counts.submitted + row.counts.reviewed);
  return (
    <span className="gk-progress">
      <span className="gk-progress-bar">
        <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
      </span>
      <small>
        {done}/{total}
      </small>
    </span>
  );
};

const Correction = ({ row }: { readonly row: Row }) =>
  row.counts.toReview ? (
    <span className="gk-alert-text">
      <GestaoIcon name="alert" size={13} /> {row.counts.toReview} a corrigir
    </span>
  ) : (
    <span className="gk-dash">—</span>
  );

const ActivityRow = ({ row }: { readonly row: Row }) => (
  <tr data-selected={row.counts.toReview > 0}>
    <td>
      <div className="gk-person">
        <span aria-hidden="true" className="gk-kindtile">
          <GestaoIcon name="inbox" size={18} />
        </span>
        <div>
          <Link
            className="gk-qtitle"
            href={`/gestao/ensino/atividades/${row.id}`}
            prefetch={false}
          >
            {row.title}
          </Link>
          <small className="gk-qsub">{deliveryNames[row.deliveryKind]}</small>
        </div>
      </div>
    </td>
    <td>{dueLabel(row.dueAt)}</td>
    <td>
      <Recipients row={row} />
    </td>
    <td>
      <Deliveries row={row} />
    </td>
    <td>
      <Correction row={row} />
    </td>
    <td>
      <span
        className="gk-chip"
        data-tone={row.status === "PUBLISHED" ? "active" : "neutral"}
      >
        <GestaoIcon name={statusIcons[row.status]} size={12} />
        {statusNames[row.status]}
      </span>
    </td>
    <td className="gk-col-menu">
      <ActivityRowMenu
        id={row.id}
        status={row.status}
        title={row.title}
        version={row.version}
      />
    </td>
  </tr>
);

const GestaoActivitiesPage = async ({ searchParams }: Properties) => {
  const params = await searchParams;
  const catalog = await listGestaoActivities({
    courseId: params.curso,
    due: params.prazo,
    page: Number(params.pagina),
    query: params.q,
    status: params.estado,
  });
  const due = dueOptions.some(([key]) => key === params.prazo)
    ? (params.prazo ?? "")
    : "";
  const first = (catalog.page - 1) * catalog.pageSize + 1;
  const pageLink = (target: number) => {
    const next = new URLSearchParams();
    for (const key of ["q", "curso", "prazo", "estado"] as const) {
      if (params[key]) {
        next.set(key, params[key] as string);
      }
    }
    next.set("pagina", String(target));
    return `/gestao/ensino/atividades?${next}`;
  };
  const message = params.resultado ? resultMessages[params.resultado] : null;

  return (
    <section className="gt-page gk-activities">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Atividades</h1>
          <p>
            Crie e publique atividades. A correção das entregas fica em Alunos ›
            Correções.
          </p>
        </div>
        <div className="gk-head-actions">
          <Link
            className="gk-btn gk-btn--primary gk-btn--wide"
            href="/gestao/ensino/atividades/nova"
          >
            Nova atividade
          </Link>
        </div>
      </header>

      {message ? <output className="gk-result">{message}</output> : null}

      <nav aria-label="Estado das atividades" className="gk-tabs">
        {tabs.map(([key, label]) => (
          <Link
            aria-current={catalog.status === key ? "page" : undefined}
            className="gk-tab"
            href={tabHref(key, params)}
            key={key}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="gk-toolbar">
        <GestaoFilterBar
          placeholder="Buscar atividades"
          query={catalog.query}
          selects={[
            {
              label: "Curso",
              options: catalog.courses.map((c) => [c.id, c.title] as const),
              param: "curso",
              value: params.curso ?? "",
            },
            { label: "Prazo", options: dueOptions, param: "prazo", value: due },
          ]}
        />
      </div>

      <div className="gk-table-card">
        <table className="gk-table gk-qtable">
          <thead>
            <tr>
              <th>Atividade</th>
              <th>Prazo</th>
              <th>Destinatários</th>
              <th>Entregas</th>
              <th>Correção</th>
              <th>Estado</th>
              <th className="gk-col-menu" />
            </tr>
          </thead>
          <tbody>
            {catalog.activities.length ? (
              catalog.activities.map((row) => (
                <ActivityRow key={row.id} row={row} />
              ))
            ) : (
              <tr>
                <td className="gk-empty-cell" colSpan={7}>
                  Nenhuma atividade encontrada. Altere os filtros ou crie uma
                  atividade para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginação das atividades" className="gk-pager">
        <span>
          {catalog.totalCount === 0
            ? "0 atividades"
            : `${first} a ${Math.min(catalog.page * catalog.pageSize, catalog.totalCount)} de ${catalog.totalCount}`}
        </span>
        <div>
          {catalog.page > 1 ? (
            <Link className="gk-btn" href={pageLink(catalog.page - 1)}>
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className="gk-btn" data-disabled="true">
              Anterior
            </span>
          )}
          {catalog.page < catalog.totalPages ? (
            <Link className="gk-btn" href={pageLink(catalog.page + 1)}>
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

export default GestaoActivitiesPage;
