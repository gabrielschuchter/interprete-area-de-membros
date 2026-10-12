import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import { listGestaoAssignableCohorts } from "@/lib/gestao-cohorts";
import { GestaoPageHeading } from "../../../gestao-shell";

const route = "/gestao/alunos/turmas/atribuir";
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

const AssignmentCohort = ({
  cohort,
}: {
  readonly cohort: Awaited<
    ReturnType<typeof listGestaoAssignableCohorts>
  >["cohorts"][number];
}) => (
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
        <span>Responsável: {cohort.responsible ?? "não atribuído"}</span>
      </div>
      <div className="gt-cohort-footer">
        <span />
        <Button asChild variant="outline">
          <Link
            href={`/gestao/alunos/turmas/${cohort.id}/alunos?somenteSemTurma=1#alunos-disponiveis`}
          >
            Selecionar turma
          </Link>
        </Button>
      </div>
    </div>
  </article>
);

const AssignmentPagination = ({
  page,
  totalPages,
  totalCount,
  query,
}: {
  readonly page: number;
  readonly totalPages: number;
  readonly totalCount: number;
  readonly query: string;
}) =>
  totalPages > 1 ? (
    <nav
      aria-label="Paginação das turmas disponíveis"
      className="gt-pagination"
    >
      <span>
        Página {page} de {totalPages} · {totalCount} turmas
      </span>
      <div>
        {page > 1 ? (
          <Link
            href={`${route}?pagina=${page - 1}&q=${encodeURIComponent(query)}`}
          >
            Anterior
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={`${route}?pagina=${page + 1}&q=${encodeURIComponent(query)}`}
          >
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  ) : null;

const GestaoCohortAssignmentPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{ q?: string; pagina?: string }>;
}) => {
  const [actor, params] = await Promise.all([
    requireGestaoActor(),
    searchParams,
  ]);
  if (actor.role !== "ADMIN") {
    notFound();
  }
  const query = params.q?.trim().slice(0, 120) ?? "";
  const page = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);
  const result = await listGestaoAssignableCohorts({ page, query });

  return (
    <section className="gt-page">
      <GestaoPageHeading
        description="Escolha uma turma em andamento ou programada. Depois, selecione os alunos sem turma para adicioná-los."
        eyebrow="Gestão · Alunos"
        title="Atribuir a uma turma"
      >
        <Button asChild variant="outline">
          <Link href="/gestao/alunos/turmas">Voltar para turmas</Link>
        </Button>
      </GestaoPageHeading>
      <div className="gt-list-toolbar">
        <form action={route} className="gt-search-form" method="get">
          <label className="gt-search">
            <span className="sr-only">Buscar turma disponível</span>
            <input
              autoComplete="off"
              defaultValue={query}
              maxLength={120}
              name="q"
              placeholder="Buscar turma"
              type="search"
            />
          </label>
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
      </div>
      {result.cohorts.length ? (
        <div className="gt-cohort-grid">
          {result.cohorts.map((cohort) => (
            <AssignmentCohort cohort={cohort} key={cohort.id} />
          ))}
        </div>
      ) : (
        <div className="gestao-empty-state">
          <h2>
            {query ? "Nenhuma turma encontrada" : "Nenhuma turma disponível"}
          </h2>
          <p>
            {query
              ? "Confira o nome digitado ou tente outra busca."
              : "Crie uma turma em andamento ou programada para escolher quem participa."}
          </p>
          {query ? null : (
            <Button asChild>
              <Link href="/gestao/alunos/turmas/nova">Criar turma</Link>
            </Button>
          )}
        </div>
      )}
      <AssignmentPagination
        page={result.page}
        query={query}
        totalCount={result.totalCount}
        totalPages={result.totalPages}
      />
    </section>
  );
};

export default GestaoCohortAssignmentPage;
