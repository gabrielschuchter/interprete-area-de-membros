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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import { toast } from "@repo/design-system/lib/toast";
import {
  Clock3Icon,
  PauseIcon,
  PlayIcon,
  Settings2Icon,
  SquareIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { loadPlannerNotesAction } from "@/app/(authenticated)/ferramentas/actions";
import type { getActiveFocusTimerState } from "@/lib/focus-timer";
import type { getPlannerNotes } from "@/lib/planner-notes";

type LessonTimerState = Awaited<ReturnType<typeof getActiveFocusTimerState>>;
type LessonNotesData = Awaited<ReturnType<typeof getPlannerNotes>>;
type LessonTimer = NonNullable<LessonTimerState["active"]>;
type TimerReview = NonNullable<LessonTimerState["pendingReview"]>;

type TimerAction =
  | {
      action: "start";
      clientId: string;
      linkedResourceId: string | null;
    }
  | { action: "pause" | "resume" | "stop" }
  | { action: "link"; linkedResourceId: string | null }
  | { action: "claim"; sessionId: string; clientId: string }
  | {
      action: "review";
      id: string;
      note: string;
      saveStudy: boolean;
    };

const LessonNotesPanel = dynamic(
  () =>
    import("@/app/(authenticated)/ferramentas/notes-workspace").then(
      (module) => module.LessonNotesPanel
    ),
  {
    loading: () => (
      <output
        aria-busy="true"
        className="grid min-h-20 place-items-center text-[#7A5A69] text-sm"
      >
        Carregando notas…
      </output>
    ),
  }
);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const formatTimer = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const readJson = async <T,>(response: Response): Promise<T> => {
  const value = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(value.error || "Não foi possível atualizar o cronômetro.");
  }
  return value;
};

const timerActionPayload = (action: TimerAction, focusMinutes: number) => {
  if (action.action !== "start") {
    return action;
  }
  return {
    ...action,
    durationSeconds: focusMinutes * 60,
    linkedResourceType: action.linkedResourceId ? "LESSON" : null,
    mode: "FOCUS",
    title: null,
  };
};

const successMessageForAction = (
  action: TimerAction,
  next: LessonTimerState
) => {
  switch (action.action) {
    case "start":
      return "Cronômetro iniciado.";
    case "pause":
      return "Cronômetro pausado.";
    case "resume":
      return "Cronômetro retomado.";
    case "stop":
      return next.pendingReview
        ? "Revise a sessão antes de registrá-la."
        : null;
    case "review":
      return action.saveStudy
        ? "Sessão registrada no histórico de estudo."
        : "Sessão descartada.";
    case "claim":
      return "Sessão sincronizada com este aparelho.";
    case "link":
      return "Sessão vinculada a esta aula.";
    default: {
      const unreachableAction: never = action;
      return `Ação de cronômetro desconhecida: ${unreachableAction}`;
    }
  }
};

const timerSecondsFromState = (
  active: LessonTimer | null,
  tick: number,
  syncedAt: number,
  focusMinutes: number
) => {
  if (!active) {
    return focusMinutes * 60;
  }
  const elapsed =
    active.elapsedSeconds +
    (active.runStartedAt ? Math.floor((tick - syncedAt) / 1000) : 0);
  if (active.durationSeconds) {
    return Math.max(0, active.durationSeconds - elapsed);
  }
  return elapsed;
};

const timerStatusForLesson = (active: LessonTimer | null, lessonId: string) => {
  if (!active) {
    return null;
  }
  if (active.linkedResourceId === lessonId) {
    return "Vinculado a esta aula";
  }
  if (active.linkedResourceId) {
    return "Sessão vinculada a outra aula";
  }
  return "Sessão sem vínculo";
};

const timerBadgeForLesson = (
  active: LessonTimer | null,
  lessonId: string,
  linkedOnStart: boolean
) => {
  if (!active) {
    return linkedOnStart ? "Vinculado a esta aula" : "Sem vínculo";
  }
  if (active.linkedResourceId === lessonId) {
    return "Vinculado a esta aula";
  }
  return "Sem vínculo com esta aula";
};

const loadErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function useLessonTimer(lessonId: string, open: boolean) {
  const [timerState, setTimerState] = useState<LessonTimerState | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [linkedOnStart, setLinkedOnStart] = useState(true);
  const [timerPending, setTimerPending] = useState(false);
  const [timerLoading, setTimerLoading] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [syncedAt, setSyncedAt] = useState(Date.now());
  const [reviewNote, setReviewNote] = useState("");
  const reviewSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const current = window.localStorage.getItem(
        "interprete:focus-timer-client"
      );
      if (current && uuidPattern.test(current)) {
        setClientId(current);
      } else {
        const next = window.crypto.randomUUID();
        window.localStorage.setItem("interprete:focus-timer-client", next);
        setClientId(next);
      }
    } catch {
      setClientId(window.crypto.randomUUID());
    }
  }, []);

  const syncTimer = useCallback(async () => {
    const next = await readJson<LessonTimerState>(
      await fetch("/api/focus-timer?compact=1", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
    );
    setTimerState(next);
    setSyncedAt(Date.now());
    if (next.active) {
      setLinkedOnStart(next.active.linkedResourceId === lessonId);
    }
    if (next.pendingReview?.id !== reviewSessionIdRef.current) {
      reviewSessionIdRef.current = next.pendingReview?.id ?? null;
      setReviewNote(next.pendingReview?.sessionNote ?? "");
    }
    return next;
  }, [lessonId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let current = true;
    let syncing = false;
    let hasSynced = false;
    const refresh = async () => {
      if (!current || syncing) {
        return;
      }
      syncing = true;
      if (!hasSynced) {
        setTimerLoading(true);
      }
      try {
        await syncTimer();
        hasSynced = true;
      } catch (error) {
        if (current) {
          toast.error(
            loadErrorMessage(error, "Não foi possível carregar o cronômetro.")
          );
        }
      } finally {
        syncing = false;
        if (current) {
          setTimerLoading(false);
        }
      }
    };
    refresh().catch(() => undefined);
    const poll = window.setInterval(
      () => refresh().catch(() => undefined),
      15_000
    );
    const clock = window.setInterval(() => setTick(Date.now()), 1000);
    return () => {
      current = false;
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [open, syncTimer]);

  const sendTimerAction = async (action: TimerAction) => {
    if (timerPending) {
      return;
    }
    setTimerPending(true);
    try {
      const payload = timerActionPayload(
        action,
        timerState?.settings.focusMinutes ?? 25
      );
      await readJson<{ result: unknown }>(
        await fetch("/api/focus-timer", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
      );
      const next = await syncTimer();
      const message = successMessageForAction(action, next);
      if (message) {
        toast.success(message);
      }
    } catch (error) {
      toast.error(
        loadErrorMessage(error, "Não foi possível atualizar o cronômetro.")
      );
    } finally {
      setTimerPending(false);
    }
  };

  const active = timerState?.active ?? null;
  const review = timerState?.pendingReview ?? null;
  const focusMinutes = timerState?.settings.focusMinutes ?? 25;
  const seconds = timerSecondsFromState(active, tick, syncedAt, focusMinutes);
  const activeFromOtherDevice = Boolean(
    active && clientId && active.clientId !== clientId
  );

  const reviewSession = (saveStudy: boolean) => {
    if (!review) {
      return Promise.resolve();
    }
    return sendTimerAction({
      action: "review",
      id: review.id,
      note: reviewNote,
      saveStudy,
    });
  };

  return {
    active,
    activeFromOtherDevice,
    clientId,
    focusMinutes,
    linkedOnStart,
    pending: timerPending,
    review,
    reviewNote,
    seconds,
    sendTimerAction,
    setLinkedOnStart,
    setReviewNote,
    timerLoading,
    reviewSession,
  };
}

function useLessonNotes(
  lessonId: string,
  open: boolean,
  initialNotes: LessonNotesData | null
) {
  const [notesData, setNotesData] = useState(initialNotes);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  const loadLessonNotes = useCallback(async () => {
    if (requestInFlight.current || notesData) {
      return;
    }
    requestInFlight.current = true;
    setNotesLoading(true);
    setNotesError(null);
    try {
      const next = await loadPlannerNotesAction({
        linkedResourceId: lessonId,
        limit: 6,
      });
      setNotesData(next);
    } catch (error) {
      setNotesError(
        loadErrorMessage(
          error,
          "Não foi possível carregar as notas desta aula."
        )
      );
    } finally {
      requestInFlight.current = false;
      setNotesLoading(false);
    }
  }, [lessonId, notesData]);

  useEffect(() => {
    if (open && !notesData) {
      loadLessonNotes().catch(() => undefined);
    }
  }, [loadLessonNotes, notesData, open]);

  return { loadLessonNotes, notesData, notesError, notesLoading };
}

function TimerControls({
  active,
  activeFromOtherDevice,
  clientId,
  linkedOnStart,
  lessonId,
  loading,
  pending,
  reviewPending,
  onAction,
}: {
  readonly active: LessonTimer | null;
  readonly activeFromOtherDevice: boolean;
  readonly clientId: string | null;
  readonly linkedOnStart: boolean;
  readonly lessonId: string;
  readonly loading: boolean;
  readonly pending: boolean;
  readonly reviewPending: boolean;
  readonly onAction: (action: TimerAction) => Promise<void>;
}) {
  if (!active) {
    return (
      <div className="flex shrink-0 gap-2">
        <Button
          className="h-11 min-w-[112px] rounded-md border-2 border-[#8C1535] bg-[#8C1535] px-6 font-semibold text-white hover:bg-[#6D102A]"
          disabled={pending || loading || !clientId || reviewPending}
          onClick={() =>
            clientId &&
            onAction({
              action: "start",
              clientId,
              linkedResourceId: linkedOnStart ? lessonId : null,
            })
          }
          type="button"
        >
          {loading ? "Carregando" : "Começar"}
        </Button>
        <Button
          aria-label="Configurações do cronômetro"
          asChild
          className="hidden size-11 border-[#E2D6D1] text-[#7A5A69] md:inline-flex"
          size="icon"
          variant="outline"
        >
          <Link href="/ferramentas?view=timer&settings=1">
            <Settings2Icon aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  if (activeFromOtherDevice) {
    return (
      <Button
        className="min-h-11 bg-[#8C1535] text-white hover:bg-[#6D102A]"
        disabled={pending || !clientId}
        onClick={() =>
          clientId &&
          onAction({ action: "claim", sessionId: active.id, clientId })
        }
        type="button"
      >
        Continuar aqui
      </Button>
    );
  }

  return (
    <div className="flex shrink-0 gap-2">
      <Button
        aria-label={
          active.pausedAt ? "Retomar cronômetro" : "Pausar cronômetro"
        }
        className="size-11 border-[#D8C7C2] text-[#8C1535]"
        disabled={pending}
        onClick={() =>
          onAction({ action: active.pausedAt ? "resume" : "pause" })
        }
        size="icon"
        type="button"
        variant="outline"
      >
        {active.pausedAt ? (
          <PlayIcon aria-hidden="true" className="size-4 fill-current" />
        ) : (
          <PauseIcon aria-hidden="true" className="size-4" />
        )}
      </Button>
      <Button
        aria-label="Encerrar e revisar sessão"
        className="size-11 border-[#D8C7C2] text-[#6C4857]"
        disabled={pending}
        onClick={() => onAction({ action: "stop" })}
        size="icon"
        type="button"
        variant="outline"
      >
        <SquareIcon aria-hidden="true" className="size-3.5 fill-current" />
      </Button>
    </div>
  );
}

function LessonTimerCard({
  active,
  activeFromOtherDevice,
  clientId,
  linkedOnStart,
  lessonId,
  loading,
  pending,
  reviewPending,
  seconds,
  setLinkedOnStart,
  onAction,
}: {
  readonly active: LessonTimer | null;
  readonly activeFromOtherDevice: boolean;
  readonly clientId: string | null;
  readonly linkedOnStart: boolean;
  readonly lessonId: string;
  readonly loading: boolean;
  readonly pending: boolean;
  readonly reviewPending: boolean;
  readonly seconds: number;
  readonly setLinkedOnStart: Dispatch<SetStateAction<boolean>>;
  readonly onAction: (action: TimerAction) => Promise<void>;
}) {
  const timerStatus = timerStatusForLesson(active, lessonId);
  const badgeText = timerBadgeForLesson(active, lessonId, linkedOnStart);
  const canLinkToLesson = Boolean(
    active && active.linkedResourceId !== lessonId && !activeFromOtherDevice
  );
  const canStopFromOtherDevice = activeFromOtherDevice;

  return (
    <section aria-label="Cronômetro da aula">
      <div className="rounded-lg border border-[#E2D6D1] bg-white p-3">
        <div className="mb-3 hidden items-center justify-between text-xs md:flex">
          <span className="font-semibold text-[#7A5A69]">Cronômetro</span>
          <span className="rounded-md border border-[#8C1535] px-2 py-1 font-medium text-[#8C1535]">
            {badgeText}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display font-semibold text-[#40222F] text-[30px] leading-none">
              {formatTimer(seconds)}
            </p>
            <p className="truncate text-[#7A5A69] text-xs leading-[1.3]">
              {timerStatus ? (
                timerStatus
              ) : (
                <>
                  <span className="md:hidden">
                    {linkedOnStart
                      ? "Vinculado a esta aula · "
                      : "Sessão sem vínculo · "}
                  </span>
                  <span className="hidden md:inline">
                    {linkedOnStart
                      ? "Padrão para esta aula. "
                      : "Sessão sem vínculo. "}
                  </span>
                  <button
                    className="font-semibold text-[#8C1535] underline-offset-2 hover:underline"
                    onClick={() => setLinkedOnStart((current) => !current)}
                    type="button"
                  >
                    <span className="md:hidden">
                      {linkedOnStart ? "sem vínculo" : "vincular a esta aula"}
                    </span>
                    <span className="hidden md:inline">
                      {linkedOnStart
                        ? "Começar sem vínculo"
                        : "Vincular a esta aula"}
                    </span>
                  </button>
                </>
              )}
            </p>
          </div>
          <TimerControls
            active={active}
            activeFromOtherDevice={activeFromOtherDevice}
            clientId={clientId}
            lessonId={lessonId}
            linkedOnStart={linkedOnStart}
            loading={loading}
            onAction={onAction}
            pending={pending}
            reviewPending={reviewPending}
          />
        </div>
        {canLinkToLesson ? (
          <Button
            className="mt-1 min-h-9 px-0 text-[#8C1535] text-xs"
            disabled={pending}
            onClick={() =>
              onAction({ action: "link", linkedResourceId: lessonId })
            }
            type="button"
            variant="link"
          >
            Vincular sessão a esta aula
          </Button>
        ) : null}
        {canStopFromOtherDevice ? (
          <Button
            className="mt-1 min-h-9 px-0 text-[#6C4857] text-xs"
            disabled={pending}
            onClick={() => onAction({ action: "stop" })}
            type="button"
            variant="link"
          >
            Encerrar no outro aparelho
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function LessonNotesContent({
  initialData,
  lessonHref,
  lessonId,
  lessonTitle,
  loading,
  error,
  retry,
}: {
  readonly initialData: LessonNotesData | null;
  readonly lessonHref: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly loading: boolean;
  readonly error: string | null;
  readonly retry: () => Promise<void>;
}) {
  if (initialData) {
    return (
      <LessonNotesPanel
        initialData={initialData}
        lessonId={lessonId}
        linkResources={[
          {
            context: "Aula",
            href: lessonHref,
            id: lessonId,
            shortLabel: "Aula",
            title: lessonTitle,
            type: "LESSON",
          },
        ]}
      />
    );
  }

  if (error) {
    return (
      <section aria-label="Notas desta aula" className="grid gap-3">
        <p className="text-[#7A5A69] text-sm">{error}</p>
        <Button
          className="min-h-11 w-full border-[#8C1535] text-[#8C1535]"
          onClick={() => retry()}
          type="button"
          variant="outline"
        >
          Tentar carregar as notas novamente
        </Button>
      </section>
    );
  }

  return (
    <output
      aria-busy={loading}
      aria-label="Notas desta aula"
      className="grid min-h-20 place-items-center text-[#7A5A69] text-sm"
    >
      {loading ? "Carregando notas…" : "Notas desta aula"}
    </output>
  );
}

function SessionReviewDialog({
  note,
  pending,
  review,
  setNote,
  reviewSession,
}: {
  readonly note: string;
  readonly pending: boolean;
  readonly review: TimerReview | null;
  readonly setNote: Dispatch<SetStateAction<string>>;
  readonly reviewSession: (saveStudy: boolean) => Promise<void>;
}) {
  return (
    <Dialog open={Boolean(review)}>
      <DialogContent className="border-[#E2D6D1] bg-[#FBF8F5] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#40222F]">
            Revisar sessão
          </DialogTitle>
          <DialogDescription className="text-[#7A5A69]">
            Registre o tempo de estudo ou descarte esta sessão.
          </DialogDescription>
        </DialogHeader>
        <label
          className="grid gap-2 text-[#6C4857] text-sm"
          htmlFor="lesson-timer-review-note"
        >
          Nota da sessão (opcional)
          <Input
            id="lesson-timer-review-note"
            maxLength={4000}
            onChange={(event) => setNote(event.target.value)}
            value={note}
          />
        </label>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            disabled={pending}
            onClick={() => reviewSession(false)}
            type="button"
            variant="outline"
          >
            Descartar
          </Button>
          <Button
            className="bg-[#8C1535] text-white hover:bg-[#6D102A]"
            disabled={pending}
            onClick={() => reviewSession(true)}
            type="button"
          >
            Registrar estudo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LessonToolsDrawer({
  initialNotes,
  lessonHref,
  lessonId,
  lessonTitle,
}: {
  readonly initialNotes: LessonNotesData | null;
  readonly lessonHref: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const timer = useLessonTimer(lessonId, open);
  const notes = useLessonNotes(lessonId, open, initialNotes);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <Sheet modal={isMobile} onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          aria-label="Abrir ferramentas da aula"
          className="fixed top-[45vh] right-[18px] z-40 h-12 rounded-full bg-[#8C1535] px-[18px] text-white shadow-[0_8px_20px_rgba(64,34,47,.35)] hover:bg-[#6D102A]"
          type="button"
        >
          <Clock3Icon aria-hidden="true" className="mr-2 size-4" />
          Ferramentas
        </Button>
      </SheetTrigger>
      <SheetContent
        className={
          isMobile
            ? "max-h-[74dvh] w-full gap-0 rounded-t-[12px] border-[#E2D6D1] bg-white px-5 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(64,34,47,.18)]"
            : "inset-y-auto top-14 right-0 bottom-0 h-auto w-[400px] max-w-[calc(100vw-248px)] gap-0 border-[#E2D6D1] border-l bg-white p-5 shadow-[-8px_0_24px_rgba(64,34,47,.08)]"
        }
        data-lesson-tools-sheet
        side={isMobile ? "bottom" : "right"}
      >
        {isMobile ? (
          <div
            aria-hidden="true"
            className="absolute top-[10px] left-1/2 h-1 w-10 -translate-x-1/2 rounded-sm bg-[#BFA9A3]"
          />
        ) : null}
        <SheetHeader className="flex-row items-center justify-between border-b-0 px-0 pt-7 pb-2 text-left md:border-b md:pt-0 md:pb-4">
          <SheetTitle className="font-display text-[#40222F] text-[22px] leading-[1.25] tracking-[-.005em]">
            <span className="md:hidden">Ferramentas da aula</span>
            <span className="hidden md:inline">Ferramentas</span>
          </SheetTitle>
          <SheetDescription className="sr-only">{lessonTitle}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-[14px] overflow-y-auto pt-1 pb-4 md:pt-5">
          <LessonTimerCard
            active={timer.active}
            activeFromOtherDevice={timer.activeFromOtherDevice}
            clientId={timer.clientId}
            lessonId={lessonId}
            linkedOnStart={timer.linkedOnStart}
            loading={timer.timerLoading}
            onAction={timer.sendTimerAction}
            pending={timer.pending}
            reviewPending={Boolean(timer.review)}
            seconds={timer.seconds}
            setLinkedOnStart={timer.setLinkedOnStart}
          />
          <LessonNotesContent
            error={notes.notesError}
            initialData={notes.notesData}
            lessonHref={lessonHref}
            lessonId={lessonId}
            lessonTitle={lessonTitle}
            loading={notes.notesLoading}
            retry={notes.loadLessonNotes}
          />
        </div>
      </SheetContent>
      <SessionReviewDialog
        note={timer.reviewNote}
        pending={timer.pending}
        review={timer.review}
        reviewSession={timer.reviewSession}
        setNote={timer.setReviewNote}
      />
    </Sheet>
  );
}
