import type { Metadata } from "next";
import { MemberViewSwitcher } from "@/components/navigation/member-view-switcher";
import { requireOnboardedMemberId as requireMemberId } from "@/lib/authorization";
import { getPlannerDashboard } from "@/lib/planner";
import { getStudyGoalTopicOverview } from "@/lib/study-goal-topics";
import { PlannerWorkspace } from "./planner-workspace";

export const metadata: Metadata = { title: "Planejamento | Interprete" };

const views = [
  { id: "goals", label: "Metas" },
  { id: "calendar", label: "Calendário" },
] as const;

export default async function PlanningPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, memberId] = await Promise.all([
    searchParams,
    requireMemberId(),
  ]);
  const selectedView = typeof params.view === "string" ? params.view : "goals";
  const selectedTask = typeof params.task === "string" ? params.task : null;
  // Tarefas e Quadro saíram do Planejamento; os links antigos de lembretes,
  // busca e notificações abrem a tarefa sobre o calendário.
  let view: (typeof views)[number]["id"] = "goals";
  if (views.some((entry) => entry.id === selectedView)) {
    view = selectedView as typeof view;
  } else if (selectedTask) {
    view = "calendar";
  }
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
      ? await getStudyGoalTopicOverview(memberId, data.goals, data.goalWindows)
      : null;

  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 pt-8 pb-24 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl text-[#40222F] tracking-tight sm:text-5xl">
          Planejamento
        </h1>
        <p className="max-w-[640px] text-[#7A5A69] text-base leading-relaxed">
          Metas e calendário em um só lugar.
        </p>
      </header>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <MemberViewSwitcher activeView={view} views={views} />
      </div>
      <PlannerWorkspace
        data={data}
        goalTopics={goalTopics}
        selectedEventId={typeof params.event === "string" ? params.event : null}
        selectedEventOccurrence={
          typeof params.occurrence === "string" ? params.occurrence : null
        }
        selectedTaskId={selectedTask}
        selectedTaskOccurrence={
          typeof params.occurrence === "string" ? params.occurrence : null
        }
        view={view}
      />
    </main>
  );
}
