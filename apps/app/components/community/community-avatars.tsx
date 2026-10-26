"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { useEffect, useState } from "react";

const MAX_VISIBLE_AVATARS = 7;
const ROTATION_INTERVAL_MS = 6500;

export interface CommunityAvatarVisual {
  readonly avatarUrl: string | null;
  readonly initials: string;
}

export const rotateCommunityAvatarVisuals = (
  avatars: readonly CommunityAvatarVisual[],
  offset: number
) => {
  if (avatars.length <= MAX_VISIBLE_AVATARS) {
    return [...avatars];
  }

  const start = ((offset % avatars.length) + avatars.length) % avatars.length;
  return Array.from(
    { length: MAX_VISIBLE_AVATARS },
    (_, index) => avatars[(start + index) % avatars.length]
  ).filter((avatar): avatar is CommunityAvatarVisual => Boolean(avatar));
};

export const CommunityAvatars = ({
  avatars,
}: {
  readonly avatars: readonly CommunityAvatarVisual[];
}) => {
  const [rotationOffset, setRotationOffset] = useState(0);

  useEffect(() => {
    setRotationOffset(0);
    if (avatars.length <= MAX_VISIBLE_AVATARS) {
      return;
    }

    let timer: number | undefined;
    const clearRotation = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const syncRotation = () => {
      clearRotation();
      if (document.visibilityState === "visible") {
        timer = window.setInterval(
          () => setRotationOffset((current) => current + 1),
          ROTATION_INTERVAL_MS
        );
      }
    };

    document.addEventListener("visibilitychange", syncRotation);
    syncRotation();
    return () => {
      clearRotation();
      document.removeEventListener("visibilitychange", syncRotation);
    };
  }, [avatars.length]);

  const visibleAvatars = rotateCommunityAvatarVisuals(avatars, rotationOffset);

  return (
    <div
      aria-hidden="true"
      className="community-avatars mt-3"
      data-testid="community-avatars"
    >
      {visibleAvatars.map((avatar, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: each position is a decorative slot whose avatar rotates; the slot has no local state.
        <span className="community-avatars__item" key={index}>
          <Avatar className="community-avatars__image">
            {avatar.avatarUrl ? (
              <AvatarImage alt="" loading="lazy" src={avatar.avatarUrl} />
            ) : null}
            <AvatarFallback className="bg-brand-structural text-[0.65rem] text-primary-foreground">
              {avatar.initials}
            </AvatarFallback>
          </Avatar>
        </span>
      ))}
    </div>
  );
};
