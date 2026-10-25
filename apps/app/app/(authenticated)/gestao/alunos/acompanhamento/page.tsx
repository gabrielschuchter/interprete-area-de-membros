import { database } from "@repo/database";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { getGestaoCorrectionCohortScope } from "@/lib/gestao-correction-scope";
import { formatStudyMinutes } from "@/lib/gestao-format";
import {
  parseSituation,
  queryStudentTracking,
  type StudentSituation,
  type StudentTrackingRow,
  situationLabels,
  studentSituations,
} from "@/lib/gestao-student-tracking";
import { GestaoFilterBar } from "../../gestao-filter-bar";
import { GestaoIcon } from "../../gestao-icon";
import { StudentRowMenu } from "./student-row-menu";

const pageSize = 25;
const whitespace = /\s+/;

const situationChips = {
  ATTENTION: ["alert-circle", "danger"],
  INACTIVE: ["clock", "muted"],
  ON_TRACK: ["check-circle", "active"],
} as const;

const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? undefined : value;

const initials = (name: string) =>
  name
    .split(whitespace)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const lastStudyLabel = (row: StudentTrackingRow) => {
  if (!row.lastStudyAt) {
    return "Ainda não estudou";
  }
  if (row.daysSinceActivity === 0) {
    return "hoje";
  }
  return row.daysSinceActivity === 1
    ? "ontem"
    : `há ${row.daysSinceActivity} dias`;
};

const percent = (done: number, total: number) =>
  total > 0 ? Math.round((done / total) * 100) : null;

const CohortPill = ({ cohorts }: { readonly cohorts: readonly string[] }) =>
  cohorts.length ? (
    <span className="gk-cohortpill" title={cohorts.join(", ")}>
      <GestaoIcon name="users" size={14} />
      <span>{cohorts[0]}</span>
      {cohorts.length > 1 ? <em>+{cohorts.length - 1}</em> : null}
    </span>
  ) : (
    <span className="gk-dash">—</span>
  );

const StudentRow = ({ row }: { readonly row: StudentTrackingRow }) => {
  const progress = percent(row.lessonsDone, row.lessonsTotal);
  const [icon, tone] = situationChips[row.situation];
  return (
    <tr data-attention={row.situation === "ATTENTION"}>
      <td>
        <div className="gk-person">
          <span aria-hidden="true" className="gk-avatar gk-avatar--lg">
            {initials(row.displayName)}
          </span>
          <div>
            <Link
              className="gk-qtitle"
              href={`/gestao/alunos/perfil/${row.id}`}
              prefetch={false}
            >
              {row.displayName}
            </Link>
            {row.email ? <small className="gk-qsub">{row.email}</small> : null}
          </div>
        </div>
      </td>
      <td>
        <CohortPill cohorts={row.cohorts} />
      </td>
      <td>
        {progress === null ? (
          <span className="gk-dash">Sem aulas</span>
        ) : (
          <div className="gk-progress">
            <div className="gk-progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <small>{progress}%</small>
          </div>
        )}
      </td>
      <td>
        {row.activitiesTotal > 0 ? (
          `${row.activitiesDone} de ${row.activitiesTotal}`
        ) : (
          <span className="gk-dash">—</span>
        )}
      </td>
      <td>
        {row.studySecondsLast7Days > 0 ? (
          formatStudyMinutes(row.studySecondsLast7Days)
        ) : (
          <span className="gk-dash">—</span>
        )}
      </td>
      <td>{lastStudyLabel(row)}</td>
      <td>
        <span className="gk-chip" data-tone={tone}>
          <GestaoIcon name={icon} size={12} />
          {situationLabels[row.situation]}
        </span>
      </td>
      <td className="gk-col-menu">
        <StudentRowMenu id={row.id} name={row.displayName} />
      </td>
    </tr>
  );
};

const Kpi = ({
  caption,
  label,
  value,
}: {
  readonly caption: string;
  readonly label: string;
  readonly value: number;
}) => (
  <article>
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{caption}</small>
  </article>
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
  const scope = { cohortId, courseId, query };
  const [tracking, overall, cohorts, courses] = await Promise.all([
    queryStudentTracking(actor, {
      ...scope,
      detail: true,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      situation,
    }),
    queryStudentTracking(actor, { ...scope, limit: 1 }),
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
  const current = Math.min(page, pages);
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
  const allStudents =
    overall.counts.ON_TRACK +
    overall.counts.ATTENTION +
    overall.counts.INACTIVE;
  const first = tracking.total === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, tracking.total);

  return (
    <section className="gt-page gk-tracking">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Acompanhamento</h1>
          <p>
            Os alunos sob sua responsabilidade, com o que importa para orientar.
          </p>
        </div>
        <div className="gk-head-actions">
          <a className="gk-btn" href={exportHref}>
            Exportar (.csv)
          </a>
          <Link
            className="gk-btn gk-btn--primary gk-btn--wide"
            href="/gestao/alunos/turmas/atribuir"
            prefetch={false}
          >
            Atribuir conteúdo
          </Link>
        </div>
      </header>

      <div className="gk-stats gk-stats--three">
        <Kpi
          caption={`de ${allStudents} ${allStudents === 1 ? "aluno" : "alunos"}`}
          label="Em ritmo"
          value={overall.counts.ON_TRACK}
        />
        <Kpi
          caption="sem estudar há 5+ dias ou com entrega atrasada"
          label="Pedem atenção"
          value={overall.counts.ATTENTION}
        />
        <Kpi
          caption="há 3+ semanas sem estudar"
          label="Inativos"
          value={overall.counts.INACTIVE}
        />
      </div>

      <div className="gk-toolbar">
        <GestaoFilterBar
          placeholder="Buscar aluno"
          query={query}
          selects={[
            {
              label: "Turma",
              param: "turma",
              value: cohortId ?? "",
              options: cohorts.map((cohort) => [cohort.id, cohort.name]),
            },
            {
              label: "Curso",
              param: "curso",
              value: courseId ?? "",
              options: courses.map((course) => [course.id, course.title]),
            },
            {
              label: "Situação",
              param: "situacao",
              value: situation ?? "",
              options: studentSituations.map((value: StudentSituation) => [
                value,
                situationLabels[value],
              ]),
            },
          ]}
        />
      </div>

      <div className="gk-table-card">
        <table className="gk-table gk-qtable">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Turma</th>
              <th>Progresso nos cursos</th>
              <th>Atividades</th>
              <th>Tempo na semana</th>
              <th>Último estudo</th>
              <th>Situação</th>
              <th className="gk-col-menu" />
            </tr>
          </thead>
          <tbody>
            {tracking.rows.length ? (
              tracking.rows.map((row) => <StudentRow key={row.id} row={row} />)
            ) : (
              <tr>
                <td className="gk-empty-cell" colSpan={8}>
                  {filterParams.size
                    ? "Nenhum aluno com esses filtros."
                    : "Os alunos aparecem aqui quando entram em uma turma pela qual você é responsável."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Páginas" className="gk-pager">
        <span>
          {tracking.total === 0
            ? "0 alunos"
            : `${first} a ${last} de ${tracking.total}`}
        </span>
        <div>
          {current > 1 ? (
            <Link className="gk-btn" href={pageHref(current - 1)}>
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className="gk-btn" data-disabled="true">
              Anterior
            </span>
          )}
          {current < pages ? (
            <Link className="gk-btn" href={pageHref(current + 1)}>
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

export default GestaoStudentTrackingPage;
