import { describe, expect, it } from "vitest";
import {
  createPlaybackWindow,
  deriveWatchedInterval,
  hasWatchedNinetyPercent,
  mergeWatchedIntervals,
  readPlaybackCheckpoint,
  updatePlaybackCheckpoints,
  watchedDurationMs,
} from "./playback-progress";

describe("playback progress coverage", () => {
  it("requires two server-timed samples and rejects forward and backward seeks", () => {
    const baseline = { positionMs: 10_000, sampledAtMs: 1000 };
    expect(
      deriveWatchedInterval(
        null,
        { positionMs: 20_000, sampledAtMs: 11_000 },
        1
      )
    ).toBeNull();
    expect(
      deriveWatchedInterval(
        baseline,
        { positionMs: 20_000, sampledAtMs: 11_000 },
        1
      )
    ).toEqual({ fromMs: 10_000, toMs: 20_000 });
    expect(
      deriveWatchedInterval(
        baseline,
        { positionMs: 25_500, sampledAtMs: 16_000 },
        1
      )
    ).toEqual({ fromMs: 10_500, toMs: 25_500 });
    expect(
      deriveWatchedInterval(
        baseline,
        { positionMs: 20_000, sampledAtMs: 11_000 },
        1,
        true
      )
    ).toBeNull();
    expect(
      deriveWatchedInterval(
        baseline,
        { positionMs: 40_000, sampledAtMs: 11_000 },
        1
      )
    ).toBeNull();
    expect(
      deriveWatchedInterval(
        baseline,
        { positionMs: 5000, sampledAtMs: 11_000 },
        1
      )
    ).toBeNull();
  });

  it("unions overlapping intervals so simultaneous tabs cannot double-count", () => {
    const intervals = mergeWatchedIntervals(
      [{ fromMs: 10_000, toMs: 25_000 }],
      { fromMs: 20_000, toMs: 35_000 },
      { startMs: 0, endMs: 60_000 }
    );
    expect(intervals).toEqual([{ fromMs: 10_000, toMs: 35_000 }]);
    expect(watchedDurationMs(intervals)).toBe(25_000);
  });

  it("clamps watched time to the configured clip and requires 90 percent", () => {
    const window = createPlaybackWindow(120, 30, 90);
    if (!window) {
      throw new Error("Expected a valid playback clip window.");
    }
    expect(window).toEqual({ startMs: 30_000, endMs: 90_000 });
    const intervals = mergeWatchedIntervals(
      [
        { fromMs: 0, toMs: 35_000 },
        { fromMs: 35_000, toMs: 83_999 },
      ],
      null,
      window
    );
    expect(hasWatchedNinetyPercent(intervals, window)).toBe(false);
    const completed = mergeWatchedIntervals(
      intervals,
      { fromMs: 83_999, toMs: 84_000 },
      window
    );
    expect(hasWatchedNinetyPercent(completed, window)).toBe(true);
  });

  it("does not infer a completion denominator before duration is known", () => {
    expect(createPlaybackWindow(null, null, null)).toBeNull();
    expect(createPlaybackWindow(null, 20, 80)).toEqual({
      startMs: 20_000,
      endMs: 80_000,
    });
    expect(createPlaybackWindow(120, 90, 80)).toBeNull();
  });

  it("keeps sample checkpoints separate per tab and drops expired sessions", () => {
    const one = "11111111-1111-4111-8111-111111111111";
    const two = "22222222-2222-4222-8222-222222222222";
    const stale = "33333333-3333-4333-8333-333333333333";
    const state = updatePlaybackCheckpoints(
      { [stale]: { positionMs: 1000, sampledAtMs: 1000 } },
      one,
      { positionMs: 10_000, sampledAtMs: 3_601_001 }
    );
    const next = updatePlaybackCheckpoints(state, two, {
      positionMs: 40_000,
      sampledAtMs: 3_601_002,
    });
    expect(readPlaybackCheckpoint(next, one, 3_601_003)).toEqual({
      positionMs: 10_000,
      sampledAtMs: 3_601_001,
    });
    expect(readPlaybackCheckpoint(next, two, 3_601_003)).toEqual({
      positionMs: 40_000,
      sampledAtMs: 3_601_002,
    });
    expect(readPlaybackCheckpoint(next, stale, 3_601_003)).toBeNull();
  });
});
