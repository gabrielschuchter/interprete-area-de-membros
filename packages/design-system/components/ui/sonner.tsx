"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import type { FocusEvent } from "react";
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
  const legacyRecords = records.filter((record) => !record.variant);
  const exerciseRecords = records.filter(
    (record) => record.variant === "exercise"
  );
  const libraryRecords = records.filter((record) => record.variant === "library");

  return (
    <>
      <ol
        aria-label="Notificações"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {legacyRecords.map((record) => {
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
                  "mt-0.5 size-4 shrink-0 text-brand-action-text",
                  record.type === "loading" && "animate-spin"
                )}
              />
              <p className="min-w-0 flex-1 text-sm leading-6">
                {record.message}
              </p>
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
      <ol
        aria-label="Avisos de exercícios"
        aria-live="polite"
        className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-1/2 z-50 flex w-[min(26.25rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 md:right-auto md:bottom-4 md:left-4 md:translate-x-0"
      >
        {exerciseRecords.map((record) => {
          const Icon = iconByType[record.type];

          return (
            <li
              className="motion-reveal-fast pointer-events-auto flex items-start gap-3 rounded-md border border-transparent bg-[#40222F] p-3 text-white shadow-[var(--shadow-floating)] sm:p-4 motion-reduce:animate-none"
              key={record.id}
              onBlurCapture={(event: FocusEvent<HTMLLIElement>) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null
                  )
                ) {
                  toast.resume(record.id, "focus");
                }
              }}
              onFocusCapture={() => toast.pause(record.id, "focus")}
              onPointerEnter={() => toast.pause(record.id, "pointer")}
              onPointerLeave={() => toast.resume(record.id, "pointer")}
              role="status"
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "mt-0.5 size-4 shrink-0 text-[#E9C48E] motion-reduce:animate-none",
                  record.type === "loading" && "animate-spin"
                )}
              />
              <p className="min-w-0 flex-1 text-sm leading-6">
                {record.message}
              </p>
              {record.actions?.map((action) => (
                <button
                  className="min-h-11 shrink-0 rounded-sm px-2 text-[#E9C48E] text-xs font-semibold underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9C48E]"
                  key={action.label}
                  onClick={() => {
                    toast.dismiss(record.id);
                    action.onSelect();
                  }}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
              <button
                aria-label="Fechar notificação"
                className="-my-1 flex size-11 shrink-0 items-center justify-center rounded-sm text-white/75 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9C48E]"
                onClick={() => toast.dismiss(record.id)}
                type="button"
              >
                <XIcon aria-hidden="true" className="size-4" />
              </button>
            </li>
          );
        })}
      </ol>
      <ol
        aria-label="Avisos da biblioteca"
        aria-live="polite"
        className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 md:right-auto md:bottom-4 md:left-4 md:translate-x-0"
      >
        {libraryRecords.map((record) => (
          <li
            className="motion-reveal-fast pointer-events-auto flex items-start gap-3 rounded-lg border border-[#5d3b49] bg-[#40222F] p-3 text-[#F1EBE8] shadow-[var(--shadow-floating)] sm:p-4"
            key={record.id}
            onBlurCapture={(event: FocusEvent<HTMLLIElement>) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null
                )
              ) {
                toast.resume(record.id, "focus");
              }
            }}
            onFocusCapture={() => toast.pause(record.id, "focus")}
            onPointerEnter={() => toast.pause(record.id, "pointer")}
            onPointerLeave={() => toast.resume(record.id, "pointer")}
            role="status"
          >
            {record.type === "error" ? (
              <OctagonXIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[#E9C48E]"
              />
            ) : (
              <CircleCheckIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[#E9C48E]"
              />
            )}
            <p className="min-w-0 flex-1 text-sm leading-6">
              {record.message}
            </p>
            {record.actions?.map((action) => (
              <button
                className="min-h-11 shrink-0 rounded-sm px-2 text-[#E9C48E] text-xs font-semibold underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9C48E]"
                key={action.label}
                onClick={() => {
                  toast.dismiss(record.id);
                  action.onSelect();
                }}
                type="button"
              >
                {action.label}
              </button>
            ))}
            <button
              aria-label="Fechar aviso da biblioteca"
              className="-my-1 flex size-11 shrink-0 items-center justify-center rounded-sm text-[#d6bdc5] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9C48E]"
              onClick={() => toast.dismiss(record.id)}
              type="button"
            >
              <XIcon aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
      </ol>
    </>
  );
};

export { Toaster };
