import { z } from "zod";
import {
  parseYouTubeDuration,
  safeYouTubeThumbnailUrl,
  type YouTubeDataAdapter,
  type YouTubePlaylistItem,
  type YouTubePlaylistPage,
  type YouTubeVideoMetadata,
} from "./youtube-verification";

const thumbnailSchema = z.object({ url: z.string().optional() }).passthrough();
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

const privacyStatusFrom = (
  value: "public" | "unlisted" | "private" | undefined
) => {
  if (value === "public") {
    return "PUBLIC" as const;
  }
  if (value === "unlisted") {
    return "UNLISTED" as const;
  }
  if (value === "private") {
    return "PRIVATE" as const;
  }
  return "UNKNOWN" as const;
};

const captionsAvailableFrom = (value: string | undefined) => {
  if (value === "true") {
    return true;
  }
  return value === "false" ? false : null;
};

const videoSchema = z
  .object({
    id: z.string(),
    snippet: z
      .object({
        title: z.string().optional(),
        thumbnails: z
          .object({
            maxres: thumbnailSchema.optional(),
            standard: thumbnailSchema.optional(),
            high: thumbnailSchema.optional(),
            medium: thumbnailSchema.optional(),
            default: thumbnailSchema.optional(),
          })
          .optional(),
      })
      .optional(),
    contentDetails: z
      .object({
        duration: z.string().optional(),
        caption: z.string().optional(),
      })
      .optional(),
    status: z
      .object({
        privacyStatus: z.enum(["public", "unlisted", "private"]).optional(),
        embeddable: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough();

const videosResponseSchema = z
  .object({ items: z.array(videoSchema).default([]) })
  .passthrough();

const playlistItemSchema = z
  .object({
    snippet: z
      .object({
        position: z.number().int().nonnegative(),
        title: z.string(),
        thumbnails: z
          .object({
            maxres: thumbnailSchema.optional(),
            standard: thumbnailSchema.optional(),
            high: thumbnailSchema.optional(),
            medium: thumbnailSchema.optional(),
            default: thumbnailSchema.optional(),
          })
          .optional(),
        resourceId: z.object({ videoId: z.string().optional() }).optional(),
      })
      .optional(),
  })
  .passthrough();

const playlistResponseSchema = z
  .object({
    items: z.array(playlistItemSchema).default([]),
    nextPageToken: z.string().optional(),
    pageInfo: z
      .object({ totalResults: z.number().int().nonnegative() })
      .optional(),
  })
  .passthrough();

const thumbnailFrom = (value: {
  readonly maxres?: { readonly url?: string };
  readonly standard?: { readonly url?: string };
  readonly high?: { readonly url?: string };
  readonly medium?: { readonly url?: string };
  readonly default?: { readonly url?: string };
}) =>
  safeYouTubeThumbnailUrl(
    value.maxres?.url ??
      value.standard?.url ??
      value.high?.url ??
      value.medium?.url ??
      value.default?.url
  );

const metadataFrom = (
  video: z.infer<typeof videoSchema>
): YouTubeVideoMetadata => {
  const privacy = video.status?.privacyStatus;
  return {
    videoId: video.id,
    title: (video.snippet?.title ?? "").slice(0, 1000),
    durationSeconds: video.contentDetails?.duration
      ? parseYouTubeDuration(video.contentDetails.duration)
      : null,
    thumbnailUrl: video.snippet?.thumbnails
      ? thumbnailFrom(video.snippet.thumbnails)
      : null,
    privacyStatus: privacyStatusFrom(privacy),
    embeddable: video.status?.embeddable === true,
    captionsAvailable: captionsAvailableFrom(video.contentDetails?.caption),
  };
};

const readJson = async (response: Response) => {
  if (!response.ok) {
    throw new Error(`YouTube Data API returned ${response.status}`);
  }
  return (await response.json()) as unknown;
};

export const createYouTubeDataApiAdapter = (
  apiKey: string,
  fetchImplementation: typeof fetch = fetch
): YouTubeDataAdapter => {
  const requestJson = async (url: URL) => {
    const response = await fetchImplementation(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    return readJson(response);
  };

  const getVideos = async (ids: string[]) => {
    if (ids.length === 0) {
      return new Map<string, YouTubeVideoMetadata>();
    }
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails,status");
    url.searchParams.set("id", ids.join(","));
    url.searchParams.set("key", apiKey);
    const response = videosResponseSchema.parse(await requestJson(url));
    return new Map(
      response.items.map((video) => [video.id, metadataFrom(video)])
    );
  };

  return {
    source: "API",
    async getVideo(videoId) {
      const videos = await getVideos([videoId]);
      return videos.get(videoId) ?? null;
    },
    async getVideos(videoIds) {
      const uniqueIds = [...new Set(videoIds)];
      const result = new Map<string, YouTubeVideoMetadata>();
      for (let offset = 0; offset < uniqueIds.length; offset += 50) {
        const batch = await getVideos(uniqueIds.slice(offset, offset + 50));
        for (const [videoId, metadata] of batch) {
          result.set(videoId, metadata);
        }
      }
      return result;
    },

    async getPlaylistPage(playlistId, pageToken) {
      const url = new URL(
        "https://www.googleapis.com/youtube/v3/playlistItems"
      );
      url.searchParams.set("part", "snippet,contentDetails");
      url.searchParams.set("playlistId", playlistId);
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("key", apiKey);
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const response = playlistResponseSchema.parse(await requestJson(url));
      const playlistRows: YouTubePlaylistItem[] = response.items.flatMap(
        (item) => {
          const snippet = item.snippet;
          const videoId = snippet?.resourceId?.videoId;
          if (!(snippet && videoId && videoIdPattern.test(videoId))) {
            return [];
          }
          return [
            {
              videoId,
              title: snippet.title.slice(0, 1000),
              position: snippet.position,
              thumbnailUrl: snippet.thumbnails
                ? thumbnailFrom(snippet.thumbnails)
                : null,
              metadata: null,
              importable: false,
            },
          ];
        }
      );
      const metadata = await getVideos(
        playlistRows.map((item) => item.videoId)
      );
      const items = playlistRows.map((item) => {
        const video = metadata.get(item.videoId) ?? null;
        const importable =
          video !== null &&
          video !== undefined &&
          (video.privacyStatus === "PUBLIC" ||
            video.privacyStatus === "UNLISTED");
        return {
          ...item,
          metadata: video,
          importable,
        };
      });

      return {
        items,
        nextPageToken: response.nextPageToken ?? null,
        totalResults: response.pageInfo?.totalResults ?? items.length,
      } satisfies YouTubePlaylistPage;
    },
  };
};
