"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { toast } from "@repo/design-system/lib/toast";
import { cn } from "@repo/design-system/lib/utils";
import { Undo2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ManualStudyEntry } from "@/lib/study-week-shelf";
import {
  bookHeight,
  dayTotalMinutes,
  hourglassRemainingFraction,
  isoWeekNumber,
  type ShelfDay,
  type ShelfGroup,
  shelfGroupColors,
  shelfGroupLabels,
  shelfGroups,
  weeklyGoalPresets,
} from "@/lib/study-week-shelf-model";
import { ArchHourglass } from "./arch-hourglass";
import { savePlannerGoalAction } from "./planner-actions";
import {
  addManualStudyEntryAction,
  deleteManualStudyEntryAction,
} from "./study-manual-actions";

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
const QUICK_MINUTES = [5, 15, 30, 60] as const;

const showError = (error: unknown) =>
  toast.error(
    error instanceof Error ? error.message : "Não foi possível salvar agora."
  );

export interface WeekShelfProps {
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

const entryTimeLabel = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));

export const WeekShelf = ({
  days,
  manualEntries,
  studiedMinutes,
  targetMinutes,
  weekStartKey,
}: WeekShelfProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [group, setGroup] = useState<ShelfGroup>("reading");
  const [minutes, setMinutes] = useState<number>(15);

  const target = targetMinutes ?? 0;
  const hasGoal = target > 0;
  const remaining = hasGoal ? Math.max(0, target - studiedMinutes) : 0;
  const reached = hasGoal && studiedMinutes >= target;
  const fraction = hasGoal
    ? hourglassRemainingFraction(studiedMinutes, target)
    : 1;
  const percent = hasGoal
    ? Math.min(100, Math.round((studiedMinutes / target) * 100))
    : 0;
  const daysLeft = days.filter((day) => day.today || day.future).length;
  const pace =
    hasGoal && remaining > 0 && daysLeft > 0
      ? `≈ ${Math.ceil(remaining / daysLeft)} min por dia`
      : null;
  const lastManual = manualEntries[0] ?? null;
  let goalTitle = "Defina sua meta";
  if (hasGoal) {
    goalTitle = reached
      ? "Meta batida"
      : `Faltam ${remaining.toLocaleString("pt-BR")} min`;
  }

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
                {hasGoal ? ` de ${target.toLocaleString("pt-BR")}` : ""} min
              </span>
            </div>
            <span className="text-[#E9C3C4] text-[13px]">
              Cada prateleira soma o tempo real de estudo do dia.
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
                      .filter((item) => day.minutes[item] > 0)
                      .map((item, bookIndex) => (
                        <div
                          className="bancada-book relative w-[14px] shadow-[inset_4px_0_0_rgba(0,0,0,.18)] sm:w-[18px]"
                          key={item}
                          style={{
                            animationDelay: `${dayIndex * 80 + bookIndex * 90}ms`,
                            background: shelfGroupColors[item],
                            height: bookHeight(day.minutes[item]),
                            transition: "height .5s cubic-bezier(.2,.8,.2,1)",
                          }}
                          title={`${shelfGroupLabels[item]}: ${day.minutes[item]} min`}
                        >
                          <span className="absolute top-2 right-px left-px h-0.5 bg-[#D9A86B]" />
                          <span className="absolute right-px bottom-2 left-px h-0.5 bg-[#D9A86B]" />
                        </div>
                      ))}
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[#E9C3C4] text-[13px]">
              {shelfGroups.map((item) => (
                <span className="inline-flex items-center gap-1.5" key={item}>
                  <i
                    className="inline-block h-3.5 w-2.5"
                    style={{ background: shelfGroupColors[item] }}
                  />
                  {shelfGroupLabels[item]}
                </span>
              ))}
            </div>
            <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0">
              <legend className="mb-2 text-[#E9C3C4] text-[13px]">
                Estudou fora da plataforma? Lance o tempo de hoje.
              </legend>
              {shelfGroups.map((item) => (
                <button
                  aria-pressed={group === item}
                  className={cn(
                    "min-h-11 rounded border px-3 text-[13px] transition-colors",
                    group === item
                      ? "border-[#F1EBE8] bg-[#F1EBE8] font-semibold text-[#410230]"
                      : "border-[#7A2446] text-[#E9C3C4] hover:bg-white/10"
                  )}
                  key={item}
                  onClick={() => setGroup(item)}
                  type="button"
                >
                  {shelfGroupLabels[item]}
                </button>
              ))}
              <span aria-hidden="true" className="mx-1 h-6 w-px bg-[#5A2233]" />
              {QUICK_MINUTES.map((value) => (
                <button
                  aria-pressed={minutes === value}
                  className={cn(
                    "min-h-11 rounded border px-3 text-[13px] transition-colors",
                    MONO,
                    minutes === value
                      ? "border-[#D9A86B] bg-[#D9A86B]/20 text-[#F1EBE8]"
                      : "border-[#7A2446] text-[#E9C3C4] hover:bg-white/10"
                  )}
                  key={value}
                  onClick={() => setMinutes(value)}
                  type="button"
                >
                  {value} min
                </button>
              ))}
              <Button
                className="h-11 rounded bg-[#F1EBE8] px-5 font-semibold text-[#410230] hover:bg-white"
                disabled={pending}
                onClick={() =>
                  run(
                    () => addManualStudyEntryAction({ group, minutes }),
                    "Tempo lançado na estante."
                  )
                }
                type="button"
              >
                + Lançar {minutes} min
              </Button>
              <Button
                className="h-11 gap-1.5 rounded border border-[#7A2446] bg-transparent px-4 text-[#E9C3C4] hover:bg-white/10 hover:text-white"
                disabled={pending || !lastManual}
                onClick={() =>
                  lastManual
                    ? run(
                        () => deleteManualStudyEntryAction(lastManual.id),
                        "Último lançamento desfeito."
                      )
                    : undefined
                }
                type="button"
                variant="outline"
              >
                <Undo2Icon aria-hidden="true" className="size-4" />
                Desfazer
              </Button>
            </fieldset>
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

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-lg border border-[#E2D6D1] bg-[#F7F3F1] p-5 sm:p-6">
          <span
            className={cn(
              MONO,
              "text-[#7D5A6C] text-[11px] uppercase tracking-[.2em]"
            )}
          >
            Ampulheta da meta
          </span>
          <div className="flex flex-wrap items-center gap-5">
            <ArchHourglass
              className="h-[206px] w-[150px] shrink-0"
              flowing={hasGoal && !reached}
              glow={0.2 + 0.5 * (1 - fraction)}
              label={
                hasGoal
                  ? `Ampulheta: faltam ${remaining} minutos para a meta semanal`
                  : "Ampulheta aguardando uma meta semanal"
              }
              remaining={fraction}
            />
            <div className="flex min-w-[140px] flex-1 flex-col gap-2">
              <span className="font-display font-semibold text-[#2A0A1A] text-[28px] leading-[1.1]">
                {goalTitle}
              </span>
              <span className={cn(MONO, "text-[#7D5A6C] text-sm")}>
                {pace ??
                  (hasGoal ? "Sobrou tempo para respirar" : "Escolha abaixo")}
              </span>
              <div
                aria-label={`${percent}% da meta semanal`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={percent}
                className="mt-1 h-1.5 overflow-hidden rounded-[3px] bg-[#E7DEDC]"
                role="progressbar"
              >
                <span
                  className="block h-full bg-[#8C1535] transition-[width] duration-700"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span
                className={cn(
                  MONO,
                  "text-[#7D5A6C] text-[11px] uppercase tracking-[.2em]"
                )}
              >
                {studiedMinutes} / {hasGoal ? target : "—"} min
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 border-[#DCD0CF] border-t pt-4">
            <span className="text-[#7D5A6C] text-[13px]">
              Quanto você quer nesta semana?
            </span>
            <div className="flex items-start gap-2.5">
              {weeklyGoalPresets(targetMinutes).map((value, index) => {
                const active = value === targetMinutes;
                return (
                  <button
                    aria-label={`Meta de ${value} minutos`}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-11 flex-1 flex-col items-center gap-0.5 pt-2.5 transition-colors [clip-path:polygon(0_0,100%_0,100%_100%,50%_86%,0_100%)]",
                      MONO,
                      active
                        ? "bg-[#8C1535] text-[#F1EBE8]"
                        : "bg-[#E7DEDC] text-[#4A3340] hover:bg-[#DDD0CC]"
                    )}
                    disabled={pending}
                    key={value}
                    onClick={() =>
                      run(
                        () =>
                          savePlannerGoalAction({
                            period: "WEEKLY",
                            targetMinutes: value,
                          }),
                        "Meta semanal salva."
                      )
                    }
                    style={{ height: 62 + index * 8 }}
                    type="button"
                  >
                    <span className="text-lg">{value}</span>
                    <span className="text-[10px] tracking-[.15em]">MIN</span>
                  </button>
                );
              })}
            </div>
            <span className="text-[#7D5A6C] text-xs">
              Para outro valor, ajuste a meta semanal no cartão abaixo.
            </span>
          </div>
        </div>
      </div>

      {manualEntries.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-[#E2D6D1] bg-[#F7F3F1] p-5 sm:p-6">
          <span
            className={cn(
              MONO,
              "text-[#7D5A6C] text-[11px] uppercase tracking-[.2em]"
            )}
          >
            Lançamentos manuais da semana
          </span>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {manualEntries.map((entry) => (
              <li
                className="flex flex-wrap items-center gap-3 rounded-md border border-[#E2D6D1] bg-[#FBF8F5] px-4 py-2.5"
                key={entry.id}
              >
                <i
                  className="h-8 w-1.5 shrink-0 rounded-[1px]"
                  style={{ background: shelfGroupColors[entry.group] }}
                />
                <span className="min-w-0 flex-1 font-medium text-[#40222F] text-sm">
                  {shelfGroupLabels[entry.group]}
                  <span className="ml-2 font-normal text-[#7D5A6C] text-xs">
                    {entryTimeLabel(entry.at)}
                  </span>
                </span>
                <span className={cn(MONO, "text-[#4A3340] text-[13px]")}>
                  {entry.minutes} min
                </span>
                <Button
                  aria-label={`Remover lançamento de ${entry.minutes} minutos`}
                  className="size-11 text-[#7A5A69] hover:bg-[#F1EBE8]"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => deleteManualStudyEntryAction(entry.id),
                      "Lançamento removido."
                    )
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <XIcon aria-hidden="true" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
