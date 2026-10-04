"use client";

import { PlayIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StudyHeartbeat } from "./study-heartbeat";

interface YouTubePlayerInstance {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getIframe: () => HTMLIFrameElement;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      events: {
        onError: () => void;
        onReady: (event: { target: YouTubePlayerInstance }) => void;
        onStateChange: (event: {
          data: number;
          target: YouTubePlayerInstance;
        }) => void;
      };
      host: string;
      playerVars: Record<string, number | string>;
      videoId: string;
    }
  ) => YouTubePlayerInstance;
  PlayerState: { ENDED: number; PAUSED: number; PLAYING: number };
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: YouTubeApi;
  }
}

let apiLoadPromise: Promise<YouTubeApi> | null = null;

const loadYouTubeApi = () => {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiLoadPromise) {
    return apiLoadPromise;
  }

  apiLoadPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const existingCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existingCallback?.();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error("YouTube player API did not initialize"));
      }
    };

    let script = document.querySelector<HTMLScriptElement>(
      'script[data-youtube-iframe-api="true"]'
    );
    if (!script) {
      script = document.createElement("script");
      script.dataset.youtubeIframeApi = "true";
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("YouTube player API failed"));
      document.head.append(script);
    }
  }).catch((error: unknown) => {
    apiLoadPromise = null;
    throw error;
  });

  return apiLoadPromise;
};

interface YouTubeLessonPlayerProperties {
  readonly assetId: string;
  readonly persistProgress?: boolean;
  readonly studyActivityKind?: "LESSON" | "RECORDING";
  readonly studyResourceId?: string;
  readonly title: string;
  readonly videoId: string;
}

const writePlaybackProgress = async (
  assetId: string,
  positionSeconds: number,
  durationSeconds: number | null,
  completed: boolean
) => {
  const response = await fetch(`/api/learning/assets/${assetId}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body: JSON.stringify({ positionSeconds, durationSeconds, completed }),
  });
  return response.ok;
};

const readPlaybackPosition = (player: YouTubePlayerInstance) => {
  const rawDuration = player.getDuration();
  return {
    positionSeconds: Math.max(0, Math.floor(player.getCurrentTime())),
    durationSeconds:
      Number.isFinite(rawDuration) && rawDuration > 0
        ? Math.floor(rawDuration)
        : null,
  };
};

export const YouTubeLessonPlayer = ({
  assetId,
  persistProgress = false,
  studyActivityKind,
  studyResourceId,
  title,
  videoId,
}: YouTubeLessonPlayerProperties) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState("Vídeo pronto para reprodução");
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!(started && containerRef.current)) {
      return;
    }

    let disposed = false;
    let player: YouTubePlayerInstance | null = null;
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    let saving = false;

    const saveProgress = async (completed = false) => {
      if (!(persistProgress && player) || saving) {
        return;
      }
      const progress = readPlaybackPosition(player);
      saving = true;
      setStatus("Salvando posição");
      const saved = await writePlaybackProgress(
        assetId,
        progress.positionSeconds,
        progress.durationSeconds,
        completed
      ).catch(() => false);
      if (!disposed) {
        setStatus(saved ? "Posição salva" : "Posição não salva");
      }
      saving = false;
    };

    const startProgressSync = () => {
      if (!(persistProgress && !progressInterval)) {
        return;
      }
      progressInterval = setInterval(() => {
        saveProgress().catch(() => undefined);
      }, 15_000);
    };

    const stopProgressSync = () => {
      if (!progressInterval) {
        return;
      }
      clearInterval(progressInterval);
      progressInterval = null;
    };

    const onPlayerStateChange = (api: YouTubeApi, data: number) => {
      if (data === api.PlayerState.PLAYING) {
        setIsPlaying(true);
        setStatus("Reprodução em andamento");
        startProgressSync();
        return;
      }
      stopProgressSync();
      setIsPlaying(false);
      if (data === api.PlayerState.ENDED) {
        setStatus("Gravação concluída");
        saveProgress(true).catch(() => undefined);
      } else if (data === api.PlayerState.PAUSED) {
        setStatus("Reprodução pausada");
        saveProgress().catch(() => undefined);
      }
    };

    const initialize = async () => {
      try {
        const api = await loadYouTubeApi();
        let startSeconds = 0;
        if (persistProgress) {
          const response = await fetch(
            `/api/learning/assets/${assetId}/progress`,
            { credentials: "same-origin" }
          );
          if (response.ok) {
            const payload = (await response.json()) as {
              progress?: { positionSeconds?: number } | null;
            };
            startSeconds = Math.max(
              0,
              Math.floor(payload.progress?.positionSeconds ?? 0)
            );
          }
        }
        if (disposed || !containerRef.current) {
          return;
        }

        player = new api.Player(containerRef.current, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: 1,
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            modestbranding: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
            start: startSeconds,
          },
          events: {
            onReady: ({ target }) => {
              target.getIframe().title = title;
              setStatus("Reprodução em andamento");
            },
            onStateChange: ({ data }) => onPlayerStateChange(api, data),
            onError: () => {
              setError(true);
              setStatus("Não foi possível reproduzir este vídeo");
            },
          },
        });
      } catch {
        if (!disposed) {
          setError(true);
          setStatus("Não foi possível carregar o player de vídeo");
        }
      }
    };

    initialize().catch(() => undefined);

    return () => {
      disposed = true;
      stopProgressSync();
      saveProgress().catch(() => undefined);
      player?.destroy();
    };
  }, [assetId, persistProgress, started, title, videoId]);

  useEffect(
    () => () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    },
    []
  );

  if (started && !error) {
    return (
      <div className="space-y-3">
        {studyActivityKind && studyResourceId && (
          <StudyHeartbeat
            activityKind={studyActivityKind}
            playbackActive={isPlaying}
            resourceId={studyResourceId}
          />
        )}
        <div className="aspect-video overflow-hidden border bg-black">
          <div className="size-full" ref={containerRef} />
        </div>
        <p aria-live="polite" className="text-muted-foreground text-xs">
          {status}
        </p>
      </div>
    );
  }

  return (
    <div className="flex aspect-video items-center justify-center border bg-[radial-gradient(ellipse_at_center,rgba(143,29,64,0.45),rgba(20,18,23,0.98))] p-6 text-center text-primary-foreground">
      <div className="max-w-sm">
        <p className="font-data text-primary-foreground/80 text-xs uppercase tracking-[0.16em]">
          Reprodução externa · YouTube
        </p>
        <p className="mt-3 font-display text-2xl">{title}</p>
        <p className="mt-2 text-primary-foreground/80 text-sm leading-6">
          O player só se conecta ao YouTube quando você inicia o vídeo.
        </p>
        <button
          className="mt-5 inline-flex min-h-11 items-center gap-2 border border-primary-foreground/60 px-5 font-medium text-sm transition-colors hover:bg-primary-foreground/10 focus-visible:outline-2 focus-visible:outline-primary-foreground focus-visible:outline-offset-2"
          onClick={() => {
            if (retryTimerRef.current) {
              clearTimeout(retryTimerRef.current);
            }
            if (error) {
              setError(false);
              setStarted(false);
              retryTimerRef.current = setTimeout(() => {
                setStarted(true);
              }, 0);
            } else {
              setStarted(true);
            }
          }}
          type="button"
        >
          {error ? (
            <RotateCcwIcon aria-hidden="true" className="size-4" />
          ) : (
            <PlayIcon aria-hidden="true" className="size-4" />
          )}
          {error ? "Tentar novamente" : "Reproduzir gravação"}
        </button>
        {error && (
          <p aria-live="assertive" className="mt-3 text-sm">
            {status}
          </p>
        )}
      </div>
    </div>
  );
};
