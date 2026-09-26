"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  getServerToastSnapshot,
  getToastSnapshot,
  subscribeToToasts,
  toast,
  type ToastType,
} from "../../lib/toast";

const iconByType: Record<ToastType, typeof CircleCheckIcon> = {
  error: OctagonXIcon,
  info: InfoIcon,
  loading: Loader2Icon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
};

const Toaster = () => {
  const records = useSyncExternalStore(
    subscribeToToasts,
    getToastSnapshot,
    getServerToastSnapshot
  );

  return (
    <ol
      aria-label="Notificações"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {records.map((record) => {
        const Icon = iconByType[record.type];

        return (
          <li
            className="motion-reveal-fast paper-surface pointer-events-auto flex items-start gap-3 border p-4 shadow-[var(--shadow-floating)]"
            key={record.id}
            role="status"
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "mt-0.5 size-4 shrink-0 text-brand-action",
                record.type === "loading" && "animate-spin"
              )}
            />
            <p className="min-w-0 flex-1 text-sm leading-6">{record.message}</p>
            <button
              aria-label="Fechar notificação"
              className="-m-1 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => toast.dismiss(record.id)}
              type="button"
            >
              <XIcon aria-hidden="true" className="size-4" />
            </button>
          </li>
        );
      })}
    </ol>
  );
};

export { Toaster };
