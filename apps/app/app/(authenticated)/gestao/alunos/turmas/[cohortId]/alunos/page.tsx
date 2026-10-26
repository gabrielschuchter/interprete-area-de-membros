import Link from "next/link";
import { notFound } from "next/navigation";
import { getGestaoCohortOverviewExtras } from "@/lib/gestao-cohort-overview";
import {
  getGestaoAddableMembers,
  getGestaoCohortDetail,
  getGestaoCohortRoster,
  getGestaoCohortRosterTable,
  listGestaoAssignableCohorts,
} from "@/lib/gestao-cohorts";
import { parseSituation } from "@/lib/gestao-student-tracking";
import { GestaoListFilters } from "../../../../gestao-list-filters";
import { GestaoCohortHeader } from "../cohort-header";
import { AddStudentsDrawer, type AddTab } from "./add-students-drawer";
import { InvitesPanel } from "./invites-panel";
import { RosterTable } from "./roster-table";

const joinedFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Sao_Paulo",
});
const dayMs = 86_400_000;
const addTabs: readonly AddTab[] = ["existentes", "planilha", "convite"];

const parsePage = (value: string | undefined) =>
  Math.max(1, Number.parseInt(value ?? "1", 10) || 1);
const parseTab = (value: string | undefined) =>
  addTabs.find((tab) => tab === value) ?? null;
const ageLabel = (createdAt: Date) => {
  const days = Math.floor((Date.now() - createdAt.getTime()) / dayMs);
  if (days <= 0) {
    return "criado hoje";
  }
  return `criado há ${days} ${days === 1 ? "dia" : "dias"}`;
};

const filterParams = (query: { q?: string; situacao?: string }) => {
  const keep = new URLSearchParams();
  if (query.q) {
    keep.set("q", query.q);
  }
  if (query.situacao) {
    keep.set("situacao", query.situacao);
  }
  return keep;
};
const entryText = (
  courses: number,
  extras: { openActivities: number; futureMeetings: number } | null
) =>
  extras
    ? `${courses} curso(s) liberado(s) · ${extras.openActivities} atividade(s) aberta(s) · ${extras.futureMeetings} encontro(s) futuro(s).`
    : "";

const EmptyRoster = ({
  base,
  filtered,
}: {
  readonly base: string;
  readonly filtered: boolean;
}) => (
  <div className="gk-panel">
    <h2 className="gk-panel-title">
      {filtered ? "Nenhum aluno encontrado" : "Esta turma ainda não tem alunos"}
    </h2>
    <p className="gk-empty">
      {filtered
        ? "Ajuste a busca ou o filtro de situação."
        : "Adicione alunos que já têm conta, importe uma planilha ou gere um link de convite."}
    </p>
    {filtered ? null : (
      <Link
        className="gk-btn gk-btn--primary gk-btn--wide"
        href={`${base}?adicionar=existentes`}
        style={{ marginTop: 14 }}
      >
        Adicionar alunos
      </Link>
    )}
  </div>
);

const Pager = ({
  from,
  next,
  previous,
  to,
  total,
}: {
  readonly from: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly to: number;
  readonly total: number;
}) => (
  <div className="gk-pager">
    <span>
      {from} a {to} de {total}
    </span>
    <div>
      {previous ? (
        <Link className="gk-btn" href={previous}>
          Anterior
        </Link>
      ) : null}
      {next ? (
        <Link className="gk-btn" href={next}>
          Próxima
        </Link>
      ) : null}
    </div>
  </div>
);

const GestaoCohortStudentsPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ cohortId: string }>;
  readonly searchParams: Promise<{
    adicionar?: string;
    addq?: string;
    pagina?: string;
    q?: string;
    situacao?: string;
  }>;
}) => {
  const [{ cohortId }, query] = await Promise.all([params, searchParams]);
  const tab = parseTab(query.adicionar);
  const page = parsePage(query.pagina);
  const situation = parseSituation(query.situacao);
  const [cohort, table, roster, targets] = await Promise.all([
    getGestaoCohortDetail(cohortId),
    getGestaoCohortRosterTable(cohortId, {
      page,
      query: query.q,
      situation,
    }),
    getGestaoCohortRoster(cohortId, {}),
    listGestaoAssignableCohorts({ page: 1 }),
  ]);
  if (!(cohort && table && roster)) {
    notFound();
  }
  const [addable, extras] = tab
    ? await Promise.all([
        tab === "existentes"
          ? getGestaoAddableMembers(cohortId, { query: query.addq })
          : Promise.resolve(null),
        getGestaoCohortOverviewExtras(cohortId),
      ])
    : [null, null];
  const base = `/gestao/alunos/turmas/${cohortId}/alunos`;
  const keep = filterParams(query);
  const pageHref = (target: number) => {
    const next = new URLSearchParams(keep);
    next.set("pagina", String(target));
    return `${base}?${next}`;
  };
  const from = table.totalCount ? (page - 1) * table.pageSize + 1 : 0;
  const to = Math.min(page * table.pageSize, table.totalCount);
  const entry = entryText(cohort.courseAccesses.length, extras);
  return (
    <section className="gt-page gt-detail-page">
      <GestaoCohortHeader activeTab="alunos" cohort={cohort} />
      <div className="gk-toolbar">
        <GestaoListFilters
          options={[
            ["ON_TRACK", "Em ritmo"],
            ["ATTENTION", "Atenção"],
            ["INACTIVE", "Inativo"],
          ]}
          param="situacao"
          placeholder="Buscar aluno da turma"
          query={query.q ?? ""}
          selected={situation ?? ""}
          selectLabel="Situação"
        />
        <div className="gk-toolbar-group">
          <Link className="gk-btn" href={`${base}?adicionar=planilha`}>
            Importar planilha
          </Link>
          <Link className="gk-btn" href={`${base}?adicionar=convite`}>
            Convidar por link
          </Link>
        </div>
      </div>
      {table.rows.length > 0 ? (
        <RosterTable
          cohortId={cohortId}
          cohortName={cohort.name}
          courseCount={table.courseCount}
          key={`${page}-${query.q ?? ""}-${query.situacao ?? ""}`}
          rows={table.rows.map((row) => ({
            activitiesDone: row.activitiesDone,
            activitiesTotal: row.activitiesTotal,
            displayName: row.displayName,
            email: row.email,
            individualGrants: row.individualGrants,
            joinedLabel: joinedFormat.format(row.joinedAt).replace(".", ""),
            memberId: row.memberId,
            progress: row.progress,
            situation: row.situation,
          }))}
          targets={targets.cohorts
            .filter((item) => item.id !== cohortId)
            .map(({ id, name }) => ({ id, name }))}
        />
      ) : (
        <EmptyRoster base={base} filtered={Boolean(query.q || situation)} />
      )}
      {roster.inviteCount > 0 ? (
        <InvitesPanel
          cohortId={cohortId}
          invites={roster.invites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            ageLabel: ageLabel(invite.createdAt),
            usage: invite.email
              ? "Convite individual"
              : `${invite.usedCount} de ${invite.maxUses} usos`,
          }))}
          total={roster.inviteCount}
        />
      ) : null}
      <Pager
        from={from}
        next={page < table.totalPages ? pageHref(page + 1) : null}
        previous={page > 1 ? pageHref(page - 1) : null}
        to={to}
        total={table.totalCount}
      />
      {tab ? (
        <AddStudentsDrawer
          addable={addable?.members ?? []}
          addQuery={query.addq ?? ""}
          cohortId={cohortId}
          cohortName={cohort.name}
          entry={entry}
          studentCount={cohort.activeStudentCount}
          tab={tab}
        />
      ) : null}
    </section>
  );
};
export default GestaoCohortStudentsPage;
