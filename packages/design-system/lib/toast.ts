export type ToastType = "error" | "info" | "loading" | "success" | "warning";

export interface ToastRecord {
  readonly id: string;
  readonly message: string;
  readonly type: ToastType;
}

type ToastListener = () => void;

const EMPTY_TOASTS: readonly ToastRecord[] = [];
const listeners = new Set<ToastListener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
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

  records = records.filter((record) => record.id !== id);
  emit();
};

const createToast = (
  type: ToastType,
  message: string,
  duration = type === "loading" ? Number.POSITIVE_INFINITY : 4200
) => {
  const id = "toast-" + nextId++;
  records = [...records, { id, message, type }];
  emit();

  if (typeof window !== "undefined" && Number.isFinite(duration)) {
    timers.set(id, setTimeout(() => dismissToast(id), duration));
  }

  return id;
};

export const toast = {
  dismiss: dismissToast,
  error: (message: string) => createToast("error", message),
  info: (message: string) => createToast("info", message),
  loading: (message: string) => createToast("loading", message),
  success: (message: string) => createToast("success", message),
  warning: (message: string) => createToast("warning", message),
};
