import "server-only";

import { env } from "@/env";
import { createYouTubeDataApiAdapter } from "./youtube-data-api";
import type { YouTubeDataAdapter } from "./youtube-verification";

export const getYouTubeDataAdapter = async (): Promise<{
  readonly adapter: YouTubeDataAdapter | null;
  readonly configured: boolean;
}> => {
  if (env.YOUTUBE_DEVELOPMENT_ADAPTER === "true") {
    if (process.env.NODE_ENV !== "development") {
      throw new Error(
        "YOUTUBE_DEVELOPMENT_ADAPTER is allowed only in development."
      );
    }
    const { createYouTubeDevelopmentAdapter } = await import(
      "./youtube-development-adapter"
    );
    return { adapter: createYouTubeDevelopmentAdapter(), configured: true };
  }

  if (!env.YOUTUBE_API_KEY) {
    return { adapter: null, configured: false };
  }

  return {
    adapter: createYouTubeDataApiAdapter(env.YOUTUBE_API_KEY),
    configured: true,
  };
};
