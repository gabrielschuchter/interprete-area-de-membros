"use client";

import { useEffect, useRef, useState } from "react";

interface LessonPlayerProperties {
  readonly assetId: string;
  readonly mimeType?: string | null;
  readonly title: string;
}

const playbackRates = [1, 1.25, 1.5, 2];

export const LessonPlayer = ({
  assetId,
  title,
  mimeType,
}: LessonPlayerProperties) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rate, setRate] = useState(1);
  const source = `/api/learning/assets/${assetId}`;
  const isHls =
    mimeType === "application/vnd.apple.mpegurl" ||
    mimeType === "application/x-mpegURL" ||
    mimeType === "audio/mpegurl";

  useEffect(() => {
    if (!isHls) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source;
      return;
    }

    let destroyHls: (() => void) | null = null;
    let disposed = false;
    const loadHls = async () => {
      const { default: Hls } = await import("hls.js");
      if (disposed || !Hls.isSupported()) {
        return;
      }
      const player = new Hls({ enableWorker: true });
      player.loadSource(source);
      player.attachMedia(video);
      destroyHls = () => player.destroy();
    };
    loadHls().catch(() => undefined);

    return () => {
      disposed = true;
      destroyHls?.();
    };
  }, [isHls, source]);

  const updateRate = (nextRate: number) => {
    setRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden border bg-brand-depth">
        <video
          className="aspect-video w-full bg-black object-contain"
          controls
          controlsList="nodownload"
          playsInline
          preload="metadata"
          ref={videoRef}
          src={isHls ? undefined : source}
          title={title}
        >
          <track
            kind="captions"
            label={mimeType ? `Legendas · ${mimeType}` : "Legendas"}
            src="data:text/vtt,WEBVTT%0A"
            srcLang="pt-BR"
          />
          Seu navegador não suporta reprodução de vídeo.
        </video>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-xs">
        <span className="font-data uppercase tracking-[0.12em]">
          Reprodução protegida
        </span>
        <label className="inline-flex items-center gap-2">
          <span>Velocidade</span>
          <select
            aria-label="Velocidade de reprodução"
            className="border bg-background px-2 py-1 text-foreground"
            onChange={(event) => updateRate(Number(event.target.value))}
            value={rate}
          >
            {playbackRates.map((playbackRate) => (
              <option key={playbackRate} value={playbackRate}>
                {playbackRate}x
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
};
