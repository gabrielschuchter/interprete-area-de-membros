"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { GestaoEraseProperties } from "./erase-types";

export type { GestaoEraseKind } from "./erase-types";

// O diálogo e a ação só descem quando alguém pede para apagar.
const EraseDialog = dynamic(
  () => import("./erase-dialog-body").then((module) => module.EraseDialog),
  { ssr: false }
);

/** Gatilho + confirmação de exclusão real. Envolva o menu inteiro, não só o item. */
export const GestaoErase = ({
  children,
  ...properties
}: GestaoEraseProperties) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      {children(() => setOpen(true))}
      {open ? (
        <EraseDialog {...properties} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
};

/** Botão simples de apagar, para cabeçalhos e páginas de configuração. */
export const GestaoEraseButton = (
  properties: Omit<GestaoEraseProperties, "children"> & {
    readonly label?: string;
  }
) => (
  <GestaoErase {...properties}>
    {(open) => (
      <button
        className="gk-btn gk-btn--danger-ghost"
        onClick={open}
        type="button"
      >
        {properties.label ?? `Apagar ${properties.noun}`}
      </button>
    )}
  </GestaoErase>
);
