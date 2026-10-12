import { Button } from "@repo/design-system/components/ui/button";
import { CalendarDaysIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGestaoCohortDetail } from "@/lib/gestao-cohorts";
import { GestaoCohortHeader } from "./cohort-header";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
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
      <div className="gt-detail-columns">
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
