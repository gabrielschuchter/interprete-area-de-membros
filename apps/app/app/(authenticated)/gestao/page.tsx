import Link from "next/link";
import { getAdminOverview } from "@/lib/admin-overview";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import { GestaoPageHeading } from "./gestao-shell";

const memberNameWhitespacePattern = /\s+/;

const greetingForNow = (date: Date) => {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Sao_Paulo",
    }).format(date)
  );
  if (hour < 12) {
    return "Bom dia";
  }
  if (hour < 18) {
    return "Boa tarde";
  }
  return "Boa noite";
};

const GestaoOverviewPage = async () => {
  const actor = await requireGestaoActor();
  const greeting = greetingForNow(new Date());
  const displayName =
    actor.displayName?.trim().split(memberNameWhitespacePattern)[0] ||
    "professor";

  if (actor.role !== "ADMIN") {
    return (
      <section>
        <GestaoPageHeading
          description={`${greeting}, ${displayName}. Veja o que precisa de atenção hoje.`}
          eyebrow="Interprete · Gestão"
          title="Visão geral"
        />
        <div className="gestao-empty-state">
          <h2>Suas turmas vão aparecer aqui.</h2>
          <p>
            Acompanhe conteúdos, alunos e atividades das turmas em que você é
            responsável.
          </p>
          <Link className="gestao-dashboard-link" href="/gestao/alunos">
            Abrir Alunos
          </Link>
        </div>
      </section>
    );
  }

  const overview = await getAdminOverview();
  const metrics = [
    { label: "Membros", value: overview.counts.activeMembers },
    { label: "Cursos publicados", value: overview.counts.publishedCourses },
    { label: "Aguardando feedback", value: overview.counts.pendingFeedback },
    { label: "Próximos encontros", value: overview.upcomingMeetings.length },
  ];

  return (
    <section>
      <GestaoPageHeading
        description={`${greeting}, ${displayName}. Veja o que precisa de atenção hoje.`}
        eyebrow="Interprete · Gestão"
        title="Visão geral"
      />
      <section
        aria-label="Indicadores da Gestão"
        className="gestao-metric-grid"
      >
        {metrics.map((metric) => (
          <article className="gestao-metric-card" key={metric.label}>
            <p className="gestao-metric-label">{metric.label}</p>
            <p className="gestao-metric-value">{metric.value}</p>
          </article>
        ))}
      </section>
      <div className="gestao-dashboard-grid">
        <section
          aria-labelledby="gestao-attention-title"
          className="gestao-dashboard-card"
        >
          <div className="gestao-dashboard-card-heading">
            <h2 id="gestao-attention-title">Precisa de atenção</h2>
            <span className="gestao-metric-label">
              {overview.counts.pendingFeedback + overview.counts.overdue} itens
            </span>
          </div>
          <div className="gestao-dashboard-card-body">
            <p>
              {overview.counts.pendingFeedback === 0
                ? "Nenhuma entrega aguardando feedback."
                : `${overview.counts.pendingFeedback} entrega(s) aguardando feedback.`}
            </p>
            <Link className="gestao-dashboard-link" href="/gestao/ensino">
              Abrir Ensino
            </Link>
            <p>
              {overview.counts.overdue === 0
                ? "Nenhuma entrega atrasada."
                : `${overview.counts.overdue} entrega(s) atrasada(s).`}
            </p>
            <Link className="gestao-dashboard-link" href="/gestao/alunos">
              Abrir Alunos
            </Link>
            <p>
              {overview.counts.drafts === 0
                ? "Nenhum conteúdo em rascunho."
                : `${overview.counts.drafts} conteúdo(s) em rascunho.`}
            </p>
            <Link className="gestao-dashboard-link" href="/gestao/ensino">
              Organizar conteúdo
            </Link>
          </div>
        </section>
        <section
          aria-labelledby="gestao-meetings-title"
          className="gestao-dashboard-card"
        >
          <div className="gestao-dashboard-card-heading">
            <h2 id="gestao-meetings-title">Próximos encontros</h2>
            <Link className="gestao-dashboard-link" href="/gestao/comunidade">
              Agenda
            </Link>
          </div>
          <div className="gestao-dashboard-card-body">
            {overview.upcomingMeetings.length ? (
              overview.upcomingMeetings.slice(0, 3).map((meeting) => (
                <article key={meeting.id}>
                  <p className="gestao-metric-label">
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: meeting.timezone,
                    }).format(meeting.startsAt)}
                  </p>
                  <p>{meeting.title}</p>
                </article>
              ))
            ) : (
              <p>Nenhum encontro agendado.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
};

export default GestaoOverviewPage;
