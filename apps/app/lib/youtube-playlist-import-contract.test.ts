import { describe, expect, it } from "vitest";
import { createYouTubePlaylistImportFingerprint } from "./youtube-playlist-import-contract";

const claims = [
  {
    playlistId: "PL1234567890",
    position: 0,
    videoId: "abcdefghijk",
    videoTitle: "Primeira aula",
  },
  {
    playlistId: "PL1234567890",
    position: 2,
    videoId: "lmnopqrstuv",
    videoTitle: "Terceira aula",
  },
];

const base = {
  claims,
  courseId: "course-1",
  moduleId: "module-1",
  status: "DRAFT",
  useVideoTitle: true,
} satisfies Parameters<typeof createYouTubePlaylistImportFingerprint>[0];

const fingerprint = (overrides: Partial<Omit<typeof base, "claims">> = {}) =>
  createYouTubePlaylistImportFingerprint({ ...base, ...overrides });

describe("YouTube playlist import fingerprint", () => {
  it("does not depend on the selection token expiry or claim input order", () => {
    expect(
      createYouTubePlaylistImportFingerprint({
        claims: [...claims].reverse(),
        courseId: "course-1",
        moduleId: "module-1",
        status: "DRAFT",
        useVideoTitle: true,
      })
    ).toBe(fingerprint());
  });

  it.each([
    ["courseId", "course-2"],
    ["moduleId", "module-2"],
    ["status", "PUBLISHED"],
    ["useVideoTitle", false],
  ])("changes when %s changes", (key, value) => {
    expect(fingerprint({ [key]: value })).not.toBe(fingerprint());
  });

  it("changes when the selected videos change", () => {
    expect(
      createYouTubePlaylistImportFingerprint({
        claims: claims.slice(0, 1),
        courseId: "course-1",
        moduleId: "module-1",
        status: "DRAFT",
        useVideoTitle: true,
      })
    ).not.toBe(fingerprint());
  });
});
