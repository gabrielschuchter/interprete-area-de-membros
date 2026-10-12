import { Button } from "@repo/design-system/components/ui/button";
import { CalendarDaysIcon, PlusIcon, UsersRoundIcon } from "lucide-react";
import Link from "next/link";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import { type GestaoCohortTab, listGestaoCohorts } from "@/lib/gestao-cohorts";
import { GestaoPageHeading } from "../../gestao-shell";

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
type CohortListItem = Awaited<
  ReturnType<typeof listGestaoCohorts>
>["cohorts"][number];
type StatusCounts = Awaited<
  ReturnType<typeof listGestaoCohorts>
>["statusCounts"];

const statusHref = (status: string, query: string) =>
  `/gestao/alunos/turmas?status=${status}${query ? `&q=${encodeURIComponent(query)}` : ""}`;

const CohortStatusTabs = ({
  status,
  query,
  counts,
}: {
  readonly status: GestaoCohortTab;
  readonly query: string;
  readonly counts: StatusCounts;
}) => (
  <nav aria-label="Situação das turmas" className="gt-status-tabs">
    {statuses.map(([key, label]) => (
      <Link
        aria-current={status === key ? "page" : undefined}
        className="gt-status-tab"
        data-active={String(status === key)}
        href={statusHref(key, query)}
        key={key}
      >
        {label}
        <span>{counts[key]}</span>
      </Link>
    ))}
  </nav>
);

const UnassignedNotice = ({ count }: { readonly count: number | null }) =>
  count ? (
    <aside aria-label="Alunos sem turma" className="gt-notice">
      <UsersRoundIcon aria-hidden="true" />
      <div>
        <strong>{count} alunos ainda não estão em nenhuma turma.</strong>
        <p>Eles continuam com o acesso que já tinham até serem vinculados.</p>
      </div>
      <Link href="/gestao/alunos/turmas/nova">Criar uma turma</Link>
    </aside>
  ) : null;

const CohortListToolbar = ({
  status,
  query,
  cardMode,
}: {
  readonly status: GestaoCohortTab;
  readonly query: string;
  readonly cardMode: boolean;
}) => (
  <div className="gt-list-toolbar">
    <form
      action="/gestao/alunos/turmas"
      className="gt-search-form"
      method="get"
    >
      <input name="status" type="hidden" value={status} />
      <label className="gt-search">
        <span className="sr-only">Buscar turmas</span>
        <input
          autoComplete="off"
          defaultValue={query}
          maxLength={120}
          name="q"
          placeholder="Buscar turmas"
          type="search"
        />
      </label>
      <Button type="submit" variant="outline">
        Buscar
      </Button>
    </form>
    <nav aria-label="Visualização das turmas" className="gt-view-switch">
      <Link
        aria-current={cardMode ? "page" : undefined}
        data-active={String(cardMode)}
        href={statusHref(status, query)}
      >
        Cartões
      </Link>
      <Link
        aria-current={cardMode ? undefined : "page"}
        data-active={String(!cardMode)}
        href={`${statusHref(status, query)}&visualizacao=lista`}
      >
        Lista
      </Link>
    </nav>
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
          <strong>{cohort.pendingInviteCount}</strong> convites
        </span>
      </div>
      <div className="gt-cohort-footer">
        <div
          className="gt-responsibles"
          title={cohort.responsible
            .map((teacher) => teacher.displayName ?? "Responsável")
            .join(", ")}
        >
          <span aria-hidden="true" className="gt-avatar">
            {cohort.responsible[0]?.displayName
              ?.slice(0, 1)
              .toLocaleUpperCase("pt-BR") ?? "R"}
          </span>
          <span>
            Responsável:{" "}
            {cohort.responsible[0]?.displayName ?? "Responsável não atribuído"}
            {cohort.responsible.length > 1
              ? ` +${cohort.responsible.length - 1}`
              : ""}
          </span>
        </div>
        <Button asChild variant="outline">
          <Link href={`/gestao/alunos/turmas/${cohort.id}`}>Abrir</Link>
        </Button>
      </div>
    </div>
  </article>
);

const CohortCards = ({
  cohorts,
  cardMode,
}: {
  readonly cohorts: readonly CohortListItem[];
  readonly cardMode: boolean;
}) => (
  <div className={cardMode ? "gt-cohort-grid" : "gt-cohort-list"}>
    {cohorts.map((cohort) => (
      <CohortCard cohort={cohort} key={cohort.id} />
    ))}
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
  const result = await listGestaoCohorts({ page, query, status });
  const cardMode = params.visualizacao !== "lista";
  return (
    <section className="gt-page">
      <GestaoPageHeading
        description="Os alunos entram em turmas. Todos da mesma turma recebem os mesmos cursos e cronograma; envios individuais continuam separados."
        eyebrow="Gestão · Alunos"
        title="Turmas"
      >
        <Button asChild variant="outline">
          <Link href="/gestao/alunos/turmas/nova">
            <PlusIcon aria-hidden="true" />
            Nova turma
          </Link>
        </Button>
      </GestaoPageHeading>
      <CohortStatusTabs
        counts={result.statusCounts}
        query={query}
        status={status}
      />
      {actor.role === "ADMIN" ? (
        <UnassignedNotice count={result.unassignedMemberCount} />
      ) : null}
      <CohortListToolbar cardMode={cardMode} query={query} status={status} />
      {result.cohorts.length ? (
        <CohortCards cardMode={cardMode} cohorts={result.cohorts} />
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
