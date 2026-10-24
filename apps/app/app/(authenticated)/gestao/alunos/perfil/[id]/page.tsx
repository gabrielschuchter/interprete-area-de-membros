import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import Link from "next/link";
import { formatStudyMinutes } from "@/lib/gestao-format";
import { getGestaoStudentProfile } from "@/lib/gestao-student-profile";
import {
  type StudentSituation,
  situationLabels,
} from "@/lib/gestao-student-tracking";
import { GestaoPageHeading } from "../../../gestao-shell";

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
const submissionLabel: Record<string, string> = {
  SUBMITTED: "Aguardando feedback",
  REVIEWED: "Corrigida",
};
const exerciseLabel: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  ABANDONED: "Abandonada",
};
const periodLabel: Record<string, string> = {
  DAILY: "por dia",
  WEEKLY: "por semana",
  MONTHLY: "por mês",
};

const whitespacePattern = /\s+/u;
const initials = (name: string) =>
  name
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const GestaoStudentProfilePage = async ({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) => {
  const { id } = await params;
  const profile = await getGestaoStudentProfile(id);
  const { member, situation } = profile;
  const name = member.displayName ?? member.email ?? "Aluno sem nome";
  const firstCohort = member.cohortMemberships[0]?.cohort;
  return (
    <section className="ga-page">
      <GestaoPageHeading
        description={[
          member.profile?.username ? `@${member.profile.username}` : null,
          member.email,
          `entrou em ${dateFormat.format(member.createdAt)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        eyebrow="Gestão · Alunos · Perfil pedagógico"
        title={name}
      >
        {firstCohort ? (
          <Link
            className="ga-button-outline"
            href={`/gestao/alunos/turmas/${firstCohort.id}/alunos`}
          >
            Mover de turma
          </Link>
        ) : null}
        <Link className="ga-button" href="/gestao/alunos/atribuicoes">
          Atribuir conteúdo
        </Link>
      </GestaoPageHeading>
      <div className="ga-card ga-profile-head">
        <Avatar className="size-16">
          <AvatarImage alt="" src={member.avatarUrl ?? undefined} />
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="ga-profile-copy">
          <p className="ga-muted">
            {member.cohortMemberships
              .map(({ cohort }) => cohort.name)
              .join(" · ")}
          </p>
          {member.profile?.headline ? (
            <p className="ga-muted">{member.profile.headline}</p>
          ) : null}
        </div>
        {situation ? (
          <span className="ga-chip" data-tone={tone[situation.situation]}>
            {situationLabels[situation.situation]}
          </span>
        ) : null}
      </div>
      <div className="ga-grid">
        <div className="ga-card">
          <p className="ga-muted">Estudo nos últimos 7 dias</p>
          <p className="ga-metric">
            {formatStudyMinutes(situation?.studySecondsLast7Days ?? 0)}
          </p>
          <p className="ga-muted">
            {situation?.lastStudyAt
              ? `Último estudo em ${dateFormat.format(situation.lastStudyAt)}`
              : "Ainda não estudou"}
          </p>
        </div>
        <div className="ga-card">
          <p className="ga-muted">Aulas concluídas</p>
          <p className="ga-metric">{profile.completedLessons}</p>
          <p className="ga-muted">Conclusão aos 90% ou marcada pelo aluno</p>
        </div>
        <div className="ga-card">
          <p className="ga-muted">Entregas atrasadas</p>
          <p className="ga-metric">{situation?.overdueDeliveries ?? 0}</p>
          <p className="ga-muted">{profile.pendingActivities.length} abertas</p>
        </div>
        <div className="ga-card">
          <p className="ga-muted">Presença nos encontros</p>
          <p className="ga-metric">
            {profile.attendance.total
              ? `${Math.round((profile.attendance.present / profile.attendance.total) * 100)}%`
              : "—"}
          </p>
          <p className="ga-muted">
            {profile.attendance.total} registros de presença
          </p>
        </div>
      </div>
      <div className="ga-columns">
        <div className="ga-stack">
          <section aria-labelledby="student-open" className="ga-card">
            <div className="ga-card-heading">
              <h2 id="student-open">Atribuições abertas</h2>
              <span className="ga-muted">
                {profile.pendingActivities.length}
              </span>
            </div>
            {profile.pendingActivities.length === 0 ? (
              <p className="ga-muted">Nada em aberto para este aluno.</p>
            ) : (
              <ul className="ga-list">
                {profile.pendingActivities.map((activity) => (
                  <li key={activity.id}>
                    <Link href={`/gestao/ensino/atividades/${activity.id}`}>
                      <strong>{activity.title}</strong>
                      <span>
                        {activity.dueAt
                          ? `Prazo ${dateFormat.format(activity.dueAt)}`
                          : "Sem prazo"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="student-submissions" className="ga-card">
            <div className="ga-card-heading">
              <h2 id="student-submissions">Atividades e feedback</h2>
            </div>
            {profile.submissions.length === 0 ? (
              <p className="ga-muted">Nenhuma entrega registrada.</p>
            ) : (
              <ul className="ga-list">
                {profile.submissions.map((submission) => (
                  <li key={submission.id}>
                    <Link
                      href={`/gestao/alunos/correcoes?q=${encodeURIComponent(name)}`}
                    >
                      <strong>{submission.activity.title}</strong>
                      <span>
                        {submissionLabel[submission.status] ??
                          submission.status}
                        {submission.submittedAt
                          ? ` · ${dateFormat.format(submission.submittedAt)}`
                          : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="student-progress" className="ga-card">
            <div className="ga-card-heading">
              <h2 id="student-progress">Progresso nas aulas</h2>
            </div>
            {profile.lessonProgress.length === 0 ? (
              <p className="ga-muted">Ainda não há progresso registrado.</p>
            ) : (
              <ul className="ga-list">
                {profile.lessonProgress.map((item) => (
                  <li
                    key={`${item.lesson.title}-${item.updatedAt.toISOString()}`}
                  >
                    <div>
                      <strong>{item.lesson.title}</strong>
                      <span>{item.lesson.module.course.title}</span>
                      <span
                        className="ga-chip"
                        data-tone={
                          item.status === "COMPLETED" ? "ok" : "neutral"
                        }
                      >
                        {item.status === "COMPLETED"
                          ? "Concluída"
                          : "Em andamento"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="ga-stack">
          <section aria-labelledby="student-timeline" className="ga-card">
            <div className="ga-card-heading">
              <h2 id="student-timeline">Linha do tempo</h2>
            </div>
            {profile.timeline.length === 0 ? (
              <p className="ga-muted">Sem movimentação ainda.</p>
            ) : (
              <ul className="ga-list">
                {profile.timeline.map((entry) => (
                  <li
                    key={`${entry.kind}-${entry.title}-${entry.at.toISOString()}`}
                  >
                    <div>
                      <strong>{entry.title}</strong>
                      <span>{dateFormat.format(entry.at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="student-goals" className="ga-card">
            <div className="ga-card-heading">
              <h2 id="student-goals">Metas e medalhas</h2>
            </div>
            {profile.goals.length === 0 && profile.awards.length === 0 ? (
              <p className="ga-muted">Sem metas nem medalhas até agora.</p>
            ) : (
              <ul className="ga-list">
                {profile.goals.map((goal) => (
                  <li key={`${goal.period}-${goal.targetMinutes}`}>
                    <div>
                      <strong>
                        Meta de {goal.targetMinutes} min{" "}
                        {periodLabel[goal.period] ?? ""}
                      </strong>
                    </div>
                  </li>
                ))}
                {profile.awards.map((award) => (
                  <li key={`${award.badge.id}`}>
                    <div>
                      <strong>{award.badge.title}</strong>
                      <span>{dateFormat.format(award.awardedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="student-exercises" className="ga-card">
            <div className="ga-card-heading">
              <h2 id="student-exercises">Exercícios</h2>
            </div>
            {profile.exerciseSessions.length === 0 ? (
              <p className="ga-muted">Nenhuma sessão de exercícios.</p>
            ) : (
              <ul className="ga-list">
                {profile.exerciseSessions.map((session) => (
                  <li key={session.id}>
                    <div>
                      <strong>{session.list.title}</strong>
                      <span>
                        {exerciseLabel[session.status] ?? session.status} ·{" "}
                        {dateFormat.format(
                          session.completedAt ?? session.updatedAt
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </section>
  );
};

export default GestaoStudentProfilePage;
