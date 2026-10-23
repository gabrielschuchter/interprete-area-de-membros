// Pure rules for how the room opens a lesson video. The server resolves the
// initial state; the client only adds transient states (loading, playing...).

export type VideoAvailability = "ok" | "unchecked" | "broken" | "missing";

export type InitialPlayerState =
  | "idle"
  | "resume"
  | "unavailable"
  | "no_video"
  | "locked";

export interface RoomVideo {
  readonly availability: VideoAvailability;
  readonly durationSeconds: number | null;
  readonly endSeconds: number | null;
  readonly startSeconds: number | null;
}

export interface RoomPlaybackPosition {
  readonly durationSeconds: number | null;
  readonly positionSeconds: number;
}

export const RESUME_MIN_SECONDS = 20;
export const RESUME_TAIL_SECONDS = 20;

const brokenYoutubeStatuses: ReadonlySet<string> = new Set([
  "PRIVATE_OR_NOT_FOUND",
  "EMBEDDING_DISABLED",
  "INVALID",
]);
const okYoutubeStatuses: ReadonlySet<string> = new Set(["PUBLIC", "UNLISTED"]);

interface VideoAssetAvailabilityInput {
  readonly externalUrl: string | null;
  readonly mediaExternalId: string | null;
  readonly mediaProvider: "STORAGE" | "YOUTUBE" | "EXTERNAL_URL";
  readonly storagePath: string | null;
  readonly youtubeVerificationStatus: string | null;
}

// UNREACHABLE and NOT_CONFIGURED say nothing about the video itself, so they
// stay "unchecked" (played as ok) instead of blaming the lesson.
export const videoAssetAvailability = (
  asset: VideoAssetAvailabilityInput
): VideoAvailability => {
  if (asset.mediaProvider === "YOUTUBE") {
    if (!asset.mediaExternalId) {
      return "missing";
    }
    if (
      asset.youtubeVerificationStatus &&
      brokenYoutubeStatuses.has(asset.youtubeVerificationStatus)
    ) {
      return "broken";
    }
    return asset.youtubeVerificationStatus &&
      okYoutubeStatuses.has(asset.youtubeVerificationStatus)
      ? "ok"
      : "unchecked";
  }
  if (asset.mediaProvider === "EXTERNAL_URL") {
    return asset.externalUrl ? "unchecked" : "missing";
  }
  return asset.storagePath ? "ok" : "missing";
};

const videoEndSeconds = (
  video: Pick<RoomVideo, "durationSeconds" | "endSeconds">,
  position: Pick<RoomPlaybackPosition, "durationSeconds">
) => video.endSeconds ?? video.durationSeconds ?? position.durationSeconds;

export const isResumable = (
  position: RoomPlaybackPosition,
  video: Pick<RoomVideo, "durationSeconds" | "endSeconds" | "startSeconds">
) => {
  const start = video.startSeconds ?? 0;
  if (
    position.positionSeconds <
    Math.max(RESUME_MIN_SECONDS, start + RESUME_MIN_SECONDS)
  ) {
    return false;
  }
  const end = videoEndSeconds(video, position);
  return end === null || position.positionSeconds <= end - RESUME_TAIL_SECONDS;
};

export const resolveInitialPlayerState = ({
  now,
  position,
  releasesAt,
  startAtSeconds,
  video,
}: {
  readonly now: Date;
  readonly position: RoomPlaybackPosition;
  readonly releasesAt: Date | null;
  readonly startAtSeconds: number | null;
  readonly video: RoomVideo | null;
}): InitialPlayerState => {
  if (releasesAt && releasesAt.getTime() > now.getTime()) {
    return "locked";
  }
  if (!video || video.availability === "missing") {
    return "no_video";
  }
  if (video.availability === "broken") {
    return "unavailable";
  }
  if (startAtSeconds !== null) {
    return "idle";
  }
  return isResumable(position, video) ? "resume" : "idle";
};

export const effectiveStartSeconds = ({
  choice,
  position,
  startAtSeconds,
  video,
}: {
  readonly choice: "resume" | "beginning" | "default";
  readonly position: Pick<RoomPlaybackPosition, "positionSeconds">;
  readonly startAtSeconds: number | null;
  readonly video: Pick<RoomVideo, "startSeconds">;
}) => {
  const base = video.startSeconds ?? 0;
  if (startAtSeconds !== null) {
    return Math.max(base, startAtSeconds);
  }
  return choice === "resume" ? Math.max(base, position.positionSeconds) : base;
};

const startAtPattern = /^\d{1,6}$/;

// ?t= is honoured only as a whole, non-negative second inside the video.
export const parseStartAt = (
  raw: string | readonly string[] | null | undefined,
  durationSeconds: number | null
) => {
  if (typeof raw !== "string" || !startAtPattern.test(raw)) {
    return null;
  }
  const seconds = Number.parseInt(raw, 10);
  return durationSeconds !== null && seconds >= durationSeconds
    ? null
    : seconds;
};
