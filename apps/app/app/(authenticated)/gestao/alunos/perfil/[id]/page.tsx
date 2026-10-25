import Link from "next/link";
import { formatStudyMinutes } from "@/lib/gestao-format";
import { getGestaoStudentProfile } from "@/lib/gestao-student-profile";
import { situationLabels } from "@/lib/gestao-student-tracking";
import { GestaoCrumbTail } from "../../../gestao-crumbs";
import { GestaoIcon } from "../../../gestao-icon";

type Profile = Awaited<ReturnType<typeof getGestaoStudentProfile>>;

const tabs = [
  ["visao-geral", "Visão geral"],
  ["atribuicoes", "Atribuições"],
  ["atividades", "Atividades e feedback"],
  ["exercicios", "Exercícios"],
  ["metas", "Metas e medalhas"],
] as const;
type Tab = (typeof tabs)[number][0];

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Sao_Paulo",
});
const longDate = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});
const monthYear = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "America/Sao_Paulo",
  year: "numeric",
});

const situationChip = {
  ATTENTION: ["alert-circle", "danger"],
  INACTIVE: ["clock", "muted"],
  ON_TRACK: ["check-circle", "active"],
} as const;
const submissionLabel: Record<string, string> = {
  REVIEWED: "Corrigida",
  SUBMITTED: "Aguardando feedback",
};
const exerciseLabel: Record<string, string> = {
  ABANDONED: "Abandonada",
  COMPLETED: "Concluída",
  IN_PROGRESS: "Em andamento",
};
const periodLabel: Record<string, string> = {
  DAILY: "por dia",
  MONTHLY: "por mês",
  WEEKLY: "por semana",
};
const timelineIcons = {
  Aula: "play-circle",
  Entrega: "inbox",
  Feedback: "chat",
  Medalha: "star",
  Turma: "users",
} as const;

const whitespace = /\s+/u;
const initials = (name: string) =>
  name
    .split(whitespace)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const lastStudy = (days: number | undefined, studied: boolean) => {
  if (!studied || days === undefined) {
    return "Sem estudo";
  }
  if (days === 0) {
    return "hoje";
  }
  return days === 1 ? "ontem" : `há ${days} dias`;
};

const Stat = ({
  caption,
  label,
  value,
}: {
  readonly caption?: string;
  readonly label: string;
  readonly value: string;
}) => (
  <article>
    <span>{label}</span>
    <strong>{value}</strong>
    {caption ? <small>{caption}</small> : null}
  </article>
);

const EmptyNote = ({ children }: { readonly children: string }) => (
  <p className="gk-hint gk-empty-note">{children}</p>
);

const Timeline = ({ profile }: { readonly profile: Profile }) => (
  <section aria-labelledby="student-timeline" className="gk-panel">
    <div className="gk-panel-head">
      <h2 className="gk-panel-title" id="student-timeline">
        Linha do tempo
      </h2>
    </div>
    {profile.timeline.length === 0 ? (
      <EmptyNote>Sem movimentação ainda.</EmptyNote>
    ) : (
      <ul className="gk-feed">
        {profile.timeline.map((entry) => (
          <li key={`${entry.kind}-${entry.title}-${entry.at.toISOString()}`}>
            <GestaoIcon
              name={
                timelineIcons[entry.kind as keyof typeof timelineIcons] ??
                "check-circle"
              }
              size={18}
            />
            <div>
              <strong>{entry.title}</strong>
              <small>{entry.detail}</small>
            </div>
            <time dateTime={entry.at.toISOString()}>
              {shortDate.format(entry.at)}
            </time>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const LessonProgress = ({ profile }: { readonly profile: Profile }) =>
  profile.lessonProgress.length === 0 ? null : (
    <section aria-labelledby="student-progress" className="gk-panel">
      <div className="gk-panel-head">
        <h2 className="gk-panel-title" id="student-progress">
          Progresso nas aulas
        </h2>
      </div>
      <ul className="gk-feed">
        {profile.lessonProgress.map((item) => (
          <li key={`${item.lesson.title}-${item.updatedAt.toISOString()}`}>
            <GestaoIcon name="play-circle" size={18} />
            <div>
              <strong>{item.lesson.title}</strong>
              <small>{item.lesson.module.course.title}</small>
            </div>
            <span
              className="gk-chip"
              data-tone={item.status === "COMPLETED" ? "active" : "neutral"}
            >
              {item.status === "COMPLETED" ? "Concluída" : "Em andamento"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );

const OpenAssignments = ({
  limit,
  profile,
}: {
  readonly limit?: number;
  readonly profile: Profile;
}) => {
  const items = limit
    ? profile.pendingActivities.slice(0, limit)
    : profile.pendingActivities;
  return (
    <section aria-labelledby="student-open" className="gk-panel">
      <div className="gk-panel-head">
        <h2 className="gk-panel-title" id="student-open">
          Atribuições abertas
        </h2>
        {limit ? null : <span>{profile.pendingActivities.length}</span>}
      </div>
      {items.length === 0 ? (
        <EmptyNote>Nada em aberto para este aluno.</EmptyNote>
      ) : (
        <ul className="gk-lines">
          {items.map((activity) => (
            <li key={activity.id}>
              <Link href={`/gestao/ensino/atividades/${activity.id}`}>
                <span>{activity.title}</span>
                <small>
                  {activity.dueAt
                    ? `prazo ${shortDate.format(activity.dueAt)}`
                    : "sem prazo"}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {limit && profile.pendingActivities.length > limit ? (
        <Link className="gk-edit-link" href="?aba=atribuicoes" prefetch={false}>
          Ver todas <GestaoIcon name="arrow-right" size={14} />
        </Link>
      ) : null}
    </section>
  );
};

const RecentFeedback = ({
  name,
  profile,
}: {
  readonly name: string;
  readonly profile: Profile;
}) => {
  const entry = profile.latestFeedback;
  return (
    <section aria-labelledby="student-feedback" className="gk-panel">
      <div className="gk-panel-head">
        <h2 className="gk-panel-title" id="student-feedback">
          Feedback recente
        </h2>
      </div>
      {entry?.feedback ? (
        <>
          <p className="gk-quote">“{entry.feedback.content.slice(0, 280)}”</p>
          <Link
            className="gk-edit-link"
            href={`/gestao/alunos/correcoes?q=${encodeURIComponent(name)}`}
            prefetch={false}
          >
            Abrir entrega
          </Link>
        </>
      ) : (
        <EmptyNote>Nenhum feedback enviado a este aluno ainda.</EmptyNote>
      )}
    </section>
  );
};

const Submissions = ({
  name,
  profile,
}: {
  readonly name: string;
  readonly profile: Profile;
}) => (
  <section aria-labelledby="student-submissions" className="gk-panel">
    <div className="gk-panel-head">
      <h2 className="gk-panel-title" id="student-submissions">
        Atividades e feedback
      </h2>
    </div>
    {profile.submissions.length === 0 ? (
      <EmptyNote>Nenhuma entrega registrada.</EmptyNote>
    ) : (
      <ul className="gk-lines">
        {profile.submissions.map((submission) => (
          <li key={submission.id}>
            <Link
              href={`/gestao/alunos/correcoes?q=${encodeURIComponent(name)}`}
            >
              <span>{submission.activity.title}</span>
              <small>
                {submissionLabel[submission.status] ?? submission.status}
                {submission.submittedAt
                  ? ` · ${longDate.format(submission.submittedAt)}`
                  : ""}
              </small>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const Exercises = ({ profile }: { readonly profile: Profile }) => (
  <section aria-labelledby="student-exercises" className="gk-panel">
    <div className="gk-panel-head">
      <h2 className="gk-panel-title" id="student-exercises">
        Exercícios
      </h2>
    </div>
    {profile.exerciseSessions.length === 0 ? (
      <EmptyNote>Nenhuma sessão de exercícios.</EmptyNote>
    ) : (
      <ul className="gk-lines">
        {profile.exerciseSessions.map((session) => (
          <li key={session.id}>
            <span>
              <span>{session.list.title}</span>
              <small>
                {exerciseLabel[session.status] ?? session.status} ·{" "}
                {longDate.format(session.completedAt ?? session.updatedAt)}
              </small>
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const Goals = ({ profile }: { readonly profile: Profile }) => (
  <section aria-labelledby="student-goals" className="gk-panel">
    <div className="gk-panel-head">
      <h2 className="gk-panel-title" id="student-goals">
        Metas e medalhas
      </h2>
    </div>
    {profile.goals.length === 0 && profile.awards.length === 0 ? (
      <EmptyNote>Sem metas nem medalhas até agora.</EmptyNote>
    ) : (
      <ul className="gk-lines">
        {profile.goals.map((goal) => (
          <li key={`${goal.period}-${goal.targetMinutes}`}>
            <span>
              <span>
                Meta de {goal.targetMinutes} min{" "}
                {periodLabel[goal.period] ?? ""}
              </span>
            </span>
          </li>
        ))}
        {profile.awards.map((award) => (
          <li key={award.badge.id}>
            <span>
              <span>{award.badge.title}</span>
              <small>{longDate.format(award.awardedAt)}</small>
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const TabBody = ({
  name,
  profile,
  tab,
}: {
  readonly name: string;
  readonly profile: Profile;
  readonly tab: Tab;
}) => {
  if (tab === "atribuicoes") {
    return <OpenAssignments profile={profile} />;
  }
  if (tab === "atividades") {
    return <Submissions name={name} profile={profile} />;
  }
  if (tab === "exercicios") {
    return <Exercises profile={profile} />;
  }
  if (tab === "metas") {
    return <Goals profile={profile} />;
  }
  return (
    <div className="gk-cols">
      <div className="gk-stack">
        <Timeline profile={profile} />
        <LessonProgress profile={profile} />
      </div>
      <div className="gk-stack">
        <OpenAssignments limit={3} profile={profile} />
        <RecentFeedback name={name} profile={profile} />
      </div>
    </div>
  );
};

const GestaoStudentProfilePage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<{ readonly aba?: string }>;
}) => {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const profile = await getGestaoStudentProfile(id);
  const { member, situation } = profile;
  const name = member.displayName ?? member.email ?? "Aluno sem nome";
  const firstCohort = member.cohortMemberships[0]?.cohort;
  const tab = tabs.find(([key]) => key === query.aba)?.[0] ?? "visao-geral";
  const base = `/gestao/alunos/perfil/${member.id}`;
  const lessonsPercent =
    situation && situation.lessonsTotal > 0
      ? Math.round((situation.lessonsDone / situation.lessonsTotal) * 100)
      : null;
  const [chipIcon, chipTone] = situation
    ? situationChip[situation.situation]
    : situationChip.ON_TRACK;

  return (
    <section className="gt-page gk-profile">
      <GestaoCrumbTail
        items={[
          { href: "/gestao/alunos/acompanhamento", label: "Acompanhamento" },
          { label: name },
        ]}
      />
      <header className="gk-head gk-head--profile">
        <div className="gk-profile-id">
          <span aria-hidden="true" className="gk-avatar gk-avatar--xl">
            {initials(name)}
          </span>
          <div className="gk-head-copy">
            <div className="gk-title-line">
              <h1>{name}</h1>
              {situation ? (
                <span className="gk-chip" data-tone={chipTone}>
                  <GestaoIcon name={chipIcon} size={12} />
                  {situationLabels[situation.situation]}
                </span>
              ) : null}
            </div>
            <p>
              {[
                member.email,
                `aluno desde ${monthYear.format(member.createdAt)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="gk-head-actions">
          {firstCohort ? (
            <span className="gk-cohortpill">
              <GestaoIcon name="users" size={14} />
              <span>{firstCohort.name}</span>
              {member.cohortMemberships.length > 1 ? (
                <em>+{member.cohortMemberships.length - 1}</em>
              ) : null}
            </span>
          ) : null}
          {firstCohort ? (
            <Link
              className="gk-btn"
              href={`/gestao/alunos/turmas/${firstCohort.id}/alunos`}
              prefetch={false}
            >
              Mover de turma
            </Link>
          ) : null}
          <Link
            className="gk-btn gk-btn--primary gk-btn--wide"
            href={`/gestao/alunos/atribuicoes/nova?aluno=${encodeURIComponent(member.id)}`}
            prefetch={false}
          >
            Atribuir conteúdo
          </Link>
        </div>
      </header>

      <nav aria-label="Seções do perfil" className="gk-tabs">
        {tabs.map(([key, label]) => (
          <Link
            aria-current={tab === key ? "page" : undefined}
            className="gk-tab"
            href={key === "visao-geral" ? base : `${base}?aba=${key}`}
            key={key}
            prefetch={false}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="gk-stats gk-stats--four">
        <Stat
          caption={
            situation && situation.lessonsTotal > 0
              ? `${situation.lessonsDone} de ${situation.lessonsTotal} aulas`
              : "nenhuma aula liberada"
          }
          label="Progresso"
          value={lessonsPercent === null ? "—" : `${lessonsPercent}%`}
        />
        <Stat
          caption={`${profile.submissions.filter((item) => item.status === "SUBMITTED").length} aguardando feedback`}
          label="Atividades"
          value={
            situation && situation.activitiesTotal > 0
              ? `${situation.activitiesDone} de ${situation.activitiesTotal}`
              : "—"
          }
        />
        <Stat
          caption={
            profile.cohortAverageStudySeconds === null
              ? undefined
              : `média da turma: ${formatStudyMinutes(profile.cohortAverageStudySeconds)}`
          }
          label="Tempo na semana"
          value={formatStudyMinutes(situation?.studySecondsLast7Days ?? 0)}
        />
        <Stat
          label="Último estudo"
          value={lastStudy(
            situation?.daysSinceActivity,
            Boolean(situation?.lastStudyAt)
          )}
        />
      </div>

      <TabBody name={name} profile={profile} tab={tab} />
    </section>
  );
};

export default GestaoStudentProfilePage;
