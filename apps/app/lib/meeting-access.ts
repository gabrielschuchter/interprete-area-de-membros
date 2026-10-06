import type { LearningAccessScope } from "./content-access";
import { getYoutubeVideoId } from "./youtube-video";

interface MeetingReadPolicy {
  readonly _count: { readonly participants: number };
  readonly course: { readonly id: string } | null;
  readonly participants: readonly { readonly memberId: string }[];
}

export const canReadMeeting = (
  meeting: MeetingReadPolicy,
  memberId: string,
  scope: Pick<LearningAccessScope, "courseIds" | "fullAccess">
) => {
  if (scope.fullAccess) {
    return true;
  }
  if (meeting._count.participants > 0) {
    return meeting.participants.some(
      (participant) => participant.memberId === memberId
    );
  }
  return !meeting.course || scope.courseIds.has(meeting.course.id);
};

export const safeMeetingRecordingUrl = (value: string | null) => {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export const hasConfiguredExternalRecordingSource = (asset: {
  readonly externalUrl: string | null;
  readonly kind: string;
  readonly mediaExternalId: string | null;
  readonly mediaProvider: string;
}) => {
  if (asset.kind !== "VIDEO") {
    return false;
  }
  if (asset.mediaProvider === "YOUTUBE") {
    return Boolean(
      asset.mediaExternalId && getYoutubeVideoId(asset.mediaExternalId)
    );
  }
  return (
    asset.mediaProvider === "EXTERNAL_URL" &&
    Boolean(safeMeetingRecordingUrl(asset.externalUrl))
  );
};
