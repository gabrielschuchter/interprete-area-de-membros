"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  TargetIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SessionReviewDialog, useLessonTimer } from "../lesson-tools-drawer";
import { roomText } from "./room-copy";

type TimerTab = "countdown" | "pomodoro" | "stopwatch";

interface PomodoroProgress {
  readonly doneToday: number;
  readonly perRound: number;
}

const tabs: readonly { key: TimerTab; label: string }[] = [
  { key: "stopwatch", label: roomText("tempoStopwatch") },
  { key: "pomodoro", label: roomText("tempoPomodoro") },
  { key: "countdown", label: roomText("tempoCountdown") },
];

const tabOfMode = (mode: string): TimerTab => {
  if (mode === "STOPWATCH") {
    return "stopwatch";
  }
  return mode === "COUNTDOWN" ? "countdown" : "pomodoro";
};

const formatClock = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${String(minutes).padStart(2, "0")}:${rest}`;
};

const todayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    date
  );

// "Foco n de total" needs today's completed focus sessions, which only the
// full timer state carries.
const usePomodoroProgress = (refreshKey: string | null) => {
  const [progress, setProgress] = useState<PomodoroProgress>({
    doneToday: 0,
    perRound: 4,
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: refetch when the active session changes
  useEffect(() => {
    let current = true;
    fetch("/api/focus-timer", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          state: {
            history?: { completedAt: string | null; mode: string }[];
            settings?: { longBreakEvery?: number };
          } | null
        ) => {
          if (!(current && state)) {
            return;
          }
          const today = todayKey(new Date());
          setProgress({
            doneToday: (state.history ?? []).filter(
              ({ completedAt, mode }) =>
                mode === "FOCUS" &&
                completedAt !== null &&
                todayKey(new Date(completedAt)) === today
            ).length,
            perRound: state.settings?.longBreakEvery ?? 4,
          });
        }
      )
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [refreshKey]);
  return progress;
};

type RoomTimer = ReturnType<typeof useLessonTimer>;

const TimerPrimaryButton = ({
  active,
  onStart,
  timer,
}: {
  readonly active: RoomTimer["active"];
  readonly onStart: () => void;
  readonly timer: RoomTimer;
}) => {
  const className = "room-button room-button--primary room-time__primary";
  if (!active) {
    return (
      <button
        className={className}
        disabled={
          timer.pending ||
          timer.timerLoading ||
          !timer.clientId ||
          Boolean(timer.review)
        }
        onClick={onStart}
        type="button"
      >
        <PlayIcon aria-hidden="true" fill="currentColor" size={14} />
        {roomText("tempoStart")}
      </button>
    );
  }
  if (timer.activeFromOtherDevice) {
    return (
      <button
        className={className}
        disabled={timer.pending || !timer.clientId}
        onClick={() =>
          timer.clientId &&
          timer.sendTimerAction({
            action: "claim",
            clientId: timer.clientId,
            sessionId: active.id,
          })
        }
        type="button"
      >
        {roomText("tempoClaim")}
      </button>
    );
  }
  const paused = Boolean(active.pausedAt);
  return (
    <button
      className={className}
      disabled={timer.pending}
      onClick={() =>
        timer.sendTimerAction({ action: paused ? "resume" : "pause" })
      }
      type="button"
    >
      {paused ? (
        <PlayIcon aria-hidden="true" fill="currentColor" size={14} />
      ) : (
        <PauseIcon aria-hidden="true" size={14} />
      )}
      {roomText(paused ? "tempoResume" : "tempoPause")}
    </button>
  );
};

const TimerMenu = ({
  active,
  lessonId,
  linkedHere,
  timer,
}: {
  readonly active: RoomTimer["active"];
  readonly lessonId: string;
  readonly linkedHere: boolean;
  readonly timer: RoomTimer;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        aria-label={roomText("tempoSettings")}
        className="room-time__more"
        type="button"
      >
        <MoreHorizontalIcon aria-hidden="true" size={18} />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="room-menu">
      <DropdownMenuItem asChild>
        <Link href="/ferramentas?view=timer&settings=1">
          {roomText("tempoSettings")}
        </Link>
      </DropdownMenuItem>
      {active && !timer.activeFromOtherDevice ? (
        <DropdownMenuItem
          onSelect={() => timer.sendTimerAction({ action: "stop" })}
        >
          {roomText("tempoReset")}
        </DropdownMenuItem>
      ) : null}
      {active && !linkedHere ? (
        <DropdownMenuItem
          onSelect={() =>
            timer.sendTimerAction({
              action: "link",
              linkedResourceId: lessonId,
            })
          }
        >
          {roomText("tempoLinkHere")}
        </DropdownMenuItem>
      ) : null}
    </DropdownMenuContent>
  </DropdownMenu>
);

// The room reuses the existing timer as is: same /api/focus-timer session,
// same review step and same link to the lesson. Modes map to the modes the
// timer already has (stopwatch, focus, countdown).
export const RoomTimePanel = ({ lessonId }: { readonly lessonId: string }) => {
  const timer = useLessonTimer(lessonId, true);
  const [chosen, setChosen] = useState<TimerTab>("pomodoro");
  const [countdownMinutes, setCountdownMinutes] = useState(25);
  const { active } = timer;
  const progress = usePomodoroProgress(active?.id ?? "idle");

  const tab = active ? tabOfMode(active.mode) : chosen;
  const linkedHere = active
    ? active.linkedResourceId === lessonId
    : timer.linkedOnStart;
  const linkedElsewhere = Boolean(
    active?.linkedResourceId && active.linkedResourceId !== lessonId
  );
  const onBreak =
    active?.mode === "SHORT_BREAK" || active?.mode === "LONG_BREAK";

  let idleSeconds = 0;
  if (tab === "pomodoro") {
    idleSeconds = timer.focusMinutes * 60;
  } else if (tab === "countdown") {
    idleSeconds = countdownMinutes * 60;
  }
  const seconds = active ? timer.seconds : idleSeconds;
  const round = (progress.doneToday % progress.perRound) + 1;

  const start = (linked: boolean) => {
    if (!timer.clientId) {
      return;
    }
    const durations = {
      countdown: countdownMinutes * 60,
      pomodoro: timer.focusMinutes * 60,
      stopwatch: null,
    } as const;
    const modes = {
      countdown: "COUNTDOWN",
      pomodoro: "FOCUS",
      stopwatch: "STOPWATCH",
    } as const;
    timer.sendTimerAction({
      action: "start",
      clientId: timer.clientId,
      durationSeconds: durations[tab],
      linkedResourceId: linked ? lessonId : null,
      mode: modes[tab],
    });
  };

  const primary = (
    <TimerPrimaryButton
      active={active}
      onStart={() => start(true)}
      timer={timer}
    />
  );

  let chip = roomText("tempoLinkedLesson");
  if (!linkedHere) {
    chip = roomText("tempoUnlinked");
  }
  if (linkedElsewhere) {
    chip = roomText("tempoLinkedOther");
  }

  return (
    <div className="room-time">
      <div className="room-time__modes">
        {tabs.map(({ key, label }) => (
          <button
            aria-pressed={tab === key}
            className="room-time__mode"
            disabled={Boolean(active) && tab !== key}
            key={key}
            onClick={() => setChosen(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="room-time__card">
        <span
          className="room-time__link-chip"
          data-muted={linkedHere && !linkedElsewhere ? undefined : "true"}
        >
          {chip}
        </span>
        <p
          aria-label={roomText("tempoClockAria")}
          className="room-time__clock"
          role="timer"
        >
          {formatClock(seconds)}
        </p>
        {tab === "pomodoro" ? (
          <div className="room-time__context">
            <span aria-hidden="true" className="room-time__dots">
              {Array.from({ length: progress.perRound }, (_, index) => (
                <span
                  data-on={index === round - 1 ? "true" : undefined}
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative dots
                  key={index}
                />
              ))}
            </span>
            <span className="room-time__context-label">
              {onBreak
                ? roomText("tempoBreak")
                : roomText("tempoRound", {
                    n: round,
                    total: progress.perRound,
                  })}
            </span>
          </div>
        ) : null}
        {tab === "countdown" && !active ? (
          <label className="room-time__duration">
            {roomText("tempoSetDuration")}
            <input
              inputMode="numeric"
              max={180}
              min={1}
              onChange={(event) =>
                setCountdownMinutes(
                  Math.min(180, Math.max(1, Number(event.target.value) || 1))
                )
              }
              type="number"
              value={countdownMinutes}
            />
            min
          </label>
        ) : null}
        <div className="room-time__buttons">
          {primary}
          <TimerMenu
            active={active}
            lessonId={lessonId}
            linkedHere={linkedHere}
            timer={timer}
          />
        </div>
      </div>

      {active ? null : (
        <button
          className="room-time__text-link"
          disabled={timer.pending || timer.timerLoading || !timer.clientId}
          onClick={() => start(false)}
          type="button"
        >
          {roomText("tempoWithoutLink")}
        </button>
      )}
      <p className="room-time__hint">{roomText("tempoFocusHint")}</p>
      <Link
        className="room-button room-button--secondary room-time__focus"
        href="/ferramentas?view=timer"
      >
        <TargetIcon aria-hidden="true" size={16} />
        {roomText("tempoFocusCta")}
      </Link>

      <SessionReviewDialog
        note={timer.reviewNote}
        pending={timer.pending}
        review={timer.review}
        reviewSession={timer.reviewSession}
        setNote={timer.setReviewNote}
      />
    </div>
  );
};
