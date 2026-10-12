import { getYoutubeVideoId } from "./youtube-video";

const durationPattern =
  /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i;
const playlistIdPattern = /^[A-Za-z0-9_-]{10,128}$/;

export type YouTubePrivacyStatus =
  | "PUBLIC"
  | "UNLISTED"
  | "PRIVATE"
  | "UNKNOWN";

export type YouTubeVerificationStatus =
  | "UNLISTED"
  | "PUBLIC"
  | "PRIVATE_OR_NOT_FOUND"
  | "EMBEDDING_DISABLED"
  | "INVALID"
  | "UNREACHABLE"
  | "NOT_CONFIGURED";

const youtubeVerificationStatuses: ReadonlySet<string> = new Set([
  "UNLISTED",
  "PUBLIC",
  "PRIVATE_OR_NOT_FOUND",
  "EMBEDDING_DISABLED",
  "INVALID",
  "UNREACHABLE",
  "NOT_CONFIGURED",
]);

export const isYouTubeVerificationStatus = (
  value: string | null | undefined
): value is YouTubeVerificationStatus =>
  typeof value === "string" && youtubeVerificationStatuses.has(value);

export interface YouTubeVideoMetadata {
  readonly captionsAvailable: boolean | null;
  readonly durationSeconds: number | null;
  readonly embeddable: boolean;
  readonly privacyStatus: YouTubePrivacyStatus;
  readonly thumbnailUrl: string | null;
  readonly title: string;
  readonly videoId: string;
}

export interface YouTubePlaylistItem {
  readonly importable: boolean;
  readonly metadata: YouTubeVideoMetadata | null;
  readonly position: number;
  readonly thumbnailUrl: string | null;
  readonly title: string;
  readonly videoId: string;
}

export interface YouTubePlaylistPage {
  readonly items: YouTubePlaylistItem[];
  readonly nextPageToken: string | null;
  readonly totalResults: number;
}

export interface YouTubeDataAdapter {
  getPlaylistPage(
    playlistId: string,
    pageToken?: string | null
  ): Promise<YouTubePlaylistPage>;
  getVideo(videoId: string): Promise<YouTubeVideoMetadata | null>;
  getVideos(
    videoIds: readonly string[]
  ): Promise<ReadonlyMap<string, YouTubeVideoMetadata>>;
  readonly source?: "API" | "DEVELOPMENT" | "TEST";
}

export const isYouTubePlaylistItemImportable = (
  metadata: YouTubeVideoMetadata | null
) =>
  metadata !== null &&
  (metadata.privacyStatus === "PUBLIC" ||
    metadata.privacyStatus === "UNLISTED");

export interface YouTubeVerificationResult {
  readonly metadata: YouTubeVideoMetadata | null;
  readonly source: "API" | "DEVELOPMENT" | "TEST" | "NOT_CONFIGURED";
  readonly status: YouTubeVerificationStatus;
  readonly videoId: string | null;
}

export const parseYouTubeDuration = (value: string): number | null => {
  const match = value.match(durationPattern);
  if (!match) {
    return null;
  }

  const [, days, hours, minutes, seconds] = match;
  const total =
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);
  return Number.isFinite(total) && total >= 0 ? Math.floor(total) : null;
};

export const safeYouTubeThumbnailUrl = (value: string | undefined) => {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "i.ytimg.com"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export const classifyYouTubeMetadata = (
  metadata: YouTubeVideoMetadata
): YouTubeVerificationStatus => {
  if (metadata.privacyStatus === "PRIVATE") {
    return "PRIVATE_OR_NOT_FOUND";
  }
  if (!metadata.embeddable) {
    return "EMBEDDING_DISABLED";
  }
  if (metadata.privacyStatus === "UNLISTED") {
    return "UNLISTED";
  }
  if (metadata.privacyStatus === "PUBLIC") {
    return "PUBLIC";
  }
  return "UNREACHABLE";
};

export const verifyYouTubeVideo = async (
  input: string,
  adapter: YouTubeDataAdapter | null
): Promise<YouTubeVerificationResult> => {
  const videoId = getYoutubeVideoId(input);
  if (!videoId) {
    return {
      status: "INVALID",
      source: adapter?.source ?? "NOT_CONFIGURED",
      videoId: null,
      metadata: null,
    };
  }
  if (!adapter) {
    return {
      status: "NOT_CONFIGURED",
      source: "NOT_CONFIGURED",
      videoId,
      metadata: null,
    };
  }

  try {
    const metadata = await adapter.getVideo(videoId);
    if (!metadata) {
      // With an API key and no channel OAuth, private and missing videos are
      // intentionally indistinguishable.
      return {
        status: "PRIVATE_OR_NOT_FOUND",
        source: adapter.source ?? "API",
        videoId,
        metadata: null,
      };
    }
    return {
      status: classifyYouTubeMetadata(metadata),
      source: adapter.source ?? "API",
      videoId,
      metadata,
    };
  } catch {
    return {
      status: "UNREACHABLE",
      source: adapter.source ?? "API",
      videoId,
      metadata: null,
    };
  }
};

export const parseYouTubePlaylistId = (input: string) => {
  try {
    const url = new URL(input.trim());
    if (
      url.protocol !== "https:" ||
      !["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
        url.hostname
      ) ||
      url.pathname !== "/playlist"
    ) {
      return null;
    }
    const playlistId = url.searchParams.get("list") ?? "";
    return playlistIdPattern.test(playlistId) ? playlistId : null;
  } catch {
    return null;
  }
};
