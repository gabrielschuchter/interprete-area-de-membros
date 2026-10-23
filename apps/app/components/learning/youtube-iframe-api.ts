"use client";

// Shared by the lesson player and the classroom (Sala de Aula) player.

export interface YouTubePlayerInstance {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getIframe: () => HTMLIFrameElement;
  getPlaybackRate: () => number;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
}

export interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      events: {
        onError: (event: { data: number }) => void;
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

export const loadYouTubeApi = () => {
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

export const writePlaybackProgress = async (
  assetId: string,
  positionMs: number,
  durationSeconds: number | null,
  playbackRate: number,
  sessionId: string,
  checkpointOnly: boolean
) => {
  const response = await fetch(`/api/learning/assets/${assetId}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body: JSON.stringify({
      positionMs,
      durationSeconds,
      playbackRate,
      sessionId,
      checkpointOnly,
    }),
  });
  return response.ok;
};

export const readPlaybackPosition = (player: YouTubePlayerInstance) => {
  const rawDuration = player.getDuration();
  return {
    positionMs: Math.max(0, Math.floor(player.getCurrentTime() * 1000)),
    durationSeconds:
      Number.isFinite(rawDuration) && rawDuration > 0
        ? Math.floor(rawDuration)
        : null,
  };
};
