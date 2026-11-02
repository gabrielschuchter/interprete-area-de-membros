"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { YouTubePlaylistImport as YouTubePlaylistImportComponent } from "./youtube-playlist-import";

const Loaded = dynamic(
  async () => {
    const { YouTubePlaylistImport } = await import("./youtube-playlist-import");
    return YouTubePlaylistImport;
  },
  {
    loading: () => (
      <p aria-busy="true" className="text-[#7A5A69] text-sm">
        Carregando importação do YouTube…
      </p>
    ),
    ssr: false,
  }
);

/** Importação de lista do YouTube sob demanda: fora do JS inicial da rota. */
export const LazyYouTubePlaylistImport = (
  properties: ComponentProps<typeof YouTubePlaylistImportComponent>
) => <Loaded {...properties} />;
