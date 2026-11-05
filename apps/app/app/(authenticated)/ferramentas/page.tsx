import type { Metadata } from "next";
import { MemberViewSwitcher } from "@/components/navigation/member-view-switcher";
import { requireOnboardedMemberId as requireMemberId } from "@/lib/authorization";
import {
  getFocusTimerLinkResources,
  getFocusTimerState,
} from "@/lib/focus-timer";
import { getPlannerDashboard } from "@/lib/planner";
import { getStudyGoalTopicOverview } from "@/lib/study-goal-topics";
import { PlannerView, TimerView } from "./tools-view-loader";

export const metadata: Metadata = { title: "Ferramentas | Interprete" };

const views = [
  { id: "goals", label: "Metas" },
  { id: "calendar", label: "Calendário" },
  { id: "timer", label: "Cronômetro" },
] as const;

type ToolsView = (typeof views)[number]["id"];

const subtitles: Record<ToolsView, string> = {
  calendar: "Encontros, prazos e o que você marcou para estudar.",
  goals: "Quanto você quer estudar e quanto já estudou.",
  timer: "Pomodoro, cronômetro livre e contagem regressiva.",
};

const resolveView = (
  params: Record<string, string | string[] | undefined>
): ToolsView => {
  const requested = typeof params.view === "string" ? params.view : null;
  if (views.some((entry) => entry.id === requested)) {
    return requested as ToolsView;
  }
  // Links antigos de lembretes e da busca abrem a tarefa ou o evento no
  // calendário; o modo foco e as preferências pertencem ao cronômetro.
  if (typeof params.task === "string" || typeof params.event === "string") {
    return "calendar";
  }
  if (params.focus === "1" || params.settings === "1") {
    return "timer";
  }
  return "goals";
};

export default async function ToolsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, memberId] = await Promise.all([
    searchParams,
    requireMemberId(),
  ]);
  const view = resolveView(params);

  let content: React.ReactNode;
  if (view === "timer") {
    const [timer, timerResources] = await Promise.all([
      getFocusTimerState(memberId),
      getFocusTimerLinkResources(memberId),
    ]);
    content = (
      <TimerView
        focusModeInitial={params.focus === "1"}
        initialTimer={timer}
        settingsInitialOpen={params.settings === "1"}
        timerResources={timerResources}
      />
    );
  } else {
    const calendarRange =
      view === "calendar"
        ? {
            start: new Date(Date.now() - 31 * 86_400_000).toISOString(),
            end: new Date(Date.now() + 62 * 86_400_000).toISOString(),
          }
        : undefined;
    const data = await getPlannerDashboard(memberId, calendarRange);
    const goalTopics =
      view === "goals"
        ? await getStudyGoalTopicOverview(
            memberId,
            data.goals,
            data.goalWindows
          )
        : null;
    const occurrence =
      typeof params.occurrence === "string" ? params.occurrence : null;
    content = (
      <PlannerView
        data={data}
        goalTopics={goalTopics}
        selectedEventId={typeof params.event === "string" ? params.event : null}
        selectedEventOccurrence={occurrence}
        selectedTaskId={typeof params.task === "string" ? params.task : null}
        selectedTaskOccurrence={occurrence}
        view={view}
      />
    );
  }

  return (
    <main
      className="mx-auto w-full max-w-[1080px] px-5 pt-5 pb-24 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12"
      data-tools-page
      data-tools-view={view}
    >
      <header className="flex flex-col gap-2" data-tools-page-heading>
        <h1 className="font-display text-[#40222F] text-[32px] leading-[1.2] tracking-tight sm:text-5xl">
          Ferramentas
        </h1>
        <p className="max-w-[640px] text-[#7A5A69] text-sm leading-relaxed sm:text-base">
          {subtitles[view]}
        </p>
      </header>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <MemberViewSwitcher
          activeView={view}
          label="Ferramenta"
          views={views}
        />
      </div>
      {content}
    </main>
  );
}
