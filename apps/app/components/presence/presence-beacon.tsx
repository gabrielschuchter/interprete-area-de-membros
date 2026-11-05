"use client";

import { useEffect } from "react";

const BEAT_INTERVAL_MS = 60_000;
const FIRST_BEAT_DELAY_MS = 8000;
const IDLE_AFTER_MS = 5 * 60_000;

/**
 * Conta a presença na plataforma para a meta coletiva, em segundo plano e sem
 * nada na tela: um sinal por minuto, só com a aba visível e a pessoa ativa
 * nos últimos cinco minutos. Quem está numa aula, gravação ou exercício já
 * tem a medição própria; a soma no servidor não conta o mesmo minuto duas vezes.
 */
export const PresenceBeacon = () => {
  useEffect(() => {
    let lastInteractionAt = Date.now();
    let interval: ReturnType<typeof setInterval> | null = null;
    let first: ReturnType<typeof setTimeout> | null = null;

    const beat = () => {
      if (
        document.visibilityState !== "visible" ||
        Date.now() - lastInteractionAt > IDLE_AFTER_MS
      ) {
        return;
      }
      fetch("/api/presence", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => undefined);
    };
    const touch = () => {
      lastInteractionAt = Date.now();
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (first) {
        clearTimeout(first);
        first = null;
      }
    };
    const start = () => {
      stop();
      if (document.visibilityState !== "visible") {
        return;
      }
      first = setTimeout(beat, FIRST_BEAT_DELAY_MS);
      interval = setInterval(beat, BEAT_INTERVAL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        touch();
        start();
      } else {
        stop();
      }
    };

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const name of events) {
      window.addEventListener(name, touch, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      stop();
      for (const name of events) {
        window.removeEventListener(name, touch);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
};
