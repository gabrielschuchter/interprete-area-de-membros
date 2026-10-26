import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import type {
  CommunityGoalState,
  CommunityGoalSummary,
} from "@/lib/community-goal";

export const communityGoalSourceLabels: Record<string, string> = {
  ACTIVITY: "Atividades",
  COMMUNITY: "Comunidade",
  EXERCISE: "Exercícios",
  LESSON: "Aulas",
  LIBRARY_ITEM: "Biblioteca",
  PERSONAL_TIMER: "Cronômetro pessoal",
  RECORDING: "Gravações",
};

const stateLabels: Record<CommunityGoalState, string> = {
  active: "Ativa",
  empty: "Sem registros",
  ended: "Encerrada",
  scheduled: "Programada",
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

const CommunityGoalProgress = ({
  goal,
}: {
  readonly goal: CommunityGoalSummary;
}) => {
  if (goal.state === "ended") {
    return (
      <p className="mt-4 font-display text-2xl">
        {communityGoalHoursText(goal.totalSeconds)} de{" "}
        {communityGoalHoursText(goal.targetMinutes * 60)}
      </p>
    );
  }

  if (goal.state === "scheduled") {
    return (
      <p className="mt-4 text-sm leading-6">
        O período começa em {dateTimeFormatter.format(goal.startsAt)}.
      </p>
    );
  }

  const progressPercent = Math.min(
    100,
    Math.floor((goal.totalSeconds / (goal.targetMinutes * 60)) * 100)
  );

  return (
    <>
      <p className="mt-4 font-display text-2xl">
        {communityGoalHoursText(goal.totalSeconds)}{" "}
        <span className="font-sans text-muted-foreground text-sm">
          de {communityGoalHoursText(goal.targetMinutes * 60)}
        </span>
      </p>
      <div
        aria-label="Progresso da meta coletiva"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progressPercent}
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="mt-2 text-muted-foreground text-xs">
        {goal.totalSeconds >= goal.targetMinutes * 60
          ? "Meta atingida"
          : `${progressPercent}% da meta`}
      </p>
      {goal.state === "empty" ? (
        <p className="mt-2 text-muted-foreground text-sm leading-6">
          Ainda não há registros elegíveis neste período.
        </p>
      ) : null}
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
  return (
    <section
      aria-labelledby="community-goal-heading"
      className="community-rail__block community-rail__goal"
    >
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="brand-eyebrow">Meta coletiva</p>
            <h2
              className="mt-2 font-display text-xl leading-tight"
              id="community-goal-heading"
            >
              {goal?.title ?? "Meta coletiva"}
            </h2>
          </div>
          {goal ? (
            <Badge variant="outline">{stateLabels[goal.state]}</Badge>
          ) : null}
        </div>

        {goal ? (
          <>
            <p className="mt-3 text-muted-foreground text-xs leading-5">
              {dateTimeFormatter.format(goal.startsAt)} –{" "}
              {dateTimeFormatter.format(goal.endsAt)}
            </p>
            <CommunityGoalProgress goal={goal} />
            <p className="mt-3 text-muted-foreground text-xs leading-5">
              Fontes utilizadas:{" "}
              {goal.sourceKinds.length > 0
                ? goal.sourceKinds
                    .map(
                      (source) => communityGoalSourceLabels[source] ?? source
                    )
                    .join(", ")
                : "nenhuma fonte elegível registrada neste período"}
              .
            </p>
          </>
        ) : (
          <p className="mt-3 text-muted-foreground text-sm leading-6">
            A meta coletiva ainda não foi configurada.
          </p>
        )}

        {canManage ? (
          <Button asChild className="mt-4 w-full" size="sm" variant="outline">
            <IntentLink href="/comunidade/meta">
              {goal ? "Editar meta" : "Definir meta"}
            </IntentLink>
          </Button>
        ) : null}
      </div>
    </section>
  );
};
