export interface WatchedInterval {
  readonly fromMs: number;
  readonly toMs: number;
}

export interface PlaybackCheckpoint {
  readonly positionMs: number;
  readonly sampledAtMs: number;
}

export interface PlaybackWindow {
  readonly endMs: number;
  readonly startMs: number;
}

const maxPlaybackMs = 86_400_000;
const maxSessionAgeMs = 60 * 60_000;
const maxPlaybackSessions = 32;
const sessionIdPattern =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export const maxWatchedSampleMs = 35_000;

export const deriveWatchedInterval = (
  previous: PlaybackCheckpoint | null,
  current: PlaybackCheckpoint,
  playbackRate: number,
  checkpointOnly = false
): WatchedInterval | null => {
  if (!previous || checkpointOnly) {
    return null;
  }
  const wallDelta = current.sampledAtMs - previous.sampledAtMs;
  const mediaDelta = current.positionMs - previous.positionMs;
  if (
    wallDelta <= 0 ||
    mediaDelta <= 0 ||
    mediaDelta > maxWatchedSampleMs ||
    mediaDelta > wallDelta * playbackRate + 1000
  ) {
    return null;
  }
  const creditedDelta = Math.min(mediaDelta, wallDelta * playbackRate);
  return {
    fromMs: current.positionMs - Math.floor(creditedDelta),
    toMs: current.positionMs,
  };
};

export const createPlaybackWindow = (
  durationSeconds: number | null,
  startAtSeconds: number | null,
  endAtSeconds: number | null
): PlaybackWindow | null => {
  const durationMs =
    durationSeconds !== null &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0
      ? Math.min(durationSeconds * 1000, maxPlaybackMs)
      : null;
  if (durationMs === null && endAtSeconds === null) {
    return null;
  }

  const maximumEndMs = durationMs ?? maxPlaybackMs;
  const startMs = Math.min(
    Math.max(0, (startAtSeconds ?? 0) * 1000),
    maximumEndMs
  );
  const requestedEndMs =
    endAtSeconds === null ? maximumEndMs : Math.max(0, endAtSeconds * 1000);
  const endMs = Math.min(requestedEndMs, maximumEndMs);
  return endMs > startMs ? { startMs, endMs } : null;
};

const parseInterval = (value: unknown): WatchedInterval | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const interval = value as Record<string, unknown>;
  const { fromMs, toMs } = interval;
  return Number.isInteger(fromMs) &&
    Number.isInteger(toMs) &&
    Number(fromMs) >= 0 &&
    Number(toMs) > Number(fromMs) &&
    Number(toMs) <= maxPlaybackMs
    ? { fromMs: Number(fromMs), toMs: Number(toMs) }
    : null;
};

export const mergeWatchedIntervals = (
  stored: unknown,
  incoming: WatchedInterval | null,
  window: PlaybackWindow
): WatchedInterval[] => {
  const storedIntervals = Array.isArray(stored)
    ? stored.map(parseInterval).filter((value) => value !== null)
    : [];
  const candidates = incoming
    ? [...storedIntervals, incoming]
    : storedIntervals;
  const bounded = candidates
    .map(({ fromMs, toMs }) => ({
      fromMs: Math.max(fromMs, window.startMs),
      toMs: Math.min(toMs, window.endMs),
    }))
    .filter(({ fromMs, toMs }) => toMs > fromMs)
    .sort((left, right) => left.fromMs - right.fromMs);
  const merged: WatchedInterval[] = [];
  for (const interval of bounded) {
    const last = merged.at(-1);
    if (!last || interval.fromMs > last.toMs) {
      merged.push(interval);
      continue;
    }
    merged[merged.length - 1] = {
      fromMs: last.fromMs,
      toMs: Math.max(last.toMs, interval.toMs),
    };
  }
  return merged;
};

export const readPlaybackCheckpoint = (
  stored: unknown,
  sessionId: string,
  nowMs: number
): PlaybackCheckpoint | null => {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return null;
  }
  const value = (stored as Record<string, unknown>)[sessionId];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const checkpoint = value as Record<string, unknown>;
  const { positionMs, sampledAtMs } = checkpoint;
  if (
    !(Number.isInteger(positionMs) && Number.isInteger(sampledAtMs)) ||
    Number(positionMs) < 0 ||
    Number(positionMs) > maxPlaybackMs ||
    Number(sampledAtMs) > nowMs ||
    nowMs - Number(sampledAtMs) > maxSessionAgeMs
  ) {
    return null;
  }
  return {
    positionMs: Number(positionMs),
    sampledAtMs: Number(sampledAtMs),
  };
};

export const updatePlaybackCheckpoints = (
  stored: unknown,
  sessionId: string,
  checkpoint: PlaybackCheckpoint
): Record<string, PlaybackCheckpoint> => {
  const entries =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? Object.entries(stored as Record<string, unknown>)
      : [];
  const active = entries.flatMap(([id, value]) => {
    if (!sessionIdPattern.test(id)) {
      return [];
    }
    const parsed = readPlaybackCheckpoint(
      { [id]: value },
      id,
      checkpoint.sampledAtMs
    );
    return parsed ? [[id, parsed] as const] : [];
  });
  const sessions = new Map(active);
  sessions.set(sessionId, checkpoint);
  return Object.fromEntries(
    [...sessions.entries()]
      .sort((left, right) => left[1].sampledAtMs - right[1].sampledAtMs)
      .slice(-maxPlaybackSessions)
  );
};

export const watchedDurationMs = (intervals: readonly WatchedInterval[]) =>
  intervals.reduce(
    (total, interval) => total + interval.toMs - interval.fromMs,
    0
  );

export const hasWatchedNinetyPercent = (
  intervals: readonly WatchedInterval[],
  window: PlaybackWindow | null
) => {
  if (!window) {
    return false;
  }
  const totalDurationMs = window.endMs - window.startMs;
  return (
    totalDurationMs > 0 &&
    watchedDurationMs(intervals) >= Math.ceil(totalDurationMs * 0.9)
  );
};
