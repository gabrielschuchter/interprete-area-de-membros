import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon, Clock3Icon, TargetIcon } from "lucide-react";
import Link from "next/link";
import type { MemberStudyDashboard } from "@/lib/study-dashboard";

const minutesLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) {
    return `${remainder} min`;
  }
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
};

const StudyDashboard = ({ data }: { readonly data: MemberStudyDashboard }) => {
  const maximumDaySeconds = Math.max(
    1,
    ...data.days.map(({ studySeconds }) => studySeconds)
  );
  const weeklyTarget = data.goals.weeklyMinutes;
  const weeklyProgress = weeklyTarget
    ? Math.min(100, (data.weekMinutes / weeklyTarget) * 100)
    : null;
  const metrics = [
    { label: "Estudado esta semana", value: minutesLabel(data.weekMinutes) },
    {
      label: "Média semanal · 30 dias",
      value: minutesLabel(data.averageWeeklyMinutes),
    },
    {
      label: "Média assistida semanal · 30 dias",
      value: minutesLabel(data.averageWeeklyPlaybackMinutes),
    },
    {
      label: "Aulas concluídas · 30 dias",
      value: String(data.lessonsConsumed),
    },
    {
      label: "Questões respondidas · 30 dias",
      value: String(data.exerciseAnswers),
    },
  ];

  return (
    <section aria-labelledby="study-dashboard-heading" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <p className="brand-eyebrow">Seu estudo em contexto</p>
          <h2
            className="mt-2 font-display text-3xl"
            id="study-dashboard-heading"
          >
            Ritmo de aprendizagem
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6">
            O tempo soma intervalos ativos de aula, gravação, exercício,
            atividade e comunidade. Abas ociosas e avanço de vídeo não entram.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/tarefas">
            Metas e tarefas <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ label, value }) => (
          <article className="paper-surface border p-4 sm:p-5" key={label}>
            <p className="brand-eyebrow">{label}</p>
            <p className="mt-3 font-display text-3xl">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.85fr)]">
        <article className="paper-surface border p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="brand-eyebrow">Últimos sete dias</p>
              <h3 className="mt-2 font-display text-2xl">Tempo de estudo</h3>
            </div>
            <Clock3Icon
              aria-hidden="true"
              className="size-5 text-brand-action-text"
            />
          </div>
          <div
            aria-label="Minutos de estudo por dia nesta semana"
            className="mt-7 grid h-36 grid-cols-7 items-end gap-2 sm:gap-4"
            role="img"
          >
            {data.days.map((day) => {
              const minutes = Math.floor(day.studySeconds / 60);
              const height = Math.max(
                4,
                (day.studySeconds / maximumDaySeconds) * 100
              );
              return (
                <div
                  className="flex h-full flex-col items-center justify-end gap-2"
                  key={day.date}
                >
                  <span className="font-data text-[10px] text-muted-foreground">
                    {minutes || "·"}
                  </span>
                  <span
                    className="block w-full rounded-t-sm bg-brand-action/75"
                    style={{ height: `${height}%` }}
                  />
                  <span className="font-data text-[10px] text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      timeZone: "America/Sao_Paulo",
                    }).format(new Date(`${day.date}T12:00:00-03:00`))}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-muted-foreground text-xs">
            Vídeo assistido neste mês: {minutesLabel(data.monthPlaybackMinutes)}
            .
            {data.activitySubmissions > 0
              ? ` Atividades entregues: ${data.activitySubmissions}.`
              : ""}
          </p>
        </article>

        <article className="paper-surface border p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="brand-eyebrow">Meta que você definiu</p>
              <h3 className="mt-2 font-display text-2xl">Esta semana</h3>
            </div>
            <TargetIcon
              aria-hidden="true"
              className="size-5 text-brand-action-text"
            />
          </div>
          {weeklyTarget && weeklyProgress !== null ? (
            <>
              <p className="mt-5 font-display text-3xl">
                {minutesLabel(data.weekMinutes)}
                <span className="font-sans text-base text-muted-foreground">
                  {` / ${minutesLabel(weeklyTarget)}`}
                </span>
              </p>
              <div
                aria-label={`${data.weekMinutes} de ${weeklyTarget} minutos da meta semanal`}
                aria-valuemax={weeklyTarget}
                aria-valuemin={0}
                aria-valuenow={Math.min(data.weekMinutes, weeklyTarget)}
                className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
              >
                <div
                  className="h-full rounded-full bg-brand-action"
                  style={{ width: `${weeklyProgress}%` }}
                />
              </div>
              <p className="mt-3 text-muted-foreground text-sm">
                Meta mensal:{" "}
                {data.goals.monthlyMinutes
                  ? minutesLabel(data.goals.monthlyMinutes)
                  : "ainda não definida"}
              </p>
            </>
          ) : (
            <p className="mt-5 text-muted-foreground text-sm leading-6">
              Defina sua meta semanal e mensal. O histórico permanece salvo
              quando você ajustar o objetivo.
            </p>
          )}
          <Button asChild className="mt-5" size="sm" variant="outline">
            <Link href="/tarefas">Gerenciar metas</Link>
          </Button>
        </article>
      </div>

      {data.campaign && (
        <article className="mt-4 rounded-xl border border-brand-action/40 bg-brand-action/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="brand-eyebrow">Meta coletiva dos alunos</p>
              <h3 className="mt-2 font-display text-2xl">
                {data.campaign.title}
              </h3>
              {data.campaign.description && (
                <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6">
                  {data.campaign.description}
                </p>
              )}
            </div>
            <Badge variant="outline">
              {data.campaign.memberCount} alunos participam
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-data text-sm">
              {minutesLabel(data.campaign.contributedMinutes)} de{" "}
              {minutesLabel(data.campaign.targetMinutes)}
            </p>
            <span className="text-muted-foreground text-xs">
              A contribuição é coletiva; horas individuais não são exibidas.
            </span>
          </div>
          <div
            aria-label={`${data.campaign.contributedMinutes} de ${data.campaign.targetMinutes} minutos da meta coletiva`}
            aria-valuemax={data.campaign.targetMinutes}
            aria-valuemin={0}
            aria-valuenow={Math.min(
              data.campaign.contributedMinutes,
              data.campaign.targetMinutes
            )}
            className="mt-3 h-2 overflow-hidden rounded-full bg-background"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-brand-action"
              style={{
                width: `${Math.min(100, (data.campaign.contributedMinutes / data.campaign.targetMinutes) * 100)}%`,
              }}
            />
          </div>
        </article>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <p className="text-sm">
          {data.openTasks === 0
            ? "Nenhuma tarefa aberta para o período."
            : `${data.openTasks} tarefa${data.openTasks === 1 ? "" : "s"} esperando seu próximo passo.`}
        </p>
        <Link
          className="text-primary text-sm underline underline-offset-4"
          href="/tarefas"
        >
          Ver tarefas
        </Link>
      </div>
    </section>
  );
};

export { StudyDashboard };
