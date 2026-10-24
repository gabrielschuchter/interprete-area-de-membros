import Link from "next/link";
import { notFound } from "next/navigation";
import { getGestaoCohortOverviewExtras } from "@/lib/gestao-cohort-overview";
import {
  cohortLearningProgress,
  getGestaoCohortDetail,
} from "@/lib/gestao-cohorts";
import { GestaoIcon, type GestaoIconName } from "../../../gestao-icon";
import { GestaoCohortHeader } from "./cohort-header";

const weekDay = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  timeZone: "America/Sao_Paulo",
});
const weekMonth = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: "America/Sao_Paulo",
});
const weekDetail = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const whitespacePattern = /\s+/;
const initialsOf = (name: string) =>
  name
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR") || "?";

const weekIcons: Record<string, GestaoIconName> = {
  deadline: "inbox",
  release: "video",
};
const percent = (value: number | null) => (value === null ? "—" : `${value}%`);

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
  const base = `/gestao/alunos/turmas/${cohortId}`;
  const [extras, progress] = await Promise.all([
    getGestaoCohortOverviewExtras(cohortId),
    cohortLearningProgress(
      [cohortId],
      new Map([[cohortId, cohort.activeStudentCount]])
    ),
  ]);
  const students = cohort.activeStudentCount;
  const links: readonly (readonly [string, string])[] = [
    [
      `${cohort.courseAccesses.length} curso(s) liberado(s)`,
      `${base}/conteudo`,
    ],
    [`${extras.openActivities} atividade(s) aberta(s)`, `${base}/atividades`],
    [`${extras.futureMeetings} encontro(s) futuro(s)`, `${base}/calendario`],
  ];
  return (
    <section className="gt-page gt-detail-page">
      <GestaoCohortHeader activeTab="visao" cohort={cohort} />
      <div className="gk-stats">
        <article>
          <span>Alunos</span>
          <strong>{students}</strong>
          <small>{cohort.pendingInviteCount} convite(s) pendente(s)</small>
        </article>
        <article>
          <span>Progresso médio</span>
          <strong>{progress.get(cohortId) ?? 0}%</strong>
          <small>nos cursos liberados</small>
        </article>
        <article>
          <span>Entregas no prazo</span>
          <strong>{percent(extras.onTimeRate)}</strong>
          <small>até o prazo da atividade</small>
        </article>
        <article>
          <span>Presença média</span>
          <strong>{percent(extras.attendanceRate)}</strong>
          <small>nos encontros com presença</small>
        </article>
      </div>
      <div className="gk-cols">
        <div className="gk-stack">
          <section aria-labelledby="cohort-week" className="gk-panel">
            <h2 className="gk-panel-title" id="cohort-week">
              Esta semana na turma
            </h2>
            {extras.week.length === 0 ? (
              <p className="gk-empty">Nada marcado para os próximos 7 dias.</p>
            ) : (
              <ul className="gk-rows">
                {extras.week.map((item) => (
                  <li
                    key={`${item.kind}-${item.title}-${item.at.toISOString()}`}
                  >
                    <Link href={item.href}>
                      {item.kind === "meeting" || item.kind === "event" ? (
                        <span aria-hidden="true" className="gk-date-tile">
                          <small>
                            {weekMonth
                              .format(item.at)
                              .replace(".", "")
                              .toLocaleUpperCase("pt-BR")}
                          </small>
                          {weekDay.format(item.at)}
                        </span>
                      ) : (
                        <span aria-hidden="true" className="gk-icon-tile">
                          <GestaoIcon
                            name={weekIcons[item.kind] ?? "calendar"}
                            size={18}
                          />
                        </span>
                      )}
                      <span className="gk-row-copy">
                        <strong>{item.title}</strong>
                        <small>
                          {item.detail} · {weekDetail.format(item.at)}
                        </small>
                      </span>
                      {item.draft ? (
                        <span className="gk-chip" data-tone="neutral">
                          Rascunho
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="cohort-attention" className="gk-panel">
            <div className="gk-panel-head">
              <h2 className="gk-panel-title" id="cohort-attention">
                Alunos que pedem atenção
              </h2>
              <Link href={`/gestao/alunos/acompanhamento?turma=${cohortId}`}>
                Ver todos
              </Link>
            </div>
            {extras.attention.length === 0 ? (
              <p className="gk-empty">
                Ninguém pede atenção agora. A regra é a mesma do Acompanhamento.
              </p>
            ) : (
              <ul className="gk-rows">
                {extras.attention.map((student) => (
                  <li key={student.id}>
                    <span aria-hidden="true" className="gk-avatar">
                      {initialsOf(student.displayName)}
                    </span>
                    <span className="gk-row-copy">
                      <strong>{student.displayName}</strong>
                      <small>
                        {student.overdueDeliveries > 0
                          ? `${student.overdueDeliveries} entrega(s) atrasada(s) · `
                          : ""}
                        {student.lastStudyAt
                          ? `sem estudar há ${student.daysSinceActivity} dias`
                          : "ainda não estudou"}
                      </small>
                    </span>
                    <Link
                      className="gk-btn gk-btn--sm"
                      href={`/gestao/alunos/perfil/${student.id}`}
                    >
                      Ver perfil
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="gk-stack">
          <section className="gk-panel">
            <h2 className="gk-panel-title">Quem recebe o quê</h2>
            <p className="gk-panel-copy">
              Os <strong>{students} alunos</strong> recebem os{" "}
              <strong>mesmos</strong> cursos, atividades e encontros da turma.
              {cohort.lateJoinPolicy === "ALL_ACTIVE"
                ? " Quem entra depois recebe tudo que está ativo."
                : " Quem entra depois recebe só o que for publicado a partir da entrada."}
            </p>
            <ul className="gk-links">
              {links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href}>
                    {label}
                    <GestaoIcon name="chevron-right" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="gk-panel">
            <div className="gk-panel-head">
              <h2 className="gk-panel-title">Responsáveis</h2>
              <Link className="gk-edit-link" href={`${base}/configuracoes`}>
                <GestaoIcon name="pencil" size={14} />
                Editar
              </Link>
            </div>
            {cohort.teachers.length ? (
              <ul className="gk-rows gk-rows--plain">
                {cohort.teachers.map(({ member }) => (
                  <li key={member.id}>
                    <span aria-hidden="true" className="gk-avatar">
                      {initialsOf(member.displayName ?? "Professor")}
                    </span>
                    <span className="gk-row-copy">
                      <strong>{member.displayName ?? "Professor"}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="gk-empty">Nenhum responsável foi atribuído.</p>
            )}
          </section>
        </div>
      </div>
    </section>
  );
};
export default GestaoCohortOverviewPage;
