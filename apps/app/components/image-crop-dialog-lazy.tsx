"use client";

import dynamic from "next/dynamic";

/** O recorte só carrega quando a pessoa escolhe uma imagem. */
export const LazyImageCropDialog = dynamic(
  () => import("./image-crop-dialog").then((module) => module.ImageCropDialog),
  { ssr: false }
);
