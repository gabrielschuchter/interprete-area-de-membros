import "server-only";

import type { YouTubeDataAdapter } from "./youtube-verification";

const demoVideos = [
  {
    videoId: "AbC123xYz01",
    title: "Demonstração · vídeo não listado",
    durationSeconds: 872,
    privacyStatus: "UNLISTED" as const,
    embeddable: true,
    captionsAvailable: true,
    thumbnailUrl: null,
  },
  {
    videoId: "AbC123xYz02",
    title: "Demonstração · vídeo público",
    durationSeconds: 420,
    privacyStatus: "PUBLIC" as const,
    embeddable: true,
    captionsAvailable: false,
    thumbnailUrl: null,
  },
  {
    videoId: "AbC123xYz03",
    title: "Demonstração · vídeo com incorporação desativada",
    durationSeconds: 600,
    privacyStatus: "UNLISTED" as const,
    embeddable: false,
    captionsAvailable: null,
    thumbnailUrl: null,
  },
];

export const createYouTubeDevelopmentAdapter = (): YouTubeDataAdapter => ({
  source: "DEVELOPMENT",
  getVideo(videoId) {
    return Promise.resolve(
      demoVideos.find((video) => video.videoId === videoId) ?? null
    );
  },
  getPlaylistPage(playlistId, pageToken) {
    if (playlistId !== "PLGestaoDevFixture01" || pageToken) {
      return Promise.resolve({
        items: [],
        nextPageToken: null,
        totalResults: 0,
      });
    }
    return Promise.resolve({
      items: demoVideos.map((video, position) => ({
        videoId: video.videoId,
        title: video.title,
        position,
        thumbnailUrl: video.thumbnailUrl,
        metadata: video,
        importable: video.embeddable,
      })),
      nextPageToken: null,
      totalResults: demoVideos.length,
    });
  },
});
