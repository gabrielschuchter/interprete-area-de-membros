"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
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
      className="pointer-events-none fixed inset-0 z-50"
    >
      {records.map((record, index) => {
        const Icon = iconByType[record.type];
        const isExerciseToast = record.appearance === "exercise";
        const stackSlot = records
          .slice(0, index)
          .filter(
            (previous) =>
              (previous.appearance === "exercise") === isExerciseToast
          ).length;

        return (
          <li
            className={cn(
              "toast-item motion-reveal-fast pointer-events-auto flex items-start gap-3 rounded-md border p-4 shadow-[var(--shadow-floating)]",
              isExerciseToast
                ? "exercise-toast-position w-[min(26.25rem,calc(100vw-2rem))] border-transparent bg-[#40222F] text-white"
                : "default-toast-position paper-surface w-[min(24rem,calc(100vw-2rem))]"
            )}
            key={record.id}
            style={
              {
                "--toast-stack-offset": `${stackSlot * 4.5}rem`,
              } as CSSProperties
            }
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                toast.resume(record.id, "focus");
              }
            }}
            onFocusCapture={() => toast.pause(record.id, "focus")}
            onMouseEnter={() => toast.pause(record.id, "hover")}
            onMouseLeave={() => toast.resume(record.id, "hover")}
            role="status"
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "mt-0.5 size-4 shrink-0",
                isExerciseToast
                  ? "text-[#E9C48E]"
                  : "text-brand-action-text",
                record.type === "loading" && "animate-spin"
              )}
            />
            <p className="min-w-0 flex-1 text-sm leading-6">{record.message}</p>
            {record.link && (
              <a
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center rounded-sm px-2 text-sm font-semibold underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isExerciseToast
                    ? "text-[#E9C48E]"
                    : "text-brand-action-text"
                )}
                href={record.link.href}
              >
                {record.link.label}
              </a>
            )}
            {record.action && (
              <button
                className={cn(
                  "min-h-11 shrink-0 rounded-sm px-2 text-sm font-semibold underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isExerciseToast
                    ? "text-[#E9C48E]"
                    : "text-brand-action-text"
                )}
                onClick={() => {
                  record.action?.onClick();
                  toast.dismiss(record.id);
                }}
                type="button"
              >
                {record.action.label}
              </button>
            )}
            <button
              aria-label="Fechar notificação"
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isExerciseToast
                  ? "text-white/75 hover:text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
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
