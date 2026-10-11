import type { Metadata } from "next";
import { requireOnboardedMemberId as requireMemberId } from "@/lib/authorization";
import {
  getFocusTimerLinkResources,
  getFocusTimerState,
} from "@/lib/focus-timer";
import { getPlannerNotes } from "@/lib/planner-notes";
import { ToolsWorkspace } from "./tools-workspace";

export const metadata: Metadata = { title: "Ferramentas | Interprete" };

const views = [
  { id: "timer", label: "Cronômetro" },
  { id: "notes", label: "Notas" },
] as const;

export default async function ToolsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, memberId] = await Promise.all([
    searchParams,
    requireMemberId(),
  ]);
  const selectedView = typeof params.view === "string" ? params.view : "timer";
  const view = views.some((entry) => entry.id === selectedView)
    ? selectedView
    : "timer";
  const [timer, notes, timerResources] = await Promise.all([
    view === "timer" ? getFocusTimerState(memberId) : Promise.resolve(null),
    view === "notes" ? getPlannerNotes(memberId) : Promise.resolve(null),
    view === "timer" || view === "notes"
      ? getFocusTimerLinkResources(memberId)
      : Promise.resolve([]),
  ]);

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
          Cronômetro, modo foco e notas.
        </p>
      </header>
      <ToolsWorkspace
        focusModeInitial={params.focus === "1"}
        initialNotes={notes}
        initialTimer={timer}
        noteId={typeof params.note === "string" ? params.note : null}
        settingsInitialOpen={params.settings === "1"}
        timerResources={timerResources}
        view={view}
        views={views}
      />
    </main>
  );
}
