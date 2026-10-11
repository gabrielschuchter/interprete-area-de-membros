import type { Metadata } from "next";
import { MemberViewSwitcher } from "@/components/navigation/member-view-switcher";
import { requireOnboardedMemberId as requireMemberId } from "@/lib/authorization";
import { getPlannerDashboard } from "@/lib/planner";
import { PlannerWorkspace } from "./planner-workspace";

export const metadata: Metadata = { title: "Planejamento | Interprete" };

const views = [
  { id: "goals", label: "Metas" },
  { id: "tasks", label: "Tarefas" },
  { id: "board", label: "Quadro" },
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
  const view = views.some((entry) => entry.id === selectedView)
    ? selectedView
    : "goals";
  const calendarRange =
    view === "calendar"
      ? {
          start: new Date(Date.now() - 31 * 86_400_000).toISOString(),
          end: new Date(Date.now() + 62 * 86_400_000).toISOString(),
        }
      : undefined;
  const data = await getPlannerDashboard(memberId, calendarRange);

  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 pt-8 pb-24 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl text-[#40222F] tracking-tight sm:text-5xl">
          Planejamento
        </h1>
        <p className="max-w-[640px] text-[#7A5A69] text-base leading-relaxed">
          Metas, tarefas, quadro e calendário em um só lugar.
        </p>
      </header>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <MemberViewSwitcher activeView={view} views={views} />
      </div>
      <PlannerWorkspace
        data={data}
        selectedEventId={typeof params.event === "string" ? params.event : null}
        selectedEventOccurrence={
          typeof params.occurrence === "string" ? params.occurrence : null
        }
        selectedTaskId={typeof params.task === "string" ? params.task : null}
        selectedTaskOccurrence={
          typeof params.occurrence === "string" ? params.occurrence : null
        }
        view={view}
      />
    </main>
  );
}
