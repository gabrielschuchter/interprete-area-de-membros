import { describe, expect, test } from "vitest";
import {
  effectiveStartSeconds,
  isResumable,
  parseStartAt,
  type RoomVideo,
  resolveInitialPlayerState,
  videoAssetAvailability,
} from "./room-player-state";

const now = new Date("2026-10-23T12:00:00Z");
const video: RoomVideo = {
  availability: "ok",
  durationSeconds: 900,
  endSeconds: null,
  startSeconds: null,
};
const fresh = { durationSeconds: null, positionSeconds: 0 };

describe("videoAssetAvailability", () => {
  const youtube = {
    externalUrl: null,
    mediaExternalId: "dQw4w9WgXcQ",
    mediaProvider: "YOUTUBE" as const,
    storagePath: null,
    youtubeVerificationStatus: "UNLISTED",
  };

  test("maps the daily YouTube verification", () => {
    expect(videoAssetAvailability(youtube)).toBe("ok");
    for (const status of [
      "PRIVATE_OR_NOT_FOUND",
      "EMBEDDING_DISABLED",
      "INVALID",
    ]) {
      expect(
        videoAssetAvailability({
          ...youtube,
          youtubeVerificationStatus: status,
        })
      ).toBe("broken");
    }
    for (const status of ["UNREACHABLE", "NOT_CONFIGURED", null]) {
      expect(
        videoAssetAvailability({
          ...youtube,
          youtubeVerificationStatus: status,
        })
      ).toBe("unchecked");
    }
    expect(videoAssetAvailability({ ...youtube, mediaExternalId: null })).toBe(
      "missing"
    );
  });

  test("treats stored video by the presence of its file", () => {
    const stored = {
      ...youtube,
      mediaExternalId: null,
      mediaProvider: "STORAGE" as const,
      youtubeVerificationStatus: null,
    };
    expect(videoAssetAvailability({ ...stored, storagePath: "a/b.mp4" })).toBe(
      "ok"
    );
    expect(videoAssetAvailability(stored)).toBe("missing");
  });
});

describe("isResumable", () => {
  test("needs at least 20 s past the clip start", () => {
    expect(isResumable({ ...fresh, positionSeconds: 19 }, video)).toBe(false);
    expect(isResumable({ ...fresh, positionSeconds: 20 }, video)).toBe(true);
    expect(
      isResumable(
        { ...fresh, positionSeconds: 70 },
        { ...video, startSeconds: 60 }
      )
    ).toBe(false);
  });

  test("never offers the last 20 s", () => {
    expect(isResumable({ ...fresh, positionSeconds: 880 }, video)).toBe(true);
    expect(isResumable({ ...fresh, positionSeconds: 881 }, video)).toBe(false);
    expect(
      isResumable(
        { ...fresh, positionSeconds: 300 },
        { ...video, endSeconds: 310 }
      )
    ).toBe(false);
  });

  test("falls back to the duration reported by the player", () => {
    const unknown = { ...video, durationSeconds: null };
    expect(
      isResumable({ durationSeconds: 100, positionSeconds: 90 }, unknown)
    ).toBe(false);
    expect(
      isResumable({ durationSeconds: null, positionSeconds: 5000 }, unknown)
    ).toBe(true);
  });
});

describe("resolveInitialPlayerState", () => {
  const base = {
    now,
    position: fresh,
    releasesAt: null,
    startAtSeconds: null,
    video,
  };

  test("follows the documented precedence", () => {
    expect(
      resolveInitialPlayerState({
        ...base,
        releasesAt: new Date("2026-10-24T00:00:00Z"),
        video: null,
      })
    ).toBe("locked");
    expect(resolveInitialPlayerState({ ...base, video: null })).toBe(
      "no_video"
    );
    expect(
      resolveInitialPlayerState({
        ...base,
        video: { ...video, availability: "missing" },
      })
    ).toBe("no_video");
    expect(
      resolveInitialPlayerState({
        ...base,
        video: { ...video, availability: "broken" },
      })
    ).toBe("unavailable");
    expect(resolveInitialPlayerState(base)).toBe("idle");
  });

  test("offers resume unless ?t= was given", () => {
    const watched = { durationSeconds: 900, positionSeconds: 522 };
    expect(resolveInitialPlayerState({ ...base, position: watched })).toBe(
      "resume"
    );
    expect(
      resolveInitialPlayerState({
        ...base,
        position: watched,
        startAtSeconds: 30,
      })
    ).toBe("idle");
  });

  test("a past release date does not lock", () => {
    expect(
      resolveInitialPlayerState({
        ...base,
        releasesAt: new Date("2026-10-01T00:00:00Z"),
      })
    ).toBe("idle");
  });
});

describe("effectiveStartSeconds", () => {
  const position = { positionSeconds: 522 };

  test("respects the clip start in every choice", () => {
    const clip = { startSeconds: 60 };
    expect(
      effectiveStartSeconds({
        choice: "resume",
        position,
        startAtSeconds: null,
        video: clip,
      })
    ).toBe(522);
    expect(
      effectiveStartSeconds({
        choice: "beginning",
        position,
        startAtSeconds: null,
        video: clip,
      })
    ).toBe(60);
    expect(
      effectiveStartSeconds({
        choice: "default",
        position,
        startAtSeconds: 10,
        video: clip,
      })
    ).toBe(60);
    expect(
      effectiveStartSeconds({
        choice: "default",
        position,
        startAtSeconds: 120,
        video: clip,
      })
    ).toBe(120);
  });
});

describe("parseStartAt", () => {
  test("accepts whole seconds inside the video only", () => {
    expect(parseStartAt("42", 900)).toBe(42);
    expect(parseStartAt("0", null)).toBe(0);
    expect(parseStartAt("900", 900)).toBeNull();
    for (const raw of ["-1", "1.5", "abc", "", "1234567", undefined, null]) {
      expect(parseStartAt(raw, null)).toBeNull();
    }
    expect(parseStartAt(["1", "2"], null)).toBeNull();
  });
});
