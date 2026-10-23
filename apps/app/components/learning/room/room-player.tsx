"use client";

import {
  AlertTriangleIcon,
  LockIcon,
  PlayIcon,
  VideoOffIcon,
  WifiOffIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { reportRoomVideoIssue } from "@/app/(authenticated)/cursos/room-actions";
import { formatVideoTimestamp } from "@/lib/room-notes";
import {
  effectiveStartSeconds,
  type InitialPlayerState,
} from "@/lib/room-player-state";
import { StudyHeartbeat } from "../study-heartbeat";
import {
  loadYouTubeApi,
  readPlaybackPosition,
  writePlaybackProgress,
  type YouTubePlayerInstance,
} from "../youtube-iframe-api";
import { RoomTemple } from "./room-art";
import {
  type RoomKind,
  roomReleaseDate,
  roomText,
  roomTextFor,
} from "./room-copy";

const LessonPlayer = dynamic(
  () => import("../lesson-player").then((module) => module.LessonPlayer),
  { ssr: false }
);

export type RoomPlayerState =
  | InitialPlayerState
  | "loading"
  | "playing"
  | "error_timeout"
  | "offline";

export interface RoomPlayerVideo {
  readonly availability: "ok" | "unchecked" | "broken" | "missing";
  readonly durationSeconds: number | null;
  readonly endSeconds: number | null;
  readonly id: string;
  readonly mediaExternalId: string | null;
  readonly mediaProvider: "STORAGE" | "YOUTUBE" | "EXTERNAL_URL";
  readonly mimeType: string | null;
  readonly startSeconds: number | null;
  readonly title: string;
}

export interface RoomPlayerControls {
  currentTime: () => number | null;
  seekTo: (seconds: number) => void;
}

interface RoomPlayerProperties {
  readonly controlsRef: MutableRefObject<RoomPlayerControls | null>;
  readonly courseHref: string;
  readonly hasMaterials: boolean;
  readonly initialState: InitialPlayerState;
  readonly kind: RoomKind;
  readonly lessonId: string;
  readonly onShowMaterials: () => void;
  readonly position: {
    readonly durationSeconds: number | null;
    readonly positionSeconds: number;
  };
  readonly previousHref: string | null;
  readonly releasesAt: Date | null;
  readonly startAtSeconds: number | null;
  readonly title: string;
  readonly video: RoomPlayerVideo | null;
}

const READY_TIMEOUT_MS = 12_000;
const SAVE_EVERY_MS = 15_000;
const youtubeErrorCodes = new Set([2, 5, 100, 101, 150]);

const PosterArt = ({ dim }: { readonly dim: boolean }) => (
  <>
    <div aria-hidden="true" className="room-player__art">
      <RoomTemple className="room-player__temple" />
    </div>
    {dim ? <div aria-hidden="true" className="room-player__dim" /> : null}
  </>
);

const StateCard = ({
  actions,
  body,
  icon,
  title,
}: {
  readonly actions?: ReactNode;
  readonly body: string;
  readonly icon: ReactNode;
  readonly title: string;
}) => (
  <div aria-live="polite" className="room-glass room-player__card">
    {icon}
    <p className="room-player__card-title">{title}</p>
    <p className="room-player__card-body">{body}</p>
    {actions ? <div className="room-player__actions">{actions}</div> : null}
  </div>
);

// The YouTube iframe only exists after the student presses play: before that
// the page makes no request to YouTube at all.
const useYouTubeRoomPlayer = ({
  active,
  assetId,
  endSeconds,
  onError,
  onPlaying,
  onReady,
  startSeconds,
  title,
  videoId,
}: {
  readonly active: boolean;
  readonly assetId: string;
  readonly endSeconds: number | null;
  readonly onError: (code: string) => void;
  readonly onPlaying: (playing: boolean) => void;
  readonly onReady: () => void;
  readonly startSeconds: number;
  readonly title: string;
  readonly videoId: string | null;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);

  useEffect(() => {
    if (!(active && videoId && containerRef.current)) {
      return;
    }
    let disposed = false;
    let ready = false;
    let saveTimer: ReturnType<typeof setInterval> | null = null;
    let saveChain = Promise.resolve(true);
    const sessionId = crypto.randomUUID();
    const mount = document.createElement("div");
    containerRef.current.replaceChildren(mount);

    const save = (checkpointOnly = false) => {
      const player = playerRef.current;
      if (!(ready && player)) {
        return;
      }
      const sample = readPlaybackPosition(player);
      const rate = player.getPlaybackRate();
      saveChain = saveChain
        .catch(() => false)
        .then(() =>
          writePlaybackProgress(
            assetId,
            sample.positionMs,
            sample.durationSeconds,
            rate,
            sessionId,
            checkpointOnly
          )
        );
    };
    const stopSaving = () => {
      if (saveTimer) {
        clearInterval(saveTimer);
        saveTimer = null;
      }
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        save();
      }
    };
    const onPageHide = () => save();
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);

    const timeout = setTimeout(() => {
      if (!(ready || disposed)) {
        onError("timeout");
      }
    }, READY_TIMEOUT_MS);

    loadYouTubeApi()
      .then((api) => {
        if (disposed) {
          return;
        }
        const variables: Record<string, number | string> = {
          autoplay: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          playsinline: 1,
          rel: 0,
          start: Math.max(0, Math.floor(startSeconds)),
        };
        if (endSeconds !== null) {
          variables.end = endSeconds;
        }
        playerRef.current = new api.Player(mount, {
          host: "https://www.youtube-nocookie.com",
          playerVars: variables,
          videoId,
          events: {
            onReady: ({ target }) => {
              ready = true;
              clearTimeout(timeout);
              const iframe = target.getIframe();
              iframe.title = roomText("playerIframeTitle", { titulo: title });
              iframe.allow =
                "autoplay; encrypted-media; picture-in-picture; fullscreen";
              iframe.allowFullscreen = true;
              onReady();
            },
            onStateChange: ({ data }) => {
              if (data === api.PlayerState.PLAYING) {
                onPlaying(true);
                save(true);
                if (!saveTimer) {
                  saveTimer = setInterval(() => save(), SAVE_EVERY_MS);
                }
                return;
              }
              if (
                data === api.PlayerState.PAUSED ||
                data === api.PlayerState.ENDED
              ) {
                onPlaying(false);
                stopSaving();
                save();
              }
            },
            onError: ({ data }) => {
              clearTimeout(timeout);
              stopSaving();
              onError(youtubeErrorCodes.has(data) ? `yt_${data}` : "yt_5");
            },
          },
        });
      })
      .catch(() => {
        if (!disposed) {
          clearTimeout(timeout);
          onError("timeout");
        }
      });

    return () => {
      disposed = true;
      clearTimeout(timeout);
      stopSaving();
      save();
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [
    active,
    assetId,
    endSeconds,
    onError,
    onPlaying,
    onReady,
    startSeconds,
    title,
    videoId,
  ]);

  return { containerRef, playerRef };
};

const PosterLayer = ({
  durationSeconds,
  onStart,
  position,
  resume,
}: {
  readonly durationSeconds: number | null;
  readonly onStart: (choice: "resume" | "beginning" | "default") => void;
  readonly position: RoomPlayerProperties["position"];
  readonly resume: boolean;
}) => {
  const durationLabel =
    durationSeconds && durationSeconds > 0
      ? formatVideoTimestamp(durationSeconds)
      : null;
  const watchedPercent =
    position.durationSeconds && position.durationSeconds > 0
      ? Math.min(
          100,
          Math.round(
            (position.positionSeconds / position.durationSeconds) * 100
          )
        )
      : null;

  return (
    <>
      <PosterArt dim={false} />
      <button
        aria-label={roomText("play")}
        className="room-player__play"
        onClick={() => onStart("default")}
        type="button"
      >
        <PlayIcon aria-hidden="true" fill="currentColor" size={22} />
      </button>
      {resume ? (
        <div className="room-glass room-player__resume">
          <span className="room-player__resume-label">
            {roomText("resumeLabel")}
          </span>
          <span className="room-player__resume-time">
            {formatVideoTimestamp(position.positionSeconds)}
          </span>
          <div className="room-player__actions">
            <button
              className="room-button room-button--light"
              onClick={() => onStart("resume")}
              type="button"
            >
              {roomText("resumeCta")}
            </button>
            <button
              className="room-button room-button--glass"
              onClick={() => onStart("beginning")}
              type="button"
            >
              {roomText("resumeRestart")}
            </button>
          </div>
        </div>
      ) : null}
      {!resume && durationLabel ? (
        <span className="room-player__duration">{durationLabel}</span>
      ) : null}
      {resume && watchedPercent !== null ? (
        <div aria-hidden="true" className="room-player__progress">
          <span style={{ width: `${watchedPercent}%` }} />
        </div>
      ) : null}
    </>
  );
};

const BlockedLayer = ({
  courseHref,
  hasMaterials,
  kind,
  onRetry,
  onShowMaterials,
  previousHref,
  releasesAt,
  state,
}: {
  readonly courseHref: string;
  readonly hasMaterials: boolean;
  readonly kind: RoomKind;
  readonly onRetry: () => void;
  readonly onShowMaterials: () => void;
  readonly previousHref: string | null;
  readonly releasesAt: Date | null;
  readonly state: RoomPlayerState;
}) => {
  const retryButton = (tone: "light" | "glass") => (
    <button
      className={`room-button room-button--${tone}`}
      onClick={onRetry}
      type="button"
    >
      {roomText("retry")}
    </button>
  );
  const cards: Partial<Record<RoomPlayerState, ReactNode>> = {
    unavailable: (
      <StateCard
        actions={
          <>
            {hasMaterials ? (
              <button
                className="room-button room-button--light"
                onClick={onShowMaterials}
                type="button"
              >
                {roomText("unavailableMaterials")}
              </button>
            ) : null}
            {retryButton(hasMaterials ? "glass" : "light")}
          </>
        }
        body={roomText(
          hasMaterials ? "unavailableBody" : "unavailableBodyNoMaterials"
        )}
        icon={<AlertTriangleIcon aria-hidden="true" size={30} />}
        title={roomText("unavailableTitle")}
      />
    ),
    error_timeout: (
      <StateCard
        actions={retryButton("light")}
        body={roomText("timeoutBody")}
        icon={<AlertTriangleIcon aria-hidden="true" size={30} />}
        title={roomText("timeoutTitle")}
      />
    ),
    offline: (
      <StateCard
        body={roomText("offlineBody")}
        icon={<WifiOffIcon aria-hidden="true" size={30} />}
        title={roomText("offlineTitle")}
      />
    ),
    no_video: (
      <StateCard
        body={roomTextFor(kind, "noVideoBody")}
        icon={<VideoOffIcon aria-hidden="true" size={30} />}
        title={roomTextFor(kind, "noVideoTitle")}
      />
    ),
    locked: (
      <StateCard
        actions={
          <Link
            className="room-button room-button--light"
            href={previousHref ?? courseHref}
          >
            {roomText(previousHref ? "lockedCtaPrevious" : "lockedCtaCourse")}
          </Link>
        }
        body={roomText("lockedBody")}
        icon={<LockIcon aria-hidden="true" size={30} />}
        title={roomText("lockedTitle", {
          data: releasesAt ? roomReleaseDate(releasesAt) : "",
        })}
      />
    ),
  };
  const card = cards[state];
  if (!card) {
    return null;
  }
  return (
    <>
      <PosterArt dim />
      {card}
    </>
  );
};

export const RoomPlayer = ({
  controlsRef,
  courseHref,
  hasMaterials,
  initialState,
  kind,
  lessonId,
  onShowMaterials,
  position,
  previousHref,
  releasesAt,
  startAtSeconds,
  title,
  video,
}: RoomPlayerProperties) => {
  const [state, setState] = useState<RoomPlayerState>(initialState);
  const [startSeconds, setStartSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reportedRef = useRef(false);
  const isYouTube = video?.mediaProvider === "YOUTUBE";
  const active = state === "loading" || state === "playing";

  const handleError = useCallback(
    (code: string) => {
      setState(code === "timeout" ? "error_timeout" : "unavailable");
      setPlaying(false);
      if (!reportedRef.current && video) {
        reportedRef.current = true;
        reportRoomVideoIssue({ assetId: video.id, code }).catch(
          () => undefined
        );
      }
    },
    [video]
  );
  const handleReady = useCallback(() => setState("playing"), []);

  const { containerRef, playerRef } = useYouTubeRoomPlayer({
    active: active && isYouTube,
    assetId: `${video?.id ?? ""}`,
    endSeconds: video?.endSeconds ?? null,
    onError: handleError,
    onPlaying: setPlaying,
    onReady: handleReady,
    startSeconds,
    title,
    videoId: isYouTube ? (video?.mediaExternalId ?? null) : null,
  });

  const start = useCallback(
    (choice: "resume" | "beginning" | "default", at: number | null = null) => {
      if (!video) {
        return;
      }
      if (!navigator.onLine) {
        setState("offline");
        return;
      }
      setStartSeconds(
        effectiveStartSeconds({
          choice,
          position,
          startAtSeconds: at ?? startAtSeconds,
          video,
        })
      );
      setState("loading");
    },
    [position, startAtSeconds, video]
  );

  useEffect(() => {
    controlsRef.current = {
      currentTime: () => {
        const player = playerRef.current;
        return player && state === "playing"
          ? Math.max(0, Math.floor(player.getCurrentTime()))
          : null;
      },
      seekTo: (seconds) => {
        const player = playerRef.current;
        if (player?.seekTo && state === "playing") {
          player.seekTo(seconds, true);
          return;
        }
        start("default", seconds);
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef, playerRef, start, state]);

  useEffect(() => {
    const goOffline = () =>
      setState((current) =>
        current === "idle" || current === "resume" || current === "loading"
          ? "offline"
          : current
      );
    const goOnline = () =>
      setState((current) => (current === "offline" ? initialState : current));
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [initialState]);

  const retry = () => {
    reportedRef.current = false;
    setState("idle");
    setTimeout(() => start("default"), 0);
  };

  if (active && video && !isYouTube) {
    return (
      <div className="room-player-stored">
        <LessonPlayer
          assetId={video.id}
          mediaExternalId={video.mediaExternalId}
          mediaProvider={video.mediaProvider}
          mimeType={video.mimeType}
          persistProgress
          title={video.title}
        />
      </div>
    );
  }

  return (
    <div className="room-player" data-state={state}>
      {active && isYouTube ? (
        <>
          <StudyHeartbeat
            activityKind={kind === "recording" ? "RECORDING" : "LESSON"}
            playbackActive={playing}
            resourceId={lessonId}
          />
          <div className="room-player__frame" ref={containerRef} />
          {state === "loading" ? (
            <output className="room-player__loading">
              <span aria-hidden="true" className="room-spinner" />
              {roomText("playerLoading")}
            </output>
          ) : null}
        </>
      ) : null}
      {state === "idle" || state === "resume" ? (
        <PosterLayer
          durationSeconds={video?.durationSeconds ?? null}
          onStart={start}
          position={position}
          resume={state === "resume"}
        />
      ) : null}
      <BlockedLayer
        courseHref={courseHref}
        hasMaterials={hasMaterials}
        kind={kind}
        onRetry={retry}
        onShowMaterials={onShowMaterials}
        previousHref={previousHref}
        releasesAt={releasesAt}
        state={state}
      />
    </div>
  );
};
