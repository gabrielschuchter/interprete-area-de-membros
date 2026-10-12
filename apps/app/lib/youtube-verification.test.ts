import { describe, expect, it } from "vitest";
import { youtubePublicationIssue } from "./youtube-publication-policy";
import {
  parseYouTubeDuration,
  parseYouTubePlaylistId,
  safeYouTubeThumbnailUrl,
  verifyYouTubeVideo,
  type YouTubeDataAdapter,
  type YouTubeVideoMetadata,
} from "./youtube-verification";

const unlistedVideo: YouTubeVideoMetadata = {
  videoId: "AbC123xYz01",
  title: "Aula de demonstração",
  durationSeconds: 872,
  thumbnailUrl: "https://i.ytimg.com/vi/AbC123xYz01/hqdefault.jpg",
  privacyStatus: "UNLISTED",
  embeddable: true,
  captionsAvailable: true,
};

const adapterFor = (
  video: YouTubeVideoMetadata | null,
  shouldReject = false
): YouTubeDataAdapter => ({
  source: "TEST",
  getVideo: () => {
    if (shouldReject) {
      return Promise.reject(new Error("upstream unavailable"));
    }
    return Promise.resolve(video);
  },
  getPlaylistPage: () =>
    Promise.resolve({ items: [], nextPageToken: null, totalResults: 0 }),
  getVideos: (videoIds) =>
    Promise.resolve(
      new Map(
        video && videoIds.includes(video.videoId)
          ? [[video.videoId, video]]
          : []
      )
    ),
});

describe("YouTube verification domain", () => {
  it("parses YouTube durations including day and fractional-second components", () => {
    expect(parseYouTubeDuration("PT14M32S")).toBe(872);
    expect(parseYouTubeDuration("P1DT2H3M4.9S")).toBe(93_784);
    expect(parseYouTubeDuration("invalid")).toBeNull();
  });

  it("accepts only a YouTube playlist URL with a bounded ID", () => {
    expect(
      parseYouTubePlaylistId(
        "https://www.youtube.com/playlist?list=PLGestaoDevFixture01"
      )
    ).toBe("PLGestaoDevFixture01");
    expect(
      parseYouTubePlaylistId(
        "https://youtube.com.evil.example/playlist?list=PL0123456789"
      )
    ).toBeNull();
    expect(
      parseYouTubePlaylistId("https://youtube.com/playlist?list=short")
    ).toBeNull();
  });

  it("accepts only HTTPS thumbnails from YouTube's image host", () => {
    expect(safeYouTubeThumbnailUrl("https://i.ytimg.com/vi/id/hq.jpg")).toBe(
      "https://i.ytimg.com/vi/id/hq.jpg"
    );
    expect(
      safeYouTubeThumbnailUrl("http://i.ytimg.com/vi/id/hq.jpg")
    ).toBeNull();
    expect(
      safeYouTubeThumbnailUrl("https://evil.example/thumbnail.jpg")
    ).toBeNull();
  });

  it("classifies unlisted videos and retains API metadata", async () => {
    await expect(
      verifyYouTubeVideo(
        "https://youtu.be/AbC123xYz01",
        adapterFor(unlistedVideo)
      )
    ).resolves.toEqual({
      status: "UNLISTED",
      source: "TEST",
      videoId: "AbC123xYz01",
      metadata: unlistedVideo,
    });
  });

  it("allows public videos with a warning state", async () => {
    const publicVideo = { ...unlistedVideo, privacyStatus: "PUBLIC" as const };
    await expect(
      verifyYouTubeVideo("AbC123xYz01", adapterFor(publicVideo))
    ).resolves.toMatchObject({ status: "PUBLIC", metadata: publicVideo });
  });

  it("combines private and missing videos in API-key mode", async () => {
    await expect(
      verifyYouTubeVideo("AbC123xYz01", adapterFor(null))
    ).resolves.toMatchObject({ status: "PRIVATE_OR_NOT_FOUND" });

    await expect(
      verifyYouTubeVideo(
        "AbC123xYz01",
        adapterFor({ ...unlistedVideo, privacyStatus: "PRIVATE" })
      )
    ).resolves.toMatchObject({ status: "PRIVATE_OR_NOT_FOUND" });
  });

  it("blocks non-embeddable videos and keeps API outages saveable as drafts", async () => {
    await expect(
      verifyYouTubeVideo(
        "AbC123xYz01",
        adapterFor({ ...unlistedVideo, embeddable: false })
      )
    ).resolves.toMatchObject({ status: "EMBEDDING_DISABLED" });
    await expect(
      verifyYouTubeVideo("AbC123xYz01", adapterFor(null, true))
    ).resolves.toMatchObject({ status: "UNREACHABLE" });
  });

  it("distinguishes invalid links and missing API configuration", async () => {
    await expect(
      verifyYouTubeVideo("https://example.com/video", null)
    ).resolves.toMatchObject({
      status: "INVALID",
    });
    await expect(
      verifyYouTubeVideo("https://youtu.be/AbC123xYz01", null)
    ).resolves.toMatchObject({ status: "NOT_CONFIGURED" });
  });

  it("allows only freshly verified embeddable public or unlisted videos", async () => {
    const unlisted = await verifyYouTubeVideo(
      "https://youtu.be/AbC123xYz01",
      adapterFor(unlistedVideo)
    );
    const publicVideo = await verifyYouTubeVideo(
      "https://youtu.be/AbC123xYz01",
      adapterFor({ ...unlistedVideo, privacyStatus: "PUBLIC" })
    );
    const privateVideo = await verifyYouTubeVideo(
      "https://youtu.be/AbC123xYz01",
      adapterFor({ ...unlistedVideo, privacyStatus: "PRIVATE" })
    );
    const nonEmbeddable = await verifyYouTubeVideo(
      "https://youtu.be/AbC123xYz01",
      adapterFor({ ...unlistedVideo, embeddable: false })
    );

    expect(youtubePublicationIssue(unlisted)).toBeNull();
    expect(youtubePublicationIssue(publicVideo)).toBeNull();
    expect(youtubePublicationIssue(privateVideo)).toContain(
      "privado ou não foi encontrado"
    );
    expect(youtubePublicationIssue(nonEmbeddable)).toContain("incorporação");
    expect(
      youtubePublicationIssue(
        await verifyYouTubeVideo("https://youtu.be/AbC123xYz01", null)
      )
    ).toContain("Configure a chave");
  });
});
