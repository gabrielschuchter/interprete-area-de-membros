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
import { toast } from "@repo/design-system/lib/toast";
import { PauseIcon, PlayIcon, SquareIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  playTimerCompletionAlarm,
  startTimerTitleAlert,
  stopTimerCompletionAlarm,
  unlockTimerAudio,
} from "@/components/focus-timer-audio";

type TimerMode =
  | "FOCUS"
  | "SHORT_BREAK"
  | "LONG_BREAK"
  | "STOPWATCH"
  | "COUNTDOWN";
interface ActiveTimerSnapshot {
  clientId: string | null;
  durationSeconds: number | null;
  elapsedSeconds: number;
  id: string;
  mode: TimerMode;
  pausedAt: string | null;
  remainingSeconds: number | null;
  runStartedAt: string | null;
  startedAt: string;
  title: string | null;
}
interface ActiveTimerResponse {
  active: ActiveTimerSnapshot | null;
  completed: {
    id: string;
    mode: TimerMode;
    completed: boolean;
    elapsedSeconds: number;
    nextMode?: TimerMode;
    nextDurationSeconds?: number;
  } | null;
  pendingReview: {
    elapsedBeforePause: number;
    id: string;
    mode: TimerMode;
    sessionNote: string | null;
    title: string | null;
  } | null;
  settings: {
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    longBreakEvery: number;
    timerSoundEnabled: boolean;
    systemNotificationsEnabled: boolean;
    timerSoundType: "SOFT_BELL" | "WOOD" | "DIGITAL" | "NONE";
    timerVolume: number;
    timerVibrationEnabled: boolean;
    timerAutoAdvance: boolean;
  };
}

interface TimerPhaseNotice {
  readonly durationSeconds: number;
  readonly mode: TimerMode;
}

interface TimerSessionReview {
  readonly id: string;
  readonly note: string;
}

const CLIENT_ID_PATTERN = /^[\da-f-]{36}$/i;

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
    return "Em andamento em outro aparelho";
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

const fetchState = async () => {
  const response = await fetch("/api/focus-timer?compact=1", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json()) as ActiveTimerResponse & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.error ?? "Não foi possível atualizar o cronômetro."
    );
  }
  return payload;
};

const notifyCompletion = (
  state: ActiveTimerResponse,
  id: string,
  setAlarmActive: (active: boolean) => void
) => {
  if (!state.completed?.completed) {
    return;
  }
  const message =
    state.completed.mode === "FOCUS" && !state.settings.timerAutoAdvance
      ? `Foco concluído. Hora da pausa de ${Math.round((state.completed.nextDurationSeconds ?? state.settings.shortBreakMinutes * 60) / 60)} minutos.`
      : "Sessão concluída. O tempo de foco foi salvo no histórico.";
  toast.success(message);
  playTimerCompletionAlarm(state.settings);
  if (
    state.settings.timerSoundEnabled &&
    state.settings.timerSoundType !== "NONE" &&
    state.settings.timerVolume > 0
  ) {
    setAlarmActive(true);
    window.setTimeout(() => setAlarmActive(false), 20_000);
  }
  startTimerTitleAlert();
  if (state.settings.timerVibrationEnabled && "vibrate" in navigator) {
    navigator.vibrate([180, 70, 180]);
  }
  if (
    state.settings.systemNotificationsEnabled &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification("Sessão concluída", {
      body: "O tempo de foco foi salvo no seu histórico de estudo.",
      tag: `focus-timer-${id}`,
    });
  }
};

const usePersistentTimerClientId = () => {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const storageKey = "interprete:focus-timer-client";
    try {
      const existing = window.localStorage.getItem(storageKey);
      if (existing && CLIENT_ID_PATTERN.test(existing)) {
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

  return clientId;
};

const useTimerTick = () => {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return tick;
};

const applyTimerSnapshot = (
  next: ActiveTimerResponse,
  completionId: string | null,
  setCompletionId: (id: string) => void,
  setPhaseNotice: (notice: TimerPhaseNotice | null) => void,
  setSessionReview: (
    update: (current: TimerSessionReview | null) => TimerSessionReview | null
  ) => void,
  setAlarmActive: (active: boolean) => void
) => {
  if (next.completed?.completed && completionId !== next.completed.id) {
    setCompletionId(next.completed.id);
    notifyCompletion(next, next.completed.id, setAlarmActive);
    if (
      next.completed.mode === "FOCUS" &&
      next.completed.nextMode &&
      next.completed.nextDurationSeconds &&
      !next.settings.timerAutoAdvance
    ) {
      setPhaseNotice({
        mode: next.completed.nextMode,
        durationSeconds: next.completed.nextDurationSeconds,
      });
    }
  }
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
};

const shouldSkipGlobalTimerSync = (pathname: string, onTimerPage: boolean) =>
  pathname === "/" || pathname.startsWith("/ferramentas/") || onTimerPage;

const useGlobalTimerSync = (
  pathname: string,
  onTimerPage: boolean,
  synchronize: () => Promise<void>
) => {
  useEffect(() => {
    if (shouldSkipGlobalTimerSync(pathname, onTimerPage)) {
      return;
    }
    let mounted = true;
    const synchronizeQuietly = () => synchronize().catch(() => undefined);
    synchronizeQuietly();
    const interval = window.setInterval(() => {
      if (mounted) {
        synchronizeQuietly();
      }
    }, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        synchronizeQuietly();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [onTimerPage, pathname, synchronize]);
};

const TimerPhaseNoticeView = ({
  alarmActive,
  durationSeconds,
  focusMinutes,
  mode,
  onDismiss,
  onStart,
  onStopAlarm,
  pending,
}: {
  readonly alarmActive: boolean;
  readonly durationSeconds: number;
  readonly focusMinutes: number;
  readonly mode: TimerMode;
  readonly onDismiss: () => void;
  readonly onStart: (mode: TimerMode, durationSeconds: number) => void;
  readonly onStopAlarm: () => void;
  readonly pending: boolean;
}) => (
  <aside
    aria-label="Aviso do cronômetro"
    className="fixed top-14 right-0 left-0 z-30 border-[#D9C8C3] border-b bg-[#FBF8F5] px-4 py-3 shadow-sm md:top-2 md:right-4 md:left-auto md:w-[min(560px,calc(100vw-2rem))] md:rounded-xl md:border"
  >
    <p className="font-medium text-[#40222F]">
      Foco concluído. Hora da pausa de {Math.round(durationSeconds / 60)}{" "}
      minutos.
    </p>
    <div className="mt-2 flex flex-wrap gap-2">
      <Button
        disabled={pending}
        onClick={() => onStart(mode, durationSeconds)}
        size="sm"
        type="button"
      >
        Começar a pausa
      </Button>
      <Button
        disabled={pending}
        onClick={() => onStart("FOCUS", focusMinutes * 60)}
        size="sm"
        type="button"
        variant="outline"
      >
        Pular
      </Button>
      {alarmActive && (
        <Button onClick={onStopAlarm} size="sm" type="button" variant="outline">
          Parar alarme
        </Button>
      )}
      <Button
        className="ml-auto"
        onClick={onDismiss}
        size="sm"
        type="button"
        variant="ghost"
      >
        Dispensar
      </Button>
    </div>
  </aside>
);

const TimerAlarmNoticeView = ({
  onStopAlarm,
}: {
  readonly onStopAlarm: () => void;
}) => (
  <aside
    aria-label="Alarme do cronômetro"
    className="fixed top-14 right-0 left-0 z-30 flex items-center justify-between gap-3 border-[#D9C8C3] border-b bg-[#FBF8F5] px-4 py-3 shadow-sm md:top-2 md:right-4 md:left-auto md:w-[min(560px,calc(100vw-2rem))] md:rounded-xl md:border"
  >
    <p className="font-medium text-[#40222F]">Fase do cronômetro concluída.</p>
    <Button onClick={onStopAlarm} size="sm" type="button" variant="outline">
      Parar alarme
    </Button>
  </aside>
);

const TimerSessionReviewDialog = ({
  onChangeNote,
  onReview,
  pending,
  sessionReview,
}: {
  readonly onChangeNote: (note: string) => void;
  readonly onReview: (saveStudy: boolean) => void;
  readonly pending: boolean;
  readonly sessionReview: TimerSessionReview;
}) => (
  <Dialog onOpenChange={() => undefined} open>
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
          Registre o tempo no seu histórico de estudo ou descarte a sessão. Você
          pode deixar uma anotação para lembrar do que estudou.
        </DialogDescription>
      </DialogHeader>
      <label className="grid gap-1.5 font-medium text-[#40222F] text-sm">
        Anotação da sessão (opcional)
        <textarea
          className="min-h-28 resize-y rounded-md border border-[#E2D6D1] bg-white p-3 font-normal text-sm"
          maxLength={4000}
          onChange={(event) => onChangeNote(event.target.value)}
          value={sessionReview.note}
        />
      </label>
      <DialogFooter className="flex-col-reverse sm:flex-row">
        <Button
          disabled={pending}
          onClick={() => onReview(false)}
          type="button"
          variant="outline"
        >
          Descartar sessão
        </Button>
        <Button
          className="bg-[#8C1535] text-white hover:bg-[#6D102A]"
          disabled={pending}
          onClick={() => onReview(true)}
          type="button"
        >
          Registrar no histórico de estudo
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const ActiveTimerControls = ({
  active,
  activeFromOtherDevice,
  alarmActive,
  clientId,
  detailsOpen,
  displayTime,
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
  readonly onFocus: () => void;
  readonly onPauseResume: () => void;
  readonly onStop: () => void;
  readonly onStopAlarm: () => void;
  readonly onToggleDetails: () => void;
  readonly pending: boolean;
}) => (
  <aside
    aria-label="Cronômetro em andamento"
    className="fixed top-14 right-0 left-0 z-30 border-[#D9C8C3] border-b bg-[#FBF8F5] px-4 py-2 shadow-sm md:top-1.5 md:right-[156px] md:left-auto md:w-auto md:rounded-full md:border md:px-2 md:py-1"
  >
    <div className="flex items-center justify-between gap-2 md:justify-start">
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
        <span className="max-w-36 truncate font-medium text-[#7A5A69] text-xs md:hidden">
          {active.title || labelForMode(active.mode)}
        </span>
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
        className="min-h-8 text-[#8C1535]"
        onClick={onStopAlarm}
        size="sm"
        type="button"
        variant="outline"
      >
        Parar alarme
      </Button>
    )}
    {detailsOpen && (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-[#E2D6D1] border-t pt-2 md:absolute md:top-11 md:right-0 md:mt-0 md:w-[340px] md:rounded-xl md:border md:bg-[#FBF8F5] md:p-4 md:shadow-xl">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[#40222F] text-lg">
            {active.title || labelForMode(active.mode)}
          </p>
          <p className="text-[#7A5A69] text-xs">
            {activeRemainingTimeLabel(active.remainingSeconds, displayTime)} ·{" "}
            {activeStatusLabel(activeFromOtherDevice, Boolean(active.pausedAt))}
          </p>
        </div>
        {activeFromOtherDevice && (
          <Button asChild size="sm" type="button">
            <Link href="/ferramentas?view=timer">Continuar neste aparelho</Link>
          </Button>
        )}
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

export const ActiveTimerPill = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<ActiveTimerResponse | null>(null);
  const [syncedAt, setSyncedAt] = useState(Date.now());
  const clientId = usePersistentTimerClientId();
  const tick = useTimerTick();
  const [pending, setPending] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [completionId, setCompletionId] = useState<string | null>(null);
  const [phaseNotice, setPhaseNotice] = useState<TimerPhaseNotice | null>(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const [sessionReview, setSessionReview] = useState<TimerSessionReview | null>(
    null
  );
  const onTimerPage =
    pathname === "/ferramentas" && searchParams.get("view") !== "notes";

  const synchronize = useCallback(async () => {
    const next = await fetchState();
    applyTimerSnapshot(
      next,
      completionId,
      setCompletionId,
      setPhaseNotice,
      setSessionReview,
      setAlarmActive
    );
    setState(next);
    setSyncedAt(Date.now());
  }, [completionId]);

  useGlobalTimerSync(pathname, onTimerPage, synchronize);

  const submitSessionReview = async (saveStudy: boolean) => {
    if (!sessionReview) {
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/focus-timer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "review",
          id: sessionReview.id,
          note: sessionReview.note,
          saveStudy,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        result?: { saved: boolean; studyLogged?: boolean };
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível revisar a sessão.");
      }
      await synchronize();
      let message = "Sessão descartada.";
      if (saveStudy) {
        message = result.result?.studyLogged
          ? "Sessão registrada no histórico de estudo."
          : "Sessão salva no histórico.";
      }
      toast.success(message);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível revisar a sessão."
      );
    } finally {
      setPending(false);
    }
  };

  const startPhase = async (mode: TimerMode, durationSeconds: number) => {
    if (!clientId) {
      return;
    }
    unlockTimerAudio();
    setPending(true);
    try {
      const response = await fetch("/api/focus-timer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "start",
          clientId,
          mode,
          durationSeconds,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error ?? "Não foi possível iniciar a próxima fase."
        );
      }
      setPhaseNotice(null);
      toast.success("Próxima fase iniciada");
      await synchronize();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a próxima fase."
      );
    } finally {
      setPending(false);
    }
  };

  const sendAction = async (action: "pause" | "resume" | "stop") => {
    unlockTimerAudio();
    setPending(true);
    try {
      const response = await fetch("/api/focus-timer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error ?? "Não foi possível atualizar o cronômetro."
        );
      }
      if (action === "stop") {
        setDetailsOpen(false);
        toast.success("Sessão encerrada. Revise o registro.");
      }
      await synchronize();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o cronômetro."
      );
    } finally {
      setPending(false);
    }
  };

  const active = onTimerPage ? null : (state?.active ?? null);
  const elapsed = active
    ? active.elapsedSeconds +
      (active.runStartedAt ? Math.floor((tick - syncedAt) / 1000) : 0)
    : 0;
  const displayTime = active?.durationSeconds
    ? Math.max(0, active.durationSeconds - elapsed)
    : elapsed;
  const activeFromOtherDevice = Boolean(
    active && clientId && active.clientId !== clientId
  );
  const stopAlarm = () => {
    stopTimerCompletionAlarm();
    setAlarmActive(false);
  };
  const changeReviewNote = (note: string) => {
    setSessionReview((current) => (current ? { ...current, note } : current));
  };

  return (
    <>
      {phaseNotice && !active && !sessionReview && (
        <TimerPhaseNoticeView
          alarmActive={alarmActive}
          durationSeconds={phaseNotice.durationSeconds}
          focusMinutes={state?.settings.focusMinutes ?? 25}
          mode={phaseNotice.mode}
          onDismiss={() => setPhaseNotice(null)}
          onStart={startPhase}
          onStopAlarm={stopAlarm}
          pending={pending}
        />
      )}
      {!(active || phaseNotice) && alarmActive && !sessionReview && (
        <TimerAlarmNoticeView onStopAlarm={stopAlarm} />
      )}
      {sessionReview && (
        <TimerSessionReviewDialog
          onChangeNote={changeReviewNote}
          onReview={submitSessionReview}
          pending={pending}
          sessionReview={sessionReview}
        />
      )}
      {active && (
        <ActiveTimerControls
          active={active}
          activeFromOtherDevice={activeFromOtherDevice}
          alarmActive={alarmActive}
          clientId={clientId}
          detailsOpen={detailsOpen}
          displayTime={displayTime}
          onFocus={() => router.push("/ferramentas?view=timer&focus=1")}
          onPauseResume={() => sendAction(active.pausedAt ? "resume" : "pause")}
          onStop={() => sendAction("stop")}
          onStopAlarm={stopAlarm}
          onToggleDetails={() => setDetailsOpen((open) => !open)}
          pending={pending}
        />
      )}
      {active && (
        <p aria-live="off" className="sr-only">
          Cronômetro sincronizado com o servidor
        </p>
      )}
    </>
  );
};
