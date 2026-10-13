import { InboxIcon } from "lucide-react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { getGestaoOverviewAttention } from "@/lib/gestao-overview";
import { getGestaoOverviewWeek } from "@/lib/gestao-overview-week";
import { OverviewCohortFilter } from "./overview-cohort-filter";
import { OverviewWeek } from "./overview-week";

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

interface OverviewPageProperties {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}
const GestaoOverviewPage = async ({ searchParams }: OverviewPageProperties) => {
  const params = await searchParams;
  if (Array.isArray(params.turma)) {
    forbidden();
  }
  const [overview, week] = await Promise.all([
    getGestaoOverviewAttention({
      cohortId: params.turma,
      cohortQuery: typeof params.qTurmas === "string" ? params.qTurmas : "",
      cohortPage: Number(params.paginaTurmas),
    }),
    getGestaoOverviewWeek({ cohortId: params.turma }),
  ]);
  const displayName =
    overview.actor.displayName?.trim().split(memberNameWhitespacePattern)[0] ||
    "professor";
  return (
    <section className="go-overview">
      <header className="go-heading">
        <div>
          <h1>Visão geral</h1>
          <p>
            {greetingForNow(new Date())}, {displayName}. Veja o que precisa de
            atenção hoje.
          </p>
        </div>
        <OverviewCohortFilter filter={overview.cohortFilter} />
      </header>
      <div className="go-columns">
        <section aria-labelledby="overview-attention" className="go-panel">
          <div className="go-panel-heading">
            <h2 id="overview-attention">Precisa de atenção</h2>
            <span>{overview.pendingCount ? "1 item" : "0 itens"}</span>
          </div>
          {overview.pendingCount ? (
            <div className="go-attention-row">
              <span className="go-attention-icon">
                <InboxIcon aria-hidden="true" size={18} />
              </span>
              <div className="go-attention-copy">
                <h3>
                  {overview.pendingCount}{" "}
                  {overview.pendingCount === 1
                    ? "entrega aguardando"
                    : "entregas aguardando"}{" "}
                  feedback
                </h3>
                <p>{overview.pendingActivityTitles.join(" · ")}</p>
              </div>
              <Link
                className="go-outline-action"
                href={overview.correctionsHref}
                prefetch={false}
              >
                Corrigir
              </Link>
            </div>
          ) : (
            <div className="go-attention-empty">
              <h3>
                {overview.cohortCount === 0
                  ? "Suas turmas vão aparecer aqui."
                  : "Nenhuma entrega aguardando feedback."}
              </h3>
              <p>
                {overview.cohortCount === 0
                  ? "Você ainda não é responsável por nenhuma turma."
                  : "As entregas pendentes das turmas selecionadas aparecem aqui."}
              </p>
              {overview.cohortCount === 0 ? (
                <Link href="/gestao/alunos/turmas" prefetch={false}>
                  Abrir Turmas
                </Link>
              ) : null}
            </div>
          )}
        </section>
        <aside className="go-sidebar">
          <OverviewWeek week={week} />
        </aside>
      </div>
    </section>
  );
};
export default GestaoOverviewPage;
