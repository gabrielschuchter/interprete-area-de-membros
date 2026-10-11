"use client";

import { BellIcon, BellOffIcon } from "lucide-react";
import {
  toggleTopicFollow,
  toggleTopicMute,
} from "@/app/(authenticated)/comunidade/actions";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "../mutations/single-flight-form";

interface CommunityDiscussionFollowProperties {
  readonly isFollowing: boolean;
  readonly isMuted: boolean;
  readonly postId: string;
  readonly spaceSlug: string;
}

export function CommunityDiscussionFollow({
  isFollowing,
  isMuted,
  postId,
  spaceSlug,
}: CommunityDiscussionFollowProperties) {
  const muted = isFollowing && isMuted;
  const action = isFollowing ? toggleTopicMute : toggleTopicFollow;
  const desired = muted ? "off" : "on";
  let ariaLabel = "Seguir discussão";
  let wideLabel = "Seguir discussão";
  let shortLabel = "Seguir";
  if (isFollowing) {
    ariaLabel = "Silenciar discussão";
    wideLabel = "Seguindo discussão";
    shortLabel = "Seguindo";
  }
  if (muted) {
    ariaLabel = "Ativar notificações da discussão";
    wideLabel = "Silenciada";
    shortLabel = "Silenciada";
  }

  return (
    <SingleFlightForm action={action}>
      <input name="postId" type="hidden" value={postId} />
      <input name="spaceSlug" type="hidden" value={spaceSlug} />
      <input name="desired" type="hidden" value={desired} />
      <SingleFlightSubmit
        aria-label={ariaLabel}
        className={[
          "community-follow-button",
          isFollowing && !muted && "is-following",
          muted && "is-muted",
        ]
          .filter(Boolean)
          .join(" ")}
        pendingLabel="Salvando…"
        size="sm"
        variant="ghost"
      >
        {muted ? (
          <BellOffIcon aria-hidden="true" />
        ) : (
          <BellIcon aria-hidden="true" />
        )}
        <span className="community-follow-button__wide-label">{wideLabel}</span>
        <span className="community-follow-button__short-label">
          {shortLabel}
        </span>
      </SingleFlightSubmit>
    </SingleFlightForm>
  );
}
