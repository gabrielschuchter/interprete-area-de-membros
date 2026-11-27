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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  runTimerCompletionAlerts,
  stopTimerCompletionAlarm,
  unlockTimerAudio,
} from "@/components/focus-timer-audio";
import { TIMER_REFRESH_EVENT } from "@/components/focus-timer-refresh-event";
import type { ActiveTimerSnapshot, TimerMode } from "./active-timer-controls";

// A janela do cronômetro em andamento só baixa quando há um cronômetro
// rodando; assim não pesa nas páginas de quem não usa o cronômetro.
const ActiveTimerControls = lazy(() =>
  import("./active-timer-controls").then((module) => ({
    default: module.ActiveTimerControls,
  }))
);

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
    completedAt?: string | Date | null;
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
  runTimerCompletionAlerts(state.settings, {
    sessionId: id,
    mode: state.completed.mode,
    onAlarmActive: () => {
      setAlarmActive(true);
      window.setTimeout(() => setAlarmActive(false), 20_000);
    },
  });
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

let lastGlobalTimerSync = 0;

const shouldSkipGlobalTimerSync = (pathname: string, onTimerPage: boolean) =>
  pathname === "/" || pathname.startsWith("/ferramentas/") || onTimerPage;

const useGlobalTimerSync = (
  pathname: string,
  onTimerPage: boolean,
  synchronize: () => Promise<void>
) => {
  useEffect(() => {
    if (shouldSkipGlobalTimerSync(pathname, onTimerPage)) {
      // Nas páginas do próprio cronômetro o estado pode mudar; ao sair delas
      // a pílula relê na hora.
      lastGlobalTimerSync = 0;
      return;
    }
    let mounted = true;
    // Em conexão ruim cada pedido conta: não repete a leitura a cada troca de
    // página (só se a última tiver mais de 15 s) e não lê com a aba oculta.
    const synchronizeQuietly = (force = false) => {
      const now = Date.now();
      if (!force && now - lastGlobalTimerSync < 15_000) {
        return;
      }
      lastGlobalTimerSync = now;
      synchronize().catch(() => {
        lastGlobalTimerSync = 0;
      });
    };
    synchronizeQuietly();
    const interval = window.setInterval(() => {
      if (mounted && document.visibilityState === "visible") {
        synchronizeQuietly(true);
      }
    }, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        synchronizeQuietly();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    // Outras telas (ex.: "Abrir material" na biblioteca) iniciam o cronômetro
    // e pedem para a pílula reler o estado na hora.
    const onRefresh = () => synchronizeQuietly(true);
    window.addEventListener(TIMER_REFRESH_EVENT, onRefresh);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(TIMER_REFRESH_EVENT, onRefresh);
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
  canReopen,
  onChangeNote,
  onReopen,
  onReview,
  pending,
  sessionReview,
}: {
  readonly canReopen: boolean;
  readonly onChangeNote: (note: string) => void;
  readonly onReopen: () => void;
  readonly onReview: (saveStudy: boolean) => void;
  readonly pending: boolean;
  readonly sessionReview: TimerSessionReview;
}) => (
  <Dialog
    onOpenChange={(open) => {
      // O X volta ao cronômetro; só não vale para sessão que terminou sozinha.
      if (!open && canReopen && !pending) {
        onReopen();
      }
    }}
    open
  >
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
      <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
        </div>
        {canReopen ? (
          <Button
            className="self-start text-[#8C1535] hover:bg-[#F1EBE8] hover:text-[#6D102A]"
            disabled={pending}
            onClick={onReopen}
            type="button"
            variant="ghost"
          >
            Voltar ao cronômetro
          </Button>
        ) : null}
      </DialogFooter>
    </DialogContent>
  </Dialog>
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

  const reopenSession = async () => {
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
        body: JSON.stringify({ action: "reopen", id: sessionReview.id }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error ?? "Não foi possível voltar ao cronômetro."
        );
      }
      await synchronize();
      toast.success("Cronômetro retomado em pausa. Toque em Continuar.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível voltar ao cronômetro."
      );
    } finally {
      setPending(false);
    }
  };

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

  const claimActive = async (sessionId: string) => {
    if (!clientId) {
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
        body: JSON.stringify({ action: "claim", sessionId, clientId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error ?? "Não foi possível assumir o cronômetro."
        );
      }
      toast.success("Cronômetro assumido neste aparelho.");
      await synchronize();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível assumir o cronômetro."
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
          canReopen={Boolean(
            state?.pendingReview && !state.pendingReview.completedAt
          )}
          onChangeNote={changeReviewNote}
          onReopen={reopenSession}
          onReview={submitSessionReview}
          pending={pending}
          sessionReview={sessionReview}
        />
      )}
      {active && (
        <Suspense fallback={null}>
          <ActiveTimerControls
            active={active}
            activeFromOtherDevice={activeFromOtherDevice}
            alarmActive={alarmActive}
            clientId={clientId}
            detailsOpen={detailsOpen}
            displayTime={displayTime}
            onClaim={() => claimActive(active.id)}
            onFocus={() => router.push("/ferramentas?view=timer&focus=1")}
            onPauseResume={() =>
              sendAction(active.pausedAt ? "resume" : "pause")
            }
            onStop={() => sendAction("stop")}
            onStopAlarm={stopAlarm}
            onToggleDetails={() => setDetailsOpen((open) => !open)}
            pending={pending}
          />
        </Suspense>
      )}
      {active && (
        <p aria-live="off" className="sr-only">
          Cronômetro sincronizado com o servidor
        </p>
      )}
    </>
  );
};
