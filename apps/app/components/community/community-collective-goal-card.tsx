import { TargetIcon } from "lucide-react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import type { CommunityGoalSummary } from "@/lib/community-goal";

export const communityGoalSourceLabels: Record<string, string> = {
  ACTIVITY: "Atividades",
  COMMUNITY: "Comunidade",
  EXERCISE: "Exercícios",
  LESSON: "Aulas",
  LIBRARY_ITEM: "Biblioteca",
  PERSONAL_TIMER: "Cronômetro pessoal",
  RECORDING: "Gravações",
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

export const communityGoalHoursText = (seconds: number) =>
  `${numberFormatter.format(seconds / 3600)} h`;

const hoursFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});
const smallHoursFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});
const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "America/Sao_Paulo",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});
const DAY_MS = 86_400_000;

const wholeHours = (seconds: number) => {
  const hours = seconds / 3600;
  return hours < 10
    ? smallHoursFormatter.format(Math.floor(hours * 10) / 10)
    : hoursFormatter.format(Math.floor(hours));
};

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const remainingText = (endsAt: Date, now: number) => {
  const days = Math.ceil((endsAt.getTime() - now) / DAY_MS);
  if (days <= 0) {
    return "Último dia";
  }
  return `${days} ${days === 1 ? "dia restante" : "dias restantes"}`;
};

const CommunityGoalStatus = ({
  goal,
  now,
}: {
  readonly goal: CommunityGoalSummary;
  readonly now: number;
}) => {
  const targetSeconds = goal.targetMinutes * 60;
  const progressPercent = Math.min(
    100,
    Math.floor((goal.totalSeconds / targetSeconds) * 100)
  );
  const reached = goal.totalSeconds >= targetSeconds;
  const nearlyThere = !reached && progressPercent >= 90;
  const missingHours = Math.ceil((targetSeconds - goal.totalSeconds) / 3600);

  if (goal.state === "scheduled") {
    return (
      <p className="community-goal__note">
        O período começa em {dateFormatter.format(goal.startsAt)}.
      </p>
    );
  }

  let left = `${progressPercent}% da meta`;
  if (reached) {
    left = "Meta atingida";
  } else if (nearlyThere) {
    left = `Faltam ${hoursFormatter.format(missingHours)} ${missingHours === 1 ? "hora" : "horas"}`;
  }

  return (
    <>
      <div
        aria-label="Progresso da meta coletiva"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progressPercent}
        className="community-goal__bar"
        role="progressbar"
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="community-goal__meta">
        <span>{left}</span>
        <span>
          {goal.state === "ended"
            ? "Período encerrado"
            : remainingText(goal.endsAt, now)}
        </span>
      </div>
    </>
  );
};

export const CommunityCollectiveGoalCard = ({
  canManage,
  goal,
}: {
  readonly canManage: boolean;
  readonly goal: CommunityGoalSummary | null;
}) => {
  // Members never see an empty card; only staff get the prompt to set it up.
  if (!(goal || canManage)) {
    return null;
  }

  const now = Date.now();
  const label = goal
    ? `Meta coletiva · ${capitalize(monthFormatter.format(goal.startsAt))}`
    : "Meta coletiva";

  return (
    <section
      aria-labelledby="community-goal-heading"
      className="community-rail__goal community-goal"
    >
      <div className="community-goal__head">
        <span aria-hidden="true" className="community-goal__icon">
          <TargetIcon className="size-4" />
        </span>
        <h2 className="community-goal__label" id="community-goal-heading">
          {label}
        </h2>
        {canManage && goal ? (
          <IntentLink className="community-goal__edit" href="/comunidade/meta">
            Editar meta
          </IntentLink>
        ) : null}
      </div>

      {goal ? (
        <>
          <p className="community-goal__value">
            <strong>{wholeHours(goal.totalSeconds)}</strong>
            <span>de {wholeHours(goal.targetMinutes * 60)} horas</span>
          </p>
          <CommunityGoalStatus goal={goal} now={now} />
          <p className="community-goal__note">
            Horas de estudo registradas pelos alunos da comunidade neste mês.
          </p>
          {goal.state === "empty" ? (
            <p className="community-goal__note">
              Ainda não há registros elegíveis neste período.
            </p>
          ) : null}
          <p className="community-goal__sources">
            Fontes:{" "}
            {goal.sourceKinds.length > 0
              ? goal.sourceKinds
                  .map((source) => communityGoalSourceLabels[source] ?? source)
                  .join(", ")
              : "nenhuma fonte elegível registrada neste período"}
            .
          </p>
        </>
      ) : (
        <>
          <p className="community-goal__empty">Defina a meta coletiva</p>
          <p className="community-goal__note">
            Alunos só veem o cartão depois que a meta existe.
          </p>
          <IntentLink className="community-goal__cta" href="/comunidade/meta">
            Definir meta
          </IntentLink>
        </>
      )}
    </section>
  );
};
