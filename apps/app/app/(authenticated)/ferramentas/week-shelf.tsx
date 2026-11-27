"use client";

import { toast } from "@repo/design-system/lib/toast";
import { cn } from "@repo/design-system/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  type CountGoalKind,
  type CountGoalsOverview,
  countGoalUnit,
  type WeekActivityCounts,
  weekActivitySummary,
} from "@/lib/study-count-goals-model";
import type { ManualStudyEntry } from "@/lib/study-week-shelf";
import {
  bookHeight,
  dayTotalMinutes,
  isoWeekNumber,
  type ShelfDay,
  type ShelfGroup,
  shelfGroupColors,
  shelfGroupLabels,
  shelfGroups,
} from "@/lib/study-week-shelf-model";
import { GoalHourglassCard } from "./goal-hourglass-card";
import { ManualEntry } from "./manual-entry";

const MONO = "font-data";

const nicheClass = (day: ShelfDay) => {
  let tone = "border-white/10 bg-white/[.04]";
  if (day.today) {
    tone = "border-[#D9A86B]/60 bg-[#D9A86B]/10";
  } else if (day.future) {
    tone = "border-white/20 border-dashed bg-white/[.04]";
  }
  return cn(
    "flex items-end justify-center gap-[3px] rounded-t-[60px] border border-b-0 px-1",
    tone
  );
};
const GROUP_KIND: Record<ShelfGroup, CountGoalKind> = {
  lesson: "LESSONS",
  reading: "READINGS",
  exercise: "EXERCISES",
};
const DONE_WORD: Record<ShelfGroup, [string, string]> = {
  lesson: ["concluída", "concluídas"],
  reading: ["concluída", "concluídas"],
  exercise: ["respondida", "respondidas"],
};

const barDetails = (
  group: ShelfGroup,
  minutes: number,
  count: number
): { readonly note: string | null; readonly title: string } => {
  const kind = GROUP_KIND[group];
  const time = minutes > 0 ? `${minutes} min` : "menos de 1 min";
  const done = DONE_WORD[group][count === 1 ? 0 : 1];
  return {
    title: `${shelfGroupLabels[group]} · ${time}`,
    note: count > 0 ? `${count} ${countGoalUnit(kind, count)} ${done}` : null,
  };
};

/**
 * Uma barrinha da estante: tempo registrado naquele tipo. Sem tempo (menos de
 * 1 min) mas com itens feitos, vira um livro só de contorno. O detalhe abre ao
 * passar o mouse, focar ou tocar.
 */
const ShelfBook = ({
  animationDelay,
  count,
  group,
  minutes,
  onOpenChange,
  open,
}: {
  readonly animationDelay: string;
  readonly count: number;
  readonly group: ShelfGroup;
  readonly minutes: number;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}) => {
  const hollow = minutes === 0;
  const { note, title } = barDetails(group, minutes, count);
  const color = shelfGroupColors[group];
  return (
    <div className="relative flex items-end">
      {open ? (
        <output className="absolute bottom-[calc(100%+8px)] left-1/2 z-10 block -translate-x-1/2 whitespace-nowrap rounded-[4px] border border-[#D9A86B] bg-[#F7F3F1] px-2.5 py-1.5 text-[#410230] text-xs leading-snug">
          <span className="flex items-center gap-1.5 font-medium">
            <i
              aria-hidden="true"
              className="inline-block size-2"
              style={{ background: color }}
            />
            {title}
          </span>
          {note ? <span className="block text-[#6B4A5C]">{note}</span> : null}
        </output>
      ) : null}
      <button
        aria-label={note ? `${title}, ${note}` : title}
        className={cn(
          "relative block w-[14px] cursor-pointer p-0 focus-visible:outline-2 focus-visible:outline-[#F0C98A] focus-visible:outline-offset-2 sm:w-[18px]",
          hollow
            ? "border-[1.5px] border-dashed bg-transparent"
            : "bancada-book border-0 shadow-[inset_4px_0_0_rgba(0,0,0,.18)]"
        )}
        data-tooltip-off
        onBlur={() => onOpenChange(false)}
        onClick={() => onOpenChange(true)}
        onMouseEnter={() => onOpenChange(true)}
        onMouseLeave={() => onOpenChange(false)}
        style={{
          animationDelay,
          background: hollow ? "transparent" : color,
          borderColor: hollow ? color : undefined,
          height: hollow ? 30 : bookHeight(minutes),
        }}
        type="button"
      >
        {hollow ? null : (
          <>
            <span className="absolute top-2 right-px left-px h-0.5 bg-[#D9A86B]" />
            <span className="absolute right-px bottom-2 left-px h-0.5 bg-[#D9A86B]" />
          </>
        )}
      </button>
    </div>
  );
};

const showError = (error: unknown) =>
  toast.error(
    error instanceof Error ? error.message : "Não foi possível salvar agora."
  );

export interface WeekShelfProps {
  readonly activity: WeekActivityCounts;
  readonly countGoals: CountGoalsOverview;
  readonly days: readonly ShelfDay[];
  readonly manualEntries: readonly ManualStudyEntry[];
  readonly studiedMinutes: number;
  readonly targetMinutes: number | null;
  readonly weekStartKey: string;
}

const weekRangeLabel = (days: readonly ShelfDay[]) => {
  const first = days[0]?.dayKey;
  const last = days.at(-1)?.dayKey;
  if (!(first && last)) {
    return "";
  }
  const format = (key: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
      .format(new Date(`${key}T00:00:00Z`))
      .replace(".", "")
      .replace(" de ", " ")
      .toUpperCase();
  return `${format(first)} A ${format(last)}`;
};

export const WeekShelf = ({
  activity,
  countGoals,
  days,
  manualEntries,
  studiedMinutes,
  targetMinutes,
  weekStartKey,
}: WeekShelfProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openBook, setOpenBook] = useState<string | null>(null);

  const daysLeft = days.filter((day) => day.today || day.future).length;
  const target = targetMinutes ?? 0;
  const reached = target > 0 && studiedMinutes >= target;

  const run = (task: () => Promise<unknown>, success?: string) => {
    startTransition(() => {
      task()
        .then(() => {
          if (success) {
            toast.success(success);
          }
          router.refresh();
        })
        .catch(showError);
    });
  };

  return (
    <section
      aria-label="Estante da semana e ampulheta da meta"
      className="mt-6 flex flex-col gap-5"
      data-week-shelf
    >
      <div className="flex flex-wrap gap-5">
        <div className="relative flex min-w-0 flex-[2_1_560px] flex-col gap-5 overflow-hidden rounded-lg bg-[linear-gradient(180deg,#4A0E2C_0%,#22040F_100%)] p-5 text-[#F1EBE8] sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex flex-col gap-2">
              <span
                className={cn(
                  MONO,
                  "text-[#D9A86B] text-[11px] uppercase tracking-[.2em]"
                )}
              >
                Estante da semana · {weekRangeLabel(days)}
              </span>
              <span className="font-display font-semibold text-[28px] leading-tight">
                {studiedMinutes.toLocaleString("pt-BR")}
                {targetMinutes
                  ? ` de ${targetMinutes.toLocaleString("pt-BR")}`
                  : ""}{" "}
                min
              </span>
            </div>
            <span className="text-[#E9C3C4] text-[13px]">
              Esta semana: {weekActivitySummary(activity.week)}
            </span>
          </div>

          <figure
            aria-label="Tempo de estudo por dia nesta semana"
            className="m-0 flex flex-col"
          >
            <div className="grid h-[200px] grid-cols-7 gap-1.5 sm:gap-2">
              {days.map((day, dayIndex) => {
                const total = dayTotalMinutes(day);
                return (
                  <div className={nicheClass(day)} key={day.dayKey}>
                    {shelfGroups
                      .filter(
                        (item) =>
                          day.minutes[item] > 0 ||
                          (activity.perDay[day.dayKey]?.[GROUP_KIND[item]] ??
                            0) > 0
                      )
                      .map((item, bookIndex) => {
                        const id = `${day.dayKey}:${item}`;
                        return (
                          <ShelfBook
                            animationDelay={`${dayIndex * 80 + bookIndex * 90}ms`}
                            count={
                              activity.perDay[day.dayKey]?.[GROUP_KIND[item]] ??
                              0
                            }
                            group={item}
                            key={item}
                            minutes={day.minutes[item]}
                            onOpenChange={(next) =>
                              setOpenBook((current) => {
                                if (next) {
                                  return id;
                                }
                                return current === id ? null : current;
                              })
                            }
                            open={openBook === id}
                          />
                        );
                      })}
                    {day.future && total === 0 ? (
                      <span className="self-center font-display text-[#7A2446] text-[28px]">
                        ?
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="h-[9px] bg-[#5A2233]" />
            <div className="mb-2.5 h-1.5 bg-[#3B1222]" />
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {days.map((day) => (
                <div
                  className={cn(MONO, "flex flex-col items-center gap-0.5")}
                  key={day.dayKey}
                >
                  <span
                    className={cn(
                      "text-[10px] tracking-[.12em] sm:text-[11px] sm:tracking-[.15em]",
                      day.today ? "text-[#D9A86B]" : "text-[#CDB9B2]"
                    )}
                  >
                    {day.label}
                  </span>
                  <span className="text-[#F1EBE8] text-[11px] sm:text-[13px]">
                    {day.future ? "—" : `${dayTotalMinutes(day)} min`}
                  </span>
                </div>
              ))}
            </div>
          </figure>

          <div className="flex flex-col gap-4 border-[#5A2233] border-t pt-4">
            <ManualEntry entries={manualEntries} pending={pending} run={run} />
          </div>

          {reached ? (
            <output className="bancada-stamp absolute top-4 right-4 flex size-[104px] flex-col items-center justify-center gap-0.5 rounded-full border-[#F1EBE8] border-[3px] border-double bg-[#C8333F] text-[#F1EBE8] outline outline-[#C8333F]/35 outline-[6px] sm:top-5 sm:right-6 sm:size-[116px]">
              <span aria-hidden="true" className="text-[#F7C873]">
                ◆
              </span>
              <span className="text-center font-display font-semibold text-[16px] leading-[1.05]">
                Meta
                <br />
                cumprida
              </span>
              <span className={cn(MONO, "text-[9px] tracking-[.2em]")}>
                SEMANA {isoWeekNumber(weekStartKey)}
              </span>
            </output>
          ) : null}
        </div>

        <GoalHourglassCard
          countGoals={countGoals}
          daysLeft={daysLeft}
          pending={pending}
          run={run}
          studiedMinutes={studiedMinutes}
          targetMinutes={targetMinutes}
        />
      </div>
    </section>
  );
};
