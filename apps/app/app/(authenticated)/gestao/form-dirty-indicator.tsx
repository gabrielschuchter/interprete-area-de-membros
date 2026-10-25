"use client";

import { useEffect, useRef, useState } from "react";
import { GestaoIcon } from "./gestao-icon";

/**
 * Indicador de alterações não salvas. Observa o formulário que o contém e
 * avisa o navegador antes de sair com edições pendentes.
 */
export const FormDirtyIndicator = ({
  savedLabel = "Tudo salvo",
}: {
  readonly savedLabel?: string;
}) => {
  const anchor = useRef<HTMLSpanElement | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) {
      return;
    }
    const markDirty = () => setDirty(true);
    const markClean = () => setDirty(false);
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("submit", markClean);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("submit", markClean);
    };
  }, []);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <span className="gk-savestate" data-dirty={dirty} ref={anchor}>
      <GestaoIcon name="check" size={14} />
      {dirty ? "Alterações não salvas" : savedLabel}
    </span>
  );
};
