import { Button } from "@repo/design-system/components/ui/button";
import { CalendarDaysIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGestaoCohortOverviewExtras } from "@/lib/gestao-cohort-overview";
import { getGestaoCohortDetail } from "@/lib/gestao-cohorts";
import { situationLabels } from "@/lib/gestao-student-tracking";
import { GestaoCohortHeader } from "./cohort-header";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeZone: "America/Sao_Paulo",
});
const weekFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const GestaoCohortOverviewPage = async ({
  params,
}: {
  readonly params: Promise<{ cohortId: string }>;
}) => {
  const { cohortId } = await params;
  const cohort = await getGestaoCohortDetail(cohortId);
  if (!cohort) {
    notFound();
  }
  const extras = await getGestaoCohortOverviewExtras(cohortId);
  return (
    <section className="gt-page gt-detail-page">
      <GestaoCohortHeader activeTab="visao" cohort={cohort} />
      <div className="gt-detail-metrics">
        <article>
          <span>Alunos</span>
          <strong>{cohort.activeStudentCount}</strong>
          <small>{cohort.pendingInviteCount} convites pendentes</small>
        </article>
        <article>
          <span>Cursos liberados</span>
          <strong>{cohort.courseAccesses.length}</strong>
          <small>Disponibilidade calculada pela data</small>
        </article>
        <article>
          <span>Entrada tardia</span>
          <strong>
            {cohort.lateJoinPolicy === "ALL_ACTIVE"
              ? "Recebe o conteúdo atual"
              : "A partir da entrada"}
          </strong>
          <small>Regra aplicada em novas matrículas</small>
        </article>
        <article>
          <span>Leitura após encerramento</span>
          <strong>{cohort.readAfterEndDays} dias</strong>
          <small>Vínculos individuais são preservados</small>
        </article>
      </div>
      <div className="gt-detail-metrics">
        <article>
          <span>Entregas no prazo</span>
          <strong>
            {extras.onTimeRate === null ? "—" : `${extras.onTimeRate}%`}
          </strong>
          <small>Entregas feitas até o prazo da atividade</small>
        </article>
        <article>
          <span>Presença média</span>
          <strong>
            {extras.attendanceRate === null ? "—" : `${extras.attendanceRate}%`}
          </strong>
          <small>Nos encontros com presença registrada</small>
        </article>
        <article>
          <span>Atividades abertas</span>
          <strong>{extras.openActivities}</strong>
          <small>Publicadas e dentro do prazo</small>
        </article>
        <article>
          <span>Encontros futuros</span>
          <strong>{extras.futureMeetings}</strong>
          <small>Publicados para a turma</small>
        </article>
      </div>
      <div className="gt-detail-columns">
        <div className="gx-stack">
          <section aria-labelledby="cohort-week" className="gt-panel">
            <div className="gt-panel-heading">
              <h2 id="cohort-week">Esta semana na turma</h2>
              <Link href={`/gestao/alunos/turmas/${cohortId}/calendario`}>
                Calendário
              </Link>
            </div>
            {extras.week.length === 0 ? (
              <p className="gt-panel-empty">
                Nada marcado para os próximos 7 dias.
              </p>
            ) : (
              <ul className="gx-list">
                {extras.week.map((item) => (
                  <li
                    key={`${item.kind}-${item.title}-${item.at.toISOString()}`}
                  >
                    <Link href={item.href}>
                      <span>
                        <strong>{item.title}</strong>
                        <span>
                          {weekFormat.format(item.at)} · {item.detail}
                        </span>
                      </span>
                      {item.draft ? (
                        <span className="gx-chip" data-tone="neutral">
                          Rascunho
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="cohort-attention" className="gt-panel">
            <div className="gt-panel-heading">
              <h2 id="cohort-attention">Alunos que pedem atenção</h2>
              <Link href={`/gestao/alunos/acompanhamento?turma=${cohortId}`}>
                Ver todos
              </Link>
            </div>
            {extras.attention.length === 0 ? (
              <p className="gt-panel-empty">
                Ninguém pede atenção agora. A regra é a mesma do Acompanhamento.
              </p>
            ) : (
              <ul className="gx-list">
                {extras.attention.map((student) => (
                  <li key={student.id}>
                    <Link href={`/gestao/alunos/perfil/${student.id}`}>
                      <span>
                        <strong>{student.displayName}</strong>
                        <span>
                          {student.overdueDeliveries > 0
                            ? `${student.overdueDeliveries} entregas atrasadas · `
                            : ""}
                          {student.lastStudyAt
                            ? `sem estudar há ${student.daysSinceActivity} dias`
                            : "ainda não estudou"}
                        </span>
                      </span>
                      <span
                        className="gx-chip"
                        data-tone={
                          student.situation === "INACTIVE" ? "danger" : "warn"
                        }
                      >
                        {situationLabels[student.situation]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <section className="gt-panel">
          <div className="gt-panel-heading">
            <h2>Conteúdos desta turma</h2>
            <Link href={`/gestao/alunos/turmas/${cohortId}/conteudo`}>
              Gerenciar
            </Link>
          </div>
          {cohort.courseAccesses.length ? (
            <ul className="gt-access-list">
              {cohort.courseAccesses.map((access) => (
                <li key={access.id}>
                  <CalendarDaysIcon aria-hidden="true" />
                  <span>
                    <strong>{access.course.title}</strong>
                    <small>
                      {access.releaseMode === "SCHEDULE" && access.startsAt
                        ? `Liberação em ${dateFormat.format(access.startsAt)}`
                        : "Liberado para a turma"}
                    </small>
                  </span>
                  <span className="gt-course-state">
                    {access.course.status === "PUBLISHED"
                      ? "Publicado"
                      : "Indisponível"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="gt-panel-empty">
              Nenhum curso foi liberado para esta turma.
            </p>
          )}
        </section>
        <section className="gt-panel">
          <div className="gt-panel-heading">
            <h2>Responsáveis</h2>
            <Link href={`/gestao/alunos/turmas/${cohortId}/configuracoes`}>
              Editar
            </Link>
          </div>
          {cohort.teachers.length ? (
            <ul className="gt-teacher-list">
              {cohort.teachers.map(({ member }) => (
                <li key={member.id}>
                  <span aria-hidden="true" className="gt-avatar">
                    {member.displayName
                      ?.slice(0, 1)
                      .toLocaleUpperCase("pt-BR") ?? "R"}
                  </span>
                  <span>
                    <strong>{member.displayName ?? "Professor"}</strong>
                    {member.email ? <small>{member.email}</small> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="gt-panel-empty">Nenhum responsável foi atribuído.</p>
          )}
        </section>
      </div>
      <section className="gt-panel">
        <div className="gt-panel-heading">
          <h2>Próximo passo</h2>
        </div>
        <p className="gt-panel-copy">
          Adicione alunos já cadastrados, convide quem ainda não tem acesso ou
          importe uma planilha com prévia antes de confirmar.
        </p>
        <Button asChild variant="outline">
          <Link href={`/gestao/alunos/turmas/${cohortId}/alunos#alunos`}>
            Ver alunos da turma
          </Link>
        </Button>
      </section>
    </section>
  );
};
export default GestaoCohortOverviewPage;
