export type ToastType = "error" | "info" | "loading" | "success" | "warning";

export interface ToastRecord {
  readonly appearance?: "default" | "exercise";
  readonly action?: {
    readonly label: string;
    readonly onClick: () => void;
  };
  readonly link?: { readonly href: string; readonly label: string };
  readonly id: string;
  readonly message: string;
  readonly type: ToastType;
}

type ToastListener = () => void;

const EMPTY_TOASTS: readonly ToastRecord[] = [];
const listeners = new Set<ToastListener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const remaining = new Map<string, number>();
const startedAt = new Map<string, number>();
const pauseReasons = new Map<string, Set<string>>();
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
  remaining.delete(id);
  startedAt.delete(id);
  pauseReasons.delete(id);

  records = records.filter((record) => record.id !== id);
  emit();
};

const scheduleToast = (id: string, duration: number) => {
  if (!Number.isFinite(duration) || (pauseReasons.get(id)?.size ?? 0) > 0) return;
  remaining.set(id, duration);
  startedAt.set(id, Date.now());
  timers.set(id, setTimeout(() => dismissToast(id), duration));
};

const pauseToast = (id: string, reason: string) => {
  if (!records.some((record) => record.id === id)) return;
  const reasons = pauseReasons.get(id) ?? new Set<string>();
  reasons.add(reason);
  pauseReasons.set(id, reasons);
  const timer = timers.get(id);
  const began = startedAt.get(id);
  if (timer && began !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
    remaining.set(id, Math.max(0, (remaining.get(id) ?? 0) - (Date.now() - began)));
  }
};

const resumeToast = (id: string, reason: string) => {
  if (!records.some((record) => record.id === id)) return;
  const reasons = pauseReasons.get(id);
  reasons?.delete(reason);
  if (!reasons?.size) {
    pauseReasons.delete(id);
    const time = remaining.get(id);
    if (time !== undefined) scheduleToast(id, time);
  }
};

const createToast = (
  type: ToastType,
  message: string,
  options: {
    readonly appearance?: ToastRecord["appearance"];
    readonly action?: ToastRecord["action"];
    readonly duration?: number;
    readonly link?: ToastRecord["link"];
  } = {}
) => {
  const id = "toast-" + nextId++;
  const duration = options.duration ??
    (type === "loading" ? Number.POSITIVE_INFINITY : 5000);
  pauseReasons.set(id, new Set());
  records = [
    ...records,
    {
      id,
      message,
      type,
      appearance: options.appearance,
      action: options.action,
      link: options.link,
    },
  ];
  emit();

  if (typeof window !== "undefined") scheduleToast(id, duration);

  return id;
};

export const toast = {
  dismiss: dismissToast,
  error: (message: string, options?: Parameters<typeof createToast>[2]) =>
    createToast("error", message, options),
  info: (message: string, options?: Parameters<typeof createToast>[2]) =>
    createToast("info", message, options),
  loading: (message: string) => createToast("loading", message),
  pause: pauseToast,
  resume: resumeToast,
  success: (message: string, options?: Parameters<typeof createToast>[2]) =>
    createToast("success", message, options),
  warning: (message: string, options?: Parameters<typeof createToast>[2]) =>
    createToast("warning", message, options),
};
