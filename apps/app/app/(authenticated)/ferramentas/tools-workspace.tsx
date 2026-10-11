"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { toast } from "@repo/design-system/lib/toast";

import {
  Clock3Icon,
  DownloadIcon,
  FilePlus2Icon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  Settings2Icon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react";
import dynamic from "next/dynamic";

import {
  type Dispatch,
  memo,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  playTimerCompletionAlarm,
  playTimerCompletionSound,
  playTimerTick,
  startTimerTitleAlert,
  stopTimerCompletionAlarm,
  unlockTimerAudio,
} from "@/components/focus-timer-audio";
import {
  type MemberViewOption,
  MemberViewSwitcher,
} from "@/components/navigation/member-view-switcher";
import type { getFocusTimerState } from "@/lib/focus-timer";
import type { getPlannerNotes } from "@/lib/planner-notes";

type NotesData = Awaited<ReturnType<typeof getPlannerNotes>>;
const NotesWorkspace = dynamic(
  () => import("./notes-workspace").then((module) => module.NotesWorkspace),
  {
    loading: () => (
      <output
        aria-busy="true"
        className="grid min-h-64 place-items-center rounded-xl border border-[#E2D6D1] bg-[#FBF8F5] text-[#7A5A69] text-sm"
      >
        Carregando suas notas…
      </output>
    ),
  }
);

type TimerServerState = Awaited<ReturnType<typeof getFocusTimerState>>;
interface TimerLinkResource {
  readonly context: string;
  readonly href: string;
  readonly id: string;
  readonly shortLabel?: string;
  readonly title: string;
  readonly type: "LESSON";
}
type TimerMode =
  | "FOCUS"
  | "SHORT_BREAK"
  | "LONG_BREAK"
  | "STOPWATCH"
  | "COUNTDOWN";
type TimerExperience = "POMODORO" | "STOPWATCH" | "COUNTDOWN";
interface ActiveTimer {
  clientId: string | null;
  durationSeconds: number | null;
  elapsedSeconds: number;
  id: string;
  linkedResourceId?: string | null;
  linkedResourceType?: string | null;
  mode: TimerMode;
  pausedAt: string | null;
  remainingSeconds: number | null;
  runStartedAt: string | null;
  startedAt: string;
  title: string | null;
}
interface TimerSettings {
  focusMinutes: number;
  keepScreenAwake: boolean;
  longBreakEvery: number;
  longBreakMinutes: number;
  shortBreakMinutes: number;
  systemNotificationsEnabled: boolean;
  timerAutoAdvance: boolean;
  timerOpenFocusOnStart: boolean;
  timerSoundEnabled: boolean;
  timerSoundType: "SOFT_BELL" | "WOOD" | "DIGITAL" | "NONE";
  timerTickEnabled: boolean;
  timerVibrationEnabled: boolean;
  timerVolume: number;
  timezone: string;
}

type FocusTimerAction =
  | {
      action: "start";
      clientId: string;
      mode: TimerMode;
      durationSeconds?: number;
      title?: string | null;
    }
  | { action: "pause" | "resume" | "stop" }
  | { action: "claim"; sessionId: string; clientId: string }
  | { action: "link"; linkedResourceId: string | null }
  | { action: "review"; id: string; note: string; saveStudy: boolean }
  | {
      action: "history-add" | "history-update";
      session: Record<string, unknown>;
    }
  | { action: "history-delete"; id: string }
  | { action: "settings"; settings: TimerSettings };
const defaultTimerSettings: TimerSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  timerSoundEnabled: true,
  systemNotificationsEnabled: false,
  timerSoundType: "SOFT_BELL",
  timerVolume: 70,
  timerTickEnabled: false,
  timerVibrationEnabled: true,
  timerAutoAdvance: false,
  timerOpenFocusOnStart: false,
  keepScreenAwake: true,
  timezone: "America/Sao_Paulo",
};
interface TimerHistoryItem {
  completedAt: Date | string | null;
  durationSeconds: number | null;
  elapsedBeforePause: number;
  endedAt: Date | string | null;
  id: string;
  linkedResourceId: string | null;
  linkedResourceType: string | null;
  manuallyEntered: boolean;
  mode: TimerMode;
  sessionNote: string | null;
  startedAt: Date | string;
  title: string | null;
}
interface TimerReviewItem {
  elapsedBeforePause: number;
  endedAt: Date | string | null;
  id: string;
  linkedResourceId: string | null;
  linkedResourceType: string | null;
  mode: TimerMode;
  sessionNote: string | null;
  startedAt: Date | string;
  title: string | null;
}
interface TimerClientState {
  active: ActiveTimer | null;
  completed: {
    id: string;
    mode: TimerMode;
    completed: boolean;
    elapsedSeconds: number;
    nextMode?: TimerMode;
    nextDurationSeconds?: number;
  } | null;
  history: TimerHistoryItem[];
  pendingReview: TimerReviewItem | null;
  settings: TimerSettings;
  statistics: {
    last30DaysSeconds: number;
    last30DaysSessions: number;
    last7Days: Array<{ dayKey: string; seconds: number; sessions: number }>;
    weeklyGoalTargetMinutes: number | null;
    weeklyStudySeconds: number;
    byLink: Array<{
      linkedResourceId: string | null;
      seconds: number;
      sessions: number;
    }>;
  };
}

const textDate = (value: Date | string | null | undefined) => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

const modeNames: Record<TimerMode, string> = {
  FOCUS: "Foco",
  SHORT_BREAK: "Pausa curta",
  LONG_BREAK: "Pausa longa",
  STOPWATCH: "Cronômetro livre",
  COUNTDOWN: "Contagem regressiva",
};

const clientIdPattern = /^[\da-f-]{36}$/i;

const experienceForMode = (mode: TimerMode | undefined): TimerExperience => {
  if (mode === "STOPWATCH") {
    return "STOPWATCH";
  }
  if (mode === "COUNTDOWN") {
    return "COUNTDOWN";
  }
  return "POMODORO";
};

function experienceLabel(experience: TimerExperience) {
  switch (experience) {
    case "POMODORO":
      return "Pomodoro";
    case "STOPWATCH":
      return "Cronômetro";
    case "COUNTDOWN":
      return "Contagem regressiva";
    default:
      return "Pomodoro";
  }
}

function timerHeading(
  state: TimerClientState,
  experience: TimerExperience,
  linkResources: readonly TimerLinkResource[]
) {
  const linkedTitle = linkResources.find(
    (resource) => resource.id === state.active?.linkedResourceId
  )?.title;
  if (state.active?.title) {
    return state.active.title;
  }
  if (linkedTitle) {
    return linkedTitle;
  }
  if (state.active) {
    return modeNames[state.active.mode];
  }
  return experience === "POMODORO" ? "Pomodoro" : modeNames[experience];
}

function timerStatusDescription(active: ActiveTimer | null) {
  if (active?.pausedAt) {
    return "Pausado. Retome quando estiver pronto.";
  }
  if (active) {
    return "Sua sessão está sincronizada com sua conta.";
  }
  return "Escolha uma sessão e comece no seu tempo.";
}

function timerProgressStatus(active: ActiveTimer | null) {
  if (active?.pausedAt) {
    return "Pausado";
  }
  if (active) {
    return "Em andamento";
  }
  return "Pronto para começar";
}

function getCompletionMessage(mode: TimerMode) {
  if (mode === "FOCUS") {
    return "Foco concluído.";
  }
  if (mode === "SHORT_BREAK" || mode === "LONG_BREAK") {
    return "Pausa concluída.";
  }
  return "Sessão concluída.";
}

function notificationPermissionDescription(
  permission: NotificationPermission | "unsupported"
) {
  switch (permission) {
    case "granted":
      return "Ativadas neste navegador";
    case "denied":
      return "Bloqueadas nas configurações do navegador";
    case "default":
      return "Permissão ainda não solicitada";
    case "unsupported":
      return "Este navegador não oferece notificações do sistema";
    default:
      return "Este navegador não oferece notificações do sistema";
  }
}

function runTimerCompletionAlerts(
  settings: TimerSettings,
  sessionId: string,
  stopAlarm: () => void,
  activateAlarm: () => void
) {
  stopAlarm();
  playTimerCompletionAlarm(settings);
  if (
    settings.timerSoundEnabled &&
    settings.timerSoundType !== "NONE" &&
    settings.timerVolume > 0
  ) {
    activateAlarm();
  }
  startTimerTitleAlert();
  if (
    settings.timerVibrationEnabled &&
    typeof navigator !== "undefined" &&
    "vibrate" in navigator
  ) {
    navigator.vibrate([180, 70, 180]);
  }
  if (
    settings.systemNotificationsEnabled &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification("Sessão concluída", {
      body: "Seu tempo de foco foi salvo no seu histórico de estudo.",
      tag: `focus-timer-${sessionId}`,
    });
  }
}

const dateTimeInputInTimezone = (value: Date | string, timezone: string) => {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
};

const isoFromDateTimeInput = (value: string, timezone: string) => {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = (datePart ?? "").split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const read = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    guess +=
      target -
      Date.UTC(
        read("year"),
        read("month") - 1,
        read("day"),
        read("hour"),
        read("minute"),
        read("second")
      );
  }
  return new Date(guess).toISOString();
};

const clientError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const responseJson = async <T,>(response: Response): Promise<T> => {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Não foi possível concluir esta ação.");
  }
  return payload;
};

function FocusTimerWorkspace({
  initialFocusMode,
  initialSettingsOpen,
  initialTimer,
  linkResources,
}: {
  readonly initialFocusMode: boolean;
  readonly initialSettingsOpen: boolean;
  readonly initialTimer: TimerServerState;
  readonly linkResources: readonly TimerLinkResource[];
}) {
  const [state, setState] = useState<TimerClientState>(
    initialTimer as TimerClientState
  );
  const [clientId, setClientId] = useState<string | null>(null);
  const [experience, setExperience] = useState<TimerExperience>(
    experienceForMode(initialTimer.active?.mode)
  );
  const [countdownMinutes, setCountdownMinutes] = useState(
    initialTimer.settings.focusMinutes
  );
  const [sessionName, setSessionName] = useState("");
  const [linkedResourceId, setLinkedResourceId] = useState("");
  const [tick, setTick] = useState(Date.now());
  const [syncedAt, setSyncedAt] = useState(Date.now());
  const [pending, setPending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);
  const [settingsDraft, setSettingsDraft] = useState<TimerSettings>(
    initialTimer.settings as TimerSettings
  );
  const [announcement, setAnnouncement] = useState("");
  const [focusMode, setFocusMode] = useState(initialFocusMode);
  const [confirmFocusExit, setConfirmFocusExit] = useState(false);
  const [sessionReview, setSessionReview] = useState<{
    id: string;
    note: string;
  } | null>(() =>
    initialTimer.pendingReview
      ? {
          id: initialTimer.pendingReview.id,
          note: initialTimer.pendingReview.sessionNote ?? "",
        }
      : null
  );
  const [phasePrompt, setPhasePrompt] = useState<{
    mode: TimerMode;
    durationSeconds: number;
  } | null>(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(8);
  const [historyDraft, setHistoryDraft] = useState<{
    elapsedMinutes: string;
    id: string | null;
    linkedResourceId: string;
    note: string;
    startedAt: string;
    title: string;
  } | null>(null);
  const [historyDeleteTarget, setHistoryDeleteTarget] = useState<string | null>(
    null
  );
  const alarmTimeoutRef = useRef<number | null>(null);
  const lastCompletedId = useRef<string | null>(null);

  useEffect(() => {
    const storageKey = "interprete:focus-timer-client";
    try {
      const existing = window.localStorage.getItem(storageKey);
      if (existing && clientIdPattern.test(existing)) {
        setClientId(existing);
        return;
      }
      const next = window.crypto.randomUUID();
      window.localStorage.setItem(storageKey, next);
      setClientId(next);
    } catch {
      setClientId(window.crypto.randomUUID());
    }
  }, []);

  const stopAlarm = useCallback(() => {
    stopTimerCompletionAlarm();
    if (alarmTimeoutRef.current !== null) {
      window.clearTimeout(alarmTimeoutRef.current);
      alarmTimeoutRef.current = null;
    }
    setAlarmActive(false);
  }, []);

  const applyState = useCallback((next: TimerClientState) => {
    setState(next);
    setSyncedAt(Date.now());
    setSessionReview((current) => {
      if (!next.pendingReview) {
        return null;
      }
      return current?.id === next.pendingReview.id
        ? current
        : {
            id: next.pendingReview.id,
            note: next.pendingReview.sessionNote ?? "",
          };
    });
    if (next.active) {
      setExperience(experienceForMode(next.active.mode));
    }
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/focus-timer", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    applyState(await responseJson<TimerClientState>(response));
  }, [applyState]);

  const notifyCompletion = useCallback(
    (completed: TimerClientState["completed"]) => {
      if (!completed?.completed || lastCompletedId.current === completed.id) {
        return;
      }
      lastCompletedId.current = completed.id;
      const completionMessage = getCompletionMessage(completed.mode);
      if (completed.mode === "FOCUS" && !state.settings.timerAutoAdvance) {
        const focusTodayKey = new Intl.DateTimeFormat("en-CA", {
          timeZone: state.settings.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        const focusSessionsToday =
          state.history.filter(
            (item) =>
              item.mode === "FOCUS" &&
              item.id !== completed.id &&
              item.endedAt &&
              new Intl.DateTimeFormat("en-CA", {
                timeZone: state.settings.timezone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date(item.endedAt)) === focusTodayKey
          ).length + 1;
        const mode: TimerMode =
          completed.nextMode ??
          (focusSessionsToday % state.settings.longBreakEvery === 0
            ? "LONG_BREAK"
            : "SHORT_BREAK");
        const durationSeconds =
          completed.nextDurationSeconds ??
          (mode === "LONG_BREAK"
            ? state.settings.longBreakMinutes
            : state.settings.shortBreakMinutes) * 60;
        setPhasePrompt({ mode, durationSeconds });
        const message = `Foco concluído. Hora da pausa de ${Math.round(durationSeconds / 60)} minutos.`;
        setAnnouncement(message);
        toast.success(message);
      } else {
        setPhasePrompt(null);
        setAnnouncement(completionMessage);
        toast.success(
          `${completionMessage} O tempo foi salvo no histórico de estudo.`
        );
      }
      runTimerCompletionAlerts(state.settings, completed.id, stopAlarm, () => {
        setAlarmActive(true);
        alarmTimeoutRef.current = window.setTimeout(
          () => setAlarmActive(false),
          20_000
        );
      });
    },
    [state.history, state.settings, stopAlarm]
  );

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (
      !state.active ||
      state.active.pausedAt ||
      state.active.mode !== "FOCUS" ||
      !state.settings.timerTickEnabled
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        playTimerTick(state.settings);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [
    state.active?.id,
    state.active?.mode,
    state.active?.pausedAt,
    state.settings.timerSoundEnabled,
    state.settings.timerSoundType,
    state.settings.timerTickEnabled,
    state.settings.timerVolume,
    state.settings,
    state.active,
  ]);

  useEffect(() => {
    if (!state.active) {
      return;
    }
    const interval = window.setInterval(() => {
      refresh()
        .then(() => undefined)
        .catch(() => undefined);
    }, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, state.active]);

  useEffect(() => {
    notifyCompletion(state.completed);
  }, [notifyCompletion, state.completed]);

  useEffect(() => {
    if (
      !state.active ||
      state.active.pausedAt ||
      !state.settings.keepScreenAwake
    ) {
      return;
    }
    const wakeNavigator = navigator as Navigator & {
      wakeLock?: {
        request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
      };
    };
    if (!wakeNavigator.wakeLock) {
      return;
    }
    let lock: { release: () => Promise<void> } | null = null;
    wakeNavigator.wakeLock
      .request("screen")
      .then((next) => {
        lock = next;
      })
      .catch(() => undefined);
    return () => {
      if (lock) {
        lock.release().catch(() => undefined);
      }
    };
  }, [
    state.active?.id,
    state.active?.pausedAt,
    state.settings.keepScreenAwake,
    state.active,
  ]);

  const elapsed = state.active
    ? state.active.elapsedSeconds +
      (state.active.runStartedAt ? Math.floor((tick - syncedAt) / 1000) : 0)
    : 0;
  let shownSeconds = elapsed;
  if (state.active?.durationSeconds) {
    shownSeconds = Math.max(0, state.active.durationSeconds - elapsed);
  } else if (!state.active && experience !== "STOPWATCH") {
    const minutes =
      experience === "COUNTDOWN"
        ? countdownMinutes
        : settingsDraft.focusMinutes;
    shownSeconds = minutes * 60;
  }
  const progress = state.active?.durationSeconds
    ? Math.min(1, elapsed / state.active.durationSeconds)
    : 0;
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: state.settings.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayHistory = useMemo(
    () =>
      state.history.filter(
        (item) =>
          item.endedAt &&
          new Intl.DateTimeFormat("en-CA", {
            timeZone: state.settings.timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(item.endedAt)) === todayKey
      ),
    [state.history, state.settings.timezone, todayKey]
  );
  const todayStudyHistory = useMemo(
    () =>
      todayHistory.filter(
        (item) =>
          item.mode === "FOCUS" ||
          item.mode === "COUNTDOWN" ||
          item.mode === "STOPWATCH"
      ),
    [todayHistory]
  );
  const todayMinutes = Math.floor(
    todayStudyHistory.reduce(
      (total, item) => total + item.elapsedBeforePause,
      0
    ) / 60
  );
  const weeklySeconds = state.statistics.weeklyStudySeconds;
  const weeklyMinutes = Math.floor(weeklySeconds / 60);
  const weeklySessionCount = state.statistics.last7Days.reduce(
    (total, day) => total + day.sessions,
    0
  );
  const weeklyAverageMinutes = weeklySessionCount
    ? Math.floor(weeklyMinutes / weeklySessionCount)
    : 0;
  const largestDayMinutes = Math.max(
    1,
    ...state.statistics.last7Days.map((day) => Math.floor(day.seconds / 60))
  );
  const weeklyGoalProgress = state.statistics.weeklyGoalTargetMinutes
    ? Math.min(
        100,
        Math.floor(
          (weeklyMinutes / state.statistics.weeklyGoalTargetMinutes) * 100
        )
      )
    : null;

  const openHistoryEditor = useCallback(
    (item?: TimerHistoryItem) => {
      setHistoryDraft({
        elapsedMinutes: item
          ? String(Math.max(1, Math.round(item.elapsedBeforePause / 60)))
          : String(state.settings.focusMinutes),
        id: item?.id ?? null,
        linkedResourceId: item?.linkedResourceId ?? "",
        note: item?.sessionNote ?? "",
        startedAt: dateTimeInputInTimezone(
          item?.startedAt ??
            new Date(Date.now() - state.settings.focusMinutes * 60_000),
          state.settings.timezone
        ),
        title: item?.title ?? "",
      });
    },
    [state.settings.focusMinutes, state.settings.timezone]
  );
  const deleteHistory = useCallback(
    (id: string) => setHistoryDeleteTarget(id),
    []
  );
  const loadMoreHistory = useCallback(
    () => setHistoryLimit((current) => current + 8),
    []
  );

  const showActionFeedback = (
    payload: FocusTimerAction,
    resultValue: unknown,
    next: TimerClientState
  ) => {
    switch (payload.action) {
      case "stop":
        toast.success("Sessão encerrada. Revise o registro para continuar.");
        break;
      case "start":
        if (settingsDraft.timerOpenFocusOnStart) {
          setFocusMode(true);
        }
        toast.success("Cronômetro iniciado");
        break;
      case "settings":
        setSettingsDraft(next.settings);
        setSettingsOpen(false);
        toast.success("Preferências salvas");
        break;
      case "link":
        toast.success(
          payload.linkedResourceId
            ? "Aula vinculada à sessão."
            : "Vínculo removido."
        );
        break;
      case "review": {
        const reviewResult = resultValue as {
          saved: boolean;
          studyLogged?: boolean;
        };
        let message = "Sessão descartada.";
        if (reviewResult.saved) {
          message = reviewResult.studyLogged
            ? "Sessão registrada no histórico de estudo."
            : "Sessão salva no histórico.";
        }
        toast.success(message);
        break;
      }
      case "history-add":
        setHistoryDraft(null);
        toast.success("Sessão manual adicionada ao histórico.");
        break;
      case "history-update":
        setHistoryDraft(null);
        toast.success("Sessão atualizada; as metas foram recalculadas.");
        break;
      case "history-delete":
        setHistoryDeleteTarget(null);
        toast.success("Sessão excluída; as metas foram recalculadas.");
        break;
      case "claim":
        toast.success("Sessão sincronizada com este aparelho.");
        break;
      case "pause":
      case "resume":
        break;
      default:
        break;
    }

    const actionResult = resultValue as {
      completed?: TimerClientState["completed"];
    } | null;
    if (actionResult?.completed) {
      notifyCompletion(actionResult.completed);
    }
  };

  const sendAction = async (payload: FocusTimerAction) => {
    setPending(true);
    try {
      const response = await fetch("/api/focus-timer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await responseJson<{ result: unknown }>(response);
      const next = await responseJson<TimerClientState>(
        await fetch("/api/focus-timer", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        })
      );
      applyState(next);
      showActionFeedback(payload, result.result, next);
    } catch (error) {
      toast.error(
        clientError(error, "Não foi possível atualizar o cronômetro.")
      );
    } finally {
      setPending(false);
    }
  };

  const enableSystemNotifications = async (enabled: boolean) => {
    if (enabled && !("Notification" in window)) {
      setSettingsDraft((current) => ({
        ...current,
        systemNotificationsEnabled: false,
      }));
      toast.error("Este navegador não oferece notificações do sistema.");
      return;
    }
    if (
      enabled &&
      "Notification" in window &&
      Notification.permission !== "granted"
    ) {
      if (Notification.permission === "denied") {
        setSettingsDraft((current) => ({
          ...current,
          systemNotificationsEnabled: false,
        }));
        toast.error(
          "As notificações estão bloqueadas nas configurações do navegador."
        );
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSettingsDraft((current) => ({
          ...current,
          systemNotificationsEnabled: false,
        }));
        toast.error("A permissão de notificações não foi concedida.");
        return;
      }
    }
    setSettingsDraft((current) => ({
      ...current,
      systemNotificationsEnabled: enabled,
    }));
  };

  const saveSettings = () =>
    sendAction({ action: "settings", settings: settingsDraft });

  const startTimer = () => {
    if (sessionReview || !clientId) {
      return;
    }
    unlockTimerAudio();
    setPhasePrompt(null);
    const mode: TimerMode = experience === "POMODORO" ? "FOCUS" : experience;
    sendAction({
      action: "start",
      clientId,
      mode,
      ...(experience === "COUNTDOWN"
        ? { durationSeconds: Math.max(60, countdownMinutes * 60) }
        : {}),
      title: sessionName.trim() || null,
      ...(linkedResourceId
        ? { linkedResourceType: "LESSON", linkedResourceId }
        : {}),
    });
  };

  const startPomodoroPhase = (mode: TimerMode, durationSeconds: number) => {
    if (!clientId) {
      return;
    }
    unlockTimerAudio();
    setPhasePrompt(null);
    setExperience("POMODORO");
    sendAction({ action: "start", clientId, mode, durationSeconds });
  };

  const applyPreset = (focusMinutes: number, shortBreakMinutes: number) => {
    const next = { ...settingsDraft, focusMinutes, shortBreakMinutes };
    setSettingsDraft(next);
    setCountdownMinutes(focusMinutes);
    sendAction({ action: "settings", settings: next });
  };

  const last30DaysMinutes = Math.floor(state.statistics.last30DaysSeconds / 60);
  const activeFromOtherDevice = Boolean(
    clientId && state.active && state.active.clientId !== clientId
  );
  const currentTimerHeading = timerHeading(state, experience, linkResources);
  const currentTimerStatus = timerStatusDescription(state.active);
  const currentProgressStatus = timerProgressStatus(state.active);
  const focusCycleProgress =
    todayStudyHistory.filter((item) => item.mode === "FOCUS").length %
    settingsDraft.longBreakEvery;
  const notificationPermission =
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported";

  useEffect(() => {
    if (activeFromOtherDevice && focusMode) {
      setFocusMode(false);
      setConfirmFocusExit(false);
    }
  }, [activeFromOtherDevice, focusMode]);

  const exitFocusMode = () => {
    if (state.active) {
      setConfirmFocusExit(true);
    } else {
      setFocusMode(false);
    }
  };

  const handleSystemNotifications = (enabled: boolean) => {
    enableSystemNotifications(enabled).catch((error) => {
      toast.error(
        clientError(error, "Não foi possível atualizar as notificações.")
      );
    });
  };

  const previewTimerSound = () => {
    unlockTimerAudio()
      .then(() =>
        playTimerCompletionSound({
          timerSoundEnabled: true,
          timerSoundType: settingsDraft.timerSoundType,
          timerVolume: settingsDraft.timerVolume,
        })
      )
      .catch((error) => {
        toast.error(clientError(error, "Não foi possível reproduzir o som."));
      });
  };

  const settingsPanel = (
    <TimerSettingsPanel
      handleSystemNotifications={handleSystemNotifications}
      notificationPermission={notificationPermission}
      pending={pending}
      previewTimerSound={previewTimerSound}
      saveSettings={saveSettings}
      setSettingsDraft={setSettingsDraft}
      setSettingsOpen={setSettingsOpen}
      settingsDraft={settingsDraft}
      settingsOpen={settingsOpen}
      state={state}
    />
  );

  return (
    <>
      {activeFromOtherDevice && state.active && clientId ? (
        <aside
          aria-live="polite"
          className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#C9984A]/50 bg-[#FBF3E8] p-4 text-[#40222F]"
        >
          <div>
            <p className="font-medium">
              Há uma sessão em andamento em outro aparelho.
            </p>
            <p className="mt-1 text-[#7A5A69] text-sm">
              O tempo continua sincronizado pelo servidor. Você pode assumir o
              controle aqui ou encerrar a sessão no outro aparelho.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                sendAction({
                  action: "claim",
                  sessionId: state.active?.id ?? "",
                  clientId,
                })
              }
              type="button"
            >
              Continuar aqui
            </Button>
            <Button
              disabled={pending}
              onClick={() => sendAction({ action: "stop" })}
              type="button"
              variant="outline"
            >
              Encerrar no outro aparelho
            </Button>
          </div>
        </aside>
      ) : null}
      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <TimerMainCard
          activeFromOtherDevice={activeFromOtherDevice}
          alarmActive={alarmActive}
          announcement={announcement}
          applyPreset={applyPreset}
          clientId={clientId}
          countdownMinutes={countdownMinutes}
          currentProgressStatus={currentProgressStatus}
          currentTimerHeading={currentTimerHeading}
          currentTimerStatus={currentTimerStatus}
          experience={experience}
          focusMode={focusMode}
          linkedResourceId={linkedResourceId}
          linkResources={linkResources}
          pending={pending}
          phasePrompt={phasePrompt}
          progress={progress}
          sendAction={sendAction}
          sessionName={sessionName}
          sessionReview={sessionReview}
          setCountdownMinutes={setCountdownMinutes}
          setExperience={setExperience}
          setFocusMode={setFocusMode}
          setLinkedResourceId={setLinkedResourceId}
          setSessionName={setSessionName}
          setSettingsOpen={setSettingsOpen}
          settingsDraft={settingsDraft}
          settingsPanel={settingsPanel}
          shownSeconds={shownSeconds}
          startPomodoroPhase={startPomodoroPhase}
          startTimer={startTimer}
          state={state}
          stopAlarm={stopAlarm}
          todayStudyHistory={todayStudyHistory}
        />

        <TimerSummarySidebar
          historyLimit={historyLimit}
          largestDayMinutes={largestDayMinutes}
          last30DaysMinutes={last30DaysMinutes}
          linkResources={linkResources}
          onDeleteHistory={deleteHistory}
          onLoadMore={loadMoreHistory}
          openHistoryEditor={openHistoryEditor}
          state={state}
          todayMinutes={todayMinutes}
          todayStudyHistory={todayStudyHistory}
          weeklyAverageMinutes={weeklyAverageMinutes}
          weeklyGoalProgress={weeklyGoalProgress}
          weeklyMinutes={weeklyMinutes}
          weeklySessionCount={weeklySessionCount}
        />
      </section>
      <TimerFocusOverlay
        alarmActive={alarmActive}
        exitFocusMode={exitFocusMode}
        focusCycleProgress={focusCycleProgress}
        focusMode={focusMode}
        pending={pending}
        phasePrompt={phasePrompt}
        progress={progress}
        sendAction={sendAction}
        setFocusMode={setFocusMode}
        setSettingsOpen={setSettingsOpen}
        settingsDraft={settingsDraft}
        shownSeconds={shownSeconds}
        startPomodoroPhase={startPomodoroPhase}
        startTimer={startTimer}
        state={state}
        stopAlarm={stopAlarm}
      />
      <TimerDialogs
        confirmFocusExit={confirmFocusExit}
        historyDeleteTarget={historyDeleteTarget}
        historyDraft={historyDraft}
        isoFromDateTimeInput={isoFromDateTimeInput}
        linkResources={linkResources}
        pending={pending}
        sendAction={sendAction}
        sessionReview={sessionReview}
        setConfirmFocusExit={setConfirmFocusExit}
        setFocusMode={setFocusMode}
        setHistoryDeleteTarget={setHistoryDeleteTarget}
        setHistoryDraft={setHistoryDraft}
        setSessionReview={setSessionReview}
        state={state}
      />
    </>
  );
}

interface NotesWorkspaceToolbarActions {
  createNote: () => Promise<unknown>;
}

export const ToolsWorkspace = ({
  focusModeInitial = false,
  settingsInitialOpen = false,
  initialNotes,
  initialTimer,
  noteId,
  timerResources = [],
  views,
  view,
}: {
  readonly focusModeInitial?: boolean;
  readonly settingsInitialOpen?: boolean;
  readonly initialNotes: NotesData | null;
  readonly initialTimer: TimerServerState | null;
  readonly noteId: string | null;
  readonly timerResources?: readonly TimerLinkResource[];
  readonly views: readonly MemberViewOption[];
  readonly view: string;
}) => {
  const noteToolbarActions = useRef<NotesWorkspaceToolbarActions | null>(null);
  const [notesToolbarReady, setNotesToolbarReady] = useState(false);
  const registerNotesToolbarActions = useCallback(
    (actions: NotesWorkspaceToolbarActions | null) => {
      noteToolbarActions.current = actions;
      setNotesToolbarReady(Boolean(actions));
    },
    []
  );

  return (
    <>
      <div
        className={
          view === "notes"
            ? "mt-5 flex flex-wrap items-center justify-between gap-4 md:mt-0"
            : "mt-7 flex flex-wrap items-center justify-between gap-4"
        }
        data-tools-page-switcher
      >
        <MemberViewSwitcher activeView={view} views={views} />
        {view === "notes" ? (
          <div className="hidden items-center gap-2 md:flex">
            <Button
              className="h-11 rounded-md border-2 border-[#8C1535] px-6 font-semibold text-[#8C1535] hover:bg-[#8C1535]/5"
              disabled={!notesToolbarReady}
              onClick={async () => {
                await noteToolbarActions.current?.createNote();
              }}
              type="button"
              variant="outline"
            >
              <FilePlus2Icon aria-hidden="true" className="mr-2 size-4" />
              Nova nota
            </Button>
          </div>
        ) : null}
      </div>
      <div data-tools-workspace>
        {view === "notes" ? (
          <NotesWorkspace
            initialData={
              initialNotes ?? {
                folders: [],
                notes: [],
                tags: [],
                trashRetentionDays: 30,
              }
            }
            initialNoteId={noteId}
            linkResources={timerResources}
            registerToolbarActions={registerNotesToolbarActions}
          />
        ) : (
          <FocusTimerWorkspace
            initialFocusMode={focusModeInitial}
            initialSettingsOpen={settingsInitialOpen}
            initialTimer={initialTimer as TimerServerState}
            linkResources={timerResources}
          />
        )}
      </div>
    </>
  );
};
const TimerSummarySidebar = memo(function TimerSummarySidebar({
  state,
  todayMinutes,
  todayStudyHistory,
  weeklyMinutes,
  weeklySessionCount,
  weeklyAverageMinutes,
  weeklyGoalProgress,
  largestDayMinutes,
  last30DaysMinutes,
  linkResources,
  historyLimit,
  openHistoryEditor,
  onDeleteHistory,
  onLoadMore,
}: {
  state: TimerClientState;
  todayMinutes: number;
  todayStudyHistory: TimerHistoryItem[];
  weeklyMinutes: number;
  weeklySessionCount: number;
  weeklyAverageMinutes: number;
  weeklyGoalProgress: number | null;
  largestDayMinutes: number;
  last30DaysMinutes: number;
  linkResources: readonly TimerLinkResource[];
  historyLimit: number;
  openHistoryEditor: (item?: TimerHistoryItem) => void;
  onDeleteHistory: (id: string) => void;
  onLoadMore: () => void;
}) {
  return (
    <aside className="grid content-start gap-5">
      <div className="rounded-lg border border-[#E2D6D1] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-[#F7E8EB] text-[#8C1535]">
            <Clock3Icon aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h3 className="font-display text-[#40222F] text-xl">Hoje</h3>
            <p className="text-[#7A5A69] text-xs">Seu tempo de estudo</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#FBF8F5] p-4">
            <p className="font-semibold text-2xl text-[#40222F] tabular-nums">
              {Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m
            </p>
            <p className="mt-1 text-[#7A5A69] text-xs">tempo de estudo</p>
          </div>
          <div className="rounded-xl bg-[#FBF8F5] p-4">
            <p className="font-semibold text-2xl text-[#40222F] tabular-nums">
              {todayStudyHistory.length}
            </p>
            <p className="mt-1 text-[#7A5A69] text-xs">sessões</p>
          </div>
        </div>
        <ul className="mt-5 divide-y divide-[#E2D6D1] border-[#40222F] border-t">
          {todayStudyHistory.slice(0, 3).map((item) => (
            <li
              className="flex items-center justify-between gap-3 py-4 text-sm"
              key={item.id}
            >
              <div className="min-w-0">
                <p className="truncate text-[#40222F]">
                  {item.title || modeNames[item.mode]}
                </p>
                <p className="mt-1 text-[#7A5A69] text-xs">
                  {item.linkedResourceId ? "Aula vinculada" : "Sem vínculo"}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-[#40222F]">
                {Math.floor(item.elapsedBeforePause / 60)} min
              </span>
            </li>
          ))}
          {todayStudyHistory.length ? null : (
            <li className="py-4 text-[#7A5A69] text-sm">
              Nenhuma sessão registrada hoje.
            </li>
          )}
        </ul>
        <details className="mt-3">
          <summary className="cursor-pointer py-2 font-medium text-[#8C1535] text-sm">
            Estatísticas de estudo
          </summary>
          <p className="mt-4 border-[#EEE6E2] border-t pt-3 text-[#7A5A69] text-xs leading-relaxed">
            Últimos 30 dias: {Math.floor(last30DaysMinutes / 60)}h{" "}
            {last30DaysMinutes % 60}m · {state.statistics.last30DaysSessions}{" "}
            sessões. O estudo entra nas suas metas após ser salvo.
          </p>
          <div className="mt-4 border-[#EEE6E2] border-t pt-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h4 className="font-display text-[#40222F] text-lg">
                  Esta semana
                </h4>
                <p className="text-[#7A5A69] text-xs">
                  {Math.floor(weeklyMinutes / 60)}h {weeklyMinutes % 60}m ·{" "}
                  {weeklySessionCount} sessões · média {weeklyAverageMinutes}{" "}
                  min
                </p>
              </div>
              {state.statistics.weeklyGoalTargetMinutes ? (
                <span className="shrink-0 text-[#7A5A69] text-xs tabular-nums">
                  {weeklyMinutes} / {state.statistics.weeklyGoalTargetMinutes}{" "}
                  min
                </span>
              ) : null}
            </div>
            <figure className="mx-0 mt-3 grid h-24 grid-cols-7 items-end gap-2">
              <figcaption className="sr-only">
                Minutos de estudo por dia nesta semana:{" "}
                {state.statistics.last7Days
                  .map(
                    (day) =>
                      `${day.dayKey}, ${Math.floor(day.seconds / 60)} minutos`
                  )
                  .join("; ")}
              </figcaption>
              {state.statistics.last7Days.map((day) => {
                const minutes = Math.floor(day.seconds / 60);
                const label = new Intl.DateTimeFormat("pt-BR", {
                  weekday: "short",
                  timeZone: "UTC",
                }).format(new Date(`${day.dayKey}T12:00:00.000Z`));
                const height = Math.max(
                  minutes > 0 ? 8 : 3,
                  Math.round((minutes / largestDayMinutes) * 100)
                );
                return (
                  <div
                    aria-label={`${label}: ${minutes} minutos`}
                    className="flex h-full flex-col items-center justify-end gap-1"
                    key={day.dayKey}
                    role="img"
                    title={`${minutes} min · ${day.sessions} sessões`}
                  >
                    <span className="text-[#947A83] text-[9px] tabular-nums">
                      {minutes || ""}
                    </span>
                    <span className="flex h-16 w-full items-end rounded-sm bg-[#FBF8F5]">
                      <span
                        className="w-full rounded-sm bg-[#8C1535]"
                        style={{ height: `${height}%` }}
                      />
                    </span>
                    <span className="text-[#7A5A69] text-[9px] capitalize">
                      {label.replace(".", "")}
                    </span>
                  </div>
                );
              })}
            </figure>
            {weeklyGoalProgress !== null ? (
              <div className="mt-3">
                <div
                  aria-label={`Progresso da meta semanal: ${weeklyGoalProgress}%`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={weeklyGoalProgress}
                  className="h-2 overflow-hidden rounded-full bg-[#F1EBE8]"
                  role="progressbar"
                >
                  <span
                    className="block h-full rounded-full bg-[#8C1535]"
                    style={{ width: `${weeklyGoalProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[#7A5A69] text-xs">
                  {weeklyGoalProgress}% da meta semanal
                </p>
              </div>
            ) : null}
            <div className="mt-4 border-[#EEE6E2] border-t pt-3">
              <h5 className="font-medium text-[#40222F] text-sm">
                Tempo por vínculo
              </h5>
              {state.statistics.byLink.length ? (
                <ul className="mt-2 divide-y divide-[#F1EBE8]">
                  {state.statistics.byLink.map((entry) => (
                    <li
                      className="flex items-center justify-between gap-3 py-2 text-xs"
                      key={entry.linkedResourceId ?? "unlinked"}
                    >
                      <span className="min-w-0 truncate text-[#6C4857]">
                        {entry.linkedResourceId
                          ? (linkResources.find(
                              (resource) =>
                                resource.id === entry.linkedResourceId
                            )?.title ?? "Aula vinculada")
                          : "Sem vínculo"}
                        <span className="ml-1 text-[#947A83]">
                          · {entry.sessions} sessões
                        </span>
                      </span>
                      <span className="shrink-0 text-[#40222F] tabular-nums">
                        {formatDuration(entry.seconds)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[#7A5A69] text-xs">
                  Os vínculos aparecem após registrar sessões.
                </p>
              )}
            </div>
          </div>
        </details>
      </div>
      <div className="rounded-lg border border-[#E2D6D1] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-[#40222F] text-xl">Histórico</h3>
          <div className="flex items-center gap-2">
            <a
              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#E2D6D1] px-3 text-[#6C4857] text-xs hover:bg-[#FBF8F5]"
              href="/api/focus-timer/history"
            >
              <DownloadIcon aria-hidden="true" className="size-3.5" /> CSV
            </a>
            <Button
              className="min-h-9"
              onClick={() => openHistoryEditor()}
              type="button"
              variant="outline"
            >
              Adicionar sessão
            </Button>
          </div>
        </div>
        <ul className="mt-4 divide-y divide-[#EEE6E2]">
          {state.history.length ? (
            state.history.slice(0, historyLimit).map((item) => (
              <li
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                key={item.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#40222F] text-sm">
                    {item.title || modeNames[item.mode]}
                  </p>
                  <p className="mt-0.5 text-[#7A5A69] text-xs">
                    {textDate(item.endedAt)}
                    {item.linkedResourceId
                      ? ` · ${linkResources.find((resource) => resource.id === item.linkedResourceId)?.title ?? "Aula vinculada"}`
                      : ""}
                  </p>
                  {item.sessionNote ? (
                    <p className="mt-1 truncate text-[#7A5A69] text-xs">
                      {item.sessionNote}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[#6C4857] text-sm tabular-nums">
                  {formatDuration(item.elapsedBeforePause)}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {item.mode === "FOCUS" ||
                  item.mode === "COUNTDOWN" ||
                  item.mode === "STOPWATCH" ? (
                    <Button
                      aria-label={`Editar sessão ${item.title || modeNames[item.mode]}`}
                      className="size-8 text-[#7A5A69]"
                      onClick={() => openHistoryEditor(item)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <PencilIcon aria-hidden="true" className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    aria-label={`Excluir sessão ${item.title || modeNames[item.mode]}`}
                    className="size-8 text-[#8C1535]"
                    onClick={() => onDeleteHistory(item.id)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2Icon aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </li>
            ))
          ) : (
            <li className="py-5 text-[#7A5A69] text-sm">
              As sessões encerradas aparecerão aqui.
            </li>
          )}
        </ul>
        {state.history.length > historyLimit ? (
          <Button
            className="mt-3 w-full"
            onClick={onLoadMore}
            type="button"
            variant="outline"
          >
            Carregar mais sessões
          </Button>
        ) : null}
      </div>
    </aside>
  );
});
function TimerSettingsPanel({
  settingsOpen,
  settingsDraft,
  setSettingsDraft,
  setSettingsOpen,
  state,
  pending,
  handleSystemNotifications,
  notificationPermission,
  previewTimerSound,
  saveSettings,
}: {
  settingsOpen: boolean;
  settingsDraft: TimerSettings;
  setSettingsDraft: (
    next: TimerSettings | ((current: TimerSettings) => TimerSettings)
  ) => void;
  setSettingsOpen: (open: boolean) => void;
  state: TimerClientState;
  pending: boolean;
  handleSystemNotifications: (enabled: boolean) => void;
  notificationPermission: NotificationPermission | "unsupported";
  previewTimerSound: () => void;
  saveSettings: () => void;
}) {
  return settingsOpen ? (
    <div className="mt-8 rounded-xl border border-[#E2D6D1] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[#40222F] text-xl">Preferências</h3>
        <Button
          onClick={() => setSettingsDraft(defaultTimerSettings)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Restaurar padrões
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label
          className="grid gap-1.5 text-[#40222F] text-sm"
          htmlFor="timer-focus-minutes"
        >
          Foco (minutos)
          <Input
            id="timer-focus-minutes"
            max={180}
            min={1}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                focusMinutes: Number(event.target.value),
              })
            }
            type="number"
            value={settingsDraft.focusMinutes}
          />
        </label>
        <label
          className="grid gap-1.5 text-[#40222F] text-sm"
          htmlFor="timer-short-break-minutes"
        >
          Pausa curta (minutos)
          <Input
            id="timer-short-break-minutes"
            max={60}
            min={1}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                shortBreakMinutes: Number(event.target.value),
              })
            }
            type="number"
            value={settingsDraft.shortBreakMinutes}
          />
        </label>
        <label
          className="grid gap-1.5 text-[#40222F] text-sm"
          htmlFor="timer-long-break-minutes"
        >
          Pausa longa (minutos)
          <Input
            id="timer-long-break-minutes"
            max={90}
            min={1}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                longBreakMinutes: Number(event.target.value),
              })
            }
            type="number"
            value={settingsDraft.longBreakMinutes}
          />
        </label>
        <label
          className="grid gap-1.5 text-[#40222F] text-sm"
          htmlFor="timer-long-break-every"
        >
          Pausa longa a cada
          <Input
            id="timer-long-break-every"
            max={8}
            min={2}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                longBreakEvery: Number(event.target.value),
              })
            }
            type="number"
            value={settingsDraft.longBreakEvery}
          />
        </label>
        <label
          className="grid gap-1.5 text-[#40222F] text-sm sm:col-span-2"
          htmlFor="timer-timezone"
        >
          Fuso horário
          <Input
            id="timer-timezone"
            list="member-timezones"
            maxLength={80}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                timezone: event.target.value,
              })
            }
            value={settingsDraft.timezone}
          />
          <datalist id="member-timezones">
            <option value="America/Sao_Paulo" />
            <option value="America/Manaus" />
            <option value="America/Rio_Branco" />
            <option value="America/Fortaleza" />
            <option value="America/Belem" />
            <option value="Europe/Lisbon" />
            <option value="Europe/London" />
            <option value="UTC" />
          </datalist>
        </label>
      </div>
      <div className="mt-4 grid gap-3 text-[#40222F] text-sm sm:grid-cols-2">
        <label className="flex min-h-10 items-center gap-2">
          <input
            checked={settingsDraft.timerSoundEnabled}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                timerSoundEnabled: event.target.checked,
              })
            }
            type="checkbox"
          />
          Som ao concluir
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input
            checked={settingsDraft.systemNotificationsEnabled}
            onChange={(event) =>
              handleSystemNotifications(event.target.checked)
            }
            type="checkbox"
          />
          Notificação do dispositivo
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input
            checked={settingsDraft.timerAutoAdvance}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                timerAutoAdvance: event.target.checked,
              })
            }
            type="checkbox"
          />
          Começar a próxima fase automaticamente
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input
            checked={settingsDraft.timerOpenFocusOnStart}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                timerOpenFocusOnStart: event.target.checked,
              })
            }
            type="checkbox"
          />
          Abrir modo foco ao começar
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input
            checked={settingsDraft.timerVibrationEnabled}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                timerVibrationEnabled: event.target.checked,
              })
            }
            type="checkbox"
          />
          Vibrar ao fim de cada fase
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input
            checked={settingsDraft.keepScreenAwake}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                keepScreenAwake: event.target.checked,
              })
            }
            type="checkbox"
          />
          Manter a tela acesa durante o foco
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input
            checked={settingsDraft.timerTickEnabled}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                timerTickEnabled: event.target.checked,
              })
            }
            type="checkbox"
          />
          Som de tique-taque durante o foco
        </label>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[#40222F] text-sm">
          Som
          <select
            className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3"
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                timerSoundType: event.target
                  .value as TimerSettings["timerSoundType"],
              })
            }
            value={settingsDraft.timerSoundType}
          >
            <option value="SOFT_BELL">Sino suave</option>
            <option value="WOOD">Madeira</option>
            <option value="DIGITAL">Digital</option>
            <option value="NONE">Sem som</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-[#40222F] text-sm">
          Volume · {settingsDraft.timerVolume}%
          <input
            className="h-10 accent-[#8C1535]"
            max={100}
            min={0}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                timerVolume: Number(event.target.value),
              })
            }
            type="range"
            value={settingsDraft.timerVolume}
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          disabled={
            settingsDraft.timerSoundType === "NONE" ||
            settingsDraft.timerVolume === 0
          }
          onClick={previewTimerSound}
          type="button"
          variant="outline"
        >
          <PlayIcon aria-hidden="true" className="mr-2 size-4" />
          Ouvir som
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2D6D1] bg-[#F8F4F1] p-3 text-sm">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#40222F]">
            Notificações do navegador
          </p>
          <p className="text-[#7A5A69] text-xs">
            {notificationPermissionDescription(notificationPermission)}
          </p>
          {notificationPermission === "denied" ? (
            <p className="mt-1 text-[#7A5A69] text-xs">
              Para liberar: abra as permissões do site ao lado do endereço e
              permita notificações.
            </p>
          ) : null}
        </div>
        {notificationPermission === "default" && (
          <Button
            onClick={() => handleSystemNotifications(true)}
            type="button"
            variant="outline"
          >
            Ativar notificações
          </Button>
        )}
        {notificationPermission === "granted" && (
          <Button
            onClick={() => {
              new Notification("Aviso do cronômetro", {
                body: "As notificações estão funcionando.",
                tag: "focus-timer-test",
              });
            }}
            type="button"
            variant="outline"
          >
            Testar aviso
          </Button>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          onClick={() => {
            setSettingsDraft(state.settings);
            setSettingsOpen(false);
          }}
          type="button"
          variant="outline"
        >
          Cancelar
        </Button>
        <Button disabled={pending} onClick={saveSettings} type="button">
          Salvar preferências
        </Button>
      </div>
    </div>
  ) : null;
}

function TimerFocusOverlay({
  focusMode,
  state,
  progress,
  shownSeconds,
  settingsDraft,
  focusCycleProgress,
  phasePrompt,
  pending,
  startPomodoroPhase,
  alarmActive,
  stopAlarm,
  sendAction,
  startTimer,
  exitFocusMode,
  setSettingsOpen,
  setFocusMode,
}: {
  focusMode: boolean;
  state: TimerClientState;
  progress: number;
  shownSeconds: number;
  settingsDraft: TimerSettings;
  focusCycleProgress: number;
  phasePrompt: { mode: TimerMode; durationSeconds: number } | null;
  pending: boolean;
  startPomodoroPhase: (mode: TimerMode, durationSeconds: number) => void;
  alarmActive: boolean;
  stopAlarm: () => void;
  sendAction: (payload: FocusTimerAction) => void;
  startTimer: () => void;
  exitFocusMode: () => void;
  setSettingsOpen: (open: boolean) => void;
  setFocusMode: (open: boolean) => void;
}) {
  return focusMode ? (
    <div
      aria-label="Modo foco"
      aria-modal="true"
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-[radial-gradient(ellipse_at_50%_25%,#3A0F28_0%,#1E0318_55%,#0E0109_100%)] p-6 text-[#F1EBE8]"
      role="dialog"
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5 sm:p-8">
        <span className="font-display text-lg">Interprete.</span>
        <Button
          className="border-white/40 bg-transparent text-white hover:bg-white/10"
          onClick={exitFocusMode}
          type="button"
          variant="outline"
        >
          Sair do foco
        </Button>
      </div>
      <div className="w-full max-w-xl text-center">
        <p className="text-white/60 text-xs uppercase tracking-[.2em]">
          {state.active ? modeNames[state.active.mode] : "Modo foco"}
        </p>
        <div
          className="relative mx-auto mt-8 grid aspect-square w-full max-w-[360px] place-items-center rounded-full border-[7px] border-white/15"
          style={{
            background: `conic-gradient(#E9C48E ${progress * 360}deg, rgba(241,235,232,.10) 0)`,
          }}
        >
          <div className="grid aspect-square w-[calc(100%-14px)] place-items-center rounded-full bg-[#1B0619]">
            <div>
              <p className="font-display text-6xl tabular-nums sm:text-7xl">
                {formatDuration(shownSeconds)}
              </p>
              <p className="mt-3 text-sm text-white/70">
                {state.active?.title ||
                  (state.active?.linkedResourceId
                    ? "Sessão vinculada"
                    : "Sem vínculo")}
              </p>
            </div>
          </div>
        </div>
        <div
          aria-label="Ciclos Pomodoro"
          className="mt-7 flex justify-center gap-2"
          role="img"
        >
          {Array.from(
            { length: settingsDraft.longBreakEvery },
            (_, cycleIndex) => cycleIndex + 1
          ).map((cycleNumber) => (
            <span
              aria-hidden="true"
              className={`size-2.5 rounded-full ${cycleNumber <= focusCycleProgress ? "bg-[#E9C48E]" : "bg-white/25"}`}
              key={`pomodoro-cycle-${cycleNumber}`}
            />
          ))}
        </div>
        {phasePrompt ? (
          <div
            aria-live="assertive"
            className="mt-6 rounded-xl border border-white/20 bg-white/10 p-4"
            role="alert"
          >
            <p className="font-medium">
              Foco concluído. Hora da pausa de{" "}
              {Math.round(phasePrompt.durationSeconds / 60)} minutos.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button
                disabled={pending}
                onClick={() =>
                  startPomodoroPhase(
                    phasePrompt.mode,
                    phasePrompt.durationSeconds
                  )
                }
                type="button"
              >
                Começar a pausa
              </Button>
              <Button
                className="border-white/50 bg-transparent text-white hover:bg-white/10"
                disabled={pending}
                onClick={() =>
                  startPomodoroPhase("FOCUS", settingsDraft.focusMinutes * 60)
                }
                type="button"
                variant="outline"
              >
                Pular
              </Button>
            </div>
          </div>
        ) : null}
        {alarmActive ? (
          <Button
            className="mt-6 border-white/40 bg-transparent text-white hover:bg-white/10"
            onClick={stopAlarm}
            type="button"
            variant="outline"
          >
            Parar alarme
          </Button>
        ) : null}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {state.active ? (
            <>
              <Button
                className="min-w-36 bg-[#8C1535] text-white hover:bg-[#6D102A]"
                onClick={() =>
                  sendAction({
                    action: state.active?.pausedAt ? "resume" : "pause",
                  })
                }
                type="button"
              >
                {state.active.pausedAt ? (
                  <PlayIcon
                    aria-hidden="true"
                    className="mr-2 size-4 fill-current"
                  />
                ) : (
                  <PauseIcon aria-hidden="true" className="mr-2 size-4" />
                )}
                {state.active.pausedAt ? "Retomar" : "Pausar"}
              </Button>
              <Button
                className="border-white/50 bg-transparent text-white hover:bg-white/10"
                onClick={() => sendAction({ action: "stop" })}
                type="button"
                variant="outline"
              >
                <SquareIcon aria-hidden="true" className="mr-2 size-4" />
                Encerrar
              </Button>
            </>
          ) : (
            <Button
              className="min-w-36 bg-[#8C1535] text-white hover:bg-[#6D102A]"
              onClick={startTimer}
              type="button"
            >
              <PlayIcon
                aria-hidden="true"
                className="mr-2 size-4 fill-current"
              />
              Começar
            </Button>
          )}
        </div>
        <button
          className="mt-6 text-[#E9C48E] text-sm underline-offset-4 hover:underline"
          onClick={() => {
            setSettingsOpen(true);
            setFocusMode(false);
          }}
          type="button"
        >
          Sons e avisos
        </button>
      </div>
    </div>
  ) : null;
}
function TimerDialogs({
  state,
  pending,
  sessionReview,
  setSessionReview,
  sendAction,
  historyDraft,
  setHistoryDraft,
  historyDeleteTarget,
  setHistoryDeleteTarget,
  confirmFocusExit,
  setConfirmFocusExit,
  setFocusMode,
  linkResources,
  isoFromDateTimeInput,
}: {
  state: TimerClientState;
  pending: boolean;
  sessionReview: { id: string; note: string } | null;
  setSessionReview: Dispatch<
    SetStateAction<{ id: string; note: string } | null>
  >;
  sendAction: (payload: FocusTimerAction) => Promise<void>;
  historyDraft: {
    elapsedMinutes: string;
    id: string | null;
    linkedResourceId: string;
    note: string;
    startedAt: string;
    title: string;
  } | null;
  setHistoryDraft: Dispatch<
    SetStateAction<{
      elapsedMinutes: string;
      id: string | null;
      linkedResourceId: string;
      note: string;
      startedAt: string;
      title: string;
    } | null>
  >;
  historyDeleteTarget: string | null;
  setHistoryDeleteTarget: Dispatch<SetStateAction<string | null>>;
  confirmFocusExit: boolean;
  setConfirmFocusExit: Dispatch<SetStateAction<boolean>>;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
  linkResources: readonly TimerLinkResource[];
  isoFromDateTimeInput: (value: string, timezone: string) => string;
}) {
  return (
    <>
      {" "}
      <Dialog onOpenChange={() => undefined} open={Boolean(sessionReview)}>
        <DialogContent
          className="max-w-lg border-[#E2D6D1] bg-[#FBF8F5]"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#40222F]">
              Sessão concluída
            </DialogTitle>
            <DialogDescription>
              {state.pendingReview
                ? `${modeNames[state.pendingReview.mode]} · ${formatDuration(state.pendingReview.elapsedBeforePause)}. `
                : ""}
              Registre este tempo no seu histórico de estudo ou descarte a
              sessão. Você pode deixar uma anotação para lembrar do que estudou.
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
            Anotação da sessão (opcional)
            <textarea
              className="min-h-28 resize-y rounded-md border border-[#E2D6D1] bg-white p-3 font-normal text-sm"
              maxLength={4000}
              onChange={(event) =>
                setSessionReview((current) =>
                  current ? { ...current, note: event.target.value } : current
                )
              }
              value={sessionReview?.note ?? ""}
            />
          </label>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button
              disabled={pending}
              onClick={() =>
                sessionReview &&
                sendAction({
                  action: "review",
                  id: sessionReview.id,
                  note: sessionReview.note,
                  saveStudy: false,
                })
              }
              type="button"
              variant="outline"
            >
              Descartar sessão
            </Button>
            <Button
              className="bg-[#8C1535] text-white hover:bg-[#6D102A]"
              disabled={pending || !sessionReview}
              onClick={() =>
                sessionReview &&
                sendAction({
                  action: "review",
                  id: sessionReview.id,
                  note: sessionReview.note,
                  saveStudy: true,
                })
              }
              type="button"
            >
              Registrar no histórico de estudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => !open && setHistoryDraft(null)}
        open={Boolean(historyDraft)}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-[#E2D6D1] bg-[#FBF8F5]">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!historyDraft) {
                return;
              }
              const minutes = Number(historyDraft.elapsedMinutes);
              if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
                toast.error("Informe uma duração entre 1 e 1440 minutos.");
                return;
              }
              const session = {
                ...(historyDraft.id ? { id: historyDraft.id } : {}),
                startedAt: isoFromDateTimeInput(
                  historyDraft.startedAt,
                  state.settings.timezone
                ),
                elapsedSeconds: Math.round(minutes * 60),
                title: historyDraft.title || null,
                note: historyDraft.note || null,
                linkedResourceId: historyDraft.linkedResourceId || null,
              };
              if (historyDraft.id) {
                sendAction({ action: "history-update", session });
              } else {
                sendAction({ action: "history-add", session });
              }
            }}
          >
            <DialogHeader>
              <DialogTitle className="font-display text-2xl text-[#40222F]">
                {historyDraft?.id ? "Editar sessão" : "Adicionar sessão manual"}
              </DialogTitle>
              <DialogDescription>
                O tempo salvo entra nas estatísticas e metas de estudo.
              </DialogDescription>
            </DialogHeader>
            <label
              className="grid gap-1.5 font-medium text-[#40222F] text-sm"
              htmlFor="history-session-title"
            >
              Nome da sessão (opcional)
              <Input
                id="history-session-title"
                maxLength={180}
                onChange={(event) =>
                  setHistoryDraft((current) =>
                    current
                      ? { ...current, title: event.target.value }
                      : current
                  )
                }
                value={historyDraft?.title ?? ""}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className="grid gap-1.5 font-medium text-[#40222F] text-sm"
                htmlFor="history-session-start"
              >
                Início ({state.settings.timezone})
                <Input
                  id="history-session-start"
                  onChange={(event) =>
                    setHistoryDraft((current) =>
                      current
                        ? { ...current, startedAt: event.target.value }
                        : current
                    )
                  }
                  required
                  type="datetime-local"
                  value={historyDraft?.startedAt ?? ""}
                />
              </label>
              <label
                className="grid gap-1.5 font-medium text-[#40222F] text-sm"
                htmlFor="history-session-duration"
              >
                Duração (minutos)
                <Input
                  id="history-session-duration"
                  max={1440}
                  min={1}
                  onChange={(event) =>
                    setHistoryDraft((current) =>
                      current
                        ? { ...current, elapsedMinutes: event.target.value }
                        : current
                    )
                  }
                  required
                  type="number"
                  value={historyDraft?.elapsedMinutes ?? ""}
                />
              </label>
            </div>
            <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
              Vincular à aula (opcional)
              <select
                className="h-10 rounded-md border border-[#E2D6D1] bg-white px-3 font-normal"
                onChange={(event) =>
                  setHistoryDraft((current) =>
                    current
                      ? { ...current, linkedResourceId: event.target.value }
                      : current
                  )
                }
                value={historyDraft?.linkedResourceId ?? ""}
              >
                <option value="">Sem vínculo</option>
                {linkResources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
              Anotação (opcional)
              <textarea
                className="min-h-24 resize-y rounded-md border border-[#E2D6D1] bg-white p-3 font-normal text-sm"
                maxLength={4000}
                onChange={(event) =>
                  setHistoryDraft((current) =>
                    current ? { ...current, note: event.target.value } : current
                  )
                }
                value={historyDraft?.note ?? ""}
              />
            </label>
            <DialogFooter>
              <Button
                onClick={() => setHistoryDraft(null)}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button disabled={pending} type="submit">
                {historyDraft?.id ? "Salvar sessão" : "Adicionar ao histórico"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => !open && setHistoryDeleteTarget(null)}
        open={Boolean(historyDeleteTarget)}
      >
        <DialogContent className="max-w-md border-[#E2D6D1] bg-[#FBF8F5]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#40222F]">
              Excluir sessão?
            </DialogTitle>
            <DialogDescription>
              O tempo será removido das estatísticas e metas. Esta ação não pode
              ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setHistoryDeleteTarget(null)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={pending || !historyDeleteTarget}
              onClick={() =>
                historyDeleteTarget &&
                sendAction({
                  action: "history-delete",
                  id: historyDeleteTarget,
                })
              }
              type="button"
            >
              Excluir sessão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => !open && setConfirmFocusExit(false)}
        open={confirmFocusExit}
      >
        <DialogContent className="max-w-md border-[#E2D6D1] bg-[#FBF8F5]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#40222F]">
              Sair do modo foco?
            </DialogTitle>
            <DialogDescription>
              O cronômetro continuará rodando em qualquer tela.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setConfirmFocusExit(false)}
              type="button"
              variant="outline"
            >
              Continuar no foco
            </Button>
            <Button
              onClick={() => {
                setConfirmFocusExit(false);
                setFocusMode(false);
              }}
              type="button"
            >
              Sair do foco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>{" "}
    </>
  );
}
function TimerMainCard({
  state,
  experience,
  setExperience,
  settingsDraft,
  applyPreset,
  setSettingsOpen,
  currentTimerHeading,
  currentTimerStatus,
  shownSeconds,
  progress,
  currentProgressStatus,
  todayStudyHistory,
  focusMode,
  phasePrompt,
  startPomodoroPhase,
  countdownMinutes,
  setCountdownMinutes,
  pending,
  activeFromOtherDevice,
  sendAction,
  linkResources,
  linkedResourceId,
  setLinkedResourceId,
  sessionName,
  setSessionName,
  alarmActive,
  stopAlarm,
  sessionReview,
  clientId,
  startTimer,
  setFocusMode,
  settingsPanel,
  announcement,
}: {
  state: TimerClientState;
  experience: TimerExperience;
  setExperience: Dispatch<SetStateAction<TimerExperience>>;
  settingsDraft: TimerSettings;
  applyPreset: (focusMinutes: number, shortBreakMinutes: number) => void;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  currentTimerHeading: string;
  currentTimerStatus: string;
  shownSeconds: number;
  progress: number;
  currentProgressStatus: string;
  todayStudyHistory: TimerHistoryItem[];
  focusMode: boolean;
  phasePrompt: { mode: TimerMode; durationSeconds: number } | null;
  startPomodoroPhase: (mode: TimerMode, durationSeconds: number) => void;
  countdownMinutes: number;
  setCountdownMinutes: Dispatch<SetStateAction<number>>;
  pending: boolean;
  activeFromOtherDevice: boolean;
  sendAction: (payload: FocusTimerAction) => Promise<void>;
  linkResources: readonly TimerLinkResource[];
  linkedResourceId: string;
  setLinkedResourceId: Dispatch<SetStateAction<string>>;
  sessionName: string;
  setSessionName: Dispatch<SetStateAction<string>>;
  alarmActive: boolean;
  stopAlarm: () => void;
  sessionReview: { id: string; note: string } | null;
  clientId: string | null;
  startTimer: () => void;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
  settingsPanel: ReactNode;
  announcement: string;
}) {
  return (
    <div className="relative flex flex-col rounded-lg border border-[#E2D6D1] bg-white p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="sr-only">
          <p className="brand-eyebrow text-[#8C1535]">Ritmo de estudo</p>
          <h2 className="mt-2 font-display text-2xl text-[#40222F] sm:text-3xl">
            {currentTimerHeading}
          </h2>
          <p className="mt-1 text-[#7A5A69] text-sm">{currentTimerStatus}</p>
        </div>
        <button
          aria-label="Preferências do cronômetro"
          className="absolute top-2 right-2 grid size-8 place-items-center rounded-full text-[#6C4857] transition hover:text-[#8C1535] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C1535]"
          onClick={() => setSettingsOpen((open) => !open)}
          type="button"
        >
          <Settings2Icon aria-hidden="true" className="size-5" />
        </button>
      </div>

      <fieldset
        aria-label="Modo do cronômetro"
        className="mx-auto flex min-w-0 flex-wrap justify-center rounded-md border border-[#E2D6D1] p-0"
      >
        {(["POMODORO", "STOPWATCH", "COUNTDOWN"] as const).map((item) => (
          <button
            aria-pressed={
              (state.active
                ? experienceForMode(state.active.mode)
                : experience) === item
            }
            className={`min-h-11 rounded-sm px-4 font-medium text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C1535] ${
              (
                state.active ? experienceForMode(state.active.mode) : experience
              ) === item
                ? "bg-[#8C1535] text-white"
                : "border border-[#E2D6D1] bg-white text-[#6C4857] hover:border-[#BFA9A3]"
            }`}
            disabled={Boolean(state.active) || pending}
            key={item}
            onClick={() => setExperience(item)}
            type="button"
          >
            {experienceLabel(item)}
          </button>
        ))}
      </fieldset>

      {experience === "POMODORO" && !state.active ? (
        <fieldset
          aria-label="Atalhos Pomodoro"
          className="order-last mx-auto mt-7 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0"
        >
          <span className="mr-1 text-[#7A5A69] text-xs">Atalhos</span>
          {(
            [
              [25, 5],
              [50, 10],
              [90, 15],
            ] as const
          ).map(([focus, pause]) => (
            <button
              aria-pressed={
                settingsDraft.focusMinutes === focus &&
                settingsDraft.shortBreakMinutes === pause
              }
              className={`min-h-9 rounded-md border px-3 font-medium text-xs ${settingsDraft.focusMinutes === focus && settingsDraft.shortBreakMinutes === pause ? "border-[#8C1535] bg-[#FBF3F4] text-[#8C1535]" : "border-[#E2D6D1] bg-white text-[#40222F] hover:bg-[#F8F4F1]"}`}
              key={focus}
              onClick={() => applyPreset(focus, pause)}
              type="button"
            >
              {focus} · {pause}
            </button>
          ))}
          <button
            className="min-h-9 rounded-md border border-[#E2D6D1] bg-white px-3 font-medium text-[#40222F] text-xs hover:bg-[#F8F4F1]"
            onClick={() => setSettingsOpen(true)}
            type="button"
          >
            Personalizar
          </button>
        </fieldset>
      ) : null}

      <div className="mx-auto mt-8 grid w-full max-w-[300px] place-items-center">
        <div
          aria-label={`Tempo ${formatDuration(shownSeconds)}`}
          className="relative grid aspect-square w-full place-items-center rounded-full"
          role="timer"
        >
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full -rotate-90"
            viewBox="0 0 240 240"
          >
            <circle
              cx="120"
              cy="120"
              fill="none"
              r="108"
              stroke="#E9DEDA"
              strokeWidth="8"
            />
            <circle
              cx="120"
              cy="120"
              fill="none"
              r="108"
              stroke="#8C1535"
              strokeDasharray={`${Math.PI * 216}`}
              strokeDashoffset={`${Math.PI * 216 * progress}`}
              strokeLinecap="round"
              strokeWidth="8"
              style={{ transition: "stroke-dashoffset 400ms linear" }}
            />
          </svg>
          <div className="text-center">
            <p className="font-display text-5xl text-[#40222F] tabular-nums tracking-tight sm:text-6xl">
              {experience === "STOPWATCH"
                ? formatDuration(shownSeconds)
                : `${Math.floor(shownSeconds / 60)
                    .toString()
                    .padStart(
                      2,
                      "0"
                    )}:${(shownSeconds % 60).toString().padStart(2, "0")}`}
            </p>
            <p className="mt-2 text-[#7A5A69] text-sm">
              {currentProgressStatus}
            </p>
            {state.active?.mode === "FOCUS" ? (
              <p className="mt-1 font-mono text-[#8C1535] text-[10px] uppercase tracking-[.18em]">
                Foco{" "}
                {(todayStudyHistory.filter((item) => item.mode === "FOCUS")
                  .length %
                  settingsDraft.longBreakEvery) +
                  1}{" "}
                de {settingsDraft.longBreakEvery}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {phasePrompt && !focusMode ? (
        <div
          aria-live="assertive"
          className="mx-auto mt-5 max-w-xl rounded-xl border border-[#E7C8CE] bg-[#FBF3F4] p-4 text-center"
          role="alert"
        >
          <p className="font-medium text-[#40222F]">
            Foco concluído. Hora da pausa de{" "}
            {Math.round(phasePrompt.durationSeconds / 60)} minutos.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                startPomodoroPhase(
                  phasePrompt.mode,
                  phasePrompt.durationSeconds
                )
              }
              type="button"
            >
              Começar a pausa
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                startPomodoroPhase("FOCUS", settingsDraft.focusMinutes * 60)
              }
              type="button"
              variant="outline"
            >
              Pular
            </Button>
          </div>
        </div>
      ) : null}

      {experience === "COUNTDOWN" && !state.active ? (
        <label
          className="mx-auto mt-6 grid max-w-64 gap-1.5 font-medium text-[#40222F] text-sm"
          htmlFor="countdown-duration"
        >
          Duração em minutos
          <Input
            id="countdown-duration"
            max={1440}
            min={1}
            onChange={(event) =>
              setCountdownMinutes(Number(event.target.value))
            }
            type="number"
            value={countdownMinutes}
          />
        </label>
      ) : null}
      {state.active ? (
        <label className="mx-auto mt-6 grid w-full max-w-xl gap-1.5 font-medium text-[#7A5A69] text-xs">
          Vincular à sessão
          <select
            className="h-11 rounded-md border border-[#E2D6D1] bg-white px-3 text-[#40222F] text-sm"
            disabled={pending || activeFromOtherDevice}
            onChange={(event) =>
              sendAction({
                action: "link",
                linkedResourceId: event.target.value || null,
              })
            }
            value={state.active.linkedResourceId ?? ""}
          >
            <option value="">Sem vínculo</option>
            {linkResources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.title} · {resource.context}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="order-2 mx-auto mt-7 grid w-full max-w-xl gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 font-medium text-[#7A5A69] text-xs">
            Vincular a (opcional)
            <select
              className="h-11 rounded-md border border-[#E2D6D1] bg-white px-3 text-[#40222F] text-sm"
              onChange={(event) => setLinkedResourceId(event.target.value)}
              value={linkedResourceId}
            >
              <option value="">Sem vínculo</option>
              {linkResources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.title} · {resource.context}
                </option>
              ))}
            </select>
          </label>
          <label
            className="grid gap-1.5 font-medium text-[#7A5A69] text-xs"
            htmlFor="timer-session-title"
          >
            Nome da sessão (opcional)
            <Input
              id="timer-session-title"
              maxLength={180}
              onChange={(event) => setSessionName(event.target.value)}
              placeholder="Ex.: Revisão de bioestatística"
              value={sessionName}
            />
          </label>
          <p className="text-[#7A5A69] text-xs sm:col-span-2">
            Você pode começar sem vínculo e continuar seu estudo em qualquer
            tela.
          </p>
        </div>
      )}

      <div className="order-1 mt-7 flex flex-wrap justify-center gap-3">
        {alarmActive ? (
          <Button
            className="h-11 rounded-full border-[#8C1535] px-5 text-[#8C1535]"
            onClick={stopAlarm}
            type="button"
            variant="outline"
          >
            Parar alarme
          </Button>
        ) : null}
        {state.active ? (
          <>
            <Button
              className="h-12 min-w-40 rounded-full bg-[#8C1535] px-6 text-white hover:bg-[#6D102A]"
              disabled={
                pending ||
                Boolean(sessionReview) ||
                activeFromOtherDevice ||
                !clientId
              }
              onClick={() =>
                sendAction({
                  action: state.active?.pausedAt ? "resume" : "pause",
                })
              }
              type="button"
            >
              {state.active.pausedAt ? (
                <PlayIcon
                  aria-hidden="true"
                  className="mr-2 size-4 fill-current"
                />
              ) : (
                <PauseIcon aria-hidden="true" className="mr-2 size-4" />
              )}
              {state.active.pausedAt ? "Retomar" : "Pausar"}
            </Button>
            <Button
              className="h-12 rounded-full border-[#D8C7C2] px-6 text-[#6C4857]"
              disabled={pending || activeFromOtherDevice || !clientId}
              onClick={() => sendAction({ action: "stop" })}
              type="button"
              variant="outline"
            >
              <SquareIcon
                aria-hidden="true"
                className="mr-2 size-4 fill-current"
              />
              Encerrar e salvar
            </Button>
          </>
        ) : (
          <>
            <Button
              className="h-12 min-w-40 rounded-md bg-[#8C1535] px-7 text-white hover:bg-[#6D102A]"
              disabled={pending || Boolean(sessionReview)}
              onClick={startTimer}
              type="button"
            >
              <PlayIcon
                aria-hidden="true"
                className="mr-2 size-4 fill-current"
              />
              Começar
            </Button>
            <Button
              className="h-12 rounded-md border-[#8C1535] px-6 text-[#8C1535]"
              onClick={() => setFocusMode(true)}
              type="button"
              variant="outline"
            >
              Modo foco
            </Button>
          </>
        )}
      </div>

      {settingsPanel}
      <output aria-live="polite" className="sr-only">
        {announcement}
      </output>
    </div>
  );
}
