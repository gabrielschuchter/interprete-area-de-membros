export type ToastType = "error" | "info" | "loading" | "success" | "warning";

export interface ToastAction {
  readonly label: string;
  readonly onSelect: () => void;
}

export interface ToastRecord {
  readonly actions?: readonly ToastAction[];
  readonly id: string;
  readonly message: string;
  readonly type: ToastType;
  readonly variant?: "exercise" | "library";
}

type ToastListener = () => void;

const EMPTY_TOASTS: readonly ToastRecord[] = [];
const listeners = new Set<ToastListener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const actionToastTimers = new Map<
  string,
  {
    handle: ReturnType<typeof setTimeout>;
    pausedFor: Set<"focus" | "pointer">;
    remaining: number;
    startedAt: number;
  }
>();
let records: readonly ToastRecord[] = EMPTY_TOASTS;
let nextId = 0;

const emit = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const subscribeToToasts = (listener: ToastListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getToastSnapshot = () => records;

export const getServerToastSnapshot = () => EMPTY_TOASTS;

const dismissToast = (id: string) => {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }

  const actionTimer = actionToastTimers.get(id);
  if (actionTimer) {
    clearTimeout(actionTimer.handle);
    actionToastTimers.delete(id);
  }

  records = records.filter((record) => record.id !== id);
  emit();
};

const scheduleActionToast = (
  id: string,
  remaining: number,
  pausedFor = new Set<"focus" | "pointer">()
) => {
  const timer = {
    handle: setTimeout(() => dismissToast(id), remaining),
    pausedFor,
    remaining,
    startedAt: Date.now(),
  };
  actionToastTimers.set(id, timer);
};

const pauseActionToast = (id: string, reason: "focus" | "pointer") => {
  const timer = actionToastTimers.get(id);
  if (!timer || timer.pausedFor.has(reason)) {
    return;
  }
  timer.pausedFor.add(reason);
  if (timer.pausedFor.size === 1) {
    clearTimeout(timer.handle);
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
  }
};

const resumeActionToast = (id: string, reason: "focus" | "pointer") => {
  const timer = actionToastTimers.get(id);
  if (!timer || !timer.pausedFor.delete(reason) || timer.pausedFor.size > 0) {
    return;
  }
  scheduleActionToast(id, timer.remaining, timer.pausedFor);
};

const createActionToast = (
  variant: "exercise" | "library",
  message: string,
  actions: readonly ToastAction[],
  type: ToastType
) => {
  const id = "toast-" + nextId++;
  records = [
    ...records,
    {
      actions,
      id,
      message,
      type,
      variant,
    },
  ];
  emit();
  if (typeof window !== "undefined") {
    scheduleActionToast(id, 5000);
  }
  return id;
};

const createToast = (
  type: ToastType,
  message: string,
  options?: {
    readonly action?: {
      readonly label: string;
      readonly onClick: () => void;
    };
  },
  duration = type === "loading" ? Number.POSITIVE_INFINITY : 4200
) => {
  const id = "toast-" + nextId++;
  records = [
    ...records,
    {
      id,
      message,
      type,
      actions: options?.action
        ? [{ label: options.action.label, onSelect: options.action.onClick }]
        : undefined,
    },
  ];
  emit();

  if (typeof window !== "undefined" && Number.isFinite(duration)) {
    if (options?.action) {
      scheduleActionToast(id, duration);
    } else {
      timers.set(id, setTimeout(() => dismissToast(id), duration));
    }
  }

  return id;
};

export const toast = {
  dismiss: dismissToast,
  error: (message: string, options?: Parameters<typeof createToast>[2]) =>
    createToast("error", message, options),
  info: (message: string, options?: Parameters<typeof createToast>[2]) =>
    createToast("info", message, options),
  loading: (message: string) => createToast("loading", message),
  success: (message: string, options?: Parameters<typeof createToast>[2]) =>
    createToast("success", message, options),
  warning: (message: string, options?: Parameters<typeof createToast>[2]) =>
    createToast("warning", message, options),
  library: (
    message: string,
    actions: readonly ToastAction[] = [],
    type: ToastType = "success"
  ) => createActionToast("library", message, actions, type),
  exercise: (
    message: string,
    actions: readonly ToastAction[] = [],
    type: ToastType = "success"
  ) => createActionToast("exercise", message, actions, type),
  pause: (id: string, reason: "focus" | "pointer") =>
    pauseActionToast(id, reason),
  resume: (id: string, reason: "focus" | "pointer") =>
    resumeActionToast(id, reason),
};
