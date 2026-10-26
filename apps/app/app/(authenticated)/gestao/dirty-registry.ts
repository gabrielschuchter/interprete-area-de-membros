"use client";

import { useEffect, useId } from "react";

const registry = new Set<string>();
const eventName = "gestao:dirty-change";

export const hasGestaoUnsavedChanges = () => registry.size > 0;

export const clearGestaoUnsavedChanges = () => {
  registry.clear();
  window.dispatchEvent(new Event(eventName));
};

/** Registra a tela como "com alterações não salvas" enquanto `dirty` for verdadeiro. */
export const useGestaoDirtyRegistration = (dirty: boolean) => {
  const id = useId();
  useEffect(() => {
    if (!dirty) {
      return;
    }
    registry.add(id);
    window.dispatchEvent(new Event(eventName));
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      registry.delete(id);
      window.removeEventListener("beforeunload", warn);
      window.dispatchEvent(new Event(eventName));
    };
  }, [dirty, id]);
};
