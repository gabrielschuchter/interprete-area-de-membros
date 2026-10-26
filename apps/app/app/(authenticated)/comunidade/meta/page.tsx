import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import {
  communityGoalHoursText,
  communityGoalSourceLabels,
} from "@/components/community/community-collective-goal-card";
import { requireStaff } from "@/lib/authorization";
import {
  type CommunityGoalManagement,
  type CommunityGoalSummary,
  getCommunityGoalManagement,
} from "@/lib/community-goal";
import {
  renewCommunityGoalManually,
  saveCommunityGoal,
} from "../community-goal-actions";

interface CommunityGoalPageProperties {
  readonly searchParams: Promise<{ readonly resultado?: string }>;
}

const dateTimeLocal = (value: Date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hourCycle: "h23",
    })
      .formatToParts(value)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: partValue }) => [type, partValue])
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond}`;
};

const formatDateTime = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);

const inputClass = "h-12 rounded-[4px] border-input bg-background px-3 text-sm";

const resultMessages: Record<string, string> = {
  conflito:
    "A meta mudou enquanto a página estava aberta. Atualize e tente novamente.",
  invalida: "Confira o título, o valor e um período entre 1 e 366 dias.",
  renovada:
    "O período anterior foi salvo no histórico e o novo período está ativo.",
  salva: "A meta coletiva foi salva.",
};

const CommunityGoalResultMessage = ({
  result,
}: {
  readonly result?: string;
}) => {
  const message = result ? resultMessages[result] : undefined;
  if (!message) {
    return null;
  }
  const isError = result === "invalida" || result === "conflito";
  return (
    <p
      aria-live="polite"
      className={`mt-6 rounded-md border px-4 py-3 text-sm ${isError ? "border-destructive text-destructive" : "border-border text-foreground"}`}
      role={isError ? "alert" : "status"}
    >
      {message}
    </p>
  );
};

const CommunityGoalRenewalSection = ({
  goal,
  startsAt,
  endsAt,
}: {
  readonly goal: CommunityGoalSummary;
  readonly startsAt: Date;
  readonly endsAt: Date;
}) => (
  <section
    aria-labelledby="renew-community-goal-heading"
    className="mt-8 rounded-xl border bg-card p-5 sm:p-8"
  >
    <p className="brand-eyebrow">Período encerrado</p>
    <h2
      className="mt-2 font-display text-2xl"
      id="renew-community-goal-heading"
    >
      Renovar a meta
    </h2>
    <p className="mt-3 text-muted-foreground text-sm leading-6">
      O resumo deste período já está salvo no histórico. O novo período começa
      em {formatDateTime(startsAt)}.
    </p>
    <form action={renewCommunityGoalManually} className="mt-6 grid gap-4">
      <input name="campaignId" type="hidden" value={goal.campaignId} />
      <input
        name="updatedAt"
        type="hidden"
        value={goal.updatedAt.toISOString()}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2" htmlFor="renewal-startsAt">
          <span className="font-medium text-sm">Início · Brasília</span>
          <Input
            className={inputClass}
            defaultValue={dateTimeLocal(startsAt)}
            id="renewal-startsAt"
            name="startsAt"
            required
            step={0.001}
            type="datetime-local"
          />
        </label>
        <label className="grid gap-2" htmlFor="renewal-endsAt">
          <span className="font-medium text-sm">Fim · Brasília</span>
          <Input
            className={inputClass}
            defaultValue={dateTimeLocal(endsAt)}
            id="renewal-endsAt"
            name="endsAt"
            required
            step={0.001}
            type="datetime-local"
          />
        </label>
      </div>
      <Button className="w-fit" type="submit">
        Salvar histórico e renovar
      </Button>
    </form>
  </section>
);

const CommunityGoalConfigurationSection = ({
  goal,
  startsAt,
  endsAt,
}: {
  readonly goal: CommunityGoalSummary | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
}) => (
  <section
    aria-labelledby="configure-community-goal-heading"
    className="mt-8 rounded-xl border bg-card p-5 sm:p-8"
  >
    <p className="brand-eyebrow">
      {goal ? "Meta ativa" : "Sem meta configurada"}
    </p>
    <h2
      className="mt-2 font-display text-2xl"
      id="configure-community-goal-heading"
    >
      {goal ? "Editar configuração" : "Definir a meta coletiva"}
    </h2>
    <p className="mt-3 text-muted-foreground text-sm leading-6">
      {goal
        ? "O progresso atual é recalculado dos registros elegíveis. Mudar o valor mantém o progresso; mudar o período salva o intervalo anterior no histórico."
        : "O cartão ficará visível para a comunidade quando esta meta for publicada."}
    </p>
    <form action={saveCommunityGoal} className="mt-6 grid gap-4">
      {goal ? (
        <>
          <input name="campaignId" type="hidden" value={goal.campaignId} />
          <input
            name="updatedAt"
            type="hidden"
            value={goal.updatedAt.toISOString()}
          />
        </>
      ) : null}
      <label className="grid gap-2" htmlFor="community-goal-title">
        <span className="font-medium text-sm">Título</span>
        <Input
          className={inputClass}
          defaultValue={goal?.title ?? "Meta coletiva"}
          id="community-goal-title"
          maxLength={180}
          name="title"
          required
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2" htmlFor="community-goal-target">
          <span className="font-medium text-sm">Valor da meta · horas</span>
          <Input
            className={inputClass}
            defaultValue={goal ? (goal.targetMinutes / 60).toFixed(2) : ""}
            id="community-goal-target"
            max={1680}
            min={0.25}
            name="targetHours"
            required
            step={0.25}
            type="number"
          />
        </label>
        <label className="grid gap-2" htmlFor="community-goal-renewal">
          <span className="font-medium text-sm">Renovação do período</span>
          <select
            className={inputClass}
            defaultValue={goal?.renewalMode ?? "MANUAL"}
            id="community-goal-renewal"
            name="renewalMode"
          >
            <option value="AUTOMATIC">Automática</option>
            <option value="MANUAL">Manual</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2" htmlFor="community-goal-startsAt">
          <span className="font-medium text-sm">Início · Brasília</span>
          <Input
            className={inputClass}
            defaultValue={dateTimeLocal(startsAt)}
            id="community-goal-startsAt"
            name="startsAt"
            required
            step={0.001}
            type="datetime-local"
          />
        </label>
        <label className="grid gap-2" htmlFor="community-goal-endsAt">
          <span className="font-medium text-sm">Fim · Brasília</span>
          <Input
            className={inputClass}
            defaultValue={dateTimeLocal(endsAt)}
            id="community-goal-endsAt"
            name="endsAt"
            required
            step={0.001}
            type="datetime-local"
          />
        </label>
      </div>
      <p className="text-muted-foreground text-xs leading-5">
        O período deve ter entre 1 e 366 dias. Na renovação automática, a
        próxima janela mantém a mesma duração; na manual, um professor ou
        administrador inicia o período seguinte.
      </p>
      <Button className="w-fit" type="submit">
        Salvar meta
      </Button>
    </form>
  </section>
);

const CommunityGoalHistorySection = ({
  history,
}: {
  readonly history: CommunityGoalManagement["history"];
}) => (
  <section aria-labelledby="community-goal-history-heading" className="mt-10">
    <div className="border-b pb-3">
      <p className="brand-eyebrow">Histórico persistido</p>
      <h2
        className="mt-2 font-display text-2xl"
        id="community-goal-history-heading"
      >
        Períodos anteriores
      </h2>
    </div>
    {history.length === 0 ? (
      <p className="mt-4 text-muted-foreground text-sm">
        Ainda não há períodos encerrados.
      </p>
    ) : (
      <div className="mt-4 divide-y rounded-xl border bg-card">
        {history.map((period) => (
          <article
            className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
            key={`${period.startsAt.toISOString()}-${period.endsAt.toISOString()}`}
          >
            <div>
              <h3 className="font-medium text-sm">
                {formatDateTime(period.startsAt)} –{" "}
                {formatDateTime(period.endsAt)}
              </h3>
              <p className="mt-1 text-muted-foreground text-xs leading-5">
                Fontes:{" "}
                {period.sourceKinds.length > 0
                  ? period.sourceKinds
                      .map(
                        (source) => communityGoalSourceLabels[source] ?? source
                      )
                      .join(", ")
                  : "nenhuma fonte elegível"}
              </p>
            </div>
            <p className="font-display text-lg">
              {communityGoalHoursText(period.totalSeconds)} /{" "}
              {communityGoalHoursText(period.targetMinutes * 60)}
            </p>
          </article>
        ))}
      </div>
    )}
  </section>
);

const CommunityGoalPage = async ({
  searchParams,
}: CommunityGoalPageProperties) => {
  await requireStaff();
  const [query, management] = await Promise.all([
    searchParams,
    getCommunityGoalManagement(),
  ]);
  const { goal, history } = management;
  const now = new Date();
  const defaultStartsAt =
    goal?.startsAt ?? new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const defaultEndsAt =
    goal?.endsAt ?? new Date(now.getTime() + 30 * 86_400_000);
  const isEndedManual =
    goal?.state === "ended" && goal.renewalMode === "MANUAL";
  const renewalStartsAt = goal
    ? new Date(Math.max(goal.endsAt.getTime(), now.getTime()))
    : now;
  const renewalEndsAt = goal
    ? new Date(
        renewalStartsAt.getTime() +
          Math.max(86_400_000, goal.endsAt.getTime() - goal.startsAt.getTime())
      )
    : defaultEndsAt;

  return (
    <main className="mx-auto w-full max-w-[880px] px-5 py-8 sm:px-8 sm:py-12">
      <IntentLink
        className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
        href="/comunidade"
      >
        ← Voltar à Comunidade
      </IntentLink>

      <header className="mt-8">
        <p className="brand-eyebrow">Comunidade · Gestão</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Meta coletiva
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground leading-7">
          O total usa somente intervalos fechados e persistidos das atividades
          de estudo e do cronômetro pessoal. Períodos são interpretados no
          horário de Brasília.
        </p>
      </header>

      <CommunityGoalResultMessage result={query.resultado} />
      {isEndedManual && goal ? (
        <CommunityGoalRenewalSection
          endsAt={renewalEndsAt}
          goal={goal}
          startsAt={renewalStartsAt}
        />
      ) : (
        <CommunityGoalConfigurationSection
          endsAt={defaultEndsAt}
          goal={goal}
          startsAt={defaultStartsAt}
        />
      )}
      <CommunityGoalHistorySection history={history} />
    </main>
  );
};

export default CommunityGoalPage;
