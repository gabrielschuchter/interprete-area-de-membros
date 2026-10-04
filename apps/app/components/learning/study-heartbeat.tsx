"use client";

import { useEffect, useRef } from "react";

type TrackedActivityKind =
  | "ACTIVITY"
  | "COMMUNITY"
  | "EXERCISE"
  | "LIBRARY_ITEM"
  | "LESSON"
  | "RECORDING";

interface StudyHeartbeatProperties {
  readonly activityKind: TrackedActivityKind;
  readonly playbackActive?: boolean;
  readonly resourceId: string;
}

export const StudyHeartbeat = ({
  activityKind,
  playbackActive = false,
  resourceId,
}: StudyHeartbeatProperties) => {
  const playbackState = useRef(playbackActive);
  useEffect(() => {
    const clientSessionId = crypto.randomUUID();
    let sequence = 0;
    let lastInteractionAt = 0;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let playback = playbackState.current;
    let requestQueue = Promise.resolve();

    const send = (active: boolean, playbackOverride = playback) => {
      const requestSequence = sequence;
      sequence += 1;
      requestQueue = requestQueue
        .then(() =>
          fetch("/api/study/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            keepalive: true,
            body: JSON.stringify({
              active,
              activityKind,
              clientSessionId,
              isPlayback: active && playbackOverride,
              resourceId,
              sequence: requestSequence,
            }),
          })
        )
        .then(() => undefined)
        .catch(() => undefined);
    };

    const isActive = () =>
      document.visibilityState === "visible" &&
      (playback || Date.now() - lastInteractionAt < 120_000);

    const stopHeartbeat = (closeActiveInterval: boolean) => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (closeActiveInterval) {
        send(false);
      }
    };

    const startHeartbeat = () => {
      if (heartbeatTimer || document.visibilityState !== "visible") {
        return;
      }
      send(true);
      heartbeatTimer = setInterval(() => {
        if (isActive()) {
          send(true);
        } else {
          stopHeartbeat(true);
        }
      }, 20_000);
    };

    const scheduleIdleBoundary = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(() => {
        if (heartbeatTimer) {
          send(true, false);
          stopHeartbeat(true);
        }
      }, 120_000);
    };

    const noteInteraction = () => {
      lastInteractionAt = Date.now();
      startHeartbeat();
      if (!playback) {
        scheduleIdleBoundary();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (isActive()) {
          send(true);
        }
        stopHeartbeat(true);
        return;
      }
      if (playback) {
        startHeartbeat();
      }
    };

    const onPlaybackChange = (event: Event) => {
      const detail = (event as CustomEvent<{ active: boolean }>).detail;
      const wasPlaying = playback;
      playback = detail.active;
      if (playback) {
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        startHeartbeat();
      } else if (heartbeatTimer) {
        if (isActive()) {
          send(true, wasPlaying);
        }
        stopHeartbeat(true);
      }
    };

    if (playback) {
      startHeartbeat();
    }
    document.addEventListener("pointerdown", noteInteraction, {
      passive: true,
    });
    document.addEventListener("keydown", noteInteraction);
    document.addEventListener("touchstart", noteInteraction, { passive: true });
    document.addEventListener("touchmove", noteInteraction, { passive: true });
    document.addEventListener("wheel", noteInteraction, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("study-playback-change", onPlaybackChange);

    return () => {
      if (isActive()) {
        send(true);
      }
      stopHeartbeat(true);
      document.removeEventListener("pointerdown", noteInteraction);
      document.removeEventListener("keydown", noteInteraction);
      document.removeEventListener("touchstart", noteInteraction);
      document.removeEventListener("touchmove", noteInteraction);
      document.removeEventListener("wheel", noteInteraction);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("study-playback-change", onPlaybackChange);
    };
  }, [activityKind, resourceId]);

  const previousPlaybackState = useRef(playbackActive);
  useEffect(() => {
    if (previousPlaybackState.current === playbackActive) {
      return;
    }
    previousPlaybackState.current = playbackActive;
    playbackState.current = playbackActive;
    window.dispatchEvent(
      new CustomEvent("study-playback-change", {
        detail: { active: playbackActive },
      })
    );
  }, [playbackActive]);

  return null;
};
