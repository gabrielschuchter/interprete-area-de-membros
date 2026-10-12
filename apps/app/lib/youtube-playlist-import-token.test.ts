import { describe, expect, it } from "vitest";
import {
  createYouTubePlaylistImportToken,
  readYouTubePlaylistImportToken,
} from "./youtube-playlist-import-token";
import type { YouTubePlaylistItem } from "./youtube-verification";

const playlistId = "PLGestaoDevFixture01";
const secret = "server-secret-that-is-never-sent-to-the-browser";
const item: YouTubePlaylistItem = {
  videoId: "AbC123xYz01",
  title: "Aula um",
  position: 4,
  thumbnailUrl: "https://i.ytimg.com/vi/AbC123xYz01/hqdefault.jpg",
  importable: true,
  metadata: {
    videoId: "AbC123xYz01",
    title: "Aula um",
    durationSeconds: 90,
    thumbnailUrl: "https://i.ytimg.com/vi/AbC123xYz01/hqdefault.jpg",
    privacyStatus: "UNLISTED",
    embeddable: true,
    captionsAvailable: null,
  },
};

describe("signed YouTube playlist import selections", () => {
  it("accepts an unexpired selection only for the actor who received it", () => {
    const token = createYouTubePlaylistImportToken({
      actorId: "teacher_1",
      expiresAt: 30_000,
      item,
      playlistId,
      secret,
    });
    expect(token).toBeTruthy();
    expect(
      readYouTubePlaylistImportToken(token as string, {
        actorId: "teacher_1",
        now: 10_000,
        secret,
      })
    ).toMatchObject({
      actorId: "teacher_1",
      playlistId,
      position: 4,
      videoId: "AbC123xYz01",
    });
    expect(
      readYouTubePlaylistImportToken(token as string, {
        actorId: "teacher_2",
        now: 10_000,
        secret,
      })
    ).toBeNull();
  });

  it("rejects expired, altered, and incorrectly signed selections", () => {
    const token = createYouTubePlaylistImportToken({
      actorId: "teacher_1",
      expiresAt: 10_000,
      item,
      playlistId,
      secret,
    }) as string;
    const [payload, signature] = token.split(".");
    const alteredPayload = payload
      ? `${payload.startsWith("A") ? "B" : "A"}${payload.slice(1)}`
      : "A";
    const altered = `${alteredPayload}.${signature}`;
    expect(
      readYouTubePlaylistImportToken(token, {
        actorId: "teacher_1",
        now: 10_000,
        secret,
      })
    ).toBeNull();
    expect(
      readYouTubePlaylistImportToken(altered, {
        actorId: "teacher_1",
        now: 1,
        secret,
      })
    ).toBeNull();
    expect(
      readYouTubePlaylistImportToken(token, {
        actorId: "teacher_1",
        now: 1,
        secret: "another-secret",
      })
    ).toBeNull();
  });

  it("does not issue a selectable token for a private or unresolved item", () => {
    expect(
      createYouTubePlaylistImportToken({
        actorId: "teacher_1",
        expiresAt: 30_000,
        item: { ...item, importable: false },
        playlistId,
        secret,
      })
    ).toBeNull();
    expect(
      createYouTubePlaylistImportToken({
        actorId: "teacher_1",
        expiresAt: 30_000,
        item: { ...item, metadata: null },
        playlistId,
        secret,
      })
    ).toBeNull();
  });
});
