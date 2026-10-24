import { database } from "@repo/database";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { getGestaoCorrectionCohortScope } from "@/lib/gestao-correction-scope";
import { formatStudyMinutes } from "@/lib/gestao-format";
import {
  listGestaoStudentTracking,
  parseSituation,
  type StudentSituation,
  situationLabels,
  studentSituations,
} from "@/lib/gestao-student-tracking";
import { GestaoPageHeading } from "../../gestao-shell";

const pageSize = 25;
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});
const tone: Record<StudentSituation, string> = {
  ON_TRACK: "ok",
  ATTENTION: "warn",
  INACTIVE: "danger",
};

const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? undefined : value;

interface FilterOption {
  readonly id: string;
  readonly name?: string;
  readonly title?: string;
}

const TrackingFilters = ({
  cohortId,
  cohorts,
  courseId,
  courses,
  hasFilters,
  query,
  situation,
}: {
  readonly cohortId: string | undefined;
  readonly cohorts: readonly FilterOption[];
  readonly courseId: string | undefined;
  readonly courses: readonly FilterOption[];
  readonly hasFilters: boolean;
  readonly query: string;
  readonly situation: StudentSituation | undefined;
}) => (
  <form
    action="/gestao/alunos/acompanhamento"
    className="gx-filters"
    method="get"
  >
    <input
      aria-label="Buscar aluno"
      defaultValue={query}
      maxLength={120}
      name="q"
      placeholder="Buscar aluno"
      type="search"
    />
    <select aria-label="Turma" defaultValue={cohortId ?? ""} name="turma">
      <option value="">Todas as turmas</option>
      {cohorts.map((cohort) => (
        <option key={cohort.id} value={cohort.id}>
          {cohort.name}
        </option>
      ))}
    </select>
    <select aria-label="Curso" defaultValue={courseId ?? ""} name="curso">
      <option value="">Todos os cursos</option>
      {courses.map((course) => (
        <option key={course.id} value={course.id}>
          {course.title}
        </option>
      ))}
    </select>
    <select
      aria-label="Situação"
      defaultValue={situation ?? ""}
      name="situacao"
    >
      <option value="">Toda situação</option>
      {studentSituations.map((value) => (
        <option key={value} value={value}>
          {situationLabels[value]}
        </option>
      ))}
    </select>
    <button className="gx-button" type="submit">
      Filtrar
    </button>
    {hasFilters ? (
      <Link className="gx-link" href="/gestao/alunos/acompanhamento">
        Limpar filtros
      </Link>
    ) : null}
  </form>
);

const TrackingTable = ({
  rows,
}: {
  readonly rows: Awaited<ReturnType<typeof listGestaoStudentTracking>>["rows"];
}) => (
  <div className="gx-table-wrap">
    <table className="gx-table">
      <thead>
        <tr>
          <th scope="col">Aluno</th>
          <th scope="col">Turmas</th>
          <th scope="col">Último estudo</th>
          <th scope="col">7 dias</th>
          <th scope="col">Atrasadas</th>
          <th scope="col">Situação</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <Link href={`/gestao/alunos/perfil/${row.id}`}>
                {row.displayName}
              </Link>
            </td>
            <td>{row.cohorts.join(", ")}</td>
            <td>
              {row.lastStudyAt
                ? `${dateFormat.format(row.lastStudyAt)} · há ${row.daysSinceActivity} d`
                : "Ainda não estudou"}
            </td>
            <td>{formatStudyMinutes(row.studySecondsLast7Days)}</td>
            <td>{row.overdueDeliveries}</td>
            <td>
              <span className="gx-chip" data-tone={tone[row.situation]}>
                {situationLabels[row.situation]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const GestaoStudentTrackingPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  if (Object.values(params).some(Array.isArray)) {
    forbidden();
  }
  const cohortId = single(params.turma)?.slice(0, 255);
  const courseId = single(params.curso)?.slice(0, 255);
  const query = single(params.q)?.slice(0, 120) ?? "";
  const situation = parseSituation(single(params.situacao));
  const page = Math.max(1, Math.trunc(Number(single(params.pagina)) || 1));
  const { actor } = await requireGestaoAction("students.read");
  const [tracking, cohorts, courses] = await Promise.all([
    listGestaoStudentTracking({
      cohortId,
      courseId,
      query,
      situation,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    database.cohort.findMany({
      where: getGestaoCorrectionCohortScope(actor),
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
      take: 200,
    }),
    database.course.findMany({
      where: { experience: "ASYNC", status: { not: "ARCHIVED" } },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: { id: true, title: true },
      take: 200,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(tracking.total / pageSize));
  const filterParams = new URLSearchParams();
  for (const [key, value] of [
    ["turma", cohortId],
    ["curso", courseId],
    ["q", query],
    ["situacao", situation],
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
    return `/gestao/alunos/acompanhamento${text ? `?${text}` : ""}`;
  };
  const exportHref = `/gestao/alunos/acompanhamento/exportar${filterParams.size ? `?${filterParams}` : ""}`;
  return (
    <section className="gx-page">
      <GestaoPageHeading
        description="Situação calculada pelo estudo registrado e pelas entregas. Atenção: 5 dias sem estudar ou entrega atrasada. Inativo: 21 dias sem estudar."
        eyebrow="Gestão · Alunos"
        title="Alunos e acompanhamento"
      >
        <a className="gx-button-outline" href={exportHref}>
          Exportar CSV
        </a>
      </GestaoPageHeading>
      <TrackingFilters
        cohortId={cohortId}
        cohorts={cohorts}
        courseId={courseId}
        courses={courses}
        hasFilters={filterParams.size > 0}
        query={query}
        situation={situation}
      />
      {tracking.rows.length === 0 ? (
        <div className="gestao-empty-state">
          <h2>
            {filterParams.size
              ? "Nenhum aluno com esses filtros"
              : "Nenhum aluno para acompanhar"}
          </h2>
          <p>
            {filterParams.size
              ? "Limpe os filtros para ver todos os alunos das suas turmas."
              : "Os alunos aparecem aqui quando entram em uma turma pela qual você é responsável."}
          </p>
        </div>
      ) : (
        <div className="gx-card">
          <TrackingTable rows={tracking.rows} />
          <nav aria-label="Páginas" className="gx-pagination">
            <span>
              {tracking.total} {tracking.total === 1 ? "aluno" : "alunos"}
            </span>
            <span>
              {page > 1 ? (
                <Link className="gx-link" href={pageHref(page - 1)}>
                  Anterior
                </Link>
              ) : null}{" "}
              Página {Math.min(page, pages)} de {pages}{" "}
              {page < pages ? (
                <Link className="gx-link" href={pageHref(page + 1)}>
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

export default GestaoStudentTrackingPage;
