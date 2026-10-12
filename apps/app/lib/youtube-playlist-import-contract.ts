import { createHash } from "node:crypto";
import type { YouTubePlaylistImportTokenPayload } from "./youtube-playlist-import-token";

type PlaylistImportClaim = Pick<
  YouTubePlaylistImportTokenPayload,
  "playlistId" | "position" | "videoId" | "videoTitle"
>;

export const createYouTubePlaylistImportFingerprint = ({
  claims,
  courseId,
  moduleId,
  status,
  useVideoTitle,
}: {
  readonly claims: readonly PlaylistImportClaim[];
  readonly courseId: string;
  readonly moduleId: string;
  readonly status: string;
  readonly useVideoTitle: boolean;
}) => {
  const orderedClaims = [...claims].sort(
    (left, right) => left.position - right.position
  );
  return createHash("sha256")
    .update(
      JSON.stringify({
        claims: orderedClaims,
        courseId,
        moduleId,
        status,
        useVideoTitle,
      })
    )
    .digest("hex");
};
