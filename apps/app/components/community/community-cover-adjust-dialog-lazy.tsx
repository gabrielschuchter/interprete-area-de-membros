"use client";

import dynamic from "next/dynamic";

/** "Ajustar capa" só carrega quando a pessoa escolhe ou ajusta uma imagem. */
export const LazyCommunityCoverAdjustDialog = dynamic(
  () =>
    import("./community-cover-adjust-dialog").then(
      (module) => module.CommunityCoverAdjustDialog
    ),
  { ssr: false }
);
