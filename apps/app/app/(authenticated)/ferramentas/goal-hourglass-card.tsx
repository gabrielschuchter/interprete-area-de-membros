"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { useState } from "react";
import {
  type CountGoalsOverview,
  countGoalHelp,
  countGoalKinds,
  countGoalLabels,
  countGoalPresets,
  countGoalUnit,
  type GoalMode,
  goalProgress,
} from "@/lib/study-count-goals-model";
import {
  hourglassRemainingFraction,
  weeklyGoalPresets,
} from "@/lib/study-week-shelf-model";
import { ArchHourglass } from "./arch-hourglass";
import {
  deleteCountGoalAction,
  saveCountGoalAction,
} from "./count-goal-actions";
import { savePlannerGoalAction } from "./planner-actions";

const MONO = "font-data";
const MODES: readonly GoalMode[] = ["MINUTES", ...countGoalKinds];

const modeLabel = (mode: GoalMode) =>
  mode === "MINUTES" ? "Tempo" : countGoalLabels[mode];

const saveFor = (mode: GoalMode, value: number) =>
  mode === "MINUTES"
    ? savePlannerGoalAction({ period: "WEEKLY", targetMinutes: value })
    : saveCountGoalAction({ kind: mode, target: value });

export interface GoalHourglassCardProps {
  readonly countGoals: CountGoalsOverview;
  readonly daysLeft: number;
  readonly pending: boolean;
  readonly run: (task: () => Promise<unknown>, success?: string) => void;
  readonly studiedMinutes: number;
  readonly targetMinutes: number | null;
}

const GoalTypeTabs = ({
  mode,
  onChange,
}: {
  readonly mode: GoalMode;
  readonly onChange: (next: GoalMode) => void;
}) => (
  <fieldset className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0">
    <legend className="sr-only">Tipo de meta semanal</legend>
    {MODES.map((item) => (
      <button
        aria-pressed={mode === item}
        className={cn(
          "min-h-11 flex-1 rounded border px-3 text-[13px] transition-colors",
          mode === item
            ? "border-[#8C1535] bg-[#8C1535] font-semibold text-[#F1EBE8]"
            : "border-[#DCD0CF] bg-[#FBF8F5] text-[#4A3340] hover:bg-[#F1EBE8]"
        )}
        key={item}
        onClick={() => onChange(item)}
        type="button"
      >
        {modeLabel(item)}
      </button>
    ))}
  </fieldset>
);

const paceLabel = (mode: GoalMode, remaining: number, daysLeft: number) => {
  if (remaining <= 0 || daysLeft <= 0) {
    return null;
  }
  const amount = Math.ceil(remaining / daysLeft);
  const unit = mode === "MINUTES" ? "min" : countGoalUnit(mode, amount);
  return `≈ ${amount} ${unit} por dia`;
};

const GoalTargets = ({
  current,
  mode,
  pending,
  run,
}: {
  readonly current: number | null;
  readonly mode: GoalMode;
  readonly pending: boolean;
  readonly run: GoalHourglassCardProps["run"];
}) => {
  const [custom, setCustom] = useState("");
  const presets =
    mode === "MINUTES"
      ? weeklyGoalPresets(current)
      : countGoalPresets(mode, current);
  const number = Number.parseInt(custom, 10);
  const valid =
    Number.isInteger(number) &&
    number >= 1 &&
    number <= (mode === "MINUTES" ? 10_080 : 1000);
  const unitWord = (value: number) =>
    mode === "MINUTES" ? "minutos" : countGoalUnit(mode, value);

  return (
    <>
      <div className="flex items-start gap-2.5">
        {presets.map((value, index) => (
          <button
            aria-label={`Meta de ${value} ${unitWord(value)}`}
            aria-pressed={value === current}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center gap-0.5 pt-2.5 transition-colors [clip-path:polygon(0_0,100%_0,100%_100%,50%_86%,0_100%)]",
              MONO,
              value === current
                ? "bg-[#8C1535] text-[#F1EBE8]"
                : "bg-[#E7DEDC] text-[#4A3340] hover:bg-[#DDD0CC]"
            )}
            disabled={pending}
            key={value}
            onClick={() =>
              run(() => saveFor(mode, value), "Meta semanal salva.")
            }
            style={{ height: 62 + index * 8 }}
            type="button"
          >
            <span className="text-lg">{value}</span>
            <span className="text-[10px] tracking-[.15em]">
              {mode === "MINUTES" ? "MIN" : "QTD"}
            </span>
          </button>
        ))}
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) {
            run(() => saveFor(mode, number), "Meta semanal salva.");
            setCustom("");
          }
        }}
      >
        <label className="sr-only" htmlFor="week-goal-custom">
          Outro valor para a meta
        </label>
        <input
          className="h-11 min-w-0 flex-1 rounded border border-[#DCD0CF] bg-[#FBF8F5] px-3 text-[#2A0A1A] text-sm"
          id="week-goal-custom"
          inputMode="numeric"
          onChange={(event) => setCustom(event.target.value.replace(/\D/g, ""))}
          placeholder={
            mode === "MINUTES" ? "Outro valor em min" : "Outro valor"
          }
          value={custom}
        />
        <Button
          className="h-11 rounded bg-[#8C1535] px-4 text-[#F1EBE8] hover:bg-[#6F1029]"
          disabled={pending || !valid}
          type="submit"
        >
          Salvar
        </Button>
      </form>
    </>
  );
};

const CountGoalNote = ({
  hasGoal,
  kind,
  pending,
  run,
}: {
  readonly hasGoal: boolean;
  readonly kind: Exclude<GoalMode, "MINUTES">;
  readonly pending: boolean;
  readonly run: GoalHourglassCardProps["run"];
}) => (
  <>
    <span className="text-[#7D5A6C] text-xs">{countGoalHelp[kind]}</span>
    {hasGoal ? (
      <button
        className="self-start text-[#8C1535] text-xs underline underline-offset-2"
        disabled={pending}
        onClick={() => run(() => deleteCountGoalAction(kind), "Meta removida.")}
        type="button"
      >
        Remover esta meta
      </button>
    ) : null}
  </>
);

export const GoalHourglassCard = ({
  countGoals,
  daysLeft,
  pending,
  run,
  studiedMinutes,
  targetMinutes,
}: GoalHourglassCardProps) => {
  const [mode, setMode] = useState<GoalMode>("MINUTES");
  const progress = goalProgress(
    mode,
    { studied: studiedMinutes, target: targetMinutes },
    countGoals
  );
  const fraction = progress.hasGoal
    ? hourglassRemainingFraction(progress.studied, progress.target)
    : 1;
  const label = modeLabel(mode).toLowerCase();
  const pace = paceLabel(mode, progress.remaining, daysLeft);
  const current = progress.hasGoal ? progress.target : null;

  return (
    <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-lg border border-[#E2D6D1] bg-[#F7F3F1] p-5 sm:p-6">
      <span
        className={cn(
          MONO,
          "text-[#7D5A6C] text-[11px] uppercase tracking-[.2em]"
        )}
      >
        Ampulheta da meta
      </span>
      <GoalTypeTabs mode={mode} onChange={setMode} />
      <div className="flex flex-wrap items-center gap-5">
        <ArchHourglass
          className="h-[206px] w-[150px] shrink-0"
          flowing={progress.hasGoal && !progress.reached}
          glow={0.2 + 0.5 * (1 - fraction)}
          label={
            progress.hasGoal
              ? `Ampulheta: faltam ${progress.remaining} ${progress.unit} para a meta semanal de ${label}`
              : "Ampulheta aguardando uma meta semanal"
          }
          remaining={fraction}
        />
        <div className="flex min-w-[140px] flex-1 flex-col gap-2">
          <span className="font-display font-semibold text-[#2A0A1A] text-[28px] leading-[1.1]">
            {progress.title}
          </span>
          <span className={cn(MONO, "text-[#7D5A6C] text-sm")}>
            {pace ??
              (progress.hasGoal
                ? "Sobrou tempo para respirar"
                : "Escolha abaixo")}
          </span>
          <div
            aria-label={`${progress.percent}% da meta semanal de ${label}`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress.percent}
            className="mt-1 h-1.5 overflow-hidden rounded-[3px] bg-[#E7DEDC]"
            role="progressbar"
          >
            <span
              className="block h-full bg-[#8C1535] transition-[width] duration-700"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span
            className={cn(
              MONO,
              "text-[#7D5A6C] text-[11px] uppercase tracking-[.2em]"
            )}
          >
            {progress.studied} / {progress.hasGoal ? progress.target : "—"}{" "}
            {progress.unitTotal}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 border-[#DCD0CF] border-t pt-4">
        <span className="text-[#7D5A6C] text-[13px]">
          {mode === "MINUTES"
            ? "Quanto você quer estudar nesta semana?"
            : `Quantas ${label} nesta semana?`}
        </span>
        <GoalTargets
          current={current}
          key={mode}
          mode={mode}
          pending={pending}
          run={run}
        />
        {mode === "MINUTES" ? null : (
          <CountGoalNote
            hasGoal={progress.hasGoal}
            kind={mode}
            pending={pending}
            run={run}
          />
        )}
      </div>
    </div>
  );
};
