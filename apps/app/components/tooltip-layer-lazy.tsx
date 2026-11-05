"use client";

import dynamic from "next/dynamic";

/**
 * As dicas só importam depois da primeira interação; o código delas fica fora
 * do JavaScript inicial de todas as rotas autenticadas.
 */
export const LazyTooltipLayer = dynamic(
  () => import("./tooltip-layer").then((module) => module.TooltipLayer),
  { ssr: false }
);
