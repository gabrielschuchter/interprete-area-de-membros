import Link from "next/link";
import { forbidden } from "next/navigation";
import { getGestaoOverviewAttention } from "@/lib/gestao-overview";
import { getGestaoOverviewExtras } from "@/lib/gestao-overview-extras";
import { getGestaoOverviewWeek } from "@/lib/gestao-overview-week";
import { GestaoIcon, type GestaoIconName } from "./gestao-icon";
import { OverviewCohortFilter } from "./overview-cohort-filter";
import {
  AttentionRow,
  Institutional,
  RecentMovement,
  UpcomingMeetings,
} from "./overview-sections";
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

const shortcuts: readonly {
  readonly href: string;
  readonly icon: GestaoIconName;
  readonly label: string;
}[] = [
  { href: "/gestao/ensino/cursos/novo", icon: "book", label: "Novo curso" },
  {
    href: "/gestao/ensino/atividades/nova",
    icon: "inbox",
    label: "Nova atividade",
  },
  { href: "/gestao/comunidade/encontros", icon: "video", label: "Novo encontro" },
  { href: "/gestao/comunidade/avisos", icon: "bell", label: "Novo aviso" },
  {
    href: "/gestao/alunos/atribuicoes",
    icon: "arrow-right",
    label: "Atribuir conteúdo",
  },
];

interface OverviewPageProperties {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}
const GestaoOverviewPage = async ({ searchParams }: OverviewPageProperties) => {
  const params = await searchParams;
  if (Array.isArray(params.turma)) {
    forbidden();
  }
  const [overview, week, extras] = await Promise.all([
    getGestaoOverviewAttention({
      cohortId: params.turma,
      cohortQuery: typeof params.qTurmas === "string" ? params.qTurmas : "",
      cohortPage: Number(params.paginaTurmas),
    }),
    getGestaoOverviewWeek({ cohortId: params.turma }),
    getGestaoOverviewExtras({ cohortId: params.turma }),
  ]);
  const now = new Date();
  const attentionTotal = overview.pendingCount ? 1 : 0;
  const attentionCount = attentionTotal + extras.items.length;
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
        <div className="go-heading-actions">
          <OverviewCohortFilter filter={overview.cohortFilter} />
          <Link className="go-outline-action" href="/gestao/previa">
            Ver como aluno
          </Link>
        </div>
      </header>
      <nav aria-label="Atalhos" className="gx-shortcuts">
        {shortcuts.map((shortcut) => (
          <Link href={shortcut.href} key={shortcut.href} prefetch={false}>
            <GestaoIcon name={shortcut.icon} size={18} />
            {shortcut.label}
          </Link>
        ))}
      </nav>
      <div className="go-columns">
        <div className="gx-stack">
          <section aria-labelledby="overview-attention" className="go-panel">
            <div className="go-panel-heading">
              <h2 id="overview-attention">Precisa de atenção</h2>
              <span>
                {attentionCount} {attentionCount === 1 ? "item" : "itens"}
              </span>
            </div>
            <div className="go-rows">
            {overview.pendingCount ? (
              <div
                className="go-attention-row"
                data-attention-item="corrections"
              >
                <span className="go-attention-icon">
                  <GestaoIcon name="inbox" />
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
            ) : null}
            {extras.items.map((item) => (
              <AttentionRow item={item} key={item.id} />
            ))}
            </div>
            {attentionCount === 0 ? (
              <div className="go-attention-empty">
                <h3>
                  {overview.cohortCount === 0
                    ? "Suas turmas vão aparecer aqui."
                    : "Tudo em dia."}
                </h3>
                <p>
                  {overview.cohortCount === 0
                    ? "Você ainda não é responsável por nenhuma turma."
                    : "Nenhuma entrega, atraso ou rascunho pede a sua ação agora."}
                </p>
                {overview.cohortCount === 0 ? (
                  <Link href="/gestao/alunos/turmas" prefetch={false}>
                    Abrir Turmas
                  </Link>
                ) : null}
              </div>
            ) : null}
          </section>
          <RecentMovement movement={extras.movement} now={now} />
        </div>
        <aside className="go-sidebar">
          <UpcomingMeetings meetings={extras.upcoming} />
          <OverviewWeek week={week} />
          {extras.institutional ? (
            <Institutional data={extras.institutional} />
          ) : null}
        </aside>
      </div>
    </section>
  );
};
export default GestaoOverviewPage;
