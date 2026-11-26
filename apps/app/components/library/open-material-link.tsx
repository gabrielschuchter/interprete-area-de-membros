"use client";

import { toast } from "@repo/design-system/lib/toast";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowUpRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TIMER_REFRESH_EVENT } from "@/components/focus-timer-refresh-event";

const CLIENT_KEY = "interprete:focus-timer-client";
const CLIENT_ID_PATTERN = /^[\da-f-]{36}$/i;

const timerClientId = () => {
  try {
    const stored = window.localStorage.getItem(CLIENT_KEY);
    if (stored && CLIENT_ID_PATTERN.test(stored)) {
      return stored;
    }
    const next = window.crypto.randomUUID();
    window.localStorage.setItem(CLIENT_KEY, next);
    return next;
  } catch {
    return window.crypto.randomUUID();
  }
};

/**
 * A leitura acontece em outra aba, onde nada mede o tempo. Ao abrir o
 * material, liga um cronômetro já vinculado ao item; "Terminei de ler" na
 * pílula encerra e o tempo entra na estante e nas metas de leitura.
 */
const startReadingTimer = async (itemId: string, title: string) => {
  const response = await fetch("/api/focus-timer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    // No celular a aba original vai para segundo plano ao abrir o material;
    // keepalive deixa o pedido terminar mesmo assim.
    keepalive: true,
    body: JSON.stringify({
      action: "start",
      clientId: timerClientId(),
      mode: "STOPWATCH",
      linkedResourceType: "LIBRARY_ITEM",
      linkedResourceId: itemId,
      title: `Leitura: ${title}`.slice(0, 180),
    }),
  });
  if (response.ok) {
    window.dispatchEvent(new Event(TIMER_REFRESH_EVENT));
    toast.success("Cronômetro de leitura ligado. Encerre quando terminar.");
    return;
  }
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  toast.info(
    payload?.error ?? "Não foi possível ligar o cronômetro de leitura."
  );
};

/** Ao voltar para esta aba, a pílula relê o cronômetro na hora. */
const refreshWhenBackOnce = () => {
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      document.removeEventListener("visibilitychange", onVisible);
      window.dispatchEvent(new Event(TIMER_REFRESH_EVENT));
    }
  };
  document.addEventListener("visibilitychange", onVisible);
};

export const OpenMaterialLink = ({
  children,
  className,
  href,
  itemId,
  title,
}: {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly href: string;
  readonly itemId: string;
  readonly title: string;
}) => (
  <a
    aria-label={`Abrir material: ${title}, em nova aba`}
    className={cn(
      "inline-flex h-12 items-center justify-center gap-2 rounded-md border-2 border-[#8C1535] bg-[#8C1535] px-6 font-semibold text-sm text-white transition-colors hover:bg-[#6f102b] focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2",
      className
    )}
    href={href}
    onClick={() => {
      // Sem preventDefault: a nova aba abre normalmente; o cronômetro liga
      // em paralelo e falha em silêncio se já houver outro em andamento.
      refreshWhenBackOnce();
      startReadingTimer(itemId, title).catch(() => undefined);
    }}
    rel="noopener noreferrer"
    target="_blank"
    title="Abre em nova aba e liga o cronômetro de leitura"
  >
    {children ?? "Abrir material"} <ArrowUpRightIcon aria-hidden="true" />
  </a>
);
