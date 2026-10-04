"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { StudyHeartbeat } from "./study-heartbeat";

interface LessonPlayerProperties {
  readonly assetId: string;
  readonly mediaExternalId?: string | null;
  readonly mediaProvider?: "STORAGE" | "YOUTUBE" | "EXTERNAL_URL";
  readonly mimeType?: string | null;
  readonly persistProgress?: boolean;
  readonly studyActivityKind?: "LESSON" | "RECORDING";
  readonly studyResourceId?: string;
  readonly title: string;
}

const playbackRates = [1, 1.25, 1.5, 2];

const StoredLessonPlayer = ({
  assetId,
  title,
  mimeType,
  persistProgress = false,
  studyActivityKind,
  studyResourceId,
}: LessonPlayerProperties) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumePositionRef = useRef<number | null>(null);
  const lastSavedPositionRef = useRef(0);
  const lastSavedAtRef = useRef(0);
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const [rate, setRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const source = `/api/learning/assets/${assetId}`;
  const isHls =
    mimeType === "application/vnd.apple.mpegurl" ||
    mimeType === "application/x-mpegURL" ||
    mimeType === "audio/mpegurl";

  const applyResume = useCallback(() => {
    const video = videoRef.current;
    const resumePosition = resumePositionRef.current;
    if (
      video &&
      resumePosition !== null &&
      Number.isFinite(video.duration) &&
      resumePosition < video.duration - 3
    ) {
      video.currentTime = resumePosition;
      resumePositionRef.current = null;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const handlePlay = () => setIsPlaying(true);
    const handleStop = () => setIsPlaying(false);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handleStop);
    video.addEventListener("ended", handleStop);
    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handleStop);
      video.removeEventListener("ended", handleStop);
    };
  }, []);

  useEffect(() => {
    if (!persistProgress) {
      return;
    }

    let disposed = false;
    fetch(`/api/learning/assets/${assetId}/progress`, {
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("progress lookup failed");
        }
        return (await response.json()) as {
          progress?: { positionSeconds?: number } | null;
        };
      })
      .then(({ progress }) => {
        if (!disposed && progress?.positionSeconds) {
          resumePositionRef.current = progress.positionSeconds;
          applyResume();
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
    };
  }, [applyResume, assetId, persistProgress]);

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

  const saveProgress = useCallback(
    (force = false, completed = false) => {
      if (!persistProgress) {
        return Promise.resolve();
      }

      const video = videoRef.current;
      if (!(video && Number.isFinite(video.currentTime))) {
        return Promise.resolve();
      }

      const positionSeconds = Math.max(0, Math.floor(video.currentTime));
      const durationSeconds = Number.isFinite(video.duration)
        ? Math.max(0, Math.floor(video.duration))
        : null;
      const now = Date.now();
      const shouldSave =
        force ||
        completed ||
        positionSeconds - lastSavedPositionRef.current >= 10 ||
        now - lastSavedAtRef.current >= 15_000;

      if (!shouldSave || saveInFlightRef.current) {
        return saveInFlightRef.current ?? Promise.resolve();
      }

      setSaveState("saving");
      const request = fetch(`/api/learning/assets/${assetId}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: force,
        body: JSON.stringify({ positionSeconds, durationSeconds, completed }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("progress update failed");
          }
          lastSavedPositionRef.current = positionSeconds;
          lastSavedAtRef.current = now;
          setSaveState("saved");
        })
        .catch(() => {
          setSaveState("error");
        })
        .finally(() => {
          saveInFlightRef.current = null;
        });
      saveInFlightRef.current = request;
      return request;
    },
    [assetId, persistProgress]
  );

  useEffect(() => {
    if (!persistProgress) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const handleTimeUpdate = () => {
      saveProgress().catch(() => undefined);
    };
    const handlePause = () => {
      saveProgress(true).catch(() => undefined);
    };
    const handleEnded = () => {
      saveProgress(true, true).catch(() => undefined);
    };
    video.addEventListener("loadedmetadata", applyResume);
    video.addEventListener("durationchange", applyResume);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", applyResume);
      video.removeEventListener("durationchange", applyResume);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      saveProgress(true).catch(() => undefined);
    };
  }, [applyResume, persistProgress, saveProgress]);

  const updateRate = (nextRate: number) => {
    setRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  };

  let saveStateLabel = "Reprodução protegida";
  if (saveState === "saving") {
    saveStateLabel = "Salvando posição";
  } else if (saveState === "error") {
    saveStateLabel = "Posição não salva";
  } else if (persistProgress && saveState === "saved") {
    saveStateLabel = "Posição salva";
  }

  return (
    <div className="space-y-3">
      {studyActivityKind && studyResourceId && (
        <StudyHeartbeat
          activityKind={studyActivityKind}
          playbackActive={isPlaying}
          resourceId={studyResourceId}
        />
      )}
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
        <span
          aria-live="polite"
          className="font-data uppercase tracking-[0.12em]"
        >
          {saveStateLabel}
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

const YouTubeLessonPlayer = dynamic(
  () =>
    import("./youtube-lesson-player").then(
      (module) => module.YouTubeLessonPlayer
    ),
  {
    loading: () => (
      <output
        aria-label="Preparando o player de vídeo"
        className="aspect-video animate-pulse border bg-brand-depth"
      />
    ),
    ssr: false,
  }
);

export const LessonPlayer = (properties: LessonPlayerProperties) => {
  if (properties.mediaProvider === "YOUTUBE" && properties.mediaExternalId) {
    return (
      <YouTubeLessonPlayer
        assetId={properties.assetId}
        persistProgress={properties.persistProgress}
        studyActivityKind={properties.studyActivityKind}
        studyResourceId={properties.studyResourceId}
        title={properties.title}
        videoId={properties.mediaExternalId}
      />
    );
  }

  return <StoredLessonPlayer {...properties} />;
};
