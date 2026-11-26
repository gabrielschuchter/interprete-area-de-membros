import { EvidenceToolKind } from "@repo/database";
import type { Metadata } from "next";
import { requireOnboardedMemberId as requireMemberId } from "@/lib/authorization";
import {
  getEvidenceAssessment,
  listEvidenceAssessments,
} from "@/lib/evidence-assessments";
import {
  getFocusTimerLinkResources,
  getFocusTimerState,
} from "@/lib/focus-timer";
import { getPlannerDashboard } from "@/lib/planner";
import { getCountGoalsOverview } from "@/lib/study-count-goals";
import { getStudyGoalTopicOverview } from "@/lib/study-goal-topics";
import { getStudyWeekShelf } from "@/lib/study-week-shelf";
import type { GradeSelected } from "./grade-workspace";
import type { Rob2Selected } from "./rob2-workspace";
import { ToolsHero } from "./tools-hero";
import { ToolsPicker } from "./tools-picker";
import {
  GradeView,
  PlannerView,
  Rob2View,
  TimerView,
} from "./tools-view-loader";
import { WeekShelf } from "./week-shelf";

export const metadata: Metadata = { title: "Ferramentas | Interprete" };

const views = [
  { id: "goals", label: "Metas" },
  { id: "calendar", label: "Calendário" },
  { id: "timer", label: "Cronômetro" },
  { id: "rob2", label: "RoB 2" },
  { id: "grade", label: "GRADE" },
] as const;

type ToolsView = (typeof views)[number]["id"];

const pickerItems = [
  {
    id: "goals",
    label: "Metas",
    description: "Estante da semana e ampulheta da meta.",
    iconPath: "M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l8-8M17 4h3v3",
  },
  {
    id: "calendar",
    label: "Calendário",
    description: "Encontros, prazos e o que você marcou.",
    iconPath: "M4 6h16v14H4zM4 10h16M9 3v5M15 3v5",
  },
  {
    id: "timer",
    label: "Cronômetro",
    description: "Pomodoro, cronômetro livre e contagem.",
    iconPath:
      "M7 3h10M7 21h10M8 3c0 6 8 6 8 9s-8 3-8 9M16 3c0 6-8 6-8 9s8 3 8 9",
  },
  {
    id: "rob2",
    label: "RoB 2",
    description: "Risco de viés, domínio a domínio.",
    iconPath: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  },
  {
    id: "grade",
    label: "GRADE",
    description: "Certeza da evidência por desfecho.",
    iconPath: "M4 8l8-4 8 4-8 4zM4 12l8 4 8-4M4 16l8 4 8-4",
  },
] as const;

const subtitles: Record<ToolsView, string> = {
  calendar: "Encontros, prazos e o que você marcou para estudar.",
  goals: "Quanto você quer estudar e quanto já estudou.",
  timer: "Pomodoro, cronômetro livre e contagem regressiva.",
  rob2: "Risco de viés de ensaios randomizados, domínio a domínio.",
  grade: "Certeza da evidência por desfecho, a partir dos seus RoB 2.",
};

const serializeList = (
  rows: Awaited<ReturnType<typeof listEvidenceAssessments>>
) => rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));

const loadEvidenceView = async (
  memberId: string,
  view: "grade" | "rob2",
  requested: string | null
) => {
  const tool = view === "rob2" ? EvidenceToolKind.ROB2 : EvidenceToolKind.GRADE;
  const creating = requested === "nova";
  const [items, selected, rob2Items] = await Promise.all([
    listEvidenceAssessments(memberId, tool),
    requested && !creating
      ? getEvidenceAssessment(memberId, tool, requested)
      : Promise.resolve(null),
    view === "grade"
      ? listEvidenceAssessments(memberId, EvidenceToolKind.ROB2)
      : Promise.resolve([]),
  ]);
  const selection = selected
    ? {
        id: selected.id,
        title: selected.title,
        context: selected.context,
        version: selected.version,
        data: (selected.data ?? {}) as object,
      }
    : null;
  return {
    creating,
    items: serializeList(items),
    rob2Items: serializeList(rob2Items),
    selection,
  };
};

const loadWeekShelf = async (
  memberId: string,
  data: Awaited<ReturnType<typeof getPlannerDashboard>>
) => {
  const shelf = await getStudyWeekShelf(
    memberId,
    data.goalWindows,
    data.preferences.timezone
  );
  const weeklyTarget =
    data.goals.find((goal) => goal.period === "WEEKLY")?.targetMinutes ?? null;
  const countGoals = await getCountGoalsOverview(memberId, data.goalWindows);
  return { ...shelf, countGoals, weeklyTarget };
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

const loadPlannerContent = async (
  memberId: string,
  view: "calendar" | "goals",
  params: Record<string, string | string[] | undefined>
) => {
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
  const shelf = view === "goals" ? await loadWeekShelf(memberId, data) : null;
  const occurrence =
    typeof params.occurrence === "string" ? params.occurrence : null;
  return (
    <>
      {shelf ? (
        <WeekShelf
          countGoals={shelf.countGoals}
          days={shelf.days}
          manualEntries={shelf.manualEntries}
          studiedMinutes={data.stats.weeklyMinutes}
          targetMinutes={shelf.weeklyTarget}
          weekStartKey={shelf.weekNumberKey}
        />
      ) : null}
      <PlannerView
        data={data}
        goalTopics={goalTopics}
        selectedEventId={typeof params.event === "string" ? params.event : null}
        selectedEventOccurrence={occurrence}
        selectedTaskId={typeof params.task === "string" ? params.task : null}
        selectedTaskOccurrence={occurrence}
        view={view}
      />
    </>
  );
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
  if (view === "rob2" || view === "grade") {
    const requested =
      typeof params.avaliacao === "string" ? params.avaliacao : null;
    const evidence = await loadEvidenceView(memberId, view, requested);
    content =
      view === "rob2" ? (
        <Rob2View
          creating={evidence.creating}
          items={evidence.items}
          selected={evidence.selection as Rob2Selected | null}
        />
      ) : (
        <GradeView
          creating={evidence.creating}
          items={evidence.items}
          rob2Items={evidence.rob2Items}
          selected={evidence.selection as GradeSelected | null}
        />
      );
  } else if (view === "timer") {
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
    content = await loadPlannerContent(memberId, view, params);
  }

  return (
    <main
      className="mx-auto w-full max-w-[1080px] px-5 pt-5 pb-24 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12"
      data-tools-page
      data-tools-view={view}
    >
      <ToolsHero subtitle={subtitles[view]} />
      <ToolsPicker activeView={view} items={pickerItems} />
      {content}
    </main>
  );
}
