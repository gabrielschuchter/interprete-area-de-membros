"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import {
  GripVerticalIcon,
  PauseIcon,
  PlayIcon,
  SquareIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { useFloatingPosition } from "./use-floating-position";

export type TimerMode =
  | "FOCUS"
  | "SHORT_BREAK"
  | "LONG_BREAK"
  | "STOPWATCH"
  | "COUNTDOWN";

export interface ActiveTimerSnapshot {
  clientId: string | null;
  durationSeconds: number | null;
  elapsedSeconds: number;
  id: string;
  linkedResourceType?: string | null;
  mode: TimerMode;
  pausedAt: string | null;
  remainingSeconds: number | null;
  runStartedAt: string | null;
  startedAt: string;
  title: string | null;
}

const TIMER_POSITION_KEY = "interprete.timer.position";

const labelForMode = (mode: TimerMode) => {
  switch (mode) {
    case "FOCUS":
      return "Foco";
    case "SHORT_BREAK":
      return "Pausa curta";
    case "LONG_BREAK":
      return "Pausa longa";
    case "COUNTDOWN":
      return "Contagem regressiva";
    default:
      return "Cronômetro";
  }
};

const activeStatusLabel = (fromOtherDevice: boolean, paused: boolean) => {
  if (fromOtherDevice) {
    return paused
      ? "Pausado · iniciado em outro aparelho"
      : "Em andamento em outro aparelho";
  }
  return paused ? "Pausado" : "Em andamento";
};

const activeStatusDotClass = (paused: boolean) =>
  paused
    ? "size-2 rounded-full bg-[#BFA9A3]"
    : "size-2 rounded-full bg-[#D62839]";

const activeRemainingTimeLabel = (
  remainingSeconds: number | null,
  displayTime: number
) =>
  remainingSeconds === null
    ? "Cronômetro livre"
    : [clock(displayTime), "restantes"].join(" ");

const clock = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

export const ActiveTimerControls = ({
  active,
  activeFromOtherDevice,
  alarmActive,
  clientId,
  detailsOpen,
  displayTime,
  onClaim,
  onFocus,
  onPauseResume,
  onStop,
  onStopAlarm,
  onToggleDetails,
  pending,
}: {
  readonly active: ActiveTimerSnapshot;
  readonly activeFromOtherDevice: boolean;
  readonly alarmActive: boolean;
  readonly clientId: string | null;
  readonly detailsOpen: boolean;
  readonly displayTime: number;
  readonly onClaim: () => void;
  readonly onFocus: () => void;
  readonly onPauseResume: () => void;
  readonly onStop: () => void;
  readonly onStopAlarm: () => void;
  readonly onToggleDetails: () => void;
  readonly pending: boolean;
}) => {
  const asideRef = useRef<HTMLElement | null>(null);
  const floating = useFloatingPosition(asideRef, TIMER_POSITION_KEY);
  const placed = floating.position;
  // O painel abre para o lado que tem espaço: para cima na metade de baixo
  // da tela, alinhado à esquerda quando a janela está na metade esquerda.
  const opensUp =
    placed !== null &&
    typeof window !== "undefined" &&
    placed.y > window.innerHeight / 2;
  const alignsLeft =
    placed !== null &&
    typeof window !== "undefined" &&
    placed.x < window.innerWidth / 2;

  return (
    <aside
      aria-label="Cronômetro em andamento"
      className={cn(
        "fixed z-30 rounded-full border border-[#D9C8C3] bg-[#FBF8F5] py-1 pr-2 pl-1 shadow-md",
        placed ? null : "top-16 right-3 md:top-1.5 md:right-[156px]",
        floating.dragging && "cursor-grabbing select-none shadow-xl"
      )}
      ref={asideRef}
      style={placed ? { left: placed.x, top: placed.y } : undefined}
    >
      <div className="flex items-center gap-1">
        <button
          aria-label="Mover cronômetro. Arraste, ou use as setas; Home volta ao lugar padrão"
          className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-[#9C8790] hover:bg-[#F1EBE8] hover:text-[#40222F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C1535] active:cursor-grabbing"
          onDoubleClick={floating.reset}
          title="Arraste para mover. Dois cliques voltam ao lugar padrão."
          type="button"
          {...floating.handleProps}
        >
          <GripVerticalIcon aria-hidden="true" className="size-4" />
        </button>
        <button
          aria-expanded={detailsOpen}
          aria-label={
            (active.title || labelForMode(active.mode)) +
            " " +
            clock(displayTime) +
            ". Abrir controles do cronômetro"
          }
          className="flex min-h-9 min-w-0 items-center gap-2 rounded-full px-2 text-[#40222F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C1535]"
          onClick={onToggleDetails}
          type="button"
        >
          <span
            aria-hidden="true"
            className={activeStatusDotClass(Boolean(active.pausedAt))}
          />
          <span className="font-mono font-semibold text-sm tabular-nums tracking-wide">
            {clock(displayTime)}
          </span>
        </button>
        <Button
          aria-label={
            active.pausedAt ? "Retomar cronômetro" : "Pausar cronômetro"
          }
          className="size-8 shrink-0 rounded-full bg-[#8C1535] text-white hover:bg-[#6D102A]"
          disabled={pending || activeFromOtherDevice || !clientId}
          onClick={onPauseResume}
          size="icon-sm"
          type="button"
        >
          {active.pausedAt ? (
            <PlayIcon aria-hidden="true" className="size-3.5 fill-current" />
          ) : (
            <PauseIcon aria-hidden="true" className="size-3.5" />
          )}
        </Button>
      </div>
      {alarmActive && (
        <Button
          className="mt-1 min-h-8 w-full text-[#8C1535]"
          onClick={onStopAlarm}
          size="sm"
          type="button"
          variant="outline"
        >
          Parar alarme
        </Button>
      )}
      {detailsOpen && (
        <div
          className={cn(
            "absolute flex w-[min(340px,calc(100vw-1.5rem))] flex-wrap items-center justify-end gap-2 rounded-xl border border-[#E2D6D1] bg-[#FBF8F5] p-4 shadow-xl",
            opensUp ? "bottom-full mb-2" : "top-full mt-2",
            alignsLeft ? "left-0" : "right-0"
          )}
        >
          {/* Linha inteira: com flex-1 e base 0 o texto encolhia até caber uma letra por linha. */}
          <div className="w-full min-w-0">
            <p className="font-display text-[#40222F] text-lg">
              {active.title || labelForMode(active.mode)}
            </p>
            <p className="text-[#7A5A69] text-xs">
              {activeRemainingTimeLabel(active.remainingSeconds, displayTime)} ·{" "}
              {activeStatusLabel(
                activeFromOtherDevice,
                Boolean(active.pausedAt)
              )}
            </p>
          </div>
          {activeFromOtherDevice && (
            <Button
              disabled={pending || !clientId}
              onClick={onClaim}
              size="sm"
              type="button"
            >
              Continuar neste aparelho
            </Button>
          )}
          {active.linkedResourceType === "LIBRARY_ITEM" ? (
            <Button
              className="text-[#8C1535]"
              disabled={pending || !clientId}
              onClick={onStop}
              size="sm"
              type="button"
              variant="outline"
            >
              Terminei de ler
            </Button>
          ) : (
            <Button
              aria-label="Encerrar cronômetro"
              className="text-[#8C1535]"
              disabled={pending || activeFromOtherDevice || !clientId}
              onClick={onStop}
              size="icon"
              type="button"
              variant="outline"
            >
              <SquareIcon aria-hidden="true" className="size-4" />
            </Button>
          )}
          <Button
            disabled={activeFromOtherDevice}
            onClick={onFocus}
            size="sm"
            type="button"
            variant="outline"
          >
            Foco
          </Button>
          <Button asChild size="sm" type="button">
            <Link href="/ferramentas?view=timer">Abrir Ferramentas</Link>
          </Button>
        </div>
      )}
    </aside>
  );
};
