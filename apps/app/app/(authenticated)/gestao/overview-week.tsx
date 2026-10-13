import type { getGestaoOverviewWeek } from "@/lib/gestao-overview-week";

type Week = Awaited<ReturnType<typeof getGestaoOverviewWeek>>;
const WeekMetric = ({
  id,
  label,
  value,
  detail,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: ReactNode;
  readonly detail: string;
}) => (
  <div data-week-metric={id}>
    <dt>{label}</dt>
    <dd>
      <span className="go-week-value">{value}</span>
      <p>{detail}</p>
    </dd>
  </div>
);
export const formatOverviewStudyTime = (seconds: number | null) => {
  if (seconds === null) {
    return "—";
  }
  if (seconds > 0 && seconds < 60) {
    return "Menos de 1 min";
  }
  const minutes = Math.floor(seconds / 60);
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
};

export const OverviewWeek = ({ week }: { readonly week: Week }) => {
  const comparison =
    week.lessonChangePercent === null
      ? "Sem base na semana anterior"
      : `${week.lessonChangePercent > 0 ? "+" : ""}${week.lessonChangePercent}% no mesmo período da semana anterior`;
  return (
    <section aria-labelledby="overview-week" className="go-panel go-week">
      <div className="go-week-heading">
        <h2 id="overview-week">Esta semana</h2>
        <span>Desde segunda-feira</span>
      </div>
      <dl>
        <WeekMetric
          detail={`${week.activeStudents} ${week.activeStudents === 1 ? "aluno único" : "alunos únicos"} nas turmas ativas`}
          id="active-cohorts"
          label="Turmas ativas"
          value={week.activeCohorts}
        />
        <WeekMetric
          detail={`${week.reviewed} ${week.reviewed === 1 ? "corrigida" : "corrigidas"}`}
          id="submissions"
          label="Entregas"
          value={week.submissions}
        />
        <WeekMetric
          detail={comparison}
          id="lessons"
          label="Aulas concluídas"
          value={week.lessons}
        />
        <WeekMetric
          detail={
            week.students
              ? `por aluno · ${week.students} no filtro`
              : "Nenhum aluno no filtro"
          }
          id="study-time"
          label="Tempo médio"
          value={
            week.averageStudySeconds === null ? (
              "—"
            ) : (
              <time dateTime={`PT${week.averageStudySeconds}S`}>
                {formatOverviewStudyTime(week.averageStudySeconds)}
              </time>
            )
          }
        />
      </dl>
      <p className="go-week-note">
        Horário de São Paulo. Alunos em mais de uma turma são contados uma vez.
      </p>
    </section>
  );
};

import type { ReactNode } from "react";
