import { describe, expect, it } from "vitest";
import {
  getYoutubeVideoId,
  getYoutubeWatchUrl,
  resolveYoutubePlayback,
} from "./youtube-video";

describe("YouTube media URLs", () => {
  it.each([
    "dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?t=12",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ])("extracts a valid video id from %s", (value) => {
    expect(getYoutubeVideoId(value)).toBe("dQw4w9WgXcQ");
  });

  it.each([
    "javascript:alert(1)",
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=short",
    "https://vimeo.com/dQw4w9WgXcQ",
  ])("rejects unsupported media URL %s", (value) => {
    expect(getYoutubeVideoId(value)).toBeNull();
  });

  it("builds a canonical watch URL only for a valid video id", () => {
    expect(getYoutubeWatchUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
    expect(getYoutubeWatchUrl("bad")).toBeNull();
  });

  it("keeps YouTube assets pending when a video association is missing", () => {
    expect(resolveYoutubePlayback("YOUTUBE", null)).toEqual({
      kind: "pending",
    });
    expect(resolveYoutubePlayback("YOUTUBE", "not-a-video-id")).toEqual({
      kind: "pending",
    });
  });

  it("returns only validated YouTube IDs for mapped assets", () => {
    expect(resolveYoutubePlayback("YOUTUBE", "dQw4w9WgXcQ")).toEqual({
      kind: "ready",
      videoId: "dQw4w9WgXcQ",
    });
  });

  it("does not change the handling of other media providers", () => {
    expect(resolveYoutubePlayback("STORAGE", "dQw4w9WgXcQ")).toEqual({
      kind: "other-provider",
    });
  });
});
