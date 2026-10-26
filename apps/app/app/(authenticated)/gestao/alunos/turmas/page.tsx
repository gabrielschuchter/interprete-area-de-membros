import { Button } from "@repo/design-system/components/ui/button";
import { CalendarDaysIcon } from "lucide-react";
import Link from "next/link";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import { type GestaoCohortTab, listGestaoCohorts } from "@/lib/gestao-cohorts";
import { GestaoIcon } from "../../gestao-icon";
import { CohortFilters } from "./cohort-filters";

const statuses = [
  ["ACTIVE", "Ativas"],
  ["NOT_STARTED", "Não iniciadas"],
  ["ENDED", "Encerradas"],
  ["ARCHIVED", "Arquivadas"],
] as const satisfies readonly (readonly [
  Exclude<GestaoCohortTab, "ALL">,
  string,
])[];
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});
const statusLabels = {
  ACTIVE: "Em andamento",
  NOT_STARTED: "Não iniciada",
  ENDED: "Encerrada",
  ARCHIVED: "Arquivada",
} as const;
const statusIcons = {
  ACTIVE: "clock",
  NOT_STARTED: "calendar",
  ENDED: "archive",
  ARCHIVED: "archive",
} as const;
type CohortListItem = Awaited<
  ReturnType<typeof listGestaoCohorts>
>["cohorts"][number];
type StatusCounts = Awaited<
  ReturnType<typeof listGestaoCohorts>
>["statusCounts"];

const statusHref = (status: string, query: string, teacherId = "") =>
  `/gestao/alunos/turmas?status=${status}${query ? `&q=${encodeURIComponent(query)}` : ""}${teacherId ? `&responsavel=${encodeURIComponent(teacherId)}` : ""}`;

const CohortStatusTabs = ({
  status,
  query,
  teacherId,
  counts,
}: {
  readonly status: GestaoCohortTab;
  readonly query: string;
  readonly teacherId: string;
  readonly counts: StatusCounts;
}) => (
  <nav aria-label="Situação das turmas" className="gk-tabs">
    {statuses.map(([key, label]) => (
      <Link
        aria-current={status === key ? "page" : undefined}
        className="gk-tab"
        href={statusHref(key, query, teacherId)}
        key={key}
        role="tab"
      >
        {counts[key] > 0 ? `${label} · ${counts[key]}` : label}
      </Link>
    ))}
  </nav>
);

const UnassignedNotice = ({ count }: { readonly count: number | null }) =>
  count ? (
    <aside aria-label="Alunos sem turma" className="gk-notice" role="alert">
      <GestaoIcon name="alert-circle" size={20} />
      <div className="gk-notice-copy">
        <strong>
          {count === 1
            ? "1 aluno ainda não está em nenhuma turma."
            : `${count} alunos ainda não estão em nenhuma turma.`}
        </strong>
        <span>
          Eles não recebem cursos, atividades nem encontros até entrarem em uma
          turma.
        </span>
      </div>
      <Link className="gk-btn gk-btn--sm" href="/gestao/alunos/turmas/atribuir">
        Atribuir a uma turma
      </Link>
    </aside>
  ) : null;

const CohortListToolbar = ({
  status,
  query,
  teacherId,
  cardMode,
  responsibleOptions,
}: {
  readonly status: GestaoCohortTab;
  readonly query: string;
  readonly teacherId: string;
  readonly cardMode: boolean;
  readonly responsibleOptions: readonly {
    readonly displayName: string | null;
    readonly id: string;
  }[];
}) => (
  <div className="gk-toolbar">
    <CohortFilters
      query={query}
      responsibleOptions={responsibleOptions}
      selectedTeacherId={teacherId}
    />
    <fieldset className="gk-segmented">
      <legend className="sr-only">Visualização</legend>
      <Link aria-pressed={cardMode} href={statusHref(status, query, teacherId)}>
        Cartões
      </Link>
      <Link
        aria-pressed={!cardMode}
        href={`${statusHref(status, query, teacherId)}&visualizacao=lista`}
      >
        Lista
      </Link>
    </fieldset>
  </div>
);

const CohortCard = ({ cohort }: { readonly cohort: CohortListItem }) => (
  <article className="gt-cohort-card">
    <div aria-hidden="true" className="gt-cohort-cover">
      <span>
        {dateFormat.format(cohort.startsAt)}
        {cohort.endsAt
          ? ` a ${dateFormat.format(cohort.endsAt)}`
          : " · sem data final"}
      </span>
    </div>
    <div className="gt-cohort-card-body">
      <div className="gt-cohort-title-row">
        <h2>{cohort.name}</h2>
        <span
          className={`gt-status-pill gt-status-${cohort.status.toLowerCase()}`}
        >
          <GestaoIcon
            name={statusIcons[cohort.status]}
            size={12}
            strokeWidth={1.8}
          />
          {statusLabels[cohort.status]}
        </span>
      </div>
      <div className="gt-cohort-facts">
        <span>
          <strong>{cohort.activeStudentCount}</strong>{" "}
          {cohort.activeStudentCount === 1 ? "aluno" : "alunos"}
        </span>
        <span>
          <strong>{cohort.courseCount}</strong>{" "}
          {cohort.courseCount === 1 ? "curso" : "cursos"}
        </span>
        <span>
          <strong>{cohort.meetingCount}</strong>{" "}
          {cohort.meetingCount === 1 ? "encontro" : "encontros"}
        </span>
      </div>
      <div className="gt-cohort-progress">
        <div className="gt-cohort-progress-label">
          <span>Progresso médio</span>
          <span>{cohort.averageProgress}%</span>
        </div>
        <div
          aria-label={`Progresso médio da turma: ${cohort.averageProgress}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={cohort.averageProgress}
          className="gt-cohort-progress-track"
          role="progressbar"
        >
          <span style={{ width: `${cohort.averageProgress}%` }} />
        </div>
      </div>
      <div className="gt-cohort-footer">
        <div
          className="gt-responsibles"
          title={cohort.responsible
            .map((teacher) => teacher.displayName ?? "Responsável")
            .join(", ")}
        >
          <span aria-hidden="true" className="gt-avatar">
            {(cohort.responsible[0]?.displayName ?? "R")
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toLocaleUpperCase("pt-BR")}
          </span>
          <span>
            Responsável:{" "}
            {cohort.responsible[0]?.displayName ?? "Responsável não atribuído"}
            {cohort.responsible.length > 1
              ? ` +${cohort.responsible.length - 1}`
              : ""}
          </span>
        </div>
        <div className="gt-cohort-card-actions">
          <Link
            className="gk-btn gk-btn--sm"
            href={`/gestao/alunos/turmas/${cohort.id}`}
          >
            Abrir
          </Link>
          <Link
            aria-label={`Configurações de ${cohort.name}`}
            className="gk-icon-btn"
            href={`/gestao/alunos/turmas/${cohort.id}/configuracoes`}
          >
            <GestaoIcon name="dots" size={18} />
          </Link>
        </div>
      </div>
    </div>
  </article>
);

const CohortCards = ({
  cohorts,
  cardMode,
  canCreate,
}: {
  readonly cohorts: readonly CohortListItem[];
  readonly cardMode: boolean;
  readonly canCreate: boolean;
}) => (
  <div className={cardMode ? "gt-cohort-grid" : "gt-cohort-list"}>
    {cohorts.map((cohort) => (
      <CohortCard cohort={cohort} key={cohort.id} />
    ))}
    {cardMode && canCreate ? (
      <Link className="gt-cohort-new" href="/gestao/alunos/turmas/nova">
        <span>
          <GestaoIcon name="plus" size={20} />
        </span>
        Nova turma
      </Link>
    ) : null}
  </div>
);

const emptyCohortTitle = (query: string, status: GestaoCohortTab) => {
  if (query) {
    return "Nenhuma turma encontrada";
  }
  if (status === "ACTIVE") {
    return "Nenhuma turma em andamento";
  }
  return "Nenhuma turma nesta situação";
};

const EmptyCohorts = ({
  query,
  status,
}: {
  readonly query: string;
  readonly status: GestaoCohortTab;
}) => (
  <div className="gestao-empty-state">
    <CalendarDaysIcon aria-hidden="true" />
    <h2>{emptyCohortTitle(query, status)}</h2>
    <p>
      {query
        ? "Confira o nome digitado ou tente outra busca."
        : "Crie uma turma para organizar responsáveis, alunos, cursos e liberações."}
    </p>
    {!query && status !== "ARCHIVED" ? (
      <Button asChild>
        <Link href="/gestao/alunos/turmas/nova">Criar turma</Link>
      </Button>
    ) : null}
  </div>
);

const CohortPagination = ({
  page,
  totalPages,
  totalCount,
  status,
  query,
}: {
  readonly page: number;
  readonly totalPages: number;
  readonly totalCount: number;
  readonly status: GestaoCohortTab;
  readonly query: string;
}) =>
  totalPages > 1 ? (
    <nav aria-label="Paginação das turmas" className="gt-pagination">
      <span>
        Página {page} de {totalPages} · {totalCount} turmas
      </span>
      <div>
        {page > 1 ? (
          <Link href={`${statusHref(status, query)}&pagina=${page - 1}`}>
            Anterior
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link href={`${statusHref(status, query)}&pagina=${page + 1}`}>
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  ) : null;

const GestaoCohortsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{
    q?: string;
    pagina?: string;
    responsavel?: string;
    status?: string;
    visualizacao?: string;
  }>;
}) => {
  const [actor, params] = await Promise.all([
    requireGestaoActor(),
    searchParams,
  ]);
  const status = statuses.some(([key]) => key === params.status)
    ? (params.status as GestaoCohortTab)
    : "ACTIVE";
  const page = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);
  const query = params.q?.trim().slice(0, 120) ?? "";
  const teacherId = params.responsavel?.trim().slice(0, 120) ?? "";
  const result = await listGestaoCohorts({ page, query, status, teacherId });
  const cardMode = params.visualizacao !== "lista";
  return (
    <section className="gt-page">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Turmas</h1>
          <p>
            Os alunos entram em turmas. Todos da mesma turma recebem os mesmos
            cursos, atividades, encontros e avisos, e você pode enviar algo só
            para alguns.
          </p>
        </div>
        <div className="gk-head-actions">
          <Link className="gk-btn" href="/gestao/alunos/turmas/importar">
            Importar turma de planilha
          </Link>
          <Link
            className="gk-btn gk-btn--primary gk-btn--wide"
            href="/gestao/alunos/turmas/nova"
          >
            Nova turma
          </Link>
        </div>
      </header>
      <CohortStatusTabs
        counts={result.statusCounts}
        query={query}
        status={status}
        teacherId={teacherId}
      />
      {actor.role === "ADMIN" ? (
        <UnassignedNotice count={result.unassignedMemberCount} />
      ) : null}
      <CohortListToolbar
        cardMode={cardMode}
        query={query}
        responsibleOptions={result.responsibleOptions}
        status={status}
        teacherId={teacherId}
      />
      {result.cohorts.length ? (
        <CohortCards canCreate cardMode={cardMode} cohorts={result.cohorts} />
      ) : (
        <EmptyCohorts query={query} status={status} />
      )}
      <CohortPagination
        page={result.page}
        query={query}
        status={status}
        totalCount={result.totalCount}
        totalPages={result.totalPages}
      />
    </section>
  );
};
export default GestaoCohortsPage;
