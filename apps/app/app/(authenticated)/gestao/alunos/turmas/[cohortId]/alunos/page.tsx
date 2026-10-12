import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getGestaoAddableMembers,
  getGestaoCohortDetail,
  getGestaoCohortRoster,
  listGestaoCohorts,
} from "@/lib/gestao-cohorts";
import { GestaoCohortHeader } from "../cohort-header";
import {
  CohortCsvImport,
  CohortInviteManager,
  CohortRosterManager,
} from "../cohort-roster";

type RosterResult = NonNullable<
  Awaited<ReturnType<typeof getGestaoCohortRoster>>
>;
type AddableResult = NonNullable<
  Awaited<ReturnType<typeof getGestaoAddableMembers>>
>;
const parsePage = (value: string | undefined) =>
  Math.max(1, Number.parseInt(value ?? "1", 10) || 1);
const routeFor = (cohortId: string) =>
  `/gestao/alunos/turmas/${cohortId}/alunos`;
const memberSearchCopy = (add: boolean, onlyUnassigned: boolean) => {
  if (add && onlyUnassigned) {
    return {
      label: "Buscar alunos sem turma",
      placeholder: "Buscar aluno sem turma",
      submit: "Buscar alunos",
    };
  }
  if (add) {
    return {
      label: "Buscar membros para adicionar",
      placeholder: "Buscar por nome ou e-mail para adicionar",
      submit: "Buscar membros",
    };
  }
  return {
    label: "Buscar alunos desta turma",
    placeholder: "Buscar aluno da turma",
    submit: "Buscar",
  };
};

const MemberSearch = ({
  cohortId,
  query,
  addQuery,
  add = false,
  onlyUnassigned = false,
}: {
  readonly cohortId: string;
  readonly query: string;
  readonly addQuery: string;
  readonly add?: boolean;
  readonly onlyUnassigned?: boolean;
}) => {
  const copy = memberSearchCopy(add, onlyUnassigned);
  return (
    <form
      action={routeFor(cohortId)}
      className={`gt-roster-search${add ? "gt-addable-search" : ""}`}
      method="get"
    >
      {add ? (
        <input name="q" type="hidden" value={query} />
      ) : (
        <input name="addq" type="hidden" value={addQuery} />
      )}
      {onlyUnassigned ? (
        <input name="somenteSemTurma" type="hidden" value="1" />
      ) : null}
      <label>
        <span className="sr-only">{copy.label}</span>
        <input
          defaultValue={add ? addQuery : query}
          maxLength={120}
          name={add ? "addq" : "q"}
          placeholder={copy.placeholder}
          type="search"
        />
      </label>
      <Button type="submit" variant="outline">
        {copy.submit}
      </Button>
    </form>
  );
};

const RosterPagination = ({
  cohortId,
  page,
  result,
  query,
  addQuery,
  onlyUnassigned,
}: {
  readonly cohortId: string;
  readonly page: number;
  readonly result: RosterResult;
  readonly query: string;
  readonly addQuery: string;
  readonly onlyUnassigned: boolean;
}) =>
  result.totalPages > 1 ? (
    <nav aria-label="Paginação dos alunos da turma" className="gt-pagination">
      <span>
        {(page - 1) * result.pageSize + 1}–
        {Math.min(page * result.pageSize, result.totalCount)} de{" "}
        {result.totalCount}
      </span>
      <div>
        {page > 1 ? (
          <Link
            href={`${routeFor(cohortId)}?pagina=${page - 1}&q=${encodeURIComponent(query)}&addq=${encodeURIComponent(addQuery)}${onlyUnassigned ? "&somenteSemTurma=1" : ""}`}
          >
            Anterior
          </Link>
        ) : null}
        {page < result.totalPages ? (
          <Link
            href={`${routeFor(cohortId)}?pagina=${page + 1}&q=${encodeURIComponent(query)}&addq=${encodeURIComponent(addQuery)}${onlyUnassigned ? "&somenteSemTurma=1" : ""}`}
          >
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  ) : null;

const AddablePagination = ({
  cohortId,
  page,
  result,
  query,
  addQuery,
  onlyUnassigned,
}: {
  readonly cohortId: string;
  readonly page: number;
  readonly result: AddableResult;
  readonly query: string;
  readonly addQuery: string;
  readonly onlyUnassigned: boolean;
}) =>
  result.totalPages > 1 ? (
    <nav
      aria-label="Paginação dos membros disponíveis"
      className="gt-pagination"
    >
      <span>
        Página {page} de {result.totalPages} · {result.totalCount} membros
      </span>
      <div>
        {page > 1 ? (
          <Link
            href={`${routeFor(cohortId)}?addpagina=${page - 1}&q=${encodeURIComponent(query)}&addq=${encodeURIComponent(addQuery)}${onlyUnassigned ? "&somenteSemTurma=1" : ""}`}
          >
            Anterior
          </Link>
        ) : null}
        {page < result.totalPages ? (
          <Link
            href={`${routeFor(cohortId)}?addpagina=${page + 1}&q=${encodeURIComponent(query)}&addq=${encodeURIComponent(addQuery)}${onlyUnassigned ? "&somenteSemTurma=1" : ""}`}
          >
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  ) : null;

const mapTargets = (
  cohortId: string,
  cohorts: Awaited<ReturnType<typeof listGestaoCohorts>>["cohorts"]
) =>
  cohorts
    .filter((item) => item.id !== cohortId && item.status !== "ARCHIVED")
    .map(({ id, name }) => ({ id, name }));
const mapStudents = (result: RosterResult) =>
  result.memberships.map(({ joinedAt, member }) => ({
    id: member.id,
    displayName: member.displayName,
    email: member.email,
    joinedAt,
  }));
const mapAddable = (result: AddableResult) =>
  result.members.map((member) => ({
    id: member.id,
    displayName: member.displayName,
    email: member.email,
    otherCohortCount: member.otherCohortCount,
  }));

const GestaoCohortStudentsPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ cohortId: string }>;
  readonly searchParams: Promise<{
    q?: string;
    addq?: string;
    pagina?: string;
    addpagina?: string;
    somenteSemTurma?: string;
  }>;
}) => {
  const [{ cohortId }, query] = await Promise.all([params, searchParams]);
  const onlyUnassigned = query.somenteSemTurma === "1";
  const [cohort, roster, addable, targetResult] = await Promise.all([
    getGestaoCohortDetail(cohortId),
    getGestaoCohortRoster(cohortId, {
      page: parsePage(query.pagina),
      query: query.q,
    }),
    getGestaoAddableMembers(cohortId, {
      page: parsePage(query.addpagina),
      query: query.addq,
      unassignedOnly: onlyUnassigned,
    }),
    listGestaoCohorts({ status: "ALL", page: 1 }),
  ]);
  if (!(cohort && roster && addable)) {
    notFound();
  }
  const page = parsePage(query.pagina);
  const addPage = parsePage(query.addpagina);
  const q = query.q ?? "";
  const addq = query.addq ?? "";
  return (
    <section className="gt-page gt-detail-page">
      <GestaoCohortHeader activeTab="alunos" cohort={cohort} />
      <MemberSearch
        addQuery={addq}
        cohortId={cohortId}
        onlyUnassigned={onlyUnassigned}
        query={q}
      />
      <CohortRosterManager
        addable={mapAddable(addable)}
        cohortId={cohortId}
        onlyUnassigned={onlyUnassigned}
        students={mapStudents(roster)}
        targets={mapTargets(cohortId, targetResult.cohorts)}
      />
      <RosterPagination
        addQuery={addq}
        cohortId={cohortId}
        onlyUnassigned={onlyUnassigned}
        page={page}
        query={q}
        result={roster}
      />
      <MemberSearch
        add
        addQuery={addq}
        cohortId={cohortId}
        onlyUnassigned={onlyUnassigned}
        query={q}
      />
      <AddablePagination
        addQuery={addq}
        cohortId={cohortId}
        onlyUnassigned={onlyUnassigned}
        page={addPage}
        query={q}
        result={addable}
      />
      <CohortCsvImport cohortId={cohortId} />
      <CohortInviteManager cohortId={cohortId} invites={roster.invites} />
    </section>
  );
};
export default GestaoCohortStudentsPage;
